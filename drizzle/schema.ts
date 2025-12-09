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
  from: varchar("from", { length: 50 }).notNull(),
  messageId: varchar("message_id", { length: 255 }).notNull(),
  text: text("text").notNull(),
  status: mysqlEnum("status", ["success", "error"]).notNull(),
  response: text("response"), // JSON string
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type WebhookLog = typeof webhookLogs.$inferSelect;
export type InsertWebhookLog = typeof webhookLogs.$inferInsert;
