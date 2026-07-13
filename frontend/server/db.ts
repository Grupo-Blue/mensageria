import { eq, and, desc, lt, or, isNull, sql, gte, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
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
  whatsappBusinessAccounts,
  InsertWhatsappBusinessAccount,
  campaigns,
  Campaign,
  InsertCampaign,
  campaignRecipients,
  InsertCampaignRecipient,
  whatsappTemplates,
  InsertWhatsappTemplate,
  contactLists,
  ContactList,
  InsertContactList,
  contactListItems,
  ContactListItem,
  InsertContactListItem,
  webhookConfig,
  webhookLogs,
  InsertWebhookLog,
  whatsappBlacklist,
  WhatsappBlacklist,
  InsertWhatsappBlacklist,
  invitations,
  InsertInvitation,
  accountMembers,
  InsertAccountMember,
  baileysCampaigns,
  BaileysCampaign,
  InsertBaileysCampaign,
  baileysCampaignRecipients,
  InsertBaileysCampaignRecipient,
  baileysCampaignConnections,
  webshareProxies,
  WebshareProxy,
  InsertWebshareProxy,
} from "../drizzle/schema";
import { ENV } from './_core/env';

/**
 * Generate a secure API key
 */
export function generateApiKey(prefix: string = 'conn'): string {
  const randomPart = crypto.randomBytes(24).toString('hex');
  return `${prefix}_${randomPart}`;
}

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
    // Decodificar a senha caso tenha sido URL-encoded
    // Isso é necessário quando a senha contém caracteres especiais como &, ^, etc.
    const password = decodeURIComponent(parsedUrl.password);
    
    return {
      host: parsedUrl.hostname,
      port: parseInt(parsedUrl.port) || 3306,
      user: decodeURIComponent(parsedUrl.username),
      password: password,
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
        passwordLength: connectionConfig.password.length,
        passwordHasSpecialChars: /[&^#@%!]/.test(connectionConfig.password),
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
      } else if (error?.code === 'ER_ACCESS_DENIED_ERROR') {
        console.error("[Database] Access denied. Possible causes:");
        console.error("  1. Wrong username or password");
        console.error("  2. Password contains special characters that need URL encoding");
        console.error("  3. User doesn't have permission to access from this IP");
        console.error("");
        console.error("[Database] If your password contains special characters (&, ^, #, @, %, !, etc.),");
        console.error("  they must be URL-encoded in the DATABASE_URL:");
        console.error("  - & becomes %26");
        console.error("  - ^ becomes %5E");
        console.error("  - # becomes %23");
        console.error("  - @ becomes %40");
        console.error("  - % becomes %25");
        console.error("");
        console.error("[Database] Example: mysql://user:pass%26word@host:3306/db");
        console.error("[Database] Current DATABASE_URL (masked):", 
          process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));
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

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
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

export async function getWhatsappConnectionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(whatsappConnections).where(eq(whatsappConnections.id, id)).limit(1);
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

/** Devolve o id da linha criada, para que o chamador possa fechar o status depois do envio. */
export async function createMessage(message: InsertMessage): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(messages).values(message);
  return Number(result.insertId);
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
// Invitations & Account members (convidar usuários)
// =====================================================

export async function createInvitation(invitation: InsertInvitation): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(invitations).values(invitation);
  return result[0].insertId;
}

export async function getInvitationByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(invitations).where(eq(invitations.token, token)).limit(1);
  return rows[0];
}

export async function getInvitationsByInviterId(inviterId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(invitations).where(eq(invitations.inviterId, inviterId)).orderBy(desc(invitations.createdAt));
}

export async function updateInvitation(id: number, data: Partial<InsertInvitation>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(invitations).set(data).where(eq(invitations.id, id));
}

export async function addAccountMember(ownerId: number, memberId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(accountMembers).values({ ownerId, memberId, role: "viewer" });
}

export async function getAccountMembersByOwnerId(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(accountMembers).where(eq(accountMembers.ownerId, ownerId));
}

/** Lista de membros com nome e email do usuário convidado. */
export async function getAccountMembersWithMemberInfo(ownerId: number): Promise<Array<{ id: number; memberId: number; role: string; createdAt: Date; memberName: string | null; memberEmail: string | null }>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: accountMembers.id,
    memberId: accountMembers.memberId,
    role: accountMembers.role,
    createdAt: accountMembers.createdAt,
    memberName: users.name,
    memberEmail: users.email,
  }).from(accountMembers).innerJoin(users, eq(accountMembers.memberId, users.id)).where(eq(accountMembers.ownerId, ownerId));
  return rows.map((r) => ({
    id: r.id,
    memberId: r.memberId,
    role: r.role,
    createdAt: r.createdAt,
    memberName: r.memberName,
    memberEmail: r.memberEmail,
  }));
}

/** Retorna os owner_ids para os quais o usuário é membro (pode ver disparos). */
export async function getOwnerIdsForMember(memberId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ ownerId: accountMembers.ownerId }).from(accountMembers).where(eq(accountMembers.memberId, memberId));
  return rows.map((r) => r.ownerId);
}

export async function isMemberOfOwner(ownerId: number, memberId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(accountMembers).where(and(eq(accountMembers.ownerId, ownerId), eq(accountMembers.memberId, memberId))).limit(1);
  return rows.length > 0;
}

export async function removeAccountMember(ownerId: number, memberId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(accountMembers).where(and(eq(accountMembers.ownerId, ownerId), eq(accountMembers.memberId, memberId)));
}

// =====================================================
// Campaigns
// =====================================================

export async function getCampaigns(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(campaigns).where(eq(campaigns.userId, userId)).orderBy(desc(campaigns.createdAt));
}

