/**
 * Motor de disparo em massa via Baileys.
 *
 * Singleton com tick periódico. Todo o estado vive no banco
 * (`baileys_campaigns` / `baileys_campaign_recipients`), então o motor sobrevive
 * a reinícios do servidor — campanhas em `running` são retomadas automaticamente.
 *
 * Clone do padrão de `CampaignScheduler` (Meta), adaptado para:
 *  - envio livre de texto via Baileys (sem templates);
 *  - rotação de até 5 variações de mensagem + personalização `{{nome}}`;
 *  - delay aleatório entre mensagens (proteção anti-ban);
 *  - limite diário opcional;
 *  - pausa automática se a conexão WhatsApp cair.
 *
 * Diferença em relação ao motor Meta: o envio NÃO bloqueia a requisição tRPC.
 * O router apenas marca o status; este scheduler faz o envio em background.
 */
import * as db from "../db";
import type { BaileysCampaign, BaileysCampaignRecipient } from "../../drizzle/schema";
import {
  parseMessageVariants,
  renderMessage,
  randomDelayMs,
  sendBaileysMessage,
  checkConnectionHealth,
} from "./dispatcher";
import { notifyBaileysCampaignDispatched } from "./dispatchWebhook";

let schedulerInterval: NodeJS.Timeout | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class BaileysCampaignScheduler {
  private static instance: BaileysCampaignScheduler | null = null;
  private isRunning = false;
  private readonly checkIntervalMs = 5000;
  /** Campanhas com loop de envio ativo neste processo (evita processamento duplicado). */
  private readonly processing = new Set<number>();
  /** Campanhas que já tiveram o limite diário registrado em log (evita spam). */
  private readonly dailyLimitNotified = new Set<number>();

  private constructor() {}

  static getInstance(): BaileysCampaignScheduler {
    if (!BaileysCampaignScheduler.instance) {
      BaileysCampaignScheduler.instance = new BaileysCampaignScheduler();
    }
    return BaileysCampaignScheduler.instance;
  }

  start() {
    if (this.isRunning) {
      console.log("[BaileysCampaignScheduler] Já está em execução");
      return;
    }
    this.isRunning = true;
    console.log(
      "[BaileysCampaignScheduler] Iniciado - verificando a cada",
      this.checkIntervalMs / 1000,
      "segundos",
    );
    this.runScheduledTasks();
    schedulerInterval = setInterval(() => this.runScheduledTasks(), this.checkIntervalMs);
  }

  stop() {
    if (schedulerInterval) {
      clearInterval(schedulerInterval);
      schedulerInterval = null;
    }
    this.isRunning = false;
    console.log("[BaileysCampaignScheduler] Parado");
  }

  private async runScheduledTasks() {
    try {
      await this.activateScheduledCampaigns();
      await this.processAutoRetries();
      await this.resumeRunningCampaigns();
    } catch (error) {
      console.error("[BaileysCampaignScheduler] Erro no ciclo de tarefas:", error);
    }
  }

  /** Campanhas agendadas cujo horário chegou passam para `running`. */
  private async activateScheduledCampaigns() {
    const dbInstance = await db.getDb();
    if (!dbInstance) return;
    const { baileysCampaigns } = await import("../../drizzle/schema");
    const { eq, and, lte } = await import("drizzle-orm");
    const now = new Date();
    const due = await dbInstance
      .select()
      .from(baileysCampaigns)
      .where(and(eq(baileysCampaigns.status, "scheduled"), lte(baileysCampaigns.scheduledAt, now)));
    for (const campaign of due) {
      console.log(`[BaileysCampaignScheduler] Ativando campanha agendada ${campaign.id}`);
      await db.updateBaileysCampaign(campaign.id, {
        status: "running",
        startedAt: campaign.startedAt ?? new Date(),
        completedAt: null,
      });
    }
  }

  /** Garante um loop de envio para cada campanha `running` (inclusive após restart). */
  private async resumeRunningCampaigns() {
    const dbInstance = await db.getDb();
    if (!dbInstance) return;
    const { baileysCampaigns } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const running = await dbInstance
      .select()
      .from(baileysCampaigns)
      .where(eq(baileysCampaigns.status, "running"));
    for (const campaign of running) {
      if (!this.processing.has(campaign.id)) {
        void this.processCampaign(campaign.id);
      }
    }
  }

  /**
   * Reenvio automático: para campanhas encerradas (`completed`/`failed`) com
   * auto-retry ligado, devolve as falhas elegíveis para a fila e volta a `running`.
   * Não mexe em campanhas `running`, `scheduled`, `draft` ou `paused`.
   */
  private async processAutoRetries() {
    const dbInstance = await db.getDb();
    if (!dbInstance) return;
    const { baileysCampaigns } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const candidates = await dbInstance
      .select()
      .from(baileysCampaigns)
      .where(eq(baileysCampaigns.autoRetryEnabled, true));
    for (const campaign of candidates) {
      if (campaign.status !== "completed" && campaign.status !== "failed") continue;
      const failed = await db.getBaileysFailedRecipientsForRetry(
        campaign.id,
        campaign.maxRetries,
        campaign.retryDelayMinutes,
      );
      if (failed.length === 0) continue;
      console.log(
        `[BaileysCampaignScheduler] Auto-retry: ${failed.length} destinatário(s) da campanha ${campaign.id}`,
      );
      for (const recipient of failed) {
        await db.incrementBaileysRecipientRetryCount(recipient.id);
      }
      await db.updateBaileysCampaign(campaign.id, { status: "running", completedAt: null });
    }
  }

  /**
   * Loop de envio de uma campanha: envia 1 mensagem, espera o delay anti-ban e repete.
   * Encerra quando: não há mais pendentes (→ `completed`), a campanha sai de `running`
   * (pausa/remoção) ou a conexão WhatsApp fica indisponível (→ `paused`).
   */
  private async processCampaign(campaignId: number) {
    if (this.processing.has(campaignId)) return;
    this.processing.add(campaignId);
    try {
      while (true) {
        const campaign = await db.getBaileysCampaignById(campaignId);
        if (!campaign || campaign.status !== "running") break;

        const connection = await db.getWhatsappConnectionById(campaign.connectionId);
        if (!connection) {
          await db.updateBaileysCampaign(campaignId, { status: "failed", completedAt: new Date() });
          console.error(
            `[BaileysCampaignScheduler] Campanha ${campaignId}: conexão ${campaign.connectionId} não encontrada`,
          );
          break;
        }

        const pending = await db.getBaileysCampaignRecipientsByStatus(campaignId, "pending");
        if (pending.length === 0) {
          await db.updateBaileysCampaign(campaignId, { status: "completed", completedAt: new Date() });
          this.dailyLimitNotified.delete(campaignId);
          await this.fireDispatchWebhook(campaign, connection.identification, connection.phoneNumber);
          console.log(`[BaileysCampaignScheduler] Campanha ${campaignId} concluída`);
          break;
        }

        // Limite diário por campanha (anti-ban / aquecimento): atingiu a cota — retoma depois.
        if (campaign.dailyLimit && campaign.dailyLimit > 0) {
          const sentToday = await this.countSentToday(campaignId);
          if (sentToday >= campaign.dailyLimit) {
            if (!this.dailyLimitNotified.has(campaignId)) {
              console.log(
                `[BaileysCampaignScheduler] Campanha ${campaignId}: limite diário (${campaign.dailyLimit}) atingido — retoma no próximo dia`,
              );
              this.dailyLimitNotified.add(campaignId);
            }
            break;
          }
        }

        // Limite diário por conexão (aquecimento de chip novo): soma todos os disparos
        // desta conexão. Quando setado e atingido, pausa a iteração até o próximo dia.
        const warmupLimit = (connection as { warmupDailyLimit?: number | null }).warmupDailyLimit;
        if (typeof warmupLimit === "number" && warmupLimit > 0) {
          const sentTodayByConnection = await db.countBaileysSentTodayForConnection(
            campaign.connectionId,
          );
          if (sentTodayByConnection >= warmupLimit) {
            const notifyKey = -campaign.connectionId; // chave negativa para distinguir do per-campaign
            if (!this.dailyLimitNotified.has(notifyKey)) {
              console.log(
                `[BaileysCampaignScheduler] Conexão ${connection.identification}: warmup diário (${warmupLimit}) atingido — disparo ${campaignId} aguarda até amanhã`,
              );
              this.dailyLimitNotified.add(notifyKey);
            }
            break;
          }
        }

        // Saúde da conexão: se o WhatsApp caiu, pausa a campanha (retomável depois).
        const health = await checkConnectionHealth(connection.identification);
        if (!health.connected) {
          await db.updateBaileysCampaign(campaignId, { status: "paused" });
          console.warn(
            `[BaileysCampaignScheduler] Campanha ${campaignId} pausada: conexão ${connection.identification} indisponível`,
          );
          break;
        }

        const recipient = pending[0] as BaileysCampaignRecipient;
        const variants = parseMessageVariants(campaign.messageVariants);
        try {
          if (variants.length === 0) {
            throw new Error("Campanha sem variações de mensagem válidas");
          }
          const { text, variantIndex } = renderMessage(variants, recipient);
          const result = await sendBaileysMessage(
            connection.identification,
            recipient.phoneNumber,
            text,
            {
              mediaUrl: campaign.mediaUrl,
              mediaType: campaign.mediaType,
              mediaFileName: campaign.mediaFileName,
              mediaMimeType: campaign.mediaMimeType,
            },
          );
          await db.updateBaileysCampaignRecipient(recipient.id, {
            status: "sent",
            whatsappMessageId: result.messageId ?? null,
            sentVariantIndex: variantIndex,
            sentAt: new Date(),
            errorMessage: null,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await db.updateBaileysCampaignRecipient(recipient.id, {
            status: "failed",
            errorMessage: message.slice(0, 1000),
          });
          console.error(
            `[BaileysCampaignScheduler] Falha ao enviar para ${recipient.phoneNumber}:`,
            message,
          );
        }

        await this.refreshCounters(campaignId);

        // Delay aleatório anti-ban antes da próxima mensagem.
        await sleep(randomDelayMs(campaign.minDelaySeconds, campaign.maxDelaySeconds));
      }
    } catch (error) {
      console.error(`[BaileysCampaignScheduler] Erro ao processar campanha ${campaignId}:`, error);
    } finally {
      this.processing.delete(campaignId);
    }
  }

  /** Conta quantas mensagens da campanha já foram enviadas hoje (para o limite diário). */
  private async countSentToday(campaignId: number): Promise<number> {
    const recipients = (await db.getBaileysCampaignRecipients(campaignId)) as BaileysCampaignRecipient[];
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return recipients.filter(
      (r) => r.status === "sent" && r.sentAt != null && new Date(r.sentAt) >= startOfDay,
    ).length;
  }

  /** Recalcula `sentCount`/`failedCount` da campanha a partir dos destinatários. */
  private async refreshCounters(campaignId: number) {
    const recipients = (await db.getBaileysCampaignRecipients(campaignId)) as BaileysCampaignRecipient[];
    await db.updateBaileysCampaign(campaignId, {
      sentCount: recipients.filter((r) => r.status === "sent").length,
      failedCount: recipients.filter((r) => r.status === "failed").length,
    });
  }

  /** Dispara o webhook `campaign.dispatched` com os contatos efetivamente enviados. */
  private async fireDispatchWebhook(
    campaign: BaileysCampaign,
    connectionIdentification: string,
    connectionPhone: string | null,
  ) {
    try {
      const recipients = (await db.getBaileysCampaignRecipients(campaign.id)) as BaileysCampaignRecipient[];
      const sent = recipients.filter((r) => r.status === "sent");
      if (sent.length === 0) return;
      const variants = parseMessageVariants(campaign.messageVariants);
      await notifyBaileysCampaignDispatched({
        event: "campaign.dispatched",
        channel: "baileys",
        dispatchedAt: new Date().toISOString(),
        campaignId: campaign.id,
        campaignName: campaign.name,
        company: connectionPhone || connectionIdentification,
        message: variants[0] ?? "",
        contacts: sent.map((r) => ({ name: r.name ?? null, phone: r.phoneNumber })),
      });
    } catch (error) {
      console.error(
        `[BaileysCampaignScheduler] Erro ao disparar webhook da campanha ${campaign.id}:`,
        error,
      );
    }
  }

  /**
   * Reenvio manual: devolve para a fila as falhas elegíveis (`retryCount < maxRetries`)
   * e recoloca a campanha em `running`. O envio em si fica a cargo do scheduler.
   */
  async manualRetry(campaignId: number): Promise<{ retried: number }> {
    const campaign = await db.getBaileysCampaignById(campaignId);
    if (!campaign) throw new Error("Campanha não encontrada");

    const dbInstance = await db.getDb();
    if (!dbInstance) throw new Error("Banco de dados indisponível");
    const { baileysCampaignRecipients } = await import("../../drizzle/schema");
    const { eq, and, lt } = await import("drizzle-orm");
    const failed = await dbInstance
      .select()
      .from(baileysCampaignRecipients)
      .where(
        and(
          eq(baileysCampaignRecipients.campaignId, campaignId),
          eq(baileysCampaignRecipients.status, "failed"),
          lt(baileysCampaignRecipients.retryCount, campaign.maxRetries),
        ),
      );
    if (failed.length === 0) return { retried: 0 };

    for (const recipient of failed) {
      await db.incrementBaileysRecipientRetryCount(recipient.id);
    }
    await db.updateBaileysCampaign(campaignId, { status: "running", completedAt: null });
    return { retried: failed.length };
  }
}

export const baileysCampaignScheduler = BaileysCampaignScheduler.getInstance();
