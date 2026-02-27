import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, unique, decimal, date, json, serial } from "drizzle-orm/mysql-core";

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
 * WhatsApp Business Accounts table
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
  templateVariables: text("template_variables"),
  headerMediaUrl: text("header_media_url"),
  status: mysqlEnum("status", ["draft", "scheduled", "running", "paused", "completed", "failed"]).default("draft").notNull(),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  totalRecipients: int("total_recipients").default(0).notNull(),
  sentCount: int("sent_count").default(0).notNull(),
  deliveredCount: int("delivered_count").default(0).notNull(),
  readCount: int("read_count").default(0).notNull(),
  failedCount: int("failed_count").default(0).notNull(),
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
  variables: text("variables"),
  status: mysqlEnum("status", ["pending", "sent", "delivered", "read", "failed"]).default("pending").notNull(),
  whatsappMessageId: varchar("whatsapp_message_id", { length: 255 }),
  errorMessage: text("error_message"),
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
 * WhatsApp message templates cache table
 */
export const whatsappTemplates = mysqlTable("whatsapp_templates", {
  id: int("id").autoincrement().primaryKey(),
  businessAccountId: int("business_account_id").notNull(),
  templateId: varchar("template_id", { length: 100 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  language: varchar("language", { length: 10 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  components: text("components").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => {
  return {
    uniqueBusinessAccountTemplate: unique().on(table.businessAccountId, table.templateId),
  };
});

export type WhatsappTemplate = typeof whatsappTemplates.$inferSelect;
export type InsertWhatsappTemplate = typeof whatsappTemplates.$inferInsert;

/**
 * Contact Lists table
 */
export const contactLists = mysqlTable("contact_lists", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }),
  description: text("description"),
  totalContacts: int("total_contacts").default(0).notNull(),
  invalidContacts: int("invalid_contacts").default(0).notNull(),
  optedOutContacts: int("opted_out_contacts").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ContactList = typeof contactLists.$inferSelect;
export type InsertContactList = typeof contactLists.$inferInsert;

/**
 * Contact List Items table
 */
export const contactListItems = mysqlTable("contact_list_items", {
  id: int("id").autoincrement().primaryKey(),
  listId: int("list_id").notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  customFields: text("custom_fields"),
  status: mysqlEnum("status", ["active", "invalid", "opted_out", "spam_reported"]).default("active").notNull(),
  optedOutAt: timestamp("opted_out_at"),
  optedOutReason: varchar("opted_out_reason", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => {
  return {
    uniqueListPhone: unique().on(table.listId, table.phoneNumber),
  };
});

export type ContactListItem = typeof contactListItems.$inferSelect;
export type InsertContactListItem = typeof contactListItems.$inferInsert;

/**
 * WhatsApp Blacklist table for opt-out management
 */
export const whatsappBlacklist = mysqlTable("whatsapp_blacklist", {
  id: int("id").autoincrement().primaryKey(),
  businessAccountId: int("business_account_id").notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  reason: mysqlEnum("reason", ["sair", "cancelar", "spam_report", "manual", "bounce"]).notNull(),
  originalMessage: text("original_message"),
  optedOutAt: timestamp("opted_out_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    uniqueAccountPhone: unique().on(table.businessAccountId, table.phoneNumber),
  };
});

export type WhatsappBlacklist = typeof whatsappBlacklist.$inferSelect;
export type InsertWhatsappBlacklist = typeof whatsappBlacklist.$inferInsert;

// ==========================================
// BILLING & SUBSCRIPTION TABLES
// ==========================================

/**
 * Plans table - Available subscription plans
 */
export const plans = mysqlTable("plans", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  description: text("description"),

  // Pricing
  priceMonthly: decimal("price_monthly", { precision: 10, scale: 2 }).notNull(),
  priceYearly: decimal("price_yearly", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),

  // Limits
  maxWhatsappConnections: int("max_whatsapp_connections").notNull(),
  maxBusinessAccounts: int("max_business_accounts").notNull(),
  maxCampaignsPerMonth: int("max_campaigns_per_month").notNull(),
  maxContactsPerList: int("max_contacts_per_list").notNull(),
  maxMessagesPerMonth: int("max_messages_per_month").notNull(),
  maxTemplateMessagesPerMonth: int("max_template_messages_per_month").notNull(),

  // Features
  hasWebhooks: boolean("has_webhooks").default(false).notNull(),
  hasApiAccess: boolean("has_api_access").default(false).notNull(),
  hasAiFeatures: boolean("has_ai_features").default(false).notNull(),
  hasPrioritySupport: boolean("has_priority_support").default(false).notNull(),
  hasCustomBranding: boolean("has_custom_branding").default(false).notNull(),

  // Stripe
  stripePriceIdMonthly: varchar("stripe_price_id_monthly", { length: 255 }),
  stripePriceIdYearly: varchar("stripe_price_id_yearly", { length: 255 }),

  isActive: boolean("is_active").default(true).notNull(),
  isEnterprise: boolean("is_enterprise").default(false).notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Plan = typeof plans.$inferSelect;
export type InsertPlan = typeof plans.$inferInsert;

/**
 * Subscriptions table - User subscriptions
 */
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  planId: int("plan_id").notNull(),

  // Status
  status: mysqlEnum("status", [
    "active", "canceled", "past_due", "trialing", "paused", "incomplete"
  ]).default("active").notNull(),

  // Billing cycle
  billingCycle: mysqlEnum("billing_cycle", ["monthly", "yearly"]).default("monthly").notNull(),

  // Dates
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  canceledAt: timestamp("canceled_at"),
  cancelReason: text("cancel_reason"),
  trialEndsAt: timestamp("trial_ends_at"),
  pausedAt: timestamp("paused_at"),

  // Stripe
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/**
 * Usage Records table - Monthly usage tracking per user
 */
export const usageRecords = mysqlTable("usage_records", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),

  // Period
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),

  // Counters
  whatsappConnectionsCount: int("whatsapp_connections_count").default(0).notNull(),
  businessAccountsCount: int("business_accounts_count").default(0).notNull(),
  campaignsCreated: int("campaigns_created").default(0).notNull(),
  messagesViaApi: int("messages_via_api").default(0).notNull(),
  messagesViaTemplate: int("messages_via_template").default(0).notNull(),
  contactsCreated: int("contacts_created").default(0).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userPeriodUnique: unique().on(table.userId, table.periodStart),
}));

export type UsageRecord = typeof usageRecords.$inferSelect;
export type InsertUsageRecord = typeof usageRecords.$inferInsert;

/**
 * Payments table - Payment history
 */
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  subscriptionId: int("subscription_id"),

  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  status: mysqlEnum("status", ["pending", "succeeded", "failed", "refunded"]).default("pending").notNull(),
  description: text("description"),

  // Stripe
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  stripeInvoiceId: varchar("stripe_invoice_id", { length: 255 }),
  stripeChargeId: varchar("stripe_charge_id", { length: 255 }),

  paidAt: timestamp("paid_at"),
  refundedAt: timestamp("refunded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

// ==========================================
// ADMIN & SYSTEM TABLES
// ==========================================

/**
 * Admin Logs table - Audit trail for admin actions
 */
export const adminLogs = mysqlTable("admin_logs", {
  id: int("id").autoincrement().primaryKey(),
  adminUserId: int("admin_user_id").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  targetType: varchar("target_type", { length: 50 }),
  targetId: int("target_id"),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  details: text("details"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AdminLog = typeof adminLogs.$inferSelect;
export type InsertAdminLog = typeof adminLogs.$inferInsert;

/**
 * Error Logs table - System error tracking
 */
export const errorLogs = mysqlTable("error_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id"),
  errorType: varchar("error_type", { length: 50 }).notNull(),
  errorCode: varchar("error_code", { length: 50 }),
  message: text("message").notNull(),
  stackTrace: text("stack_trace"),
  context: text("context"),
  resolved: boolean("resolved").default(false).notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: int("resolved_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertErrorLog = typeof errorLogs.$inferInsert;

/**
 * System Settings table - Global system configuration
 */
export const systemSettings = mysqlTable("system_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  type: varchar("type", { length: 20 }).default("string").notNull(),
  description: text("description"),
  isPublic: boolean("is_public").default(false).notNull(),
  updatedBy: int("updated_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;

/**
 * Audit Logs table - User action tracking
 */
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  resourceType: varchar("resource_type", { length: 50 }),
  resourceId: varchar("resource_id", { length: 100 }),
  metadata: text("metadata"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/**
 * Invitations - convites enviados para outros usuários verem meus disparos
 */
export const invitations = mysqlTable("invitations", {
  id: int("id").autoincrement().primaryKey(),
  inviterId: int("inviter_id").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  role: mysqlEnum("role", ["viewer"]).default("viewer").notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "expired", "revoked"]).default("pending").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = typeof invitations.$inferInsert;

/**
 * Account members - usuários que aceitaram convite e podem ver disparos do dono
 */
export const accountMembers = mysqlTable("account_members", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("owner_id").notNull(),
  memberId: int("member_id").notNull(),
  role: mysqlEnum("role", ["viewer"]).default("viewer").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    uniqueOwnerMember: unique().on(table.ownerId, table.memberId),
  };
});

export type AccountMember = typeof accountMembers.$inferSelect;
export type InsertAccountMember = typeof accountMembers.$inferInsert;
