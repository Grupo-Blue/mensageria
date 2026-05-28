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
  extractAxiosErrorDetail,
  ensureBackendConnection,
  isBackendConnectionMissingError,
  isBaileysSendTimeoutError,
} from "./dispatcher";
import { notifyBaileysCampaignDispatched } from "./dispatchWebhook";

let schedulerInterval: NodeJS.Timeout | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * IMPORTANTE — escala horizontal:
 *
 * Este scheduler é um singleton em memória. O conjunto `processing` que
 * impede processamento duplicado vale APENAS dentro do mesmo processo node.
 * Se a aplicação for escalada para múltiplas instâncias (cluster PM2,
 * vários containers, etc.), cada instância rodará o seu próprio scheduler
 * e os mesmos destinatários serão enviados em duplicidade.
 *
 * O design "scheduler em processo" foi escolhido conscientemente para evitar
 * dependência de Redis no MVP (alternativa avaliada e descartada no plano).
 * Para escalar horizontalmente, é necessário um mecanismo de claim atômico —
 * recomendado: adicionar `worker_id` + `claimed_at` em `baileys_campaigns` e
 * usar `UPDATE ... WHERE status='running' AND (worker_id IS NULL OR claimed_at < NOW()-INTERVAL X)`
 * para reivindicar exclusivamente, renovando periodicamente.
 */
export class BaileysCampaignScheduler {
  private static instance: BaileysCampaignScheduler | null = null;
  private isRunning = false;
  private readonly checkIntervalMs = 5000;
  /** Campanhas com loop de envio ativo NESTE processo (não funciona multi-instância — ver doc acima). */
  private readonly processing = new Set<number>();
  /** Campanhas que já tiveram o limite diário registrado em log (evita spam). */
  private readonly dailyLimitNotified = new Set<number>();
  /**
   * Cursor de round-robin por campanha: índice da última conexão usada (na ordem
   * de `getBaileysCampaignConnectionIds`). Vive em memória — após restart, recomeça
   * do 0, o que é aceitável (round-robin perfeito não é requisito).
   */
  private readonly roundRobinCursor = new Map<number, number>();
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

