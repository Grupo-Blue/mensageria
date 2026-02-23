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
 * Sends campaign dispatched payload to all configured chat webhook targets (fire-and-forget).
 * Uses CHAT_WEBHOOK_TARGETS (JSON array) ou CHAT_WEBHOOK_URL/CHAT_WEBHOOK_SECRET (legado).
 * Chama todos os targets em paralelo. Não lança erros; registra falhas em log.
 */
export function notifyCampaignDispatched(payload: CampaignDispatchedPayload): void {
  const targets = ENV.chatWebhookTargets;
  if (targets.length === 0) return;

  const promises = targets.map((target) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (target.secret) {
      headers["Authorization"] = `Bearer ${target.secret}`;
    }
    return axios
      .post(target.url, payload, { headers, timeout: 10000 })
      .then(() => {
        console.log(
          "[DispatchWebhook] Notified chat system:",
          target.url,
          payload.campaignId,
          payload.contacts.length,
          "contacts"
        );
      })
      .catch((err) => {
        console.error(
          "[DispatchWebhook] Failed to notify chat system:",
          target.url,
          err.message,
          err.response?.status
        );
      });
  });

  void Promise.allSettled(promises);
}
