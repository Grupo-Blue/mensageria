import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import axios from "axios";
import { MetaWhatsAppApi } from "./whatsappBusiness/metaApi";

const BACKEND_API_URL = process.env.BACKEND_API_URL || "http://localhost:5600";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  whatsappGroups: router({
    list: publicProcedure.query(async () => {
      return await db.getWhatsappGroups();
    }),
    save: publicProcedure
      .input(z.object({
        sessionId: z.string(),
        groupId: z.string(),
        groupName: z.string(),
        lastMessageAt: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const timestamp = input.lastMessageAt ? new Date(input.lastMessageAt) : undefined;
        await db.upsertWhatsappGroup(
          input.sessionId,
          input.groupId,
          input.groupName,
          timestamp
        );
        return { success: true };
      }),
  }),
  
  whatsapp: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getWhatsappConnections(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({ identification: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        console.log('[whatsapp.create] Starting with:', { userId: ctx.user.id, identification: input.identification });
        try {
          const existing = await db.getWhatsappConnectionByIdentification(input.identification);
          console.log('[whatsapp.create] Existing check:', existing);
          if (existing) throw new Error("Identificação já existe");
          
          console.log('[whatsapp.create] Creating connection in DB');
          await db.createWhatsappConnection({ userId: ctx.user.id, identification: input.identification, status: "connecting" });
          
          const apiToken = process.env.BACKEND_API_TOKEN;
          if (!apiToken) throw new Error('BACKEND_API_TOKEN não configurado');
          
          // Retorna URL para o usuário acessar e escanear o QR Code
          const qrCodeUrl = `${BACKEND_API_URL}/whatsapp/qrcode?token=${apiToken}`;
          console.log('[whatsapp.create] QR Code URL:', qrCodeUrl);
          
          return { success: true, qrCodeUrl };
        } catch (error: any) {
          console.error('[whatsapp.create] Error:', error.message, error.response?.data);
          throw new Error(error.response?.data?.message || error.message || "Erro ao gerar QR Code");
        }
      }),
    getQRCode: protectedProcedure.input(z.object({ identification: z.string() })).query(async ({ input }) => {
      const connection = await db.getWhatsappConnectionByIdentification(input.identification);
      if (!connection) throw new Error("Conexão não encontrada");
      return { qrCode: connection.qrCode, status: connection.status };
    }),
    checkStatus: protectedProcedure.input(z.object({ identification: z.string() })).query(async ({ input }) => {
      try {
        const apiToken = process.env.BACKEND_API_TOKEN;
        if (!apiToken) throw new Error('BACKEND_API_TOKEN não configurado');
        
        const response = await axios.get(`${BACKEND_API_URL}/whatsapp/status/${input.identification}`, {
          headers: { 'x-auth-api': apiToken }
        });
        const connection = await db.getWhatsappConnectionByIdentification(input.identification);
        if (connection) {
          await db.updateWhatsappConnection(connection.id, {
            status: response.data.connected ? "connected" : "disconnected",
            phoneNumber: response.data.phoneNumber,
            lastConnectedAt: response.data.connected ? new Date() : connection.lastConnectedAt,
          });
        }
        return response.data;
      } catch (error: any) {
        return { connected: false };
      }
    }),
    disconnect: protectedProcedure.input(z.object({ id: z.number(), identification: z.string() })).mutation(async ({ input }) => {
      try {
        const apiToken = process.env.BACKEND_API_TOKEN;
        if (!apiToken) throw new Error('BACKEND_API_TOKEN não configurado');
        
        await axios.post(`${BACKEND_API_URL}/whatsapp/disconnect`, { identification: input.identification }, {
          headers: { 'x-auth-api': apiToken }
        });
        await db.updateWhatsappConnection(input.id, { status: "disconnected", qrCode: null });
        return { success: true };
      } catch (error: any) {
        throw new Error("Erro ao desconectar");
      }
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteWhatsappConnection(input.id);
      return { success: true };
    }),
    saveConnection: protectedProcedure
      .input(z.object({ identification: z.string(), phoneNumber: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const existing = await db.getWhatsappConnectionByIdentification(input.identification);
          if (existing) {
            // Atualizar conexão existente
            await db.updateWhatsappConnection(existing.id, {
              status: "connected",
              phoneNumber: input.phoneNumber,
              lastConnectedAt: new Date(),
            });
            return { success: true, id: existing.id };
          } else {
            // Criar nova conexão
            await db.createWhatsappConnection({
              userId: ctx.user.id,
              identification: input.identification,
              status: "connected",
              phoneNumber: input.phoneNumber,
              lastConnectedAt: new Date(),
            });
            const newConnection = await db.getWhatsappConnectionByIdentification(input.identification);
            return { success: true, id: newConnection?.id };
          }
        } catch (error: any) {
          throw new Error("Erro ao salvar conexão");
        }
      }),
    sync: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        const apiToken = process.env.BACKEND_API_TOKEN;
        if (!apiToken) throw new Error('BACKEND_API_TOKEN não configurado');
        
        // Buscar conexões do backend Docker
        const response = await axios.get(`${BACKEND_API_URL}/whatsapp/connections`, {
          headers: { 'x-auth-api': apiToken }
        });
        
        const connections = response.data;
        console.log('[whatsapp.sync] Conexões do backend:', connections);
        
        // Sincronizar cada conexão com o banco do frontend
        for (const conn of connections) {
          // Mapear campos da API do backend para o schema do frontend
          const identification = conn.id; // Backend usa 'id', frontend usa 'identification'
          const status = conn.connected ? 'connected' : 'disconnected';
          const phoneNumber = conn.phoneNumber || null;
          
          const existing = await db.getWhatsappConnectionByIdentification(identification);
          if (existing) {
            // Atualizar conexão existente
            await db.updateWhatsappConnection(existing.id, {
              status,
              phoneNumber,
              lastConnectedAt: conn.connected ? new Date() : existing.lastConnectedAt,
            });
          } else {
            // Criar nova conexão
            await db.createWhatsappConnection({
              userId: ctx.user.id,
              identification,
              status,
              phoneNumber,
              lastConnectedAt: conn.connected ? new Date() : undefined,
            });
          }
        }
        
        return { success: true, synced: connections.length };
      } catch (error: any) {
        console.error('[whatsapp.sync] Erro:', error.message);
        throw new Error('Erro ao sincronizar conexões');
      }
    }),
    sendMessage: protectedProcedure.input(z.object({ connectionId: z.number(), identification: z.string(), recipient: z.string(), message: z.string() })).mutation(async ({ ctx, input }) => {
      await db.createMessage({ userId: ctx.user.id, platform: "whatsapp", connectionId: input.connectionId, recipient: input.recipient, content: input.message, status: "pending" });
      try {
        const apiToken = process.env.BACKEND_API_TOKEN;
        if (!apiToken) throw new Error('BACKEND_API_TOKEN não configurado no servidor');

        console.log('[whatsapp.sendMessage] Enviando para:', `${BACKEND_API_URL}/whatsapp?token=${input.identification}`);

        await axios.post(`${BACKEND_API_URL}/whatsapp?token=${input.identification}`,
          { phone: input.recipient, message: input.message },
          { headers: { 'x-auth-api': apiToken }, timeout: 30000 }
        );
        return { success: true };
      } catch (error: any) {
        console.error('[whatsapp.sendMessage] Erro:', error.code, error.message, error.response?.status, error.response?.data);
        if (error.code === 'ECONNREFUSED') {
          throw new Error(`Backend não acessível em ${BACKEND_API_URL}. Verifique se o backend Docker está rodando.`);
        }
        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
          throw new Error('Timeout ao conectar com o backend. Verifique a conexão.');
        }
        if (error.response?.status === 401) {
          throw new Error('Acesso negado pelo backend. Verifique BACKEND_API_TOKEN.');
        }
        throw new Error(error.response?.data?.message || error.response?.data?.error || error.message || "Erro ao enviar mensagem");
      }
    }),
  }),
  telegram: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getTelegramConnections(ctx.user.id);
    }),
    create: protectedProcedure.input(z.object({ botToken: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      try {
        const apiToken = process.env.BACKEND_API_TOKEN;
        if (!apiToken) throw new Error('BACKEND_API_TOKEN não configurado');
        
        const response = await axios.post(`${BACKEND_API_URL}/telegram/connect`, 
          { token: input.botToken },
          { headers: { 'x-auth-api': apiToken } }
        );
        await db.createTelegramConnection({ userId: ctx.user.id, botToken: input.botToken, botUsername: response.data.username, status: "connected", lastConnectedAt: new Date() });
        return { success: true, username: response.data.username };
      } catch (error: any) {
        throw new Error(error.response?.data?.message || "Token inválido");
      }
    }),
    disconnect: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.updateTelegramConnection(input.id, { status: "disconnected" });
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteTelegramConnection(input.id);
      return { success: true };
    }),
    sendMessage: protectedProcedure.input(z.object({ connectionId: z.number(), botToken: z.string(), chatId: z.string(), message: z.string() })).mutation(async ({ ctx, input }) => {
      await db.createMessage({ userId: ctx.user.id, platform: "telegram", connectionId: input.connectionId, recipient: input.chatId, content: input.message, status: "pending" });
      try {
        const apiToken = process.env.BACKEND_API_TOKEN;
        if (!apiToken) throw new Error('BACKEND_API_TOKEN não configurado');
        
        await axios.post(`${BACKEND_API_URL}/telegram/send`, 
          { token: input.botToken, chatId: input.chatId, message: input.message },
          { headers: { 'x-auth-api': apiToken } }
        );
        return { success: true };
      } catch (error: any) {
        throw new Error(error.response?.data?.message || "Erro ao enviar mensagem");
      }
    }),
  }),
  messages: router({
    list: protectedProcedure.input(z.object({ limit: z.number().optional().default(50) })).query(async ({ ctx, input }) => {
      return await db.getMessages(ctx.user.id, input.limit);
    }),
  }),
  webhook: router({
    getConfig: protectedProcedure.query(async ({ ctx }) => {
      return await db.getWebhookConfig(ctx.user.id);
    }),
    saveConfig: protectedProcedure
      .input(z.object({
        webhookUrl: z.string().url(),
        webhookSecret: z.string().min(1),
        enabled: z.boolean(),
        connectionName: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.upsertWebhookConfig(ctx.user.id, input);
        return { success: true };
      }),
    getLogs: protectedProcedure
      .input(z.object({ limit: z.number().optional().default(50) }))
      .query(async ({ ctx, input }) => {
        return await db.getWebhookLogs(ctx.user.id, input.limit);
      }),
    testWebhook: protectedProcedure
      .input(z.object({ webhookUrl: z.string().url(), webhookSecret: z.string() }))
      .mutation(async ({ input }) => {
        const testPayload = {
          from: "+5561999999999",
          message_id: "test-" + Date.now(),
          timestamp: new Date().toISOString(),
          text: "Mensagem de teste do sistema Mensageria"
        };

        try {
          const response = await axios.post(input.webhookUrl, testPayload, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${input.webhookSecret}`
            },
            timeout: 10000,
            validateStatus: () => true, // Aceita qualquer status para não lançar exceção
          });

          if (response.status >= 200 && response.status < 300) {
            return { success: true, response: response.data, status: response.status };
          } else {
            return {
              success: false,
              response: response.data,
              status: response.status,
              message: `Webhook retornou status ${response.status}`
            };
          }
        } catch (error: unknown) {
          // Erros de rede, timeout, etc.
          if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNREFUSED') {
              return { success: false, message: 'Conexão recusada. Verifique se a URL está correta e acessível.' };
            }
            if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
              return { success: false, message: 'Timeout. O servidor demorou muito para responder.' };
            }
            if (error.code === 'ENOTFOUND') {
              return { success: false, message: 'Host não encontrado. Verifique a URL do webhook.' };
            }
            return { success: false, message: `Erro de rede: ${error.message}` };
          }

          const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
          return { success: false, message: `Erro ao testar webhook: ${errorMessage}` };
        }
      }),
  }),
  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserSettings(ctx.user.id);
    }),
    update: protectedProcedure.input(z.object({ googleApiKey: z.string().optional(), resumeGroupId: z.string().optional(), resumeGroupIdToSend: z.string().optional(), resumeHourOfDay: z.number().min(0).max(23).optional(), enableGroupResume: z.boolean().optional(), resumePrompt: z.string().optional(), resumeConnectionId: z.number().optional() })).mutation(async ({ ctx, input }) => {
      await db.upsertUserSettings(ctx.user.id, input);
      
      // Configurar scheduler de resumo no backend
      try {
        const apiToken = process.env.BACKEND_API_TOKEN;
        if (apiToken && input.enableGroupResume !== undefined) {
          await axios.post(`${BACKEND_API_URL}/whatsapp/configure-resume`, {
            enabled: input.enableGroupResume,
            sourceGroupId: input.resumeGroupId,
            destinationGroupId: input.resumeGroupIdToSend,
            hourOfDay: input.resumeHourOfDay,
            geminiApiKey: input.googleApiKey,
          }, {
            headers: { 'x-auth-api': apiToken }
          });
          console.log('[settings.update] Scheduler configurado no backend');
        }
      } catch (error: any) {
        console.error('[settings.update] Erro ao configurar scheduler:', error.message);
        // Não falha a operação se o scheduler não puder ser configurado
      }
      
      return { success: true };
    }),
    analyzeMessages: protectedProcedure.input(z.object({ question: z.string(), groupId: z.string(), geminiApiKey: z.string() })).mutation(async ({ ctx, input }) => {
      try {
        const apiToken = process.env.BACKEND_API_TOKEN;
        if (!apiToken) throw new Error('BACKEND_API_TOKEN não configurado');

        const response = await axios.post(`${BACKEND_API_URL}/whatsapp/analyze-messages`, {
          question: input.question,
          groupId: input.groupId,
        }, {
          headers: { 'x-auth-api': apiToken }
        });

        return { response: response.data.answer };
      } catch (error: any) {
        throw new Error(error.response?.data?.message || "Erro ao analisar mensagens");
      }
    }),
  }),

  // =====================================================
  // WhatsApp Business API (Official Meta API)
  // =====================================================
  whatsappBusiness: router({
    // List all business accounts for the user
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getWhatsappBusinessAccounts(ctx.user.id);
    }),

    // Get a specific account by ID
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const account = await db.getWhatsappBusinessAccountById(input.id);
        if (!account || account.userId !== ctx.user.id) {
          throw new Error("Conta não encontrada");
        }
        return account;
      }),

    // Create a new WhatsApp Business account
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        phoneNumberId: z.string().min(1),
        businessAccountId: z.string().min(1),
        accessToken: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        // Validate the credentials by fetching phone number info
        try {
          const api = new MetaWhatsAppApi(input.phoneNumberId, input.accessToken);
          await api.getPhoneNumberInfo();
        } catch (error: any) {
          throw new Error(`Credenciais inválidas: ${error.message}`);
        }

        const id = await db.createWhatsappBusinessAccount({
          userId: ctx.user.id,
          name: input.name,
          phoneNumberId: input.phoneNumberId,
          businessAccountId: input.businessAccountId,
          accessToken: input.accessToken,
          isActive: true,
        });

        return { success: true, id };
      }),

    // Update an existing account
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        accessToken: z.string().min(1).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const account = await db.getWhatsappBusinessAccountById(input.id);
        if (!account || account.userId !== ctx.user.id) {
          throw new Error("Conta não encontrada");
        }

        const { id, ...updateData } = input;
        await db.updateWhatsappBusinessAccount(id, updateData);
        return { success: true };
      }),

    // Delete an account
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const account = await db.getWhatsappBusinessAccountById(input.id);
        if (!account || account.userId !== ctx.user.id) {
          throw new Error("Conta não encontrada");
        }

        await db.deleteWhatsappBusinessAccount(input.id);
        return { success: true };
      }),

    // Fetch and sync templates from Meta API
    syncTemplates: protectedProcedure
      .input(z.object({ accountId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const account = await db.getWhatsappBusinessAccountById(input.accountId);
        if (!account || account.userId !== ctx.user.id) {
          throw new Error("Conta não encontrada");
        }

        const api = new MetaWhatsAppApi(account.phoneNumberId, account.accessToken);
        const templates = await api.getTemplates(account.businessAccountId);

        // Save templates to database
        await db.upsertWhatsappTemplates(
          account.id,
          templates.map((t) => ({
            templateId: t.id,
            name: t.name,
            language: t.language,
            category: t.category,
            status: t.status,
            components: JSON.stringify(t.components),
          }))
        );

        return { success: true, count: templates.length };
      }),

    // Get templates for an account
    getTemplates: protectedProcedure
      .input(z.object({ accountId: z.number() }))
      .query(async ({ ctx, input }) => {
        const account = await db.getWhatsappBusinessAccountById(input.accountId);
        if (!account || account.userId !== ctx.user.id) {
          throw new Error("Conta não encontrada");
        }

        const templates = await db.getWhatsappTemplates(account.id);
        return templates.map((t) => ({
          ...t,
          components: JSON.parse(t.components),
        }));
      }),

    // Test sending a message
    testMessage: protectedProcedure
      .input(z.object({
        accountId: z.number(),
        recipientPhone: z.string().min(1),
        templateName: z.string().min(1),
        templateLanguage: z.string().default("pt_BR"),
        bodyParams: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const account = await db.getWhatsappBusinessAccountById(input.accountId);
        if (!account || account.userId !== ctx.user.id) {
          throw new Error("Conta não encontrada");
        }

        const api = new MetaWhatsAppApi(account.phoneNumberId, account.accessToken);
        const result = await api.sendTemplateMessage({
          phoneNumberId: account.phoneNumberId,
          accessToken: account.accessToken,
          recipientPhone: input.recipientPhone,
          templateName: input.templateName,
          templateLanguage: input.templateLanguage,
          bodyParams: input.bodyParams,
        });

        return { success: true, messageId: result.messages[0]?.id };
      }),

    // Get phone number info
    getPhoneInfo: protectedProcedure
      .input(z.object({ accountId: z.number() }))
      .query(async ({ ctx, input }) => {
        const account = await db.getWhatsappBusinessAccountById(input.accountId);
        if (!account || account.userId !== ctx.user.id) {
          throw new Error("Conta não encontrada");
        }

        const api = new MetaWhatsAppApi(account.phoneNumberId, account.accessToken);
        return await api.getPhoneNumberInfo();
      }),
  }),

  // =====================================================
  // Marketing Campaigns
  // =====================================================
  campaigns: router({
    // List all campaigns for the user
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getCampaigns(ctx.user.id);
    }),

    // Get a specific campaign by ID
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const campaign = await db.getCampaignById(input.id);
        if (!campaign || campaign.userId !== ctx.user.id) {
          throw new Error("Campanha não encontrada");
        }
        return campaign;
      }),

    // Create a new campaign
    create: protectedProcedure
      .input(z.object({
        businessAccountId: z.number(),
        name: z.string().min(1),
        description: z.string().optional(),
        templateName: z.string().min(1),
        templateLanguage: z.string().default("pt_BR"),
        templateVariables: z.string().optional(), // JSON string
        headerMediaUrl: z.string().optional(),
        scheduledAt: z.string().optional(), // ISO date string
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify the business account belongs to the user
        const account = await db.getWhatsappBusinessAccountById(input.businessAccountId);
        if (!account || account.userId !== ctx.user.id) {
          throw new Error("Conta de negócios não encontrada");
        }

        const id = await db.createCampaign({
          userId: ctx.user.id,
          businessAccountId: input.businessAccountId,
          name: input.name,
          description: input.description,
          templateName: input.templateName,
          templateLanguage: input.templateLanguage,
          templateVariables: input.templateVariables,
          headerMediaUrl: input.headerMediaUrl,
          status: input.scheduledAt ? "scheduled" : "draft",
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
        });

        return { success: true, id };
      }),

    // Update a campaign
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        templateName: z.string().min(1).optional(),
        templateLanguage: z.string().optional(),
        templateVariables: z.string().optional(),
        headerMediaUrl: z.string().optional(),
        scheduledAt: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const campaign = await db.getCampaignById(input.id);
        if (!campaign || campaign.userId !== ctx.user.id) {
          throw new Error("Campanha não encontrada");
        }

        if (campaign.status !== "draft" && campaign.status !== "scheduled") {
          throw new Error("Só é possível editar campanhas em rascunho ou agendadas");
        }

        const { id, ...updateData } = input;
        const processedData: any = { ...updateData };
        if (updateData.scheduledAt) {
          processedData.scheduledAt = new Date(updateData.scheduledAt);
          processedData.status = "scheduled";
        }

        await db.updateCampaign(id, processedData);
        return { success: true };
      }),

    // Delete a campaign
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const campaign = await db.getCampaignById(input.id);
        if (!campaign || campaign.userId !== ctx.user.id) {
          throw new Error("Campanha não encontrada");
        }

        if (campaign.status === "running") {
          throw new Error("Não é possível excluir uma campanha em execução");
        }

        await db.deleteCampaign(input.id);
        return { success: true };
      }),

    // Add recipients to a campaign
    addRecipients: protectedProcedure
      .input(z.object({
        campaignId: z.number(),
        recipients: z.array(z.object({
          phoneNumber: z.string().min(1),
          name: z.string().optional(),
          variables: z.string().optional(), // JSON string with variable overrides
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const campaign = await db.getCampaignById(input.campaignId);
        if (!campaign || campaign.userId !== ctx.user.id) {
          throw new Error("Campanha não encontrada");
        }

        if (campaign.status !== "draft" && campaign.status !== "scheduled") {
          throw new Error("Só é possível adicionar destinatários em campanhas em rascunho ou agendadas");
        }

        const recipientsToAdd = input.recipients.map((r) => ({
          campaignId: input.campaignId,
          phoneNumber: r.phoneNumber,
          name: r.name,
          variables: r.variables,
          status: "pending" as const,
        }));

        await db.addCampaignRecipients(recipientsToAdd);

        // Update total recipients count
        const allRecipients = await db.getCampaignRecipients(input.campaignId);
        await db.updateCampaign(input.campaignId, { totalRecipients: allRecipients.length });

        return { success: true, added: input.recipients.length };
      }),

    // Get recipients for a campaign
    getRecipients: protectedProcedure
      .input(z.object({ campaignId: z.number() }))
      .query(async ({ ctx, input }) => {
        const campaign = await db.getCampaignById(input.campaignId);
        if (!campaign || campaign.userId !== ctx.user.id) {
          throw new Error("Campanha não encontrada");
        }

        return await db.getCampaignRecipients(input.campaignId);
      }),

    // Clear all recipients from a campaign
    clearRecipients: protectedProcedure
      .input(z.object({ campaignId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const campaign = await db.getCampaignById(input.campaignId);
        if (!campaign || campaign.userId !== ctx.user.id) {
          throw new Error("Campanha não encontrada");
        }

        if (campaign.status !== "draft" && campaign.status !== "scheduled") {
          throw new Error("Só é possível limpar destinatários em campanhas em rascunho ou agendadas");
        }

        await db.deleteCampaignRecipients(input.campaignId);
        await db.updateCampaign(input.campaignId, { totalRecipients: 0 });

        return { success: true };
      }),

    // Start a campaign (send messages)
    start: protectedProcedure
      .input(z.object({ campaignId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const campaign = await db.getCampaignById(input.campaignId);
        if (!campaign || campaign.userId !== ctx.user.id) {
          throw new Error("Campanha não encontrada");
        }

        if (campaign.status !== "draft" && campaign.status !== "scheduled") {
          throw new Error("Só é possível iniciar campanhas em rascunho ou agendadas");
        }

        const recipients = await db.getCampaignRecipientsByStatus(input.campaignId, "pending");
        if (recipients.length === 0) {
          throw new Error("Nenhum destinatário pendente na campanha");
        }

        const account = await db.getWhatsappBusinessAccountById(campaign.businessAccountId);
        if (!account) {
          throw new Error("Conta de negócios não encontrada");
        }

        // Update campaign status to running
        await db.updateCampaign(input.campaignId, {
          status: "running",
          startedAt: new Date(),
        });

        // Parse template variables
        const templateVariables = campaign.templateVariables
          ? JSON.parse(campaign.templateVariables)
          : {};

        const api = new MetaWhatsAppApi(account.phoneNumberId, account.accessToken);

        // Send messages to all pending recipients
        let sentCount = 0;
        let failedCount = 0;

        for (const recipient of recipients) {
          try {
            // Merge template variables with recipient-specific variables
            const recipientVariables = recipient.variables
              ? JSON.parse(recipient.variables)
              : {};
            const mergedVariables = { ...templateVariables, ...recipientVariables };

            // Build body params from variables
            const bodyParams = Object.values(mergedVariables) as string[];

            const result = await api.sendTemplateMessage({
              phoneNumberId: account.phoneNumberId,
              accessToken: account.accessToken,
              recipientPhone: recipient.phoneNumber,
              templateName: campaign.templateName,
              templateLanguage: campaign.templateLanguage,
              bodyParams: bodyParams.length > 0 ? bodyParams : undefined,
            });

            await db.updateCampaignRecipient(recipient.id, {
              status: "sent",
              whatsappMessageId: result.messages[0]?.id,
              sentAt: new Date(),
            });

            sentCount++;

            // Rate limiting: wait 100ms between messages to avoid API limits
            await new Promise((resolve) => setTimeout(resolve, 100));
          } catch (error: any) {
            await db.updateCampaignRecipient(recipient.id, {
              status: "failed",
              errorMessage: error.message,
            });
            failedCount++;
          }
        }

        // Update campaign stats
        const allRecipients = await db.getCampaignRecipients(input.campaignId);
        const pendingCount = allRecipients.filter((r) => r.status === "pending").length;

        await db.updateCampaign(input.campaignId, {
          sentCount: allRecipients.filter((r) => r.status === "sent" || r.status === "delivered" || r.status === "read").length,
          failedCount: allRecipients.filter((r) => r.status === "failed").length,
          status: pendingCount === 0 ? "completed" : "running",
          completedAt: pendingCount === 0 ? new Date() : undefined,
        });

        return { success: true, sent: sentCount, failed: failedCount };
      }),

    // Pause a running campaign
    pause: protectedProcedure
      .input(z.object({ campaignId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const campaign = await db.getCampaignById(input.campaignId);
        if (!campaign || campaign.userId !== ctx.user.id) {
          throw new Error("Campanha não encontrada");
        }

        if (campaign.status !== "running") {
          throw new Error("Só é possível pausar campanhas em execução");
        }

        await db.updateCampaign(input.campaignId, { status: "paused" });
        return { success: true };
      }),

    // Resume a paused campaign
    resume: protectedProcedure
      .input(z.object({ campaignId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const campaign = await db.getCampaignById(input.campaignId);
        if (!campaign || campaign.userId !== ctx.user.id) {
          throw new Error("Campanha não encontrada");
        }

        if (campaign.status !== "paused") {
          throw new Error("Só é possível retomar campanhas pausadas");
        }

        // Resume by calling start again
        await db.updateCampaign(input.campaignId, { status: "draft" });

        // The actual sending will happen when the user calls start again
        return { success: true };
      }),

    // Get campaign statistics
    getStats: protectedProcedure
      .input(z.object({ campaignId: z.number() }))
      .query(async ({ ctx, input }) => {
        const campaign = await db.getCampaignById(input.campaignId);
        if (!campaign || campaign.userId !== ctx.user.id) {
          throw new Error("Campanha não encontrada");
        }

        const recipients = await db.getCampaignRecipients(input.campaignId);

        return {
          total: recipients.length,
          pending: recipients.filter((r) => r.status === "pending").length,
          sent: recipients.filter((r) => r.status === "sent").length,
          delivered: recipients.filter((r) => r.status === "delivered").length,
          read: recipients.filter((r) => r.status === "read").length,
          failed: recipients.filter((r) => r.status === "failed").length,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
