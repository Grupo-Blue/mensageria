/**
 * Webhook de disparo para campanhas Baileys.
 *
 * Notifica um sistema de chat externo quando uma campanha Baileys termina de ser
 * disparada, no mesmo formato `campaign.dispatched` usado pelas campanhas Meta
 * (com `channel: "baileys"` para distinguir a origem). Reutiliza apenas a leitura
 * de configuração (`getChatWebhookConfig`); o envio é próprio — fire-and-forget.
 */
import axios from "axios";
import { getChatWebhookConfig } from "../whatsappBusiness/chatWebhookConfig";

export interface BaileysDispatchContact {
  name: string | null;
  phone: string;
}

export interface BaileysCampaignDispatchedPayload {
  event: "campaign.dispatched";
  channel: "baileys";
  dispatchedAt: string;
  campaignId: number;
  campaignName: string;
  /** Identificação/telefone da conexão Baileys que disparou a campanha. */
  company: string;
  /** Texto representativo (primeira variação da mensagem). */
  message: string;
  contacts: BaileysDispatchContact[];
}

/**
 * Envia a notificação de campanha disparada ao webhook de chat configurado.
 * Nunca lança erro: falhas são apenas registradas em log.
 */
export async function notifyBaileysCampaignDispatched(
  payload: BaileysCampaignDispatchedPayload,
): Promise<void> {
  try {
    const config = await getChatWebhookConfig();
    const url = config.url?.trim();
    if (!url) {
      console.log(
        "[BaileysDispatchWebhook] Webhook de disparo não configurado (Admin > Webhook de disparo) – não enviado. Campanha:",
        payload.campaignId,
      );
      return;
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const secret = config.secret?.trim();
    if (secret) {
      headers["Authorization"] = `Bearer ${secret}`;
    }

    // Retry com backoff (delays antes da 2ª e 3ª tentativas). 4xx não é retentado.
    const retryDelaysMs = [1000, 3000];
    const maxAttempts = 1 + retryDelaysMs.length;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await axios.post(url, payload, { headers, timeout: 10000 });
        const tag = attempt > 1 ? ` (após ${attempt} tentativas)` : "";
        console.log(
          `[BaileysDispatchWebhook] Disparo notificado${tag} para a campanha ${payload.campaignId}`,
        );
        return;
      } catch (error) {
        const status = (error as { response?: { status?: number } }).response?.status;
        const msg = error instanceof Error ? error.message : String(error);
        lastError = status ? `HTTP ${status}: ${msg}` : msg;
        // 4xx: erro do cliente, não retenta
        if (status && status >= 400 && status < 500) {
          console.error(
            `[BaileysDispatchWebhook] Erro HTTP ${status} (não-retentável) na campanha ${payload.campaignId}:`,
            msg,
          );
          return;
        }
      }
      if (attempt < maxAttempts) {
        const baseDelay = retryDelaysMs[attempt - 1] ?? 5000;
        const delay = baseDelay + Math.floor(Math.random() * 250);
        console.warn(
          `[BaileysDispatchWebhook] Tentativa ${attempt}/${maxAttempts} falhou (${lastError}). Reenviando em ${delay}ms`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    console.error(
      `[BaileysDispatchWebhook] Falha ao notificar a campanha ${payload.campaignId} (esgotadas ${maxAttempts} tentativas):`,
      lastError,
    );
  } catch (error) {
    // Erro na configuração/setup (antes do envio) — não retentável.
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[BaileysDispatchWebhook] Erro de configuração ao notificar a campanha ${payload.campaignId}:`,
      message,
    );
  }
}
