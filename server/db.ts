import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  whatsappGroups,
  whatsappConnections,
  telegramConnections,
  messages,
  settings,
  InsertWhatsappConnection,
  InsertTelegramConnection,
  InsertMessage,
  InsertSettings
} from "../drizzle/schema";
import { ENV } from './_core/env';

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
export async function upsertWhatsappGroup(groupId: string, groupName: string, connectionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db.select().from(whatsappGroups).where(eq(whatsappGroups.groupId, groupId)).limit(1);
  
  if (existing.length > 0) {
    await db.update(whatsappGroups)
      .set({ groupName, lastMessageAt: new Date() })
      .where(eq(whatsappGroups.groupId, groupId));
  } else {
    await db.insert(whatsappGroups).values({ groupId, groupName, connectionId, lastMessageAt: new Date() });
  }
}

export async function getWhatsappGroups() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(whatsappGroups).orderBy(whatsappGroups.lastMessageAt);
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
  return result.length > 0 ? result[0] : undefined;
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
