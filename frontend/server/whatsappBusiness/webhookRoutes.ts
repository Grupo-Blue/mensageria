import { Router, Request, Response } from "express";
import { MetaWhatsAppApi } from "./metaApi";
import * as db from "../db";

const router = Router();

// Store recent webhook events for debugging (last 50 events)
const recentWebhookEvents: Array<{
  timestamp: Date;
  origin?: string;
  userAgent?: string;
  ip?: string;
  body: any;
  isFromChatwoot: boolean;
}> = [];

const MAX_RECENT_EVENTS = 50;

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
 * Also accepts requests from Chatwoot (https://atendimento.grupoblue.com.br/) without token
 */
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const body = req.body;
    
    // Get request origin/referer for validation
    // Note: Server-to-server webhooks may not send origin/referer headers
    const origin = req.get("origin") || req.get("referer") || "";
    const userAgent = req.get("user-agent") || "";
    const forwardedFor = req.get("x-forwarded-for") || "";
    const realIp = req.get("x-real-ip") || "";
    const clientIp = req.ip || realIp || forwardedFor.split(",")[0] || "";
    
    // Check if request is from Chatwoot
    // Since Chatwoot doesn't send authorization token, we'll be more permissive
    // and check multiple indicators
    const isFromChatwoot = 
      origin.includes("atendimento.grupoblue.com.br") || 
      userAgent.includes("Chatwoot") ||
      clientIp?.includes("atendimento.grupoblue.com.br") ||
      // If no authorization header is present, might be from Chatwoot
      (!req.get("authorization") && !req.get("x-webhook-signature"));

    // Log the incoming webhook for debugging
    const webhookEvent = {
      timestamp: new Date(),
      origin,
      userAgent,
      ip: req.ip,
      body: JSON.parse(JSON.stringify(body)), // Deep clone
      isFromChatwoot,
    };
    
    // Store in recent events (keep only last MAX_RECENT_EVENTS)
    recentWebhookEvents.unshift(webhookEvent);
    if (recentWebhookEvents.length > MAX_RECENT_EVENTS) {
      recentWebhookEvents.pop();
    }
    
    console.log("[WhatsApp Business Webhook] Received event:", {
      timestamp: webhookEvent.timestamp.toISOString(),
      origin,
      userAgent,
      ip: req.ip,
      isFromChatwoot,
      bodyKeys: Object.keys(body),
      bodyPreview: JSON.stringify(body).substring(0, 500),
    });

    // If coming from Chatwoot, accept without token validation
    if (isFromChatwoot) {
      console.log("[WhatsApp Business Webhook] Request from Chatwoot - accepting without token validation");
    }

    // Validate it's a WhatsApp webhook (Meta format)
    // If it's from Chatwoot or doesn't have authorization, accept it anyway
    // (Chatwoot doesn't send authorization tokens)
    const hasAuthorization = req.get("authorization") || req.get("x-webhook-signature");
    
    if (!isFromChatwoot && !hasAuthorization && body.object !== "whatsapp_business_account") {
      console.log("[WhatsApp Business Webhook] Not a WhatsApp event, not from Chatwoot, and no auth - might be Chatwoot, accepting anyway");
      // Accept anyway - might be Chatwoot without proper headers
    } else if (!isFromChatwoot && hasAuthorization && body.object !== "whatsapp_business_account") {
      console.log("[WhatsApp Business Webhook] Not a WhatsApp event and has auth - ignoring");
      res.sendStatus(200);
      return;
    }

    // Process each entry (Meta format)
    if (body.entry && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
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
    } else {
      // Handle other webhook formats (Chatwoot, etc.)
      // If no entry array, might be a different format
      console.log("[WhatsApp Business Webhook] Processing non-Meta webhook format");
      console.log("[WhatsApp Business Webhook] Webhook body structure:", {
        hasEntry: !!body.entry,
        hasStatus: !!body.status,
        hasMessageStatus: !!body.message_status,
        bodyKeys: Object.keys(body),
      });
      
      // Log the full body for debugging (truncated to avoid huge logs)
      const bodyStr = JSON.stringify(body, null, 2);
      console.log("[WhatsApp Business Webhook] Full webhook body (first 2000 chars):", bodyStr.substring(0, 2000));
      
      // Try to process Chatwoot format if detected
      if (body.status || body.message_status) {
        const status = body.status || body.message_status;
        if (status.messageId || status.id) {
          console.log("[WhatsApp Business Webhook] Processing status update from alternative format");
          await processStatusUpdate({
            id: status.messageId || status.id,
            status: status.status || status.state,
            timestamp: status.timestamp || Math.floor(Date.now() / 1000).toString(),
            recipient_id: status.recipient || status.to,
            errors: status.errors,
          });
        }
      }
      
      // Try to process message if in alternative format
      if (body.message && !body.entry) {
        console.log("[WhatsApp Business Webhook] Processing message from alternative format");
        await processIncomingMessage(
          body.message,
          body.phone_number_id || body.phoneNumberId
        );
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

/**
 * GET /api/whatsapp-business/webhook/logs
 * Get recent webhook events for debugging
 * No authentication required (for debugging purposes)
 */
router.get("/webhook/logs", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const events = recentWebhookEvents.slice(0, limit);
    
    res.json({
      success: true,
      total: recentWebhookEvents.length,
      events: events.map(e => ({
        timestamp: e.timestamp.toISOString(),
        origin: e.origin,
        userAgent: e.userAgent,
        ip: e.ip,
        isFromChatwoot: e.isFromChatwoot,
        bodyKeys: Object.keys(e.body),
        bodyPreview: JSON.stringify(e.body).substring(0, 1000),
      })),
    });
  } catch (error: any) {
    console.error("[WhatsApp Business Webhook] Error getting logs:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
