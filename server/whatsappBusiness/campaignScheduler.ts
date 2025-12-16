import * as db from "../db";
import { MetaWhatsAppApi, mapVariablesToOrderedArray, BodyParam } from "../whatsappBusiness/metaApi";

// Special marker for variables that should use recipient name
const RECIPIENT_NAME_MARKER = "__RECIPIENT_NAME__";

/**
 * Process template variables, replacing recipient name markers with actual recipient name
 */
function processVariablesWithRecipientName(
  templateVariables: Record<string, string>,
  recipientName: string | null | undefined
): Record<string, string> {
  const processed: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(templateVariables)) {
    if (value === RECIPIENT_NAME_MARKER) {
      // Use recipient name or fallback to empty string
      processed[key] = recipientName || "";
    } else {
      processed[key] = value;
    }
  }
  
  return processed;
}

let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Campaign Scheduler Service
 * Checks for scheduled campaigns and executes them when their scheduled time arrives
 * Also handles automatic retries for failed messages
 */
export class CampaignScheduler {
  private static instance: CampaignScheduler | null = null;
  private isRunning = false;
  private checkIntervalMs = 60000; // Check every minute

  private constructor() {}

  static getInstance(): CampaignScheduler {
    if (!CampaignScheduler.instance) {
      CampaignScheduler.instance = new CampaignScheduler();
    }
    return CampaignScheduler.instance;
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.isRunning) {
      console.log("[CampaignScheduler] Already running");
      return;
    }

    this.isRunning = true;
    console.log("[CampaignScheduler] Started - checking every", this.checkIntervalMs / 1000, "seconds");

    // Run immediately on start
    this.runScheduledTasks();

