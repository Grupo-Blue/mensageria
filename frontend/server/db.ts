import { eq, and, desc } from "drizzle-orm";
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
  InsertSettings
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
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