/** Campanhas que o usuário pode ver: as suas + as dos donos que o convidaram. */
export async function getCampaignsVisibleToUser(userId: number): Promise<Campaign[]> {
  const db = await getDb();
  if (!db) return [];

  const ownerIds = [userId, ...(await getOwnerIdsForMember(userId))];
  if (ownerIds.length === 0) return [];
  return await db.select().from(campaigns).where(inArray(campaigns.userId, ownerIds)).orderBy(desc(campaigns.createdAt));
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
// Baileys Campaigns (disparo em massa via QR Code)
// =====================================================

/**
 * Conta quantas mensagens já foram enviadas hoje somando todos os disparos
 * Baileys desta conexão. Usado pelo limite diário de aquecimento (warmup).
 *
 * Usa `sentFromConnectionId` (preenchido pelo scheduler ao despachar) como
 * fonte primária. Para campanhas legadas (pré multi-conexão) cujos recipients
 * não têm essa coluna preenchida, faz fallback no `baileysCampaigns.connectionId`.
 */
export async function countBaileysSentTodayForConnection(connectionId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(baileysCampaignRecipients)
    .innerJoin(baileysCampaigns, eq(baileysCampaigns.id, baileysCampaignRecipients.campaignId))
    .where(and(
      or(
        eq(baileysCampaignRecipients.sentFromConnectionId, connectionId),
        and(
          isNull(baileysCampaignRecipients.sentFromConnectionId),
          eq(baileysCampaigns.connectionId, connectionId),
        ),
      ),
      eq(baileysCampaignRecipients.status, "sent"),
      gte(baileysCampaignRecipients.sentAt, startOfDay),
    ));
  return Number(rows[0]?.count ?? 0);
}

/** Campanhas Baileys que o usuário pode ver: as suas + as dos donos que o convidaram. */
export async function getBaileysCampaignsVisibleToUser(userId: number): Promise<BaileysCampaign[]> {
  const db = await getDb();
  if (!db) return [];

  const ownerIds = [userId, ...(await getOwnerIdsForMember(userId))];
  if (ownerIds.length === 0) return [];
  return await db.select().from(baileysCampaigns).where(inArray(baileysCampaigns.userId, ownerIds)).orderBy(desc(baileysCampaigns.createdAt));
}

export async function getBaileysCampaignById(id: number): Promise<BaileysCampaign | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(baileysCampaigns).where(eq(baileysCampaigns.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createBaileysCampaign(campaign: InsertBaileysCampaign): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(baileysCampaigns).values(campaign);
  return result[0].insertId;
}

export async function updateBaileysCampaign(id: number, data: Partial<InsertBaileysCampaign>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(baileysCampaigns).set(data).where(eq(baileysCampaigns.id, id));
}

export async function deleteBaileysCampaign(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete recipients first
  await db.delete(baileysCampaignRecipients).where(eq(baileysCampaignRecipients.campaignId, id));
  // Drop junction rows (multi-conexão) antes de remover a campanha em si.
  await db.delete(baileysCampaignConnections).where(eq(baileysCampaignConnections.campaignId, id));
  // Then delete campaign
  await db.delete(baileysCampaigns).where(eq(baileysCampaigns.id, id));
}

export async function getBaileysCampaignRecipients(campaignId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(baileysCampaignRecipients).where(eq(baileysCampaignRecipients.campaignId, campaignId));
}

export async function getBaileysCampaignRecipientsByStatus(
  campaignId: number,
  status: "pending" | "sent" | "failed",
  limit?: number,
) {
  const db = await getDb();
  if (!db) return [];

  const query = db.select().from(baileysCampaignRecipients)
    .where(and(eq(baileysCampaignRecipients.campaignId, campaignId), eq(baileysCampaignRecipients.status, status)));
  if (typeof limit === "number" && limit > 0) {
    return await query.limit(limit);
  }
  return await query;
}

/**
 * Retorna o próximo destinatário `pending` de uma campanha (LIMIT 1, ordem de
 * inserção). Usado pelo scheduler para evitar carregar a lista inteira a cada
 * iteração do loop de envio.
 */
export async function getNextBaileysPendingRecipient(campaignId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(baileysCampaignRecipients)
    .where(and(
      eq(baileysCampaignRecipients.campaignId, campaignId),
      eq(baileysCampaignRecipients.status, "pending"),
    ))
    .orderBy(baileysCampaignRecipients.id)
    .limit(1);
  return rows.length > 0 ? rows[0] : undefined;
}

/**
 * Contagem agregada (SQL COUNT(*) GROUP BY status) dos destinatários da
 * campanha. Não traz linhas para a memória.
 */
export async function countBaileysRecipientStatuses(
  campaignId: number,
): Promise<{ pending: number; sent: number; failed: number; total: number }> {
  const db = await getDb();
  const out = { pending: 0, sent: 0, failed: 0, total: 0 };
  if (!db) return out;
  const rows = await db
    .select({
      status: baileysCampaignRecipients.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(baileysCampaignRecipients)
    .where(eq(baileysCampaignRecipients.campaignId, campaignId))
    .groupBy(baileysCampaignRecipients.status);
  for (const r of rows as Array<{ status: string; count: number }>) {
    const n = Number(r.count);
    out.total += n;
    if (r.status === "pending" || r.status === "sent" || r.status === "failed") {
      out[r.status] = n;
    }
  }
  return out;
}

/**
 * Conta apenas as mensagens enviadas HOJE para uma campanha específica
 * (SQL COUNT). Usado pelo limite diário por campanha.
 */
export async function countBaileysSentTodayForCampaign(campaignId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(baileysCampaignRecipients)
    .where(and(
      eq(baileysCampaignRecipients.campaignId, campaignId),
      eq(baileysCampaignRecipients.status, "sent"),
      gte(baileysCampaignRecipients.sentAt, startOfDay),
    ));
  return Number(rows[0]?.count ?? 0);
}

export async function addBaileysCampaignRecipients(recipients: InsertBaileysCampaignRecipient[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (recipients.length === 0) return;

  await db.insert(baileysCampaignRecipients).values(recipients);
}

export async function updateBaileysCampaignRecipient(id: number, data: Partial<InsertBaileysCampaignRecipient>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(baileysCampaignRecipients).set(data).where(eq(baileysCampaignRecipients.id, id));
}

export async function deleteBaileysCampaignRecipients(campaignId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(baileysCampaignRecipients).where(eq(baileysCampaignRecipients.campaignId, campaignId));
}

export async function getBaileysFailedRecipientsForRetry(campaignId: number, maxRetries: number, retryDelayMinutes: number) {
  const db = await getDb();
  if (!db) return [];

  const retryThreshold = new Date(Date.now() - retryDelayMinutes * 60 * 1000);

  // Falhas que ainda não esgotaram o limite de tentativas e já esperaram o suficiente
  return await db.select().from(baileysCampaignRecipients)
    .where(and(
      eq(baileysCampaignRecipients.campaignId, campaignId),
      eq(baileysCampaignRecipients.status, "failed"),
      lt(baileysCampaignRecipients.retryCount, maxRetries),
      or(
        isNull(baileysCampaignRecipients.lastRetryAt),
        lt(baileysCampaignRecipients.lastRetryAt, retryThreshold)
      )
    ));
}

export async function incrementBaileysRecipientRetryCount(recipientId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(baileysCampaignRecipients)
    .set({
      retryCount: sql`${baileysCampaignRecipients.retryCount} + 1`,
      lastRetryAt: new Date(),
      status: "pending", // volta para a fila de envio
      errorMessage: null,
    })
    .where(eq(baileysCampaignRecipients.id, recipientId));
}

export async function getBaileysRecipientsRetryStats(campaignId: number) {
  const db = await getDb();
  if (!db) return { totalFailed: 0, retriable: 0, maxRetriesReached: 0 };

  const campaign = await getBaileysCampaignById(campaignId);
  if (!campaign) return { totalFailed: 0, retriable: 0, maxRetriesReached: 0 };

  const failedRecipients = await db.select().from(baileysCampaignRecipients)
    .where(and(
      eq(baileysCampaignRecipients.campaignId, campaignId),
      eq(baileysCampaignRecipients.status, "failed")
    ));

  const retriable = failedRecipients.filter((r: { retryCount: number }) => r.retryCount < campaign.maxRetries).length;
  const maxRetriesReached = failedRecipients.filter((r: { retryCount: number }) => r.retryCount >= campaign.maxRetries).length;

  return {
    totalFailed: failedRecipients.length,
    retriable,
    maxRetriesReached,
  };
}

// =====================================================
// Baileys Campaign × Connections (junction N:N)
// =====================================================

/**
 * IDs das conexões WhatsApp vinculadas a uma campanha (multi-conexão).
 * Para campanhas legadas (pré multi-conexão), retorna [campaign.connectionId]
 * como fallback transparente.
 */
export async function getBaileysCampaignConnectionIds(campaignId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ connectionId: baileysCampaignConnections.connectionId })
    .from(baileysCampaignConnections)
    .where(eq(baileysCampaignConnections.campaignId, campaignId));
  if (rows.length > 0) {
    return rows.map((r: { connectionId: number }) => r.connectionId);
  }
  // Fallback retrocompat: campanhas criadas antes da junction usavam connectionId.
  const campaign = await getBaileysCampaignById(campaignId);
  if (campaign?.connectionId) return [campaign.connectionId];
  return [];
}

/**
 * Substitui o conjunto de conexões da campanha (delete + insert). Usado por
 * `baileysCampaigns.create` e `baileysCampaigns.update` quando o usuário
 * altera as conexões selecionadas.
 */
export async function setBaileysCampaignConnections(campaignId: number, connectionIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(baileysCampaignConnections).where(eq(baileysCampaignConnections.campaignId, campaignId));
  if (connectionIds.length === 0) return;
  const rows = connectionIds.map((connectionId) => ({ campaignId, connectionId }));
  await db.insert(baileysCampaignConnections).values(rows);
}

// =====================================================
// Webshare proxies
// =====================================================

export async function getWebshareProxyById(id: number): Promise<WebshareProxy | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(webshareProxies).where(eq(webshareProxies.id, id)).limit(1);
  return rows[0];
}

/** Proxy atribuído a uma conexão WhatsApp (JOIN via `proxyId`). */
export async function getWebshareProxyForConnection(connectionId: number): Promise<WebshareProxy | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select({ proxy: webshareProxies })
    .from(whatsappConnections)
    .innerJoin(webshareProxies, eq(webshareProxies.id, whatsappConnections.proxyId))
    .where(eq(whatsappConnections.id, connectionId))
    .limit(1);
  return rows[0]?.proxy;
}

/**
 * Próximo proxy disponível para atribuição. Prefere `preferCountry` (ex.: "BR");
 * se não houver, retorna qualquer outro `available` como último recurso.
 */
export async function pickAvailableWebshareProxy(preferCountry?: string): Promise<WebshareProxy | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  if (preferCountry) {
    const preferred = await db
      .select()
      .from(webshareProxies)
      .where(and(eq(webshareProxies.status, "available"), eq(webshareProxies.countryCode, preferCountry)))
      .limit(1);
    if (preferred.length > 0) return preferred[0];
  }
  const any = await db
    .select()
    .from(webshareProxies)
    .where(eq(webshareProxies.status, "available"))
    .limit(1);
  return any[0];
}

