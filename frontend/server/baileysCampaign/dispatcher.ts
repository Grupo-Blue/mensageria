/**
 * Dispatcher de campanhas Baileys.
 *
 * Camada de envio reutilizada pelo motor de disparo em massa (Fase 2). Encapsula:
 *  - seleção/rotação das variações de mensagem (anti-ban);
 *  - personalização por destinatário ({{nome}} e campos customizados);
 *  - delay aleatório entre envios (jitter anti-ban);
 *  - o envio unitário via o backend Baileys (mesmo caminho de `whatsapp.sendMessage`).
 */
import axios from "axios";

// Mesmo backend usado por whatsapp.sendMessage em server/routers.ts.
const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://localhost:5600";

/** Quantidade máxima de variações de mensagem por campanha. */
export const MAX_MESSAGE_VARIANTS = 5;

export interface DispatchRecipient {
  name?: string | null;
  /** JSON string com campos customizados para placeholders {{campo}}. */
  variables?: string | null;
}

export interface RenderedMessage {
  text: string;
  /** Índice da variação sorteada (0-based) — gravado em sent_variant_index. */
  variantIndex: number;
}

/**
 * Faz parse do campo `message_variants` (JSON string) em um array de variações.
 * Aceita também uma string única por compatibilidade. Retorna apenas variações não vazias.
 */
export function parseMessageVariants(raw: string | null | undefined): string[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Não era JSON: trata o valor bruto como variação única.
    return raw.trim() ? [raw] : [];
  }
  if (typeof parsed === "string") {
    return parsed.trim() ? [parsed] : [];
  }
  if (Array.isArray(parsed)) {
    return parsed
      .filter((v): v is string => typeof v === "string")
      .filter((v) => v.trim().length > 0);
  }
  return [];
}

/** Converte o JSON de variáveis do destinatário em um mapa (chaves em minúsculas). */
function parseVariables(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        out[k.toLowerCase()] = v == null ? "" : String(v);
      }
      return out;
    }
  } catch {
    // JSON inválido: ignora e segue sem variáveis customizadas.
  }
  return {};
}

/**
 * Substitui placeholders `{{campo}}` no texto pelos dados do destinatário.
 * `{{nome}}` usa o nome do destinatário; placeholders sem valor viram string vazia.
 */
export function applyVariables(template: string, recipient: DispatchRecipient): string {
  const fields = parseVariables(recipient.variables);
  // O nome do destinatário alimenta {{nome}}, salvo se já houver um valor explícito em variables.
  if (recipient.name != null && fields.nome === undefined) {
    fields.nome = recipient.name;
  }
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key: string) => {
    const value = fields[String(key).toLowerCase()];
    return value != null ? value : "";
  });
}

/**
 * Sorteia uma variação da mensagem e aplica a personalização do destinatário.
 * Variar o texto entre contatos reduz o risco de banimento.
 */
export function renderMessage(variants: string[], recipient: DispatchRecipient): RenderedMessage {
  if (!variants || variants.length === 0) {
    throw new Error("A campanha precisa de ao menos uma variação de mensagem");
  }
  const variantIndex = Math.floor(Math.random() * variants.length);
  const text = applyVariables(variants[variantIndex], recipient);
  return { text, variantIndex };
}

/**
 * Delay aleatório (jitter) em milissegundos entre `minSec` e `maxSec`.
 * Espaçar os envios de forma irregular é a principal proteção anti-ban.
 */
export function randomDelayMs(minSec: number, maxSec: number): number {
  const lo = Math.max(0, Math.min(minSec, maxSec));
  const hi = Math.max(0, Math.max(minSec, maxSec));
  return Math.round((lo + Math.random() * (hi - lo)) * 1000);
}

export interface SendResult {
  messageId?: string;
}

/** Mídia opcional para envio (URL pública — Baileys faz fetch). */
export interface SendOptions {
  mediaUrl?: string | null;
  mediaType?: "image" | "document" | "audio" | null;
  mediaFileName?: string | null;
  mediaMimeType?: string | null;
}

/**
 * Envia uma mensagem (texto e/ou mídia) via o backend Baileys.
 * Usa o endpoint multi-tenant `/connections/:id/send`, que já tem rate limit.
 */
export async function sendBaileysMessage(
  identification: string,
  phone: string,
  text: string,
  options: SendOptions = {},
): Promise<SendResult> {
  const apiToken = process.env.BACKEND_API_TOKEN;
  if (!apiToken) {
    throw new Error("BACKEND_API_TOKEN não configurado no servidor");
  }

  const body: Record<string, unknown> = { phone, message: text };
  if (options.mediaUrl) {
    body.mediaUrl = options.mediaUrl;
    body.mediaType = options.mediaType ?? "image";
    if (options.mediaFileName) body.mediaFileName = options.mediaFileName;
    if (options.mediaMimeType) body.mediaMimeType = options.mediaMimeType;
  }

  const response = await axios.post(
    `${BACKEND_API_URL}/connections/${encodeURIComponent(identification)}/send`,
    body,
    { headers: { "x-auth-api": apiToken }, timeout: 30000 },
  );

  // Resposta: { success, message, data: { key:{id}, ... } }
  const data = (response.data ?? {}) as Record<string, unknown>;
  const inner = (data.data ?? data) as Record<string, unknown>;
  const key = inner.key as Record<string, unknown> | undefined;
  const messageId = inner.messageId ?? key?.id ?? inner.id;
  return { messageId: messageId != null ? String(messageId) : undefined };
}

export interface ConnectionHealth {
  connected: boolean;
  phoneNumber?: string;
  /** Detalhe do erro quando `connected` é falso por falha (rede, auth, etc.) e não por status. */
  error?: string;
}

/**
 * Consulta a saúde de uma conexão Baileys no backend.
 *
 * IMPORTANTE: esta função NÃO é mais usada pelo scheduler como pre-flight
 * (causava pausa silenciosa quando o pre-flight falhava por motivo de rede
 * em vez de conexão genuinamente caída). O scheduler agora deixa a tentativa
 * de envio ser o teste. Esta função fica como utilitário para diagnóstico
 * (por ex., um endpoint de status no futuro).
 */
export async function checkConnectionHealth(identification: string): Promise<ConnectionHealth> {
  const apiToken = process.env.BACKEND_API_TOKEN;
  if (!apiToken) {
    console.error("[BaileysDispatcher] BACKEND_API_TOKEN não configurado");
    return { connected: false, error: "BACKEND_API_TOKEN não configurado" };
  }
  try {
    const response = await axios.get(
      `${BACKEND_API_URL}/connections/${encodeURIComponent(identification)}`,
      { headers: { "x-auth-api": apiToken }, timeout: 10000 },
    );
    const data = (response.data ?? {}) as Record<string, unknown>;
    return {
      connected: data.connected === true,
      phoneNumber: data.phoneNumber != null ? String(data.phoneNumber) : undefined,
    };
  } catch (error) {
    // Não engolir mais o erro silenciosamente — logar com contexto para
    // facilitar diagnóstico (URL, status HTTP, mensagem).
    const err = error as {
      message?: string;
      code?: string;
      response?: { status?: number; data?: unknown };
    };
    const detail =
      err.response?.status != null
        ? `HTTP ${err.response.status}`
        : err.code ?? err.message ?? "desconhecido";
    console.error(
      `[BaileysDispatcher] checkConnectionHealth falhou para "${identification}" via ${BACKEND_API_URL}: ${detail}`,
    );
    return { connected: false, error: detail };
  }
}
