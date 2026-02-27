import { inArray } from "drizzle-orm";
import { getDb } from "../db";
import { systemSettings } from "../../drizzle/schema";
import { ENV } from "../_core/env";

const CHAT_WEBHOOK_URL_KEY = "chat_webhook_url";
const CHAT_WEBHOOK_SECRET_KEY = "chat_webhook_secret";

export interface ChatWebhookConfig {
  url: string;
  secret: string;
}

/**
 * Returns the chat webhook URL and secret to use when sending campaign.dispatched webhooks.
 * Priority: system_settings (DB) > environment variables (ENV).
 */
export async function getChatWebhookConfig(): Promise<ChatWebhookConfig> {
  const db = await getDb();
  if (!db) {
    return {
      url: ENV.chatWebhookUrl ?? "",
      secret: ENV.chatWebhookSecret ?? "",
    };
  }

  const rows = await db
    .select()
    .from(systemSettings)
    .where(inArray(systemSettings.key, [CHAT_WEBHOOK_URL_KEY, CHAT_WEBHOOK_SECRET_KEY]));

  const urlRow = rows.find((r) => r.key === CHAT_WEBHOOK_URL_KEY);
  const secretRow = rows.find((r) => r.key === CHAT_WEBHOOK_SECRET_KEY);

  return {
    url: (urlRow?.value?.trim() || ENV.chatWebhookUrl ?? "").trim(),
    secret: (secretRow?.value?.trim() || ENV.chatWebhookSecret ?? "").trim(),
  };
}