export async function updateWebshareProxy(id: number, data: Partial<InsertWebshareProxy>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(webshareProxies).set(data).where(eq(webshareProxies.id, id));
}

/**
 * Upsert por `webshareProxyId` (id externo do Webshare). Usado pelo sync que
 * importa a lista de proxies reservados na conta. Insere novos, atualiza
 * credenciais/host/porta dos existentes.
 */
export async function upsertWebshareProxy(proxy: InsertWebshareProxy): Promise<WebshareProxy | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db
    .select()
    .from(webshareProxies)
    .where(eq(webshareProxies.webshareProxyId, proxy.webshareProxyId))
    .limit(1);
  if (existing.length > 0) {
    const updateFields: Partial<InsertWebshareProxy> = {
      host: proxy.host,
      port: proxy.port,
      username: proxy.username,
      password: proxy.password,
      countryCode: proxy.countryCode,
      lastVerifiedAt: new Date(),
    };
    // Sync revive: proxy que tinha sido marcado `dead` localmente (falha de
    // conexão pontual) e voltou válido no painel Webshare deve voltar ao pool.
    // Sem isso, o pool drenaria com o tempo.
    if (existing[0].status === "dead") {
      updateFields.status = "available";
    }
    await db.update(webshareProxies).set(updateFields).where(eq(webshareProxies.id, existing[0].id));
    return await getWebshareProxyById(existing[0].id);
  }
  const result = await db.insert(webshareProxies).values({ ...proxy, lastVerifiedAt: new Date() });
  return await getWebshareProxyById(result[0].insertId);
}

export async function listWebshareProxies(): Promise<WebshareProxy[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(webshareProxies).orderBy(webshareProxies.id);
}

/**
 * Marca todos os proxies cujos `webshareProxyId` NÃO estão em `keepIds`
 * como `dead`. Usado pelo sync para refletir remoções no painel Webshare.
 */
export async function markMissingWebshareProxiesDead(keepIds: string[]) {
  const db = await getDb();
  if (!db) return;
  if (keepIds.length === 0) {
    await db.update(webshareProxies).set({ status: "dead" });
    return;
  }
  await db.update(webshareProxies)
    .set({ status: "dead" })
    .where(sql`${webshareProxies.webshareProxyId} NOT IN (${sql.join(keepIds.map((id) => sql`${id}`), sql`, `)})`);
}

