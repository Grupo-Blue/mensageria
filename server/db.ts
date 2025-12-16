import { eq, and, desc, lt, or, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  InsertUser,
  users,
  whatsappGroups,
  whatsappConnections,
  telegramConnections,
  messages,
  settings,
  Settings,
  InsertWhatsappConnection,
  InsertTelegramConnection,
  InsertMessage,
  InsertSettings,
  whatsappBusinessAccounts,
  InsertWhatsappBusinessAccount,
  campaigns,
  Campaign,
  InsertCampaign,
  campaignRecipients,
  InsertCampaignRecipient,
  whatsappTemplates,
  InsertWhatsappTemplate
} from "../drizzle/schema";
import { ENV } from './_core/env';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;
let _connection: mysql.Connection | null = null;

function parseDatabaseUrl(url: string): {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
} {
  try {
    const parsedUrl = new URL(url);
    return {
      host: parsedUrl.hostname,
      port: parseInt(parsedUrl.port) || 3306,
      user: parsedUrl.username,
      password: parsedUrl.password,
      database: parsedUrl.pathname.replace(/^\//, ''),
    };
  } catch (error) {
    throw new Error(`Invalid DATABASE_URL format: ${url}. Error: ${error}`);
  }
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // Parsear a URL de conexão
      const connectionConfig = parseDatabaseUrl(process.env.DATABASE_URL);
      
      console.log("[Database] Attempting to connect to MySQL:", {
        host: connectionConfig.host,
        port: connectionConfig.port,
        database: connectionConfig.database,
        user: connectionConfig.user,
      });
      
      // Criar conexão MySQL2
      _connection = await mysql.createConnection(connectionConfig);
      _db = drizzle(_connection, { mode: 'default' });
      console.log("[Database] Connected successfully to:", connectionConfig.database);
      
      // Testar a conexão
      await _connection.execute('SELECT 1');
    } catch (error: any) {
      console.error("[Database] Failed to connect to MySQL");
      console.error("[Database] Error code:", error?.code);
      console.error("[Database] Error message:", error?.message);
      
      if (error?.code === 'ECONNREFUSED') {
        console.error("[Database] Connection refused. Possible causes:");
        console.error("  1. MySQL server is not running");
        console.error("  2. MySQL is running on a different port");
        console.error("  3. Firewall is blocking the connection");
        console.error("  4. Wrong host/port in DATABASE_URL");
        console.error("");
        console.error("[Database] To start MySQL on macOS:");
        console.error("  - Using Homebrew: brew services start mysql");
        console.error("  - Using Docker: docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=password mysql:8");
        console.error("");
        console.error("[Database] Current DATABASE_URL:", process.env.DATABASE_URL);
      }
      
      _db = null;
      _connection = null;
      throw error;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    // Determinar o role
    const role = user.role || (user.openId === ENV.ownerOpenId ? 'admin' : 'user');
    const lastSignedIn = user.lastSignedIn || new Date();

    const values: InsertUser = {
      openId: user.openId,
      role: role,
      lastSignedIn: lastSignedIn,
    };

    const updateSet: Record<string, unknown> = {
      role: role,
      lastSignedIn: lastSignedIn,
    };

    // Adicionar campos opcionais
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value !== undefined) {
        const normalized = value ?? null;
        values[field] = normalized;
        updateSet[field] = normalized;
      }
    };

    textFields.forEach(assignNullable);

    console.log("[Database] Upserting user with values:", JSON.stringify(values, null, 2));
    console.log("[Database] Update set:", JSON.stringify(updateSet, null, 2));

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
    
    console.log("[Database] User upserted successfully");
  } catch (error: any) {
    console.error("[Database] Failed to upsert user:", error);
    console.error("[Database] User data:", {
      openId: user.openId,
      name: user.name,
      email: user.email,
      loginMethod: user.loginMethod,
      role: user.role || (user.openId === ENV.ownerOpenId ? 'admin' : 'user'),
    });
    
    // Se for erro de conexão, tentar reconectar
    if (error?.code === 'ECONNREFUSED' || error?.code === 'PROTOCOL_CONNECTION_LOST') {
      console.log("[Database] Connection lost, attempting to reconnect...");
      _db = null;
      _connection = null;
    }
    
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// WhatsApp Groups
export async function upsertWhatsappGroup(sessionId: string, groupId: string, groupName: string, lastMessageAt?: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const timestamp = lastMessageAt || new Date();
  const existing = await db.select().from(whatsappGroups)
    .where(and(eq(whatsappGroups.sessionId, sessionId), eq(whatsappGroups.groupId, groupId)))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(whatsappGroups)
      .set({ groupName, lastMessageAt: timestamp })
      .where(and(eq(whatsappGroups.sessionId, sessionId), eq(whatsappGroups.groupId, groupId)));
  } else {
    await db.insert(whatsappGroups).values({ sessionId, groupId, groupName, lastMessageAt: timestamp });
  }
}

export async function getWhatsappGroups() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(whatsappGroups).orderBy(desc(whatsappGroups.lastMessageAt));
}

