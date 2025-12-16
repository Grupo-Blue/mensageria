import * as db from "../db";
import { MetaWhatsAppApi } from "../whatsappBusiness/metaApi";

let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Campaign Scheduler Service
 * Checks for scheduled campaigns and executes them when their scheduled time arrives
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
    this.checkScheduledCampaigns();

    // Then run periodically
    schedulerInterval = setInterval(() => {
      this.checkScheduledCampaigns();
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

      const api = new MetaWhatsAppApi(account.phoneNumberId, account.accessToken);

      // Send messages to all pending recipients
      let sentCount = 0;
      let failedCount = 0;

      for (const recipient of recipients) {
        try {
          // Merge template variables with recipient-specific variables
          const recipientVariables = recipient.variables
            ? JSON.parse(recipient.variables)
            : {};
          const mergedVariables = { ...templateVariables, ...recipientVariables };

          // Build body params from variables
          const bodyParams = Object.values(mergedVariables) as string[];

          const result = await api.sendTemplateMessage({
            phoneNumberId: account.phoneNumberId,
            accessToken: account.accessToken,
            recipientPhone: recipient.phoneNumber,
            templateName: campaign.templateName,
            templateLanguage: campaign.templateLanguage,
            bodyParams: bodyParams.length > 0 ? bodyParams : undefined,
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
      const pendingCount = allRecipients.filter((r) => r.status === "pending").length;

      await db.updateCampaign(campaign.id, {
        sentCount: allRecipients.filter((r) =>
          r.status === "sent" || r.status === "delivered" || r.status === "read"
        ).length,
        failedCount: allRecipients.filter((r) => r.status === "failed").length,
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