// =====================================================
// WhatsApp Templates
// =====================================================

export async function getWhatsappTemplates(businessAccountId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(whatsappTemplates).where(eq(whatsappTemplates.businessAccountId, businessAccountId));
}

/**
 * Apelido local dos templates usados por estas campanhas, indexado por "contaId:nomeTemplate".
 * A campanha guarda o nome técnico da Meta (não há FK para o template), então o vínculo é por
 * (conta, nome) — o mesmo par que identifica o template do lado de lá.
 */
export async function getTemplateAliasesForCampaigns(
  items: Array<{ businessAccountId: number; templateName: string }>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const db = await getDb();
  if (!db || items.length === 0) return out;

  const accountIds = Array.from(new Set(items.map((i) => i.businessAccountId)));
  const rows = await db
    .select({
      businessAccountId: whatsappTemplates.businessAccountId,
      name: whatsappTemplates.name,
      alias: whatsappTemplates.alias,
    })
    .from(whatsappTemplates)
    .where(inArray(whatsappTemplates.businessAccountId, accountIds));

  for (const r of rows as Array<{ businessAccountId: number; name: string; alias: string | null }>) {
    if (r.alias) out.set(`${r.businessAccountId}:${r.name}`, r.alias);
  }
  return out;
}

export async function getWhatsappTemplateById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const results = await db.select().from(whatsappTemplates).where(eq(whatsappTemplates.id, id)).limit(1);
  return results[0] || null;
}

/**
 * Grava apenas o apelido e a descrição locais. Nome, idioma e components pertencem à Meta e
 * são sobrescritos a cada sync — por isso não passam por aqui.
 */
