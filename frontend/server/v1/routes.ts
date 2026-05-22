/**
 * API REST v1 para sistemas externos.
 *
 * Autenticação: header `x-api-key` com a API key da conexão Baileys
 * (gerada em Configurações da Conexão).
 *
 * Endpoint principal: POST /v1/connections/:identification/messages/bulk —
 * cria um disparo em massa e devolve `campaignId`. O envio em si é feito
 * em background pelo `baileysCampaignScheduler`, respeitando o delay
 * aleatório anti-ban configurado.
 */
import { Router, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import * as db from "../db";

const router = Router();

interface ApiAuthedRequest extends Request {
  apiConnection?: { id: number; userId: number; identification: string };
}

/** Rate limit por API key: 30 chamadas/min (criação de disparo é evento pontual). */
const v1RateLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.headers["x-api-key"] as string) || req.ip || "unknown",
  message: { error: "Limite de requisições excedido. Tente novamente em instantes." },
});

/** Autentica via API key per-connection e anexa `apiConnection` ao request. */
async function apiKeyAuth(req: ApiAuthedRequest, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || typeof apiKey !== "string") {
    return res.status(401).json({ error: "Header x-api-key é obrigatório" });
  }
  try {
    const connection = await db.getWhatsappConnectionByApiKey(apiKey);
    if (!connection) {
      return res.status(401).json({ error: "API key inválida" });
    }
    req.apiConnection = {
      id: connection.id,
      userId: connection.userId,
      identification: connection.identification,
    };
    return next();
  } catch (error) {
    console.error("[v1] Erro na autenticação:", error);
    return res.status(500).json({ error: "Erro interno ao autenticar" });
  }
}

interface BulkRecipientInput {
  phoneNumber?: unknown;
  name?: unknown;
  variables?: unknown;
}

/**
 * POST /v1/connections/:identification/messages/bulk
 * Cria um disparo em massa via Baileys.
 *
 * Body:
 *   {
 *     messageVariants: string[]   // 1 a 5 versões da mensagem (anti-ban)
 *     recipients: [{ phoneNumber, name?, variables? }]
 *     name?: string
 *     description?: string
 *     scheduledAt?: string        // ISO 8601 (futuro)
 *     minDelaySeconds?: number    // default 8
 *     maxDelaySeconds?: number    // default 25
 *     dailyLimit?: number
 *     autoRetryEnabled?: boolean  // default true
 *     maxRetries?: number         // default 3
 *     retryDelayMinutes?: number  // default 30
 *   }
 *
 * Responde 202 Accepted com `{ campaignId, recipientsQueued, status }`.
 */
