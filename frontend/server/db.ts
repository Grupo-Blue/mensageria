import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import crypto from "crypto";
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
  webhookConfig,
  webhookLogs,
} from "../drizzle/schema";
import { ENV } from './_core/env';

/**
 * Generate a secure API key
 */
export function generateApiKey(prefix: string = 'conn'): string {
  const randomPart = crypto.randomBytes(24).toString('hex');
  return `${prefix}_${randomPart}`;
}

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
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
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
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

// ============================================
// Multi-tenant API functions
// ============================================

/**
 * Get all WhatsApp connections with their webhook configurations
 * Used by backend to sync token cache
 */
export async function getAllWhatsappConnectionsWithWebhooks() {
  const db = await getDb();
  if (!db) return [];

  const connections = await db.select().from(whatsappConnections);

  // For each connection, get the webhook config if exists
  const result = await Promise.all(
    connections.map(async (conn) => {
      const webhook = await db
        .select()
        .from(webhookConfig)
        .where(
          and(
            eq(webhookConfig.userId, conn.userId),
            eq(webhookConfig.connectionName, conn.identification)
          )
        )
        .limit(1);

      return {
        id: conn.id,
        identification: conn.identification,
        apiKey: conn.apiKey,
        userId: conn.userId,
        webhookUrl: conn.webhookUrl || webhook[0]?.webhookUrl || null,
        webhookSecret: conn.webhookSecret || webhook[0]?.webhookSecret || null,
        status: conn.status,
      };
    })
  );

  return result;
}

/**
 * Update WhatsApp connection by identification (name)
 */
export async function updateWhatsappConnectionByIdentification(
  identification: string,
  data: Partial<InsertWhatsappConnection>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(whatsappConnections)
    .set(data)
    .where(eq(whatsappConnections.identification, identification));
}

/**
 * Generate and set API key for a WhatsApp connection
 */
export async function generateConnectionApiKey(connectionId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const apiKey = generateApiKey('conn');

  await db
    .update(whatsappConnections)
    .set({ apiKey })
    .where(eq(whatsappConnections.id, connectionId));

  return apiKey;
}

/**
 * Generate and set API key for a user
 */
export async function generateUserApiKey(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const apiKey = generateApiKey('user');

  await db
    .update(users)
    .set({ apiKey })
    .where(eq(users.id, userId));

  return apiKey;
}

/**
 * Get user by API key
 */
export async function getUserByApiKey(apiKey: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.apiKey, apiKey))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get WhatsApp connection by API key
 */
export async function getWhatsappConnectionByApiKey(apiKey: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(whatsappConnections)
    .where(eq(whatsappConnections.apiKey, apiKey))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Create webhook log entry
 */
export async function createWebhookLog(data: {
  connectionName: string;
  fromNumber: string;
  messageId: string;
  text: string;
  status: "success" | "error";
  response?: string;
  errorMessage?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Find webhook config by connection name
  const config = await db
    .select()
    .from(webhookConfig)
    .where(eq(webhookConfig.connectionName, data.connectionName))
    .limit(1);

  if (!config.length) {
    console.warn(`[WebhookLog] No webhook config found for connection: ${data.connectionName}`);
    return;
  }

  await db.insert(webhookLogs).values({
    webhookConfigId: config[0].id,
    fromNumber: data.fromNumber,
    messageId: data.messageId,
    text: data.text,
    status: data.status,
    response: data.response,
    errorMessage: data.errorMessage,
  });
}

/**
 * Update connection webhook settings
 */
export async function updateConnectionWebhook(
  connectionId: number,
  data: { webhookUrl?: string; webhookSecret?: string }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(whatsappConnections)
    .set(data)
    .where(eq(whatsappConnections.id, connectionId));
}