    // Then run periodically
    schedulerInterval = setInterval(() => {
      this.runScheduledTasks();
    }, this.checkIntervalMs);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (schedulerInterval) {
      clearInterval(schedulerInterval);
      schedulerInterval = null;
    }
    this.isRunning = false;
    console.log("[CampaignScheduler] Stopped");
  }

  /**
   * Run all scheduled tasks
   */
  private async runScheduledTasks() {
    await this.checkScheduledCampaigns();
    await this.processAutoRetries();
  }

  /**
   * Check for campaigns that need to be executed
   */
  private async checkScheduledCampaigns() {
    try {
      const dbInstance = await db.getDb();
      if (!dbInstance) {
        return;
      }

      const { campaigns } = await import("../../drizzle/schema");
      const { eq, and, lte } = await import("drizzle-orm");

      // Find campaigns that are scheduled and their time has come
      const now = new Date();
      const scheduledCampaigns = await dbInstance
        .select()
        .from(campaigns)
        .where(
          and(
            eq(campaigns.status, "scheduled"),
            lte(campaigns.scheduledAt, now)
          )
        );

      if (scheduledCampaigns.length > 0) {
        console.log(`[CampaignScheduler] Found ${scheduledCampaigns.length} campaigns to execute`);
      }

      // Execute each scheduled campaign
      for (const campaign of scheduledCampaigns) {
        await this.executeCampaign(campaign);
      }
    } catch (error) {
      console.error("[CampaignScheduler] Error checking scheduled campaigns:", error);
    }
  }

  /**
   * Process automatic retries for failed messages
   */
  private async processAutoRetries() {
    try {
      const dbInstance = await db.getDb();
      if (!dbInstance) {
        return;
      }

      const { campaigns } = await import("../../drizzle/schema");
      const { eq, or } = await import("drizzle-orm");

      // Find campaigns that have auto retry enabled and are completed or paused
      const campaignsForRetry = await dbInstance
        .select()
        .from(campaigns)
        .where(
          eq(campaigns.autoRetryEnabled, true)
        );

      for (const campaign of campaignsForRetry) {
        // Skip if campaign is still running or scheduled
        if (campaign.status === "running" || campaign.status === "scheduled" || campaign.status === "draft") {
          continue;
        }

        // Get failed recipients eligible for retry
        const failedRecipients = await db.getFailedRecipientsForRetry(
          campaign.id,
          campaign.maxRetries,
          campaign.retryDelayMinutes
        );

        if (failedRecipients.length > 0) {
          console.log(`[CampaignScheduler] Found ${failedRecipients.length} failed recipients to retry for campaign ${campaign.id}`);
          await this.retryFailedRecipients(campaign, failedRecipients);
        }
      }
    } catch (error) {
      console.error("[CampaignScheduler] Error processing auto retries:", error);
    }
  }

  /**
   * Get template body text for variable ordering
   */
  private async getTemplateBodyText(accountId: number, templateName: string): Promise<string> {
    const template = await db.getWhatsappTemplateByName(accountId, templateName);
    if (!template) return "";
    
    try {
      const components = JSON.parse(template.components);
      const bodyComponent = components.find((c: any) => c.type === "BODY");
      return bodyComponent?.text || "";
    } catch {
      return "";
    }
  }

  /**
   * Build body params from variables in correct order
   */
  private buildBodyParams(
    mergedVariables: Record<string, string>,
    templateBodyText: string
  ): BodyParam[] | undefined {
    if (Object.keys(mergedVariables).length === 0 || !templateBodyText) {
      return undefined;
    }
    
    const bodyParams = mapVariablesToOrderedArray(templateBodyText, mergedVariables);
    // Return undefined if all values are empty
    if (bodyParams.every(p => !p.value)) {
      return undefined;
    }
    return bodyParams;
  }

  /**
   * Retry sending messages to failed recipients
   */
  private async retryFailedRecipients(
    campaign: {
      id: number;
      userId: number;
      businessAccountId: number;
      templateName: string;
      templateLanguage: string;
      templateVariables: string | null;
      maxRetries: number;
    },
    recipients: Array<{
      id: number;
      phoneNumber: string;
      name: string | null;
      variables: string | null;
      retryCount: number;
    }>
  ) {
    try {
      // Get the business account
      const account = await db.getWhatsappBusinessAccountById(campaign.businessAccountId);
      if (!account) {
        console.error(`[CampaignScheduler] Business account ${campaign.businessAccountId} not found for retry`);
        return;
      }

      // Parse template variables
      const templateVariables = campaign.templateVariables
        ? JSON.parse(campaign.templateVariables)
        : {};

      // Get template body text for variable ordering
      const templateBodyText = await this.getTemplateBodyText(account.id, campaign.templateName);

      const api = new MetaWhatsAppApi(account.phoneNumberId, account.accessToken);

      let successCount = 0;
      let failCount = 0;

      for (const recipient of recipients) {
        const retryNumber = recipient.retryCount + 1;
        console.log(`[CampaignScheduler] Retrying ${recipient.phoneNumber} (attempt ${retryNumber}/${campaign.maxRetries})`);

        try {
          // Increment retry count and reset status to pending
          await db.incrementRecipientRetryCount(recipient.id);

          // Process template variables, replacing recipient name markers
          const processedTemplateVars = processVariablesWithRecipientName(
            templateVariables,
            recipient.name
          );

          // Merge template variables with recipient-specific variables
          const recipientVariables = recipient.variables
            ? JSON.parse(recipient.variables)
            : {};
          const mergedVariables = { ...processedTemplateVars, ...recipientVariables };

          // Build body params from variables in correct order
          const bodyParams = this.buildBodyParams(mergedVariables, templateBodyText);

          const result = await api.sendTemplateMessage({
            phoneNumberId: account.phoneNumberId,
            accessToken: account.accessToken,
            recipientPhone: recipient.phoneNumber,
            templateName: campaign.templateName,
            templateLanguage: campaign.templateLanguage,
            bodyParams,
          });

          await db.updateCampaignRecipient(recipient.id, {
            status: "sent",
            whatsappMessageId: result.messages[0]?.id,
            sentAt: new Date(),
            errorMessage: null,
          });

          successCount++;
          console.log(`[CampaignScheduler] Retry successful for ${recipient.phoneNumber}`);

          // Rate limiting: wait 100ms between messages
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error: any) {
          await db.updateCampaignRecipient(recipient.id, {
            status: "failed",
            errorMessage: `Retry ${retryNumber} failed: ${error.message}`,
          });
          failCount++;
          console.error(`[CampaignScheduler] Retry failed for ${recipient.phoneNumber}:`, error.message);
        }
      }

      // Update campaign stats
      const allRecipients = await db.getCampaignRecipients(campaign.id);
      await db.updateCampaign(campaign.id, {
        sentCount: allRecipients.filter((r: any) =>
          r.status === "sent" || r.status === "delivered" || r.status === "read"
        ).length,
        failedCount: allRecipients.filter((r: any) => r.status === "failed").length,
      });

      console.log(`[CampaignScheduler] Retry batch completed for campaign ${campaign.id}: ${successCount} success, ${failCount} failed`);
    } catch (error) {
      console.error(`[CampaignScheduler] Error retrying recipients for campaign ${campaign.id}:`, error);
    }
  }

  /**
   * Manually trigger retry for a specific campaign
   */
  async manualRetry(campaignId: number): Promise<{ success: number; failed: number; skipped: number }> {
    const campaign = await db.getCampaignById(campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    // Get all failed recipients regardless of retry delay
    const dbInstance = await db.getDb();
    if (!dbInstance) {
      throw new Error("Database not available");
    }

    const { campaignRecipients } = await import("../../drizzle/schema");
    const { eq, and, lt } = await import("drizzle-orm");

    const failedRecipients = await dbInstance
      .select()
      .from(campaignRecipients)
      .where(
        and(
          eq(campaignRecipients.campaignId, campaignId),
          eq(campaignRecipients.status, "failed"),
          lt(campaignRecipients.retryCount, campaign.maxRetries)
        )
      );

    if (failedRecipients.length === 0) {
      return { success: 0, failed: 0, skipped: 0 };
    }

    const account = await db.getWhatsappBusinessAccountById(campaign.businessAccountId);
    if (!account) {
      throw new Error("Business account not found");
    }

    const templateVariables = campaign.templateVariables
      ? JSON.parse(campaign.templateVariables)
      : {};

    // Get template body text for variable ordering
    const templateBodyText = await this.getTemplateBodyText(account.id, campaign.templateName);

    const api = new MetaWhatsAppApi(account.phoneNumberId, account.accessToken);

    let success = 0;
    let failed = 0;
    const skipped = 0;

    for (const recipient of failedRecipients) {
      const retryNumber = recipient.retryCount + 1;

      try {
        await db.incrementRecipientRetryCount(recipient.id);

        // Process template variables, replacing recipient name markers
        const processedTemplateVars = processVariablesWithRecipientName(
          templateVariables,
          recipient.name
        );

        const recipientVariables = recipient.variables
          ? JSON.parse(recipient.variables)
          : {};
        const mergedVariables = { ...processedTemplateVars, ...recipientVariables };
        const bodyParams = this.buildBodyParams(mergedVariables, templateBodyText);

        const result = await api.sendTemplateMessage({
          phoneNumberId: account.phoneNumberId,
          accessToken: account.accessToken,
          recipientPhone: recipient.phoneNumber,
          templateName: campaign.templateName,
          templateLanguage: campaign.templateLanguage,
          bodyParams,
        });

        await db.updateCampaignRecipient(recipient.id, {
          status: "sent",
          whatsappMessageId: result.messages[0]?.id,
          sentAt: new Date(),
          errorMessage: null,
        });

        success++;
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error: any) {
        await db.updateCampaignRecipient(recipient.id, {
          status: "failed",
          errorMessage: `Manual retry ${retryNumber} failed: ${error.message}`,
        });
        failed++;
      }
    }

    // Update campaign stats
    const allRecipients = await db.getCampaignRecipients(campaignId);
    await db.updateCampaign(campaignId, {
      sentCount: allRecipients.filter((r: any) =>
        r.status === "sent" || r.status === "delivered" || r.status === "read"
      ).length,
      failedCount: allRecipients.filter((r: any) => r.status === "failed").length,
    });

    return { success, failed, skipped };
  }

  /**
   * Execute a scheduled campaign
   */
  private async executeCampaign(campaign: {
    id: number;
    userId: number;
    businessAccountId: number;
    templateName: string;
    templateLanguage: string;
    templateVariables: string | null;
  }) {
    console.log(`[CampaignScheduler] Executing campaign ${campaign.id}: ${campaign.templateName}`);

    try {
      // Get the business account
      const account = await db.getWhatsappBusinessAccountById(campaign.businessAccountId);
      if (!account) {
        console.error(`[CampaignScheduler] Business account ${campaign.businessAccountId} not found`);
        await db.updateCampaign(campaign.id, {
          status: "failed",
          completedAt: new Date(),
        });
        return;
      }

      // Get pending recipients
      const recipients = await db.getCampaignRecipientsByStatus(campaign.id, "pending");
      if (recipients.length === 0) {
        console.log(`[CampaignScheduler] No pending recipients for campaign ${campaign.id}`);
        await db.updateCampaign(campaign.id, {
          status: "completed",
          completedAt: new Date(),
        });
        return;
      }

      // Update campaign status to running
      await db.updateCampaign(campaign.id, {
        status: "running",
        startedAt: new Date(),
      });

      // Parse template variables
      const templateVariables = campaign.templateVariables
        ? JSON.parse(campaign.templateVariables)
        : {};

      // Get template body text for variable ordering
      const templateBodyText = await this.getTemplateBodyText(account.id, campaign.templateName);

      const api = new MetaWhatsAppApi(account.phoneNumberId, account.accessToken);

      // Send messages to all pending recipients
      let sentCount = 0;
      let failedCount = 0;

      for (const recipient of recipients) {
        try {
          // Process template variables, replacing recipient name markers
          const processedTemplateVars = processVariablesWithRecipientName(
            templateVariables,
            recipient.name
          );

          // Merge template variables with recipient-specific variables
          const recipientVariables = recipient.variables
            ? JSON.parse(recipient.variables)
            : {};
          const mergedVariables = { ...processedTemplateVars, ...recipientVariables };

          // Build body params from variables in correct order
          const bodyParams = this.buildBodyParams(mergedVariables, templateBodyText);

          const result = await api.sendTemplateMessage({
            phoneNumberId: account.phoneNumberId,
            accessToken: account.accessToken,
            recipientPhone: recipient.phoneNumber,
            templateName: campaign.templateName,
            templateLanguage: campaign.templateLanguage,
            bodyParams,
          });

          await db.updateCampaignRecipient(recipient.id, {
            status: "sent",
            whatsappMessageId: result.messages[0]?.id,
            sentAt: new Date(),
          });

          sentCount++;
          console.log(`[CampaignScheduler] Sent to ${recipient.phoneNumber}`);

          // Rate limiting: wait 100ms between messages
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error: any) {
          await db.updateCampaignRecipient(recipient.id, {
            status: "failed",
            errorMessage: error.message,
          });
          failedCount++;
          console.error(`[CampaignScheduler] Failed to send to ${recipient.phoneNumber}:`, error.message);
        }
      }

      // Update campaign stats
      const allRecipients = await db.getCampaignRecipients(campaign.id);
      const pendingCount = allRecipients.filter((r: any) => r.status === "pending").length;

      await db.updateCampaign(campaign.id, {
        sentCount: allRecipients.filter((r: any) =>
          r.status === "sent" || r.status === "delivered" || r.status === "read"
        ).length,
        failedCount: allRecipients.filter((r: any) => r.status === "failed").length,
        status: pendingCount === 0 ? "completed" : "running",
        completedAt: pendingCount === 0 ? new Date() : undefined,
      });

      console.log(`[CampaignScheduler] Campaign ${campaign.id} completed: ${sentCount} sent, ${failedCount} failed`);
    } catch (error) {
      console.error(`[CampaignScheduler] Error executing campaign ${campaign.id}:`, error);
      await db.updateCampaign(campaign.id, {
        status: "failed",
        completedAt: new Date(),
      });
    }
  }
}

// Export singleton instance
export const campaignScheduler = CampaignScheduler.getInstance();
