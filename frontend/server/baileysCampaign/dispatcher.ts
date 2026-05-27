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
import { normalizePhoneNumber } from "@shared/phoneUtils";

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

export interface AxiosErrorDetail {
  status?: number;
  /** Mensagem legível para UI/logs (corpo do backend ou fallback HTTP). */
  message: string;
  responseData?: unknown;
}

/**
 * Extrai status e mensagem úteis de erros do Axios.
 * O Axios só expõe "Request failed with status code 400" em `error.message`,
 * enquanto o motivo real costuma estar em `response.data.error` ou `.message`.
 */
export function extractAxiosErrorDetail(error: unknown): AxiosErrorDetail {
  const err = error as {
    message?: string;
    response?: { status?: number; data?: unknown };
  };
  const status = err.response?.status;
  const data = err.response?.data;

  let backendMessage: string | undefined;
  if (typeof data === "string" && data.trim()) {
    backendMessage = data.trim();
  } else if (data && typeof data === "object" && !Array.isArray(data)) {
    const record = data as Record<string, unknown>;
    for (const key of ["error", "message", "msg"] as const) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        backendMessage = value.trim();
        break;
      }
    }
  }

  const message =
    backendMessage ??
    (status != null ? `Erro HTTP ${status} ao enviar mensagem` : undefined) ??
    err.message ??
    String(error);

  return { status, message, responseData: data };
}

/** Mídia opcional para envio (URL pública — Baileys faz fetch). */
export interface SendOptions {
  mediaUrl?: string | null;
  mediaType?: "image" | "document" | "audio" | null;
  mediaFileName?: string | null;
  mediaMimeType?: string | null;
}

/** Erros do backend que indicam sessão Baileys ausente ou inativa (ex.: após restart do container). */
/** Timeout interno do Baileys ao aguardar ACK do WhatsApp (comum logo após reconectar). */
export function isBaileysSendTimeoutError(message?: string): boolean {
  if (!message) return false;
  const msg = message.toLowerCase();
  return msg.includes("timed out waiting for message") || msg.includes("timeout");
}

/** Alguns backends Baileys retornam este erro quando recebem formato inesperado do telefone. */
export function isNotRegisteredPhoneError(status?: number, message?: string): boolean {
  if (status !== 400 || !message) return false;
  const msg = message.toLowerCase();
  return (
    msg.includes("não está cadastrado no whatsapp") ||
    msg.includes("nao esta cadastrado no whatsapp") ||
    msg.includes("not registered on whatsapp")
  );
}

/**
 * Gera variações de telefone para compatibilidade com backends legados.
 * Ordem de tentativa: E.164 (55...), nacional (11 dígitos), com '+', e sem 9º dígito.
 */
export function buildPhoneCandidates(normalizedPhone: string): string[] {
  const candidates = new Set<string>();
  candidates.add(normalizedPhone);
  if (normalizedPhone.startsWith("55") && normalizedPhone.length >= 12) {
    candidates.add(normalizedPhone.slice(2));
  }
  candidates.add(`+${normalizedPhone}`);
  if (normalizedPhone.length === 13) {
    // Compatibilidade com bases antigas sem o nono dígito.
    candidates.add(`${normalizedPhone.slice(0, 4)}${normalizedPhone.slice(5)}`);
  }
  return Array.from(candidates);
}

export function isBackendConnectionMissingError(status?: number, message?: string): boolean {
  if (!message) return false;
  const msg = message.toLowerCase();
  return (
    (status === 404 || status === 400) &&
    (msg.includes("não está ativa") ||
      msg.includes("não encontrada") ||
      msg.includes("nao encontrada") ||
      msg.includes("not found"))
  );
}

function getBackendApiToken(): string {
  const apiToken = process.env.BACKEND_API_TOKEN;
  if (!apiToken) {
    throw new Error("BACKEND_API_TOKEN não configurado no servidor");
  }
  return apiToken;
}

/**
 * Recarrega o cache de API keys do backend a partir de GET /api/internal/connections.
 * Necessário após deploy/restart do serviço Baileys.
 */