router.post(
  "/connections/:identification/messages/bulk",
  v1RateLimit,
  apiKeyAuth,
  async (req: ApiAuthedRequest, res: Response) => {
    try {
      const { identification } = req.params;
      const conn = req.apiConnection;
      if (!conn || conn.identification !== identification) {
        return res.status(403).json({ error: "Esta API key não autoriza esta conexão" });
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const messageVariants = body.messageVariants;
      const recipients = body.recipients;

      if (
        !Array.isArray(messageVariants) ||
        messageVariants.length === 0 ||
        messageVariants.length > 5 ||
        !messageVariants.every((v) => typeof v === "string" && v.trim().length > 0)
      ) {
        return res.status(400).json({
          error: "messageVariants deve ser um array de 1 a 5 strings não vazias",
        });
      }
      if (!Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({
          error: "recipients deve ser um array com ao menos 1 destinatário",
        });
      }

      // Normaliza/valida destinatários
      const recipientsToInsert: Array<{
        campaignId: number;
        phoneNumber: string;
        name?: string;
        variables?: string;
        status: "pending";
      }> = [];
      for (const raw of recipients as BulkRecipientInput[]) {
        const phoneRaw = raw?.phoneNumber;
        if (typeof phoneRaw !== "string") {
          return res.status(400).json({ error: "Cada destinatário precisa de phoneNumber (string)" });
        }
        const phone = phoneRaw.replace(/\D/g, "");
        if (phone.length < 10) {
          return res.status(400).json({ error: `phoneNumber inválido: ${phoneRaw}` });
        }
        recipientsToInsert.push({
          campaignId: 0, // preenchido após criar a campanha
          phoneNumber: phone,
          name: typeof raw.name === "string" ? raw.name : undefined,
          variables:
            raw.variables && typeof raw.variables === "object" && !Array.isArray(raw.variables)
              ? JSON.stringify(raw.variables)
              : undefined,
          status: "pending",
        });
      }

      // Delays anti-ban
      const minDelaySeconds = typeof body.minDelaySeconds === "number" ? body.minDelaySeconds : 8;
      const maxDelaySeconds = typeof body.maxDelaySeconds === "number" ? body.maxDelaySeconds : 25;
      if (minDelaySeconds < 1 || maxDelaySeconds < 1 || maxDelaySeconds < minDelaySeconds) {
        return res.status(400).json({
          error: "minDelaySeconds e maxDelaySeconds devem ser >= 1 e max >= min",
        });
      }

      // Agendamento opcional
      let scheduled: Date | undefined;
      if (body.scheduledAt != null) {
        if (typeof body.scheduledAt !== "string") {
          return res.status(400).json({ error: "scheduledAt deve ser uma string ISO 8601" });
        }
        scheduled = new Date(body.scheduledAt);
        if (Number.isNaN(scheduled.getTime())) {
          return res.status(400).json({ error: "scheduledAt inválido (use ISO 8601)" });
        }
        if (scheduled <= new Date()) {
          return res.status(400).json({ error: "scheduledAt deve estar no futuro" });
        }
      }

      const name =
        (typeof body.name === "string" && body.name.trim()) ||
        `Disparo via API ${new Date().toISOString()}`;
      const description = typeof body.description === "string" ? body.description : undefined;
      const dailyLimit = typeof body.dailyLimit === "number" ? body.dailyLimit : undefined;
      const autoRetryEnabled =
        typeof body.autoRetryEnabled === "boolean" ? body.autoRetryEnabled : true;
      const maxRetries = typeof body.maxRetries === "number" ? body.maxRetries : 3;
      const retryDelayMinutes =
        typeof body.retryDelayMinutes === "number" ? body.retryDelayMinutes : 30;

      // Mídia opcional
      const mediaUrl = typeof body.mediaUrl === "string" ? body.mediaUrl : undefined;
      const mediaType = body.mediaType;
      if (mediaUrl && !["image", "document", "audio"].includes(String(mediaType))) {
        return res.status(400).json({
          error: "mediaType deve ser image, document ou audio quando enviar mediaUrl",
        });
      }
      const mediaFileName = typeof body.mediaFileName === "string" ? body.mediaFileName : undefined;
      const mediaMimeType = typeof body.mediaMimeType === "string" ? body.mediaMimeType : undefined;

      const campaignId = await db.createBaileysCampaign({
        userId: conn.userId,
        connectionId: conn.id,
        name,
        description,
        messageVariants: JSON.stringify(messageVariants),
        status: scheduled ? "scheduled" : "running",
        scheduledAt: scheduled,
        startedAt: scheduled ? undefined : new Date(),
        minDelaySeconds,
        maxDelaySeconds,
        dailyLimit,
        autoRetryEnabled,
        maxRetries,
        retryDelayMinutes,
        mediaUrl,
        mediaType: mediaUrl ? (mediaType as "image" | "document" | "audio") : undefined,
        mediaFileName,
        mediaMimeType,
      });

      // Preenche o campaignId real antes de inserir os destinatários
      for (const r of recipientsToInsert) r.campaignId = campaignId;
      await db.addBaileysCampaignRecipients(recipientsToInsert);
      await db.updateBaileysCampaign(campaignId, { totalRecipients: recipientsToInsert.length });

      return res.status(202).json({
        success: true,
        campaignId,
        recipientsQueued: recipientsToInsert.length,
        status: scheduled ? "scheduled" : "running",
        scheduledAt: scheduled?.toISOString() ?? null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao criar disparo";
      console.error("[v1/bulk] Erro:", error);
      return res.status(500).json({ error: message });
    }
  },
);

export default router;
