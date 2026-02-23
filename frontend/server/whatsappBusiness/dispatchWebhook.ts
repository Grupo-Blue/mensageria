import axios from "axios";
import { ENV } from "../_core/env";
import { extractTemplateVariablesInOrder } from "./metaApi";

export interface DispatchWebhookContact {
  name: string | null;
  phone: string;
}

export interface CampaignDispatchedPayload {
  event: "campaign.dispatched";
  dispatchedAt: string;
  campaignId: number;
  campaignName: string;
  company: string;
  message: string;
  contacts: DispatchWebhookContact[];
}

/**
 * Renders template body text by replacing {{1}}, {{2}}, {{name}} etc with values from variableValues.
 * Uses the same variable order as the Meta API for consistency.
 */
export function renderTemplateBody(
  templateBodyText: string,
  variableValues: Record<string, string>
): string {
  if (!templateBodyText) return "";
  const orderedVars = extractTemplateVariablesInOrder(templateBodyText);
  let result = templateBodyText;
  for (const varName of orderedVars) {
    const value = variableValues[varName] ?? "";
    const placeholder = new RegExp(`\\{\\{\\s*${varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\}\\}`, "g");
    result = result.replace(placeholder, value);
  }
  return result;
}

/**
 * Sends campaign dispatched payload to the chat webhook URL (fire-and-forget).
 * Only sends if CHAT_WEBHOOK_URL is set. Does not throw; logs errors.
 */
export function notifyCampaignDispatched(payload: CampaignDispatchedPayload): void {
  const url = ENV.chatWebhookUrl?.trim();
  if (!url) return;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (ENV.chatWebhookSecret?.trim()) {
    headers["Authorization"] = `Bearer ${ENV.chatWebhookSecret.trim()}`;
  }

  axios
    .post(url, payload, { headers, timeout: 10000 })
    .then(() => {
      console.log("[DispatchWebhook] Notified chat system:", payload.campaignId, payload.contacts.length, "contacts");
    })
    .catch((err) => {
      console.error("[DispatchWebhook] Failed to notify chat system:", err.message, err.response?.status);
    });
}