export async function getWhatsappConnections(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(whatsappConnections).where(eq(whatsappConnections.userId, userId));
}

export async function createWhatsappConnection(connection: InsertWhatsappConnection) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(whatsappConnections).values(connection);
}

export async function updateWhatsappConnection(id: number, data: Partial<InsertWhatsappConnection>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(whatsappConnections).set(data).where(eq(whatsappConnections.id, id));
}

export async function deleteWhatsappConnection(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(whatsappConnections).where(eq(whatsappConnections.id, id));
}

export async function getWhatsappConnectionByIdentification(identification: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(whatsappConnections).where(eq(whatsappConnections.identification, identification)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Telegram Connections
export async function getTelegramConnections(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(telegramConnections).where(eq(telegramConnections.userId, userId));
}

export async function createTelegramConnection(connection: InsertTelegramConnection) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(telegramConnections).values(connection);
}

export async function updateTelegramConnection(id: number, data: Partial<InsertTelegramConnection>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(telegramConnections).set(data).where(eq(telegramConnections.id, id));
}

export async function deleteTelegramConnection(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(telegramConnections).where(eq(telegramConnections.id, id));
}

// Messages
export async function getMessages(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(messages).where(eq(messages.userId, userId)).orderBy(desc(messages.sentAt)).limit(limit);
}

export async function createMessage(message: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(messages).values(message);
}

export async function updateMessageStatus(id: number, status: "sent" | "failed" | "pending", errorMessage?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(messages).set({ status, errorMessage }).where(eq(messages.id, id));
}

// Settings
export async function getUserSettings(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
  
  // Se não existir, criar registro default
  if (result.length === 0) {
    const defaultSettings: InsertSettings = {
      userId,
      resumeHourOfDay: 22,
      enableGroupResume: false,
    };
    await db.insert(settings).values(defaultSettings);
    return defaultSettings as Settings;
  }
  
  return result[0];
}

export async function upsertUserSettings(userId: number, data: Partial<InsertSettings>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getUserSettings(userId);
  
  if (existing) {
    await db.update(settings).set(data).where(eq(settings.userId, userId));
  } else {
    await db.insert(settings).values({ userId, ...data });
  }
}

// Webhook Configuration
export async function getWebhookConfig(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const { webhookConfig } = await import("../drizzle/schema");
  const result = await db.select().from(webhookConfig).where(eq(webhookConfig.userId, userId)).limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertWebhookConfig(userId: number, data: { webhookUrl: string; webhookSecret: string; enabled: boolean; connectionName: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { webhookConfig } = await import("../drizzle/schema");
  const existing = await getWebhookConfig(userId);
  
  if (existing) {
    await db.update(webhookConfig).set(data).where(eq(webhookConfig.userId, userId));
  } else {
    await db.insert(webhookConfig).values({ userId, ...data });
  }
}

// Webhook Logs
export async function getWebhookLogs(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  const { webhookLogs, webhookConfig } = await import("../drizzle/schema");
  
  // Join com webhook_config para filtrar por userId
  const result = await db
    .select({
      id: webhookLogs.id,
      fromNumber: webhookLogs.fromNumber,
      messageId: webhookLogs.messageId,
      text: webhookLogs.text,
      status: webhookLogs.status,
      response: webhookLogs.response,
      errorMessage: webhookLogs.errorMessage,
      createdAt: webhookLogs.createdAt,
    })
    .from(webhookLogs)
    .innerJoin(webhookConfig, eq(webhookLogs.webhookConfigId, webhookConfig.id))
    .where(eq(webhookConfig.userId, userId))
    .orderBy(desc(webhookLogs.createdAt))
    .limit(limit);
  
  return result;
}

// =====================================================
// WhatsApp Business Accounts
// =====================================================

export async function getWhatsappBusinessAccounts(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(whatsappBusinessAccounts).where(eq(whatsappBusinessAccounts.userId, userId));
}

export async function getWhatsappBusinessAccountById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(whatsappBusinessAccounts).where(eq(whatsappBusinessAccounts.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createWhatsappBusinessAccount(account: InsertWhatsappBusinessAccount) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(whatsappBusinessAccounts).values(account);
  return result[0].insertId;
}

export async function updateWhatsappBusinessAccount(id: number, data: Partial<InsertWhatsappBusinessAccount>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(whatsappBusinessAccounts).set(data).where(eq(whatsappBusinessAccounts.id, id));
}

export async function deleteWhatsappBusinessAccount(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(whatsappBusinessAccounts).where(eq(whatsappBusinessAccounts.id, id));
}

// =====================================================
// Campaigns
// =====================================================

export async function getCampaigns(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(campaigns).where(eq(campaigns.userId, userId)).orderBy(desc(campaigns.createdAt));
}

export async function getCampaignById(id: number): Promise<Campaign | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCampaign(campaign: InsertCampaign): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(campaigns).values(campaign);
  return result[0].insertId;
}

export async function updateCampaign(id: number, data: Partial<InsertCampaign>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(campaigns).set(data).where(eq(campaigns.id, id));
}

export async function deleteCampaign(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete recipients first
  await db.delete(campaignRecipients).where(eq(campaignRecipients.campaignId, id));
  // Then delete campaign
  await db.delete(campaigns).where(eq(campaigns.id, id));
}

// =====================================================
// Campaign Recipients
// =====================================================

export async function getCampaignRecipients(campaignId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(campaignRecipients).where(eq(campaignRecipients.campaignId, campaignId));
}

export async function getCampaignRecipientsByStatus(campaignId: number, status: "pending" | "sent" | "delivered" | "read" | "failed") {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(campaignRecipients)
    .where(and(eq(campaignRecipients.campaignId, campaignId), eq(campaignRecipients.status, status)));
}

export async function addCampaignRecipients(recipients: InsertCampaignRecipient[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (recipients.length === 0) return;

  await db.insert(campaignRecipients).values(recipients);
}

export async function updateCampaignRecipient(id: number, data: Partial<InsertCampaignRecipient>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(campaignRecipients).set(data).where(eq(campaignRecipients.id, id));
}

export async function updateCampaignRecipientByMessageId(whatsappMessageId: string, data: Partial<InsertCampaignRecipient>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(campaignRecipients).set(data).where(eq(campaignRecipients.whatsappMessageId, whatsappMessageId));
}

export async function deleteCampaignRecipients(campaignId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(campaignRecipients).where(eq(campaignRecipients.campaignId, campaignId));
}

export async function getFailedRecipientsForRetry(campaignId: number, maxRetries: number, retryDelayMinutes: number) {
  const db = await getDb();
  if (!db) return [];

  const retryThreshold = new Date(Date.now() - retryDelayMinutes * 60 * 1000);

  // Get failed recipients that haven't exceeded max retries and have waited long enough
  return await db.select().from(campaignRecipients)
    .where(and(
      eq(campaignRecipients.campaignId, campaignId),
      eq(campaignRecipients.status, "failed"),
      lt(campaignRecipients.retryCount, maxRetries),
      or(
        isNull(campaignRecipients.lastRetryAt),
        lt(campaignRecipients.lastRetryAt, retryThreshold)
      )
    ));
}

export async function incrementRecipientRetryCount(recipientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(campaignRecipients)
    .set({
      retryCount: sql`${campaignRecipients.retryCount} + 1`,
      lastRetryAt: new Date(),
      status: "pending", // Reset status for retry
      errorMessage: null,
    })
    .where(eq(campaignRecipients.id, recipientId));
}

export async function resetRecipientForRetry(recipientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(campaignRecipients)
    .set({
      status: "pending",
      errorMessage: null,
      whatsappMessageId: null,
      sentAt: null,
    })
    .where(eq(campaignRecipients.id, recipientId));
}

export async function getRecipientsRetryStats(campaignId: number) {
  const db = await getDb();
  if (!db) return { totalFailed: 0, retriable: 0, maxRetriesReached: 0 };

  const campaign = await getCampaignById(campaignId);
  if (!campaign) return { totalFailed: 0, retriable: 0, maxRetriesReached: 0 };

  const failedRecipients = await db.select().from(campaignRecipients)
    .where(and(
      eq(campaignRecipients.campaignId, campaignId),
      eq(campaignRecipients.status, "failed")
    ));

  const retriable = failedRecipients.filter(r => r.retryCount < campaign.maxRetries).length;
  const maxRetriesReached = failedRecipients.filter(r => r.retryCount >= campaign.maxRetries).length;

  return {
    totalFailed: failedRecipients.length,
    retriable,
    maxRetriesReached,
  };
}

// =====================================================
// WhatsApp Templates
// =====================================================

export async function getWhatsappTemplates(businessAccountId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(whatsappTemplates).where(eq(whatsappTemplates.businessAccountId, businessAccountId));
}

export async function getWhatsappTemplateByName(businessAccountId: number, templateName: string) {
  const db = await getDb();
  if (!db) return null;

  const results = await db.select()
    .from(whatsappTemplates)
    .where(and(
      eq(whatsappTemplates.businessAccountId, businessAccountId),
      eq(whatsappTemplates.name, templateName)
    ))
    .limit(1);
  
  return results[0] || null;
}

export async function upsertWhatsappTemplates(businessAccountId: number, templates: Omit<InsertWhatsappTemplate, "businessAccountId">[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  for (const template of templates) {
    const existing = await db.select().from(whatsappTemplates)
      .where(and(
        eq(whatsappTemplates.businessAccountId, businessAccountId),
        eq(whatsappTemplates.templateId, template.templateId)
      ))
      .limit(1);

    if (existing.length > 0) {
      await db.update(whatsappTemplates)
        .set({ ...template })
        .where(eq(whatsappTemplates.id, existing[0].id));
    } else {
      await db.insert(whatsappTemplates).values({ ...template, businessAccountId });
    }
  }
}

export async function deleteWhatsappTemplates(businessAccountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(whatsappTemplates).where(eq(whatsappTemplates.businessAccountId, businessAccountId));
}
