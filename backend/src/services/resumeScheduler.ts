import schedule from 'node-schedule';
import { messageStore } from './messageStore';
import { geminiService } from './geminiService';
import { getConnection } from './Baileys';

interface ResumeConfig {
  enabled: boolean;
  sourceGroupId: string;
  destinationGroupId: string;
  hourOfDay: number;
  geminiApiKey: string;
}

class ResumeScheduler {
  private job: schedule.Job | null = null;
  private config: ResumeConfig | null = null;

  configure(config: ResumeConfig): void {
    console.log('[ResumeScheduler] Configurando scheduler:', {
      enabled: config.enabled,
      sourceGroupId: config.sourceGroupId,
      destinationGroupId: config.destinationGroupId,
      hourOfDay: config.hourOfDay,
    });

    this.config = config;

    // Cancela job anterior se existir
    if (this.job) {
      this.job.cancel();
      this.job = null;
      console.log('[ResumeScheduler] Job anterior cancelado');
    }

    if (!config.enabled) {
      console.log('[ResumeScheduler] Resumo automático desativado');
      return;
    }

    // Valida configuração
    if (!config.sourceGroupId || !config.destinationGroupId) {
      console.error('[ResumeScheduler] IDs de grupo não configurados');
      return;
    }

    if (!config.geminiApiKey) {
      console.error('[ResumeScheduler] API Key do Gemini não configurada');
      return;
    }

    // Inicializa Gemini
    try {
      geminiService.initialize(config.geminiApiKey);
    } catch (error: any) {
      console.error('[ResumeScheduler] Erro ao inicializar Gemini:', error.message);
      return;
    }

    // Agenda job para rodar todos os dias no horário configurado
    const cronExpression = `0 ${config.hourOfDay} * * *`;
    
    this.job = schedule.scheduleJob(cronExpression, async () => {
      await this.generateAndSendResume();
    });

    console.log(`[ResumeScheduler] Job agendado para ${config.hourOfDay}:00 todos os dias`);
  }

  async generateAndSendResume(): Promise<void> {
    if (!this.config) {
      console.error('[ResumeScheduler] Configuração não definida');
      return;
    }

    console.log('[ResumeScheduler] Iniciando geração de resumo...');

    try {
      // Busca mensagens armazenadas
      const messages = messageStore.getMessages(this.config.sourceGroupId);
      
      if (messages.length === 0) {
        console.log('[ResumeScheduler] Nenhuma mensagem para resumir');
        return;
      }

      console.log(`[ResumeScheduler] ${messages.length} mensagens encontradas`);

      // Gera resumo usando Gemini
      const summary = await geminiService.generateSummary(messages);

      // Envia resumo para o grupo de destino
      const connection = getConnection('mensageria'); // TODO: usar identificação dinâmica
      await connection.sendMessage(this.config.destinationGroupId, {
        text: summary,
      });

      console.log('[ResumeScheduler] Resumo enviado com sucesso');

      // Limpa mensagens após enviar
      messageStore.clearMessages(this.config.sourceGroupId);
      
    } catch (error: any) {
      console.error('[ResumeScheduler] Erro ao gerar/enviar resumo:', error.message);
    }
  }

  // Método para testar manualmente
  async testResume(): Promise<void> {
    console.log('[ResumeScheduler] Teste manual de resumo...');
    await this.generateAndSendResume();
  }

  getStatus(): any {
    return {
      configured: this.config !== null,
      enabled: this.config?.enabled || false,
      nextRun: this.job?.nextInvocation()?.toISOString() || null,
      geminiInitialized: geminiService.isInitialized(),
    };
  }
}

export const resumeScheduler = new ResumeScheduler();