export async function syncBackendTokenCache(): Promise<void> {
  const apiToken = getBackendApiToken();
  await axios.post(
    `${BACKEND_API_URL}/connections/sync`,
    {},
    { headers: { "x-auth-api": apiToken }, timeout: 15000 },
  );
}

/**
 * Sincroniza tokens e tenta reativar a sessão WhatsApp no backend.
 * Usado antes de disparos e após erro "Conexão não encontrada".
 */
export interface EnsureConnectionResult extends ConnectionHealth {
  /** Sessão foi (re)aberta nesta chamada — aguardar sync antes do primeiro envio. */
  reconnected?: boolean;
}

export async function ensureBackendConnection(
  identification: string,
): Promise<EnsureConnectionResult> {
  const apiToken = getBackendApiToken();

  try {
    await syncBackendTokenCache();
  } catch (syncError) {
    const detail = extractAxiosErrorDetail(syncError);
    console.warn(
      `[BaileysDispatcher] syncBackendTokenCache falhou para "${identification}":`,
      detail.message,
    );
  }

  let health = await checkConnectionHealth(identification);
  if (health.connected) return health;

  try {
    console.log(`[BaileysDispatcher] Reativando sessão "${identification}" no backend...`);
    await axios.post(
      `${BACKEND_API_URL}/connections/${encodeURIComponent(identification)}/connect`,
      {},
      { headers: { "x-auth-api": apiToken }, timeout: 20000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 2500));
    health = await checkConnectionHealth(identification);
    if (health.connected) {
      return { ...health, reconnected: true };
    }
  } catch (connectError) {
    const detail = extractAxiosErrorDetail(connectError);
    console.warn(
      `[BaileysDispatcher] connect falhou para "${identification}":`,
      detail.message,
    );
    return { connected: false, error: detail.message };
  }

  return health;
}

async function postBaileysSend(
  identification: string,
  phone: string,
  text: string,
  options: SendOptions,
): Promise<SendResult> {
  const apiToken = getBackendApiToken();
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
    { headers: { "x-auth-api": apiToken }, timeout: 90000 },
  );

  const data = (response.data ?? {}) as Record<string, unknown>;
  const inner = (data.data ?? data) as Record<string, unknown>;
  const key = inner.key as Record<string, unknown> | undefined;
  const messageId = inner.messageId ?? key?.id ?? inner.id;
  return { messageId: messageId != null ? String(messageId) : undefined };
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
  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) {
    throw new Error(`Telefone inválido para WhatsApp: ${phone}`);
  }

  const phoneCandidates = buildPhoneCandidates(normalizedPhone);

  try {
    return await postBaileysSend(identification, phoneCandidates[0], text, options);
  } catch (error) {
    const detail = extractAxiosErrorDetail(error);

    if (isNotRegisteredPhoneError(detail.status, detail.message) && phoneCandidates.length > 1) {
      for (const candidate of phoneCandidates.slice(1)) {
        try {
          console.warn(
            `[BaileysDispatcher] Backend rejeitou "${phoneCandidates[0]}"; tentando fallback "${candidate}" para "${identification}"...`,
          );
          return await postBaileysSend(identification, candidate, text, options);
        } catch (candidateError) {
          const candidateDetail = extractAxiosErrorDetail(candidateError);
          if (!isNotRegisteredPhoneError(candidateDetail.status, candidateDetail.message)) {
            throw candidateError;
          }
        }
      }
    }

    if (isBackendConnectionMissingError(detail.status, detail.message)) {
      console.warn(
        `[BaileysDispatcher] "${identification}" ausente no backend — tentando sync + reconnect...`,
      );
      const health = await ensureBackendConnection(identification);
      if (health.connected) {
        try {
          return await postBaileysSend(identification, phoneCandidates[0], text, options);
        } catch (retryError) {
          const retryDetail = extractAxiosErrorDetail(retryError);
          console.error(
            `[BaileysDispatcher] Reenvio após reconnect falhou identification="${identification}":`,
            retryDetail.message,
          );
          throw retryError;
        }
      }
    }

    console.error(
      `[BaileysDispatcher] Falha ao enviar identification="${identification}" phone="${phone}" status=${detail.status ?? "n/a"}:`,
      detail.message,
      detail.responseData != null ? { response: detail.responseData } : "",
    );
    throw error;
  }
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