export async function updateWhatsappTemplateAlias(
  id: number,
  data: { alias: string | null; description: string | null },
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(whatsappTemplates).set(data).where(eq(whatsappTemplates.id, id));
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

// =====================================================
// Contact Lists
// =====================================================

export async function getContactLists(userId: number): Promise<ContactList[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(contactLists)
    .where(eq(contactLists.userId, userId))
    .orderBy(desc(contactLists.createdAt));
}

export async function getContactListById(id: number): Promise<ContactList | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(contactLists).where(eq(contactLists.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createContactList(list: InsertContactList): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Prepare values, ensuring optional fields are properly handled
  // Don't include fields that are undefined to let MySQL use defaults
  const values: Record<string, any> = {
    userId: list.userId,
    name: list.name,
  };

  // Only include optional fields if they have actual values (not undefined, not null, not empty string)
  if (list.company !== undefined && list.company !== null && String(list.company).trim() !== "") {
    values.company = list.company;
  }
  if (list.description !== undefined && list.description !== null && String(list.description).trim() !== "") {
    values.description = list.description;
  }

  try {
    const result = await db.insert(contactLists).values(values);
    // Handle different return formats from Drizzle
    if (Array.isArray(result) && result.length > 0) {
      return result[0].insertId || (result[0] as any).insertId || result[0];
    }
    return (result as any).insertId || (result as any)[0]?.insertId;
  } catch (error: any) {
    console.error("[createContactList] Error:", error);
    console.error("[createContactList] Values:", JSON.stringify(values, null, 2));
    throw error;
  }
}

export async function updateContactList(id: number, data: Partial<InsertContactList>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(contactLists).set(data).where(eq(contactLists.id, id));
}

export async function deleteContactList(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete all items first
  await db.delete(contactListItems).where(eq(contactListItems.listId, id));
  // Then delete the list
  await db.delete(contactLists).where(eq(contactLists.id, id));
}

export async function recalculateListStats(listId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const items = await db.select().from(contactListItems).where(eq(contactListItems.listId, listId));
  
  const totalContacts = items.length;
  const invalidContacts = items.filter(i => i.status === "invalid").length;
  const optedOutContacts = items.filter(i => i.status === "opted_out" || i.status === "spam_reported").length;

  await db.update(contactLists).set({
    totalContacts,
    invalidContacts,
    optedOutContacts,
  }).where(eq(contactLists.id, listId));
}

// =====================================================
// Contact List Items
// =====================================================

export async function getContactListItems(listId: number, statusFilter?: string): Promise<ContactListItem[]> {
  const db = await getDb();
  if (!db) return [];

  if (statusFilter) {
    return await db.select().from(contactListItems)
      .where(and(
        eq(contactListItems.listId, listId),
        eq(contactListItems.status, statusFilter as any)
      ))
      .orderBy(desc(contactListItems.createdAt));
  }

  return await db.select().from(contactListItems)
    .where(eq(contactListItems.listId, listId))
    .orderBy(desc(contactListItems.createdAt));
}

export async function getActiveContactListItems(listId: number): Promise<ContactListItem[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(contactListItems)
    .where(and(
      eq(contactListItems.listId, listId),
      eq(contactListItems.status, "active")
    ));
}

export async function getContactListItemById(id: number): Promise<ContactListItem | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(contactListItems).where(eq(contactListItems.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getContactListItemByPhone(listId: number, phoneNumber: string): Promise<ContactListItem | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(contactListItems)
    .where(and(
      eq(contactListItems.listId, listId),
      eq(contactListItems.phoneNumber, phoneNumber)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function findContactByPhoneAcrossLists(userId: number, phoneNumber: string): Promise<ContactListItem | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  // Find contact by phone in any list owned by the user
  const result = await db.select({
    item: contactListItems,
  }).from(contactListItems)
    .innerJoin(contactLists, eq(contactListItems.listId, contactLists.id))
    .where(and(
      eq(contactLists.userId, userId),
      eq(contactListItems.phoneNumber, phoneNumber)
    ))
    .limit(1);

  return result.length > 0 ? result[0].item : undefined;
}

export async function addContactListItems(items: InsertContactListItem[]): Promise<{ added: number; duplicates: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (items.length === 0) return { added: 0, duplicates: 0 };

  let added = 0;
  let duplicates = 0;

  // Insert one by one to handle duplicates gracefully
  for (const item of items) {
    try {
      const existing = await getContactListItemByPhone(item.listId, item.phoneNumber);
      if (existing) {
        duplicates++;
        continue;
      }
      await db.insert(contactListItems).values(item);
      added++;
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        duplicates++;
      } else {
        throw error;
      }
    }
  }

  // Recalculate stats for the list
  if (items.length > 0) {
    await recalculateListStats(items[0].listId);
  }

  return { added, duplicates };
}

export async function updateContactListItem(id: number, data: Partial<InsertContactListItem>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(contactListItems).set(data).where(eq(contactListItems.id, id));

  // Get the item to recalculate stats
  const item = await getContactListItemById(id);
  if (item) {
    await recalculateListStats(item.listId);
  }
}

export async function markContactAsOptedOut(listId: number, phoneNumber: string, reason: "manual" | "sair" | "spam" | "bounce") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const status = reason === "spam" ? "spam_reported" : "opted_out";

  await db.update(contactListItems).set({
    status,
    optedOutAt: new Date(),
    optedOutReason: reason,
  }).where(and(
    eq(contactListItems.listId, listId),
    eq(contactListItems.phoneNumber, phoneNumber)
  ));

  await recalculateListStats(listId);
}

export async function markContactAsOptedOutByPhone(userId: number, phoneNumber: string, reason: "manual" | "sair" | "spam" | "bounce") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const status = reason === "spam" ? "spam_reported" : "opted_out";

  // Find all lists for this user and opt out the contact in all of them
  const userLists = await getContactLists(userId);
  
  for (const list of userLists) {
    const item = await getContactListItemByPhone(list.id, phoneNumber);
    if (item && item.status === "active") {
      await db.update(contactListItems).set({
        status,
        optedOutAt: new Date(),
        optedOutReason: reason,
      }).where(eq(contactListItems.id, item.id));
      
      await recalculateListStats(list.id);
    }
  }
}

export async function reactivateContact(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const item = await getContactListItemById(id);
  if (!item) throw new Error("Contact not found");

  await db.update(contactListItems).set({
    status: "active",
    optedOutAt: null,
    optedOutReason: null,
  }).where(eq(contactListItems.id, id));

  await recalculateListStats(item.listId);
}

export async function deleteContactListItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const item = await getContactListItemById(id);
  if (!item) return;

  await db.delete(contactListItems).where(eq(contactListItems.id, id));
  await recalculateListStats(item.listId);
}

export async function deleteAllContactListItems(listId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(contactListItems).where(eq(contactListItems.listId, listId));
  await recalculateListStats(listId);
}

// =====================================================
// Webhook Functions (from production)
// =====================================================

/**
 * Get all WhatsApp connections with their webhook configurations
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
        // Backend Baileys usa identification como chave de sessão (não o id numérico).
        id: conn.identification,
        dbId: conn.id,
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
 * Revoga a API key da conexão (define como null). Requisições subsequentes com
 * a chave antiga passam a ser rejeitadas — útil em caso de vazamento.
 */
export async function revokeConnectionApiKey(connectionId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(whatsappConnections)
    .set({ apiKey: null })
    .where(eq(whatsappConnections.id, connectionId));
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

// =====================================================
// WhatsApp Blacklist Functions
// =====================================================

/**
 * Check if a phone number is blacklisted for a specific business account
 */
export async function isPhoneBlacklisted(businessAccountId: number, phoneNumber: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Normalize phone number (remove non-digits)
  const normalizedPhone = phoneNumber.replace(/\D/g, "");

  const result = await db
    .select()
    .from(whatsappBlacklist)
    .where(
      and(
        eq(whatsappBlacklist.businessAccountId, businessAccountId),
        eq(whatsappBlacklist.phoneNumber, normalizedPhone)
      )
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Add a phone number to the blacklist
 */
export async function addToBlacklist(data: {
  businessAccountId: number;
  phoneNumber: string;
  reason: "sair" | "cancelar" | "spam_report" | "manual" | "bounce";
  originalMessage?: string;
}): Promise<{ success: boolean; alreadyBlacklisted: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Normalize phone number
  const normalizedPhone = data.phoneNumber.replace(/\D/g, "");

  try {
    // Check if already blacklisted
    const existing = await isPhoneBlacklisted(data.businessAccountId, normalizedPhone);
    if (existing) {
      return { success: true, alreadyBlacklisted: true };
    }

    // Add to blacklist
    await db.insert(whatsappBlacklist).values({
      businessAccountId: data.businessAccountId,
      phoneNumber: normalizedPhone,
      reason: data.reason,
      originalMessage: data.originalMessage,
    });

    // Also mark as opted_out in all contact lists for this user
    await markPhoneAsOptedOutInAllLists(data.businessAccountId, normalizedPhone, data.reason);

    console.log(`[Blacklist] Added ${normalizedPhone} to blacklist for account ${data.businessAccountId}, reason: ${data.reason}`);

    return { success: true, alreadyBlacklisted: false };
  } catch (error: any) {
    if (error.code === "ER_DUP_ENTRY") {
      return { success: true, alreadyBlacklisted: true };
    }
    throw error;
  }
}

/**
 * Remove a phone number from the blacklist
 */
export async function removeFromBlacklist(businessAccountId: number, phoneNumber: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const normalizedPhone = phoneNumber.replace(/\D/g, "");

  const result = await db
    .delete(whatsappBlacklist)
    .where(
      and(
        eq(whatsappBlacklist.businessAccountId, businessAccountId),
        eq(whatsappBlacklist.phoneNumber, normalizedPhone)
      )
    );

  return true;
}

/**
 * Get all blacklisted numbers for a business account
 */
export async function getBlacklist(businessAccountId: number): Promise<WhatsappBlacklist[]> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[getBlacklist] Database not available, returning empty list");
      return [];
    }

    const result = await db
      .select()
      .from(whatsappBlacklist)
      .where(eq(whatsappBlacklist.businessAccountId, businessAccountId))
      .orderBy(desc(whatsappBlacklist.optedOutAt));
    
    return result;
  } catch (error: any) {
    // Blacklist não é obrigatória - se der erro, retorna lista vazia
    console.warn("[getBlacklist] Error fetching blacklist (non-critical, returning empty):", error.message);
    console.warn("[getBlacklist] Business Account ID:", businessAccountId);
    return [];
  }
}

/**
 * Mark a phone as opted_out in all contact lists belonging to the user who owns this business account
 */
async function markPhoneAsOptedOutInAllLists(businessAccountId: number, phoneNumber: string, reason: string) {
  const db = await getDb();
  if (!db) return;

  try {
    // First, get the user ID from the business account
    const account = await db
      .select()
      .from(whatsappBusinessAccounts)
      .where(eq(whatsappBusinessAccounts.id, businessAccountId))
      .limit(1);

    if (account.length === 0) return;

    const userId = account[0].userId;

    // Get all contact lists for this user
    const lists = await db
      .select()
      .from(contactLists)
      .where(eq(contactLists.userId, userId));

    // Update status in all lists where this phone exists
    for (const list of lists) {
      await db
        .update(contactListItems)
        .set({
          status: "opted_out",
          optedOutAt: new Date(),
          optedOutReason: reason,
        })
        .where(
          and(
            eq(contactListItems.listId, list.id),
            eq(contactListItems.phoneNumber, phoneNumber),
            eq(contactListItems.status, "active") // Only update active contacts
          )
        );
    }

    // Recalculate stats for all affected lists
    for (const list of lists) {
      await recalculateListStats(list.id);
    }

    console.log(`[Blacklist] Marked ${phoneNumber} as opted_out in all lists for user ${userId}`);
  } catch (error) {
    console.error("[Blacklist] Error marking phone as opted_out in lists:", error);
  }
}

/**
 * Check if message is an opt-out request
 */
export function isOptOutMessage(message: string): { isOptOut: boolean; reason: "sair" | "cancelar" | null } {
  if (!message) return { isOptOut: false, reason: null };

  const normalizedMessage = message.trim().toUpperCase();

  // Check for exact matches first
  const exactMatches = ["SAIR", "CANCELAR", "CANCELAR RECEBIMENTO", "PARAR", "STOP", "UNSUBSCRIBE"];
  if (exactMatches.includes(normalizedMessage)) {
    if (normalizedMessage === "SAIR" || normalizedMessage === "PARAR" || normalizedMessage === "STOP") {
      return { isOptOut: true, reason: "sair" };
    }
    return { isOptOut: true, reason: "cancelar" };
  }

  // Check for partial matches
  const sairPatterns = [/^SAIR$/i, /^PARAR$/i, /^STOP$/i, /^PARE$/i];
  const cancelarPatterns = [/CANCELAR/i, /DESCADASTRAR/i, /NAO QUERO/i, /NÃO QUERO/i, /UNSUBSCRIBE/i, /REMOVER/i];

  for (const pattern of sairPatterns) {
    if (pattern.test(normalizedMessage)) {
      return { isOptOut: true, reason: "sair" };
    }
  }

  for (const pattern of cancelarPatterns) {
    if (pattern.test(normalizedMessage)) {
      return { isOptOut: true, reason: "cancelar" };
    }
  }

  return { isOptOut: false, reason: null };
}

/**
 * Filter out blacklisted numbers from a list of phone numbers
 */
export async function filterBlacklistedNumbers(
  businessAccountId: number,
  phoneNumbers: string[]
): Promise<{ allowed: string[]; blocked: string[] }> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[filterBlacklistedNumbers] Database not available, allowing all numbers");
      return { allowed: phoneNumbers, blocked: [] };
    }

    // Get all blacklisted numbers for this account
    // Se der erro, getBlacklist retorna array vazio (blacklist não é obrigatória)
    const blacklist = await getBlacklist(businessAccountId);
    const blacklistedSet = new Set(blacklist.map(b => b.phoneNumber));

    const allowed: string[] = [];
    const blocked: string[] = [];

    for (const phone of phoneNumbers) {
      const normalized = phone.replace(/\D/g, "");
      if (blacklistedSet.has(normalized)) {
        blocked.push(phone);
      } else {
        allowed.push(phone);
      }
    }

    return { allowed, blocked };
  } catch (error: any) {
    // Se der erro, permite todos os números (blacklist não é obrigatória)
    console.warn("[filterBlacklistedNumbers] Error filtering blacklist (non-critical, allowing all):", error.message);
    return { allowed: phoneNumbers, blocked: [] };
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// Dashboard
//
// Os disparos em massa vivem em baileys_campaign_recipients / campaign_recipients;
// a tabela `messages` só recebe envios avulsos. Qualquer número do dashboard que
// represente "mensagens enviadas" precisa somar as três fontes.
// ─────────────────────────────────────────────────────────────────────────────

export interface ConnectionHealth {
  id: number;
  identification: string;
  phoneNumber: string | null;
  status: "connected" | "disconnected" | "qr_code" | "connecting";
  warmupDailyLimit: number | null;
  sentToday: number;
  lastConnectedAt: Date | null;
  proxyStatus: "available" | "assigned" | "dead" | null;
}

export interface DashboardOverview {
  connections: { total: number; connected: number; qrCode: number; connecting: number; disconnected: number };
  /** Teto de disparo do dia, considerando apenas as conexões conectadas que têm warmup definido. */
  capacity: { dailyLimit: number | null; usedAgainstLimit: number; uncappedConnections: number };
  queue: { pending: number; etaMinutes: number | null };
  campaigns: { running: number; scheduled: number; paused: number };
}

export interface DailySend {
  /** YYYY-MM-DD */
  date: string;
  sent: number;
  failed: number;
}

export interface SendHistory {
  series: DailySend[];
  totals: { sent: number; failed: number; failureRate: number; sentToday: number; dailyAverage: number };
}

/** Contas cujos disparos o usuário enxerga: a dele + as de quem o convidou (role viewer). */
async function getVisibleOwnerIds(userId: number): Promise<number[]> {
  return [userId, ...(await getOwnerIdsForMember(userId))];
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** YYYY-MM-DD no fuso local do processo — o dia como o usuário o entende. */
function toDayKey(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Offset local do processo em '+HH:MM'. O Drizzle grava TIMESTAMP como wall-clock UTC
 * (mapToDriverValue usa toISOString), então DATE_FORMAT direto devolveria o dia em UTC —
 * e um envio das 21h no Brasil cairia no dia seguinte. Convertendo para este offset, o
 * dia agrupado no SQL passa a ser o mesmo dia de toDayKey().
 *
 * Usa o offset de agora para toda a janela: numa virada de horário de verão, eventos na
 * primeira hora do dia podem cair no bucket vizinho. Aceitável — a alternativa exigiria
 * as tabelas de fuso do MySQL carregadas.
 */
function localUtcOffset(): string {
  const minutes = -new Date().getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/**
 * Instante → 'YYYY-MM-DD HH:mm:ss' em UTC, que é exatamente como o Drizzle grava
 * TIMESTAMP. Necessário nos WHERE que comparam uma expressão SQL (COALESCE) com uma
 * data: nesse caminho o Drizzle não aplica o encoder da coluna e entregaria o Date ao
 * mysql2, que o serializaria no fuso local — desalinhando o filtro do resto da query.
 */
function toMysqlUtc(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Enviados HOJE por conexão, em uma única query (o scheduler tem a versão de uma
 * conexão só em countBaileysSentTodayForConnection). O OR/isNull cobre campanhas
 * legadas, anteriores ao round-robin, em que o destinatário não guarda de qual
 * conexão saiu — nesse caso vale a conexão única da campanha.
 */
async function getSentTodayByConnection(userId: number): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  const db = await getDb();
  if (!db) return out;

  const rows = await db
    .select({
      connectionId: sql<number>`COALESCE(${baileysCampaignRecipients.sentFromConnectionId}, ${baileysCampaigns.connectionId})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(baileysCampaignRecipients)
    .innerJoin(baileysCampaigns, eq(baileysCampaigns.id, baileysCampaignRecipients.campaignId))
    .where(
      and(
        eq(baileysCampaigns.userId, userId),
        eq(baileysCampaignRecipients.status, "sent"),
        gte(baileysCampaignRecipients.sentAt, startOfToday()),
      ),
    )
    .groupBy(sql`COALESCE(${baileysCampaignRecipients.sentFromConnectionId}, ${baileysCampaigns.connectionId})`);

  for (const r of rows as Array<{ connectionId: number | null; count: number }>) {
    if (r.connectionId == null) continue; // campanha legada sem conexão registrada
    out.set(Number(r.connectionId), Number(r.count));
  }
  return out;
}

/**
 * Saúde de cada telefone do usuário: estado da sessão, quanto já disparou hoje e
 * situação do proxy. Alimenta os alertas e a tabela de telefones do dashboard.
 *
 * Escopo: apenas as conexões do próprio usuário. Convidados (viewer) enxergam os
 * disparos de quem os convidou, mas não os chips — isso exporia telefones que a
 * tela de Conexões nunca mostrou a eles.
 */
export async function getConnectionsHealth(userId: number): Promise<ConnectionHealth[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      id: whatsappConnections.id,
      identification: whatsappConnections.identification,
      phoneNumber: whatsappConnections.phoneNumber,
      status: whatsappConnections.status,
      warmupDailyLimit: whatsappConnections.warmupDailyLimit,
      lastConnectedAt: whatsappConnections.lastConnectedAt,
      proxyStatus: webshareProxies.status,
    })
    .from(whatsappConnections)
    .leftJoin(webshareProxies, eq(webshareProxies.id, whatsappConnections.proxyId))
    .where(eq(whatsappConnections.userId, userId))
    .orderBy(desc(whatsappConnections.id));

  const sentToday = await getSentTodayByConnection(userId);

  type HealthRow = Omit<ConnectionHealth, "sentToday" | "proxyStatus"> & {
    proxyStatus: ConnectionHealth["proxyStatus"] | undefined;
  };

  return (rows as HealthRow[]).map((r) => ({
    id: r.id,
    identification: r.identification,
    phoneNumber: r.phoneNumber,
    status: r.status,
    warmupDailyLimit: r.warmupDailyLimit,
    sentToday: sentToday.get(r.id) ?? 0,
    lastConnectedAt: r.lastConnectedAt,
    proxyStatus: r.proxyStatus ?? null,
  }));
}

/**
 * Bloco "AGORA": o que exige ação nos próximos minutos. A capacidade é derivada da
 * mesma fonte de getConnectionsHealth, para que os dois cards nunca se contradigam.
 */
export async function getDashboardOverview(userId: number): Promise<DashboardOverview> {
  const empty: DashboardOverview = {
    connections: { total: 0, connected: 0, qrCode: 0, connecting: 0, disconnected: 0 },
    capacity: { dailyLimit: null, usedAgainstLimit: 0, uncappedConnections: 0 },
    queue: { pending: 0, etaMinutes: null },
    campaigns: { running: 0, scheduled: 0, paused: 0 },
  };

  const db = await getDb();
  if (!db) return empty;

  const ownerIds = await getVisibleOwnerIds(userId);
  const health = await getConnectionsHealth(userId);

  const connections = {
    total: health.length,
    connected: health.filter((c) => c.status === "connected").length,
    qrCode: health.filter((c) => c.status === "qr_code").length,
    connecting: health.filter((c) => c.status === "connecting").length,
    disconnected: health.filter((c) => c.status === "disconnected").length,
  };

  // Teto do dia: só conexões conectadas contam, porque são as que podem disparar
  // agora. As sem warmup definido não têm teto — reportadas à parte para a UI não
  // fingir um limite que não existe.
  const connected = health.filter((c) => c.status === "connected");
  const capped = connected.filter((c) => c.warmupDailyLimit != null);
  const capacity = {
    dailyLimit: capped.length > 0 ? capped.reduce((sum, c) => sum + (c.warmupDailyLimit ?? 0), 0) : null,
    usedAgainstLimit: capped.reduce((sum, c) => sum + c.sentToday, 0),
    uncappedConnections: connected.length - capped.length,
  };

  const campaignRows = await db
    .select({ status: baileysCampaigns.status, count: sql<number>`COUNT(*)` })
    .from(baileysCampaigns)
    .where(inArray(baileysCampaigns.userId, ownerIds))
    .groupBy(baileysCampaigns.status);

  const campaignsByStatus = { running: 0, scheduled: 0, paused: 0 };
  for (const r of campaignRows as Array<{ status: string; count: number }>) {
    if (r.status === "running" || r.status === "scheduled" || r.status === "paused") {
      campaignsByStatus[r.status] = Number(r.count);
    }
  }

  // Fila + ETA, por campanha em execução.
  //
  // O ritmo NÃO é proporcional ao número de chips: o scheduler processa cada campanha
  // num laço serial — envia uma mensagem e dorme o delay aleatório
  // (baileysCampaignScheduler.ts, `await sleep(randomDelayMs(...))`). O round-robin só
  // decide QUAL chip dispara, não paraleliza. O que roda em paralelo são as campanhas,
  // uma `processCampaign` por campanha em execução.
  //
  // Logo: cada campanha leva `pendentes × delay médio`, e o todo termina quando a mais
  // demorada terminar — ou seja, o MÁXIMO entre elas, não a soma dividida por chips.
  const perCampaign = await db
    .select({
      pending: sql<number>`COUNT(*)`,
      avgDelay: sql<number>`AVG((${baileysCampaigns.minDelaySeconds} + ${baileysCampaigns.maxDelaySeconds}) / 2)`,
    })
    .from(baileysCampaignRecipients)
    .innerJoin(baileysCampaigns, eq(baileysCampaigns.id, baileysCampaignRecipients.campaignId))
    .where(
      and(
        inArray(baileysCampaigns.userId, ownerIds),
        eq(baileysCampaigns.status, "running"),
        eq(baileysCampaignRecipients.status, "pending"),
      ),
    )
    .groupBy(baileysCampaigns.id);

  let pending = 0;
  let slowestSeconds = 0;
  for (const row of perCampaign as Array<{ pending: number; avgDelay: number | null }>) {
    const count = Number(row.pending);
    pending += count;
    const delay = Number(row.avgDelay ?? 0);
    if (delay > 0) slowestSeconds = Math.max(slowestSeconds, count * delay);
  }

  // Sem chip conectado a fila não anda — não há estimativa honesta a dar.
  const etaMinutes =
    pending > 0 && connections.connected > 0 && slowestSeconds > 0
      ? Math.ceil(slowestSeconds / 60)
      : null;

  return { connections, capacity, queue: { pending, etaMinutes }, campaigns: campaignsByStatus };
}

/**
 * Série diária de envios somando as TRÊS fontes (campanhas Baileys, campanhas Meta e
 * envios avulsos), com os totais derivados da própria série — assim os KPIs do topo
 * nunca contradizem o gráfico.
 *
 * Sobre COALESCE(sent_at, created_at): falhas gravadas antes desta feature não têm
 * sent_at (os schedulers não o preenchiam), então caem no created_at do destinatário —
 * uma aproximação. Falhas novas trazem o timestamp real da tentativa.
 */
export async function getSendHistory(userId: number, days: number): Promise<SendHistory> {
  const emptyTotals = { sent: 0, failed: 0, failureRate: 0, sentToday: 0, dailyAverage: 0 };

  // Janela: `days` dias corridos terminando hoje (hoje incluso).
  const since = startOfToday();
  since.setDate(since.getDate() - (days - 1));

  const buckets = new Map<string, DailySend>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = toDayKey(d);
    buckets.set(key, { date: key, sent: 0, failed: 0 });
  }

  const db = await getDb();
  if (!db) return { series: Array.from(buckets.values()), totals: emptyTotals };

  const ownerIds = await getVisibleOwnerIds(userId);

  const add = (day: string, status: string, count: number) => {
    const bucket = buckets.get(day);
    if (!bucket) return; // fora da janela (borda de fuso) — ignora em vez de inventar um dia
    if (status === "failed") bucket.failed += count;
    else bucket.sent += count; // sent, delivered e read são todos "saiu" para o histórico
  };

  // O banco guarda TIMESTAMP em UTC; o dia precisa ser o do usuário. Daí o CONVERT_TZ
  // no agrupamento e o limite da janela já convertido para UTC no filtro.
  const tz = localUtcOffset();
  const sinceUtc = toMysqlUtc(since);

  // 1) Campanhas Baileys (disparo em massa) — a fonte principal do produto.
  const baileysAt = sql`COALESCE(${baileysCampaignRecipients.sentAt}, ${baileysCampaignRecipients.createdAt})`;
  const baileysDay = sql<string>`DATE_FORMAT(CONVERT_TZ(${baileysAt}, '+00:00', ${tz}), '%Y-%m-%d')`;
  const baileysRows = await db
    .select({ day: baileysDay, status: baileysCampaignRecipients.status, count: sql<number>`COUNT(*)` })
    .from(baileysCampaignRecipients)
    .innerJoin(baileysCampaigns, eq(baileysCampaigns.id, baileysCampaignRecipients.campaignId))
    .where(
      and(
        inArray(baileysCampaigns.userId, ownerIds),
        inArray(baileysCampaignRecipients.status, ["sent", "failed"]),
        sql`${baileysAt} >= ${sinceUtc}`,
      ),
    )
    .groupBy(baileysDay, baileysCampaignRecipients.status);

  for (const r of baileysRows as Array<{ day: string; status: string; count: number }>) {
    add(String(r.day), r.status, Number(r.count));
  }

  // 2) Campanhas Meta (API oficial). delivered/read também já saíram.
  const metaAt = sql`COALESCE(${campaignRecipients.sentAt}, ${campaignRecipients.createdAt})`;
  const metaDay = sql<string>`DATE_FORMAT(CONVERT_TZ(${metaAt}, '+00:00', ${tz}), '%Y-%m-%d')`;
  const metaRows = await db
    .select({ day: metaDay, status: campaignRecipients.status, count: sql<number>`COUNT(*)` })
    .from(campaignRecipients)
    .innerJoin(campaigns, eq(campaigns.id, campaignRecipients.campaignId))
    .where(
      and(
        inArray(campaigns.userId, ownerIds),
        inArray(campaignRecipients.status, ["sent", "delivered", "read", "failed"]),
        sql`${metaAt} >= ${sinceUtc}`,
      ),
    )
    .groupBy(metaDay, campaignRecipients.status);

  for (const r of metaRows as Array<{ day: string; status: string; count: number }>) {
    add(String(r.day), r.status, Number(r.count));
  }

  // 3) Envios avulsos (página Enviar Mensagem e rotas legadas). `messages.sentAt` é
  // NOT NULL com default, então dispensa o COALESCE.
  const messageDay = sql<string>`DATE_FORMAT(CONVERT_TZ(${messages.sentAt}, '+00:00', ${tz}), '%Y-%m-%d')`;
  const messageRows = await db
    .select({ day: messageDay, status: messages.status, count: sql<number>`COUNT(*)` })
    .from(messages)
    .where(
      and(
        eq(messages.userId, userId),
        inArray(messages.status, ["sent", "failed"]),
        gte(messages.sentAt, since),
      ),
    )
    .groupBy(messageDay, messages.status);

  for (const r of messageRows as Array<{ day: string; status: string; count: number }>) {
    add(String(r.day), r.status, Number(r.count));
  }

  const series = Array.from(buckets.values());
  const sent = series.reduce((sum, d) => sum + d.sent, 0);
  const failed = series.reduce((sum, d) => sum + d.failed, 0);
  const attempts = sent + failed;
  const todayKey = toDayKey(new Date());

  return {
    series,
    totals: {
      sent,
      failed,
      failureRate: attempts > 0 ? (failed / attempts) * 100 : 0,
      sentToday: buckets.get(todayKey)?.sent ?? 0,
      dailyAverage: days > 0 ? Math.round(sent / days) : 0,
    },
  };
}
