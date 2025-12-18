import { Router, Request, Response } from "express";
import { MetaWhatsAppApi } from "./metaApi";
import * as db from "../db";

const router = Router();

/**
 * Webhook verification endpoint (GET)
 * Meta sends a GET request to verify the webhook URL
 */
router.get("/webhook", async (req: Request, res: Response) => {
  const mode = req.query["hub.mode"] as string;
  const token = req.query["hub.verify_token"] as string;
  const challenge = req.query["hub.challenge"] as string;

  console.log("[WhatsApp Business Webhook] Verification request:", { mode, token });

  // Get the verify token from any active business account
  // In production, you might want to store this in environment variables
  const accounts = await db.getWhatsappBusinessAccounts(0); // Get all accounts

  // Check if token matches any account's webhook verify token
  // For now, we'll use a simple token check
  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "mensageria_webhook_token";

  if (mode === "subscribe" && token === expectedToken) {
    console.log("[WhatsApp Business Webhook] Verification successful");
    res.status(200).send(challenge);
  } else {
    console.log("[WhatsApp Business Webhook] Verification failed");
    res.sendStatus(403);
  }
});

/**
 * Webhook events endpoint (POST)
 * Meta sends message status updates here
 */
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const body = req.body;

    // Log the incoming webhook for debugging
    console.log("[WhatsApp Business Webhook] Received event:", JSON.stringify(body, null, 2));

    // Validate it's a WhatsApp webhook
    if (body.object !== "whatsapp_business_account") {
      console.log("[WhatsApp Business Webhook] Not a WhatsApp event, ignoring");
      res.sendStatus(200);
      return;
    }

    // Process each entry
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;

        // Handle message status updates
        if (value?.statuses) {
          for (const status of value.statuses) {
            await processStatusUpdate(status);
          }
        }

        // Handle incoming messages - process opt-out requests
        if (value?.messages) {
          for (const message of value.messages) {
            console.log("[WhatsApp Business Webhook] Incoming message:", {
              from: message.from,
              type: message.type,
              timestamp: message.timestamp,
            });

            // Process the message for opt-out keywords
            await processIncomingMessage(message, value.metadata?.phone_number_id);
          }
        }
      }
    }

    // Always return 200 to acknowledge receipt
    res.sendStatus(200);
  } catch (error) {
    console.error("[WhatsApp Business Webhook] Error processing event:", error);
    // Still return 200 to prevent Meta from retrying
    res.sendStatus(200);
  }
});

/**
 * Process a message status update from Meta
 */
async function processStatusUpdate(status: {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string; message: string }>;
}) {
  const { id: messageId, status: statusType, timestamp, errors } = status;

  console.log("[WhatsApp Business Webhook] Status update:", {
    messageId,
    status: statusType,
    timestamp,
    errors,
  });

  try {
    // Map Meta status to our status
    let newStatus: "sent" | "delivered" | "read" | "failed";
    let updateData: Record<string, any> = {};

    switch (statusType) {
      case "sent":
        newStatus = "sent";
        updateData.sentAt = new Date(parseInt(timestamp) * 1000);
        break;
      case "delivered":
        newStatus = "delivered";
        updateData.deliveredAt = new Date(parseInt(timestamp) * 1000);
        break;
      case "read":
        newStatus = "read";
        updateData.readAt = new Date(parseInt(timestamp) * 1000);
        break;
      case "failed":
        newStatus = "failed";
        if (errors && errors.length > 0) {
          updateData.errorMessage = errors.map(e => `${e.title}: ${e.message}`).join("; ");
        }
        break;
      default:
        console.log("[WhatsApp Business Webhook] Unknown status type:", statusType);
        return;
    }

    // Update recipient status by WhatsApp message ID
    await db.updateCampaignRecipientByMessageId(messageId, {
      status: newStatus,
      ...updateData,
    });

    // Update campaign counters
    await updateCampaignCounters(messageId);

    console.log("[WhatsApp Business Webhook] Updated recipient status:", {
      messageId,
      newStatus,
    });
  } catch (error) {
    console.error("[WhatsApp Business Webhook] Error updating status:", error);
  }
}

/**
 * Process incoming message for opt-out keywords
 */