  /**
   * Cada etapa roda em try/catch isolado: falha em `activateScheduledCampaigns`
   * (ex.: coluna `updated_at` ausente) não pode impedir `resumeRunningCampaigns`
   * de processar campanhas já em `running`.
   */
  private async runScheduledTasks() {
    const steps: Array<{ name: string; run: () => Promise<void> }> = [
      { name: "activateScheduledCampaigns", run: () => this.activateScheduledCampaigns() },
      { name: "processAutoRetries", run: () => this.processAutoRetries() },
      { name: "resumeRunningCampaigns", run: () => this.resumeRunningCampaigns() },
    ];
    for (const step of steps) {
      try {
        await step.run();
      } catch (error) {
        console.error(`[BaileysCampaignScheduler] Erro em ${step.name}:`, error);
      }
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
   * Round-robin: escolhe a próxima conexão da campanha que está saudável e dentro
   * do warmup. Avança o cursor circularmente em `roundRobinCursor`. Conexões em
   * `unhealthy` (marcadas neste loop por erro de backend) são puladas.
   *
   * Retorna `null` quando NENHUMA conexão atende — o caller decide se pausa a
   * campanha (todas com erro de backend) ou aguarda o dia seguinte (warmup).
   */
  private async pickNextConnection(
    campaignId: number,
    connectionIds: number[],
    unhealthy: Set<number>,
  ): Promise<{
    pick: { id: number; identification: string; phoneNumber: string | null } | null;
    /** Quantas das conexões disponíveis foram puladas por warmup já saturado. */
    warmupExhaustedCount: number;
  }> {
    const N = connectionIds.length;
    if (N === 0) return { pick: null, warmupExhaustedCount: 0 };
    let warmupExhaustedCount = 0;
    const cursor = this.roundRobinCursor.get(campaignId) ?? -1;
    for (let i = 1; i <= N; i++) {
      const idx = (cursor + i) % N;
      const cid = connectionIds[idx];
      if (unhealthy.has(cid)) continue;
      const conn = await db.getWhatsappConnectionById(cid);
      if (!conn) continue;
      const warmupLimit = (conn as { warmupDailyLimit?: number | null }).warmupDailyLimit;
      if (typeof warmupLimit === "number" && warmupLimit > 0) {
        const sentToday = await db.countBaileysSentTodayForConnection(cid);
        if (sentToday >= warmupLimit) {
          warmupExhaustedCount++;
          continue;
        }
      }
      this.roundRobinCursor.set(campaignId, idx);
      return {
        pick: { id: conn.id, identification: conn.identification, phoneNumber: conn.phoneNumber },
        warmupExhaustedCount,
      };
    }
    return { pick: null, warmupExhaustedCount };
  }

  /**
   * Loop de envio de uma campanha: envia 1 mensagem, espera o delay anti-ban e repete.
   * Encerra quando: não há mais pendentes (→ `completed`), a campanha sai de `running`
   * (pausa/remoção) ou TODAS as conexões da campanha ficam indisponíveis (→ `paused`).
   *
   * Roteamento round-robin: a cada mensagem, escolhe a próxima conexão saudável
   * da lista atribuída à campanha. Conexões que falham por backend caído entram
   * num blocklist local até o fim deste loop (próximo tick do scheduler reavalia).
   */
  private async processCampaign(campaignId: number) {
    if (this.processing.has(campaignId)) return;
    this.processing.add(campaignId);
    /** Conexões que reportaram backend down NESTE loop — puladas pelo round-robin. */
    const unhealthyConnections = new Set<number>();
    /** Conexões já com priming (sync+reconnect) feito nesta execução. */
    const primedConnections = new Set<number>();
    /** Última mensagem de erro de backend down — usada se TODAS as conexões caírem. */
    let lastBackendDownMessage: string | null = null;
    try {
      while (true) {
        const campaign = await db.getBaileysCampaignById(campaignId);
        if (!campaign || campaign.status !== "running") break;

        const connectionIds = await db.getBaileysCampaignConnectionIds(campaignId);
        if (connectionIds.length === 0) {
          await db.updateBaileysCampaign(campaignId, { status: "failed", completedAt: new Date() });
          console.error(`[BaileysCampaignScheduler] Campanha ${campaignId} sem conexões atribuídas`);
          break;
        }

        // Pega só o próximo destinatário pendente (LIMIT 1) — evita carregar a lista
        // inteira a cada iteração.
        const nextRecipient = await db.getNextBaileysPendingRecipient(campaignId);
        if (!nextRecipient) {
          await db.updateBaileysCampaign(campaignId, { status: "completed", completedAt: new Date() });
          this.dailyLimitNotified.delete(campaignId);
          // Para o webhook de "concluída", usa a primeira conexão atribuída como
          // identificador (campo legado `company`).
          const firstConn = await db.getWhatsappConnectionById(connectionIds[0]);
          await this.fireDispatchWebhook(
            campaign,
            firstConn?.identification ?? "",
            firstConn?.phoneNumber ?? null,
          );
          console.log(`[BaileysCampaignScheduler] Campanha ${campaignId} concluída`);
          break;
        }

        // Limite diário por campanha (anti-ban / aquecimento): atingiu a cota — retoma depois.
        if (campaign.dailyLimit && campaign.dailyLimit > 0) {
          const sentToday = await db.countBaileysSentTodayForCampaign(campaignId);
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

        // Round-robin: escolhe a próxima conexão saudável.
        const { pick, warmupExhaustedCount } = await this.pickNextConnection(
          campaignId,
          connectionIds,
          unhealthyConnections,
        );

        if (!pick) {
          // Nenhuma conexão disponível. Decide o motivo:
          //   - Mistura/totalidade de unhealthy (com ao menos UMA backend-down)
          //     → pausa a campanha (usuário precisa reconectar).
          //   - Só warmup saturado → idle, sai do loop, próximo tick reavalia.
          // Sem o termo "unhealthy + warmup esgotados == total" a campanha
          // ficaria em loop infinito de retry no próximo tick (unhealthy reset).
          const totalUnavailable = unhealthyConnections.size + warmupExhaustedCount;
          if (
            totalUnavailable === connectionIds.length &&
            unhealthyConnections.size > 0 &&
            lastBackendDownMessage
          ) {
            await db.updateBaileysCampaignRecipient(nextRecipient.id, {
              status: "failed",
              errorMessage: lastBackendDownMessage.slice(0, 1000),
            });
            await this.refreshCounters(campaignId);
            await db.updateBaileysCampaign(campaignId, { status: "paused" });
            console.warn(
              `[BaileysCampaignScheduler] Campanha ${campaignId} pausada: todas as ${connectionIds.length} conexões indisponíveis (${unhealthyConnections.size} unhealthy + ${warmupExhaustedCount} warmup). Último erro: "${lastBackendDownMessage}". Reconecte em Conexões e clique em Retomar.`,
            );
            break;
          }
          if (warmupExhaustedCount > 0) {
            const notifyKey = -campaignId;
            if (!this.dailyLimitNotified.has(notifyKey)) {
              console.log(
                `[BaileysCampaignScheduler] Campanha ${campaignId}: todas as conexões com warmup esgotado — aguarda próximo dia`,
              );
              this.dailyLimitNotified.add(notifyKey);
            }
          }
          break;
        }

        // Priming do backend (uma vez por conexão por execução do loop).
        if (!primedConnections.has(pick.id)) {
          primedConnections.add(pick.id);
          const priming = await ensureBackendConnection(pick.identification);
          if (priming.reconnected) {
            console.log(
              `[BaileysCampaignScheduler] Conexão "${pick.identification}" reconectada — aguardando 35s para sync do WhatsApp antes do primeiro envio`,
            );
            await sleep(35000);
          } else if (priming.connected) {
            await sleep(5000);
          }
        }

        // Nota: NÃO fazemos pre-flight health check. O backend reportará 400/404
        // se a sessão caiu — tratado no catch abaixo (marca a conexão como
        // unhealthy e tenta a próxima no round-robin).
        const recipient = nextRecipient as BaileysCampaignRecipient;
        const variants = parseMessageVariants(campaign.messageVariants);
        try {
          if (variants.length === 0) {
            throw new Error("Campanha sem variações de mensagem válidas");
          }
          const { text, variantIndex } = renderMessage(variants, recipient);
          const result = await sendBaileysMessage(
            pick.identification,
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
            sentFromConnectionId: pick.id,
            sentAt: new Date(),
            errorMessage: null,
          });
        } catch (error) {
          const { status, message: errMsg, responseData } = extractAxiosErrorDetail(error);
          const errResp = (error as {
            response?: { status?: number; headers?: Record<string, string> };
          }).response;

          // HTTP 429 do backend (rate limit) — NÃO marca o destinatário como falho:
          // aguarda o Retry-After (ou padrão razoável) e tenta o MESMO destinatário
          // na próxima iteração. Isso evita perder envios por excesso de velocidade.
          if (status === 429) {
            const ra = errResp?.headers?.["retry-after"];
            const retrySec = ra ? Math.max(1, parseInt(ra, 10) || 60) : 60;
            console.warn(
              `[BaileysCampaignScheduler] Backend respondeu 429 (conn="${pick.identification}"); aguardando ${retrySec}s antes de retomar a campanha ${campaignId}`,
            );
            await sleep(retrySec * 1000);
            continue; // re-tenta no próximo tick (mesmo recipient, próxima conexão via RR)
          }

          // Conexão WhatsApp caída no backend (404/400): tenta UMA recuperação
          // via sync/connect; se falhar, marca essa conexão como unhealthy e
          // segue tentando o mesmo destinatário nas demais conexões.
          const isConnectionDown = isBackendConnectionMissingError(status, errMsg);
          if (isConnectionDown) {
            lastBackendDownMessage = errMsg;
            console.warn(
              `[BaileysCampaignScheduler] Campanha ${campaignId} conn="${pick.identification}": "${errMsg}" — tentando sync/reconnect...`,
            );
            const health = await ensureBackendConnection(pick.identification);
            if (health.connected) {
              continue; // mesma conexão recuperada — re-tenta o mesmo recipient
            }
            unhealthyConnections.add(pick.id);
            continue; // mesmo recipient, próximo round-robin pula esta conexão
          }

          const userFacingError = isBaileysSendTimeoutError(errMsg)
            ? "WhatsApp não confirmou o envio a tempo. Aguarde a conexão ficar estável (sync concluído) e retome a campanha."
            : errMsg;

          await db.updateBaileysCampaignRecipient(recipient.id, {
            status: "failed",
            errorMessage: userFacingError.slice(0, 1000),
            sentFromConnectionId: pick.id,
          });
          console.error(
            `[BaileysCampaignScheduler] Falha campanha=${campaignId} conexão="${pick.identification}" destino=${recipient.phoneNumber} HTTP=${status ?? "n/a"}:`,
            errMsg,
            responseData != null ? { response: responseData } : "",
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

  /** Recalcula `sentCount`/`failedCount` da campanha — usa SQL COUNT(*) GROUP BY, sem trazer linhas para a memória. */
  private async refreshCounters(campaignId: number) {
    const counts = await db.countBaileysRecipientStatuses(campaignId);
    await db.updateBaileysCampaign(campaignId, {
      sentCount: counts.sent,
      failedCount: counts.failed,
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
