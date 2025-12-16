import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, unique } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  apiKey: varchar("api_key", { length: 64 }).unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * WhatsApp connections table
 */
export const whatsappConnections = mysqlTable("whatsapp_connections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  identification: varchar("identification", { length: 100 }).notNull().unique(),
  apiKey: varchar("api_key", { length: 64 }).unique(),
  webhookUrl: varchar("webhook_url", { length: 500 }),
  webhookSecret: varchar("webhook_secret", { length: 255 }),
  status: mysqlEnum("status", ["connected", "disconnected", "qr_code", "connecting"]).default("disconnected").notNull(),
  qrCode: text("qr_code"),
  phoneNumber: varchar("phone_number", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  lastConnectedAt: timestamp("last_connected_at"),
});

export type WhatsappConnection = typeof whatsappConnections.$inferSelect;
export type InsertWhatsappConnection = typeof whatsappConnections.$inferInsert;

/**
 * Telegram connections table
 */
export const telegramConnections = mysqlTable("telegram_connections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  botToken: varchar("bot_token", { length: 255 }).notNull(),
  botUsername: varchar("bot_username", { length: 100 }),
  status: mysqlEnum("status", ["connected", "disconnected", "error"]).default("disconnected").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  lastConnectedAt: timestamp("last_connected_at"),
});

export type TelegramConnection = typeof telegramConnections.$inferSelect;
export type InsertTelegramConnection = typeof telegramConnections.$inferInsert;

/**
 * Messages history table
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  platform: mysqlEnum("platform", ["whatsapp", "telegram"]).notNull(),
  connectionId: int("connection_id").notNull(),
  recipient: varchar("recipient", { length: 255 }).notNull(),
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  status: mysqlEnum("status", ["sent", "failed", "pending"]).default("pending").notNull(),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * System settings table
 */
export const settings = mysqlTable("settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(),
  googleApiKey: varchar("google_api_key", { length: 255 }),
  resumeGroupId: varchar("resume_group_id", { length: 100 }),
  resumeGroupIdToSend: varchar("resume_group_id_to_send", { length: 100 }),
  resumeHourOfDay: int("resume_hour_of_day").default(22),
  enableGroupResume: boolean("enable_group_resume").default(false),
  resumePrompt: text("resume_prompt"),
  resumeConnectionId: int("resume_connection_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Settings = typeof settings.$inferSelect;
export type InsertSettings = typeof settings.$inferInsert;

/**
 * WhatsApp groups table
 */
export const whatsappGroups = mysqlTable("whatsapp_groups", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("session_id", { length: 100 }).notNull(),
  groupId: varchar("group_id", { length: 100 }).notNull(),
  groupName: varchar("group_name", { length: 255 }),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => {
  return {
    uniqueSessionGroup: unique().on(table.sessionId, table.groupId),
  };
});

export type WhatsappGroup = typeof whatsappGroups.$inferSelect;
export type InsertWhatsappGroup = typeof whatsappGroups.$inferInsert;

/**
 * Webhook configuration table
 */
export const webhookConfig = mysqlTable("webhook_config", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  webhookUrl: varchar("webhook_url", { length: 500 }).notNull(),
  webhookSecret: varchar("webhook_secret", { length: 255 }).notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  connectionName: varchar("connection_name", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type WebhookConfig = typeof webhookConfig.$inferSelect;
export type InsertWebhookConfig = typeof webhookConfig.$inferInsert;

/**
 * Webhook logs table for audit trail
 */
export const webhookLogs = mysqlTable("webhook_logs", {
  id: int("id").autoincrement().primaryKey(),
  webhookConfigId: int("webhook_config_id").notNull(),
  fromNumber: varchar("from_number", { length: 50 }).notNull(),
  messageId: varchar("message_id", { length: 255 }).notNull(),
  text: text("text").notNull(),
  status: mysqlEnum("status", ["success", "error"]).notNull(),
  response: text("response"), // JSON string
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type WebhookLog = typeof webhookLogs.$inferSelect;
export type InsertWebhookLog = typeof webhookLogs.$inferInsert;

/**
 * WhatsApp Business API accounts table
 * Stores Meta Cloud API credentials for official WhatsApp Business integration
 */
export const whatsappBusinessAccounts = mysqlTable("whatsapp_business_accounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  phoneNumberId: varchar("phone_number_id", { length: 100 }).notNull(),
  businessAccountId: varchar("business_account_id", { length: 100 }).notNull(),
  accessToken: text("access_token").notNull(),
  webhookVerifyToken: varchar("webhook_verify_token", { length: 255 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type WhatsappBusinessAccount = typeof whatsappBusinessAccounts.$inferSelect;
export type InsertWhatsappBusinessAccount = typeof whatsappBusinessAccounts.$inferInsert;

/**
 * Marketing campaigns table
 */
export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  businessAccountId: int("business_account_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  templateName: varchar("template_name", { length: 255 }).notNull(),
  templateLanguage: varchar("template_language", { length: 10 }).default("pt_BR").notNull(),
  templateVariables: text("template_variables"), // JSON string with variable values
  headerMediaUrl: text("header_media_url"), // URL for image/video/document header
  status: mysqlEnum("status", ["draft", "scheduled", "running", "paused", "completed", "failed"]).default("draft").notNull(),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  totalRecipients: int("total_recipients").default(0).notNull(),
  sentCount: int("sent_count").default(0).notNull(),
  deliveredCount: int("delivered_count").default(0).notNull(),
  readCount: int("read_count").default(0).notNull(),
  failedCount: int("failed_count").default(0).notNull(),
  // Retry configuration
  maxRetries: int("max_retries").default(3).notNull(),
  retryDelayMinutes: int("retry_delay_minutes").default(30).notNull(),
  autoRetryEnabled: boolean("auto_retry_enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

/**
 * Campaign recipients table
 */
export const campaignRecipients = mysqlTable("campaign_recipients", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaign_id").notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }),
  variables: text("variables"), // JSON string with per-recipient variable overrides
  status: mysqlEnum("status", ["pending", "sent", "delivered", "read", "failed"]).default("pending").notNull(),
  whatsappMessageId: varchar("whatsapp_message_id", { length: 255 }),
  errorMessage: text("error_message"),
  // Retry tracking
  retryCount: int("retry_count").default(0).notNull(),
  lastRetryAt: timestamp("last_retry_at"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CampaignRecipient = typeof campaignRecipients.$inferSelect;
export type InsertCampaignRecipient = typeof campaignRecipients.$inferInsert;

/**
 * WhatsApp message templates cache
 * Caches approved templates from Meta API
 */
export const whatsappTemplates = mysqlTable("whatsapp_templates", {
  id: int("id").autoincrement().primaryKey(),
  businessAccountId: int("business_account_id").notNull(),
  templateId: varchar("template_id", { length: 100 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  language: varchar("language", { length: 10 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  components: text("components").notNull(), // JSON string with template structure
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => {
  return {
    uniqueTemplate: unique().on(table.businessAccountId, table.templateId),
  };
});

export type WhatsappTemplate = typeof whatsappTemplates.$inferSelect;
export type InsertWhatsappTemplate = typeof whatsappTemplates.$inferInsert;