async function processIncomingMessage(
  message: {
    from: string;
    type: string;
    timestamp: string;
    text?: { body: string };
  },
  phoneNumberId?: string
) {
  try {
    // Only process text messages
    if (message.type !== "text" || !message.text?.body) {
      return;
    }

    const messageText = message.text.body;
    const fromPhone = message.from;

    // Check if this is an opt-out message
    const optOutResult = db.isOptOutMessage(messageText);
    if (!optOutResult.isOptOut || !optOutResult.reason) {
      console.log("[WhatsApp Business Webhook] Message is not an opt-out request");
      return;
    }

    console.log("[WhatsApp Business Webhook] Opt-out request detected:", {
      from: fromPhone,
      message: messageText,
      reason: optOutResult.reason,
    });

    // Find the business account by phone_number_id
    let businessAccountId: number | null = null;

    if (phoneNumberId) {
      const dbInstance = await db.getDb();
      if (dbInstance) {
        const { whatsappBusinessAccounts } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        const accounts = await dbInstance
          .select()
          .from(whatsappBusinessAccounts)
          .where(eq(whatsappBusinessAccounts.phoneNumberId, phoneNumberId))
          .limit(1);

        if (accounts.length > 0) {
          businessAccountId = accounts[0].id;
        }
      }
    }

    if (!businessAccountId) {
      // Try to find by matching any active account
      const accounts = await db.getWhatsappBusinessAccounts(0);
      const activeAccount = accounts.find(a => a.isActive);
      if (activeAccount) {
        businessAccountId = activeAccount.id;
      }
    }

    if (!businessAccountId) {
      console.error("[WhatsApp Business Webhook] Could not find business account for opt-out");
      return;
    }

    // Add to blacklist
    const result = await db.addToBlacklist({
      businessAccountId,
      phoneNumber: fromPhone,
      reason: optOutResult.reason,
      originalMessage: messageText,
    });

    if (result.alreadyBlacklisted) {
      console.log("[WhatsApp Business Webhook] Phone already blacklisted:", fromPhone);
    } else {
      console.log("[WhatsApp Business Webhook] Added to blacklist:", fromPhone);
    }
  } catch (error) {
    console.error("[WhatsApp Business Webhook] Error processing incoming message:", error);
  }
}

/**
 * Update campaign counters based on recipient statuses
 */
async function updateCampaignCounters(messageId: string) {
  try {
    // First, find the campaign ID for this message
    // We need to query the recipient to get the campaign ID
    const dbInstance = await db.getDb();
    if (!dbInstance) return;

    const { campaignRecipients, campaigns } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    // Find the recipient with this message ID
    const recipients = await dbInstance
      .select()
      .from(campaignRecipients)
      .where(eq(campaignRecipients.whatsappMessageId, messageId))
      .limit(1);

    if (recipients.length === 0) {
      console.log("[WhatsApp Business Webhook] No recipient found for message:", messageId);
      return;
    }

    const recipient = recipients[0];
    const campaignId = recipient.campaignId;

    // Get all recipients for this campaign to count statuses
    const allRecipients = await db.getCampaignRecipients(campaignId);

    const counts = {
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
    };

    for (const r of allRecipients) {
      switch (r.status) {
        case "sent":
          counts.sentCount++;
          break;
        case "delivered":
          counts.deliveredCount++;
          counts.sentCount++; // Delivered implies sent
          break;
        case "read":
          counts.readCount++;
          counts.deliveredCount++; // Read implies delivered
          counts.sentCount++; // Read implies sent
          break;
        case "failed":
          counts.failedCount++;
          break;
      }
    }

    // Check if campaign is completed
    const pendingCount = allRecipients.filter(r => r.status === "pending").length;
    const isCompleted = pendingCount === 0;

    // Update campaign
    await db.updateCampaign(campaignId, {
      ...counts,
      status: isCompleted ? "completed" : undefined,
      completedAt: isCompleted ? new Date() : undefined,
    });

    console.log("[WhatsApp Business Webhook] Updated campaign counters:", {
      campaignId,
      ...counts,
      isCompleted,
    });
  } catch (error) {
    console.error("[WhatsApp Business Webhook] Error updating campaign counters:", error);
  }
}

export default router;
