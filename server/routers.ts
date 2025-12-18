import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import axios from "axios";
import { MetaWhatsAppApi, mapVariablesToOrderedArray } from "./whatsappBusiness/metaApi";

// Special marker for variables that should use recipient name
const RECIPIENT_NAME_MARKER = "__RECIPIENT_NAME__";

/**
 * Process template variables, replacing recipient name markers with actual recipient name
 */
function processVariablesWithRecipientName(
  templateVariables: Record<string, string>,
  recipientName: string | null | undefined
): Record<string, string> {
  const processed: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(templateVariables)) {
    if (value === RECIPIENT_NAME_MARKER) {
      // Use recipient name or fallback to empty string
      processed[key] = recipientName || "";
    } else {
      processed[key] = value;
    }
  }
  
  return processed;
}

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
        // Validate the credentials by trying to fetch templates and phone numbers from Business Account
        try {
          const api = new MetaWhatsAppApi(input.phoneNumberId, input.accessToken);
          
          // Step 1: Validate Business Account ID by fetching templates (most reliable)
          await api.getTemplates(input.businessAccountId);
          
          // Step 2: Try to validate Phone Number ID by listing phone numbers from Business Account
          try {
            const phoneNumbers = await api.getPhoneNumbersFromBusiness(input.businessAccountId);
            // Verify that the provided Phone Number ID exists in the list
            const phoneNumberExists = phoneNumbers.some(p => p.id === input.phoneNumberId);
            if (!phoneNumberExists && phoneNumbers.length > 0) {
              console.warn(`[WhatsApp Business] Phone Number ID ${input.phoneNumberId} not found in Business Account. Available IDs: ${phoneNumbers.map(p => p.id).join(', ')}`);
            }
          } catch (phoneListError: any) {
            // If listing phone numbers fails, try direct phone number access as fallback
            try {
              await api.getPhoneNumberInfo();
            } catch (phoneError: any) {
              // If both fail, it might be a permissions issue, but templates work so credentials are valid
              console.warn('[WhatsApp Business] Phone number validation failed, but templates work:', phoneError.message);
            }
          }
        } catch (error: any) {
          // Provide more helpful error message
          const errorMsg = error.message || 'Erro desconhecido';
          if (errorMsg.includes('does not exist') || errorMsg.includes('cannot be loaded')) {
            throw new Error(`Credenciais inválidas: O Business Account ID (${input.businessAccountId}) está incorreto ou o token não tem permissões necessárias. Verifique: 1) Se o Business Account ID está correto no Meta Business Suite, 2) Se o token tem permissões: whatsapp_business_management, whatsapp_business_messaging`);
          }
          if (errorMsg.includes('Invalid OAuth')) {
            throw new Error(`Credenciais inválidas: Token de acesso inválido ou expirado. Gere um novo token permanente em developers.facebook.com`);
          }
          throw new Error(`Credenciais inválidas: ${errorMsg}`);
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
        phoneNumberId: z.string().min(1).optional(),
        businessAccountId: z.string().min(1).optional(),
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

    // Create a new template via Meta API
    createTemplate: protectedProcedure
      .input(z.object({
        accountId: z.number(),
        name: z.string().min(1).max(512),
        language: z.string().default("pt_BR"),
        category: z.enum(["UTILITY", "MARKETING", "AUTHENTICATION"]),
        headerType: z.enum(["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"]).optional().default("NONE"),
        headerText: z.string().optional(),
        bodyText: z.string().min(1).max(1024),
        footerText: z.string().max(60).optional(),
        buttons: z.array(z.object({
          type: z.enum(["QUICK_REPLY", "URL", "PHONE_NUMBER"]),
          text: z.string().min(1).max(25),
          url: z.string().optional(),
          phoneNumber: z.string().optional(),
        })).max(3).optional(),
        variableType: z.enum(["NAMED", "POSITIONAL"]).optional().default("POSITIONAL"),
        variableExamples: z.record(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const account = await db.getWhatsappBusinessAccountById(input.accountId);
        if (!account || account.userId !== ctx.user.id) {
          throw new Error("Conta não encontrada");
        }

        const api = new MetaWhatsAppApi(account.phoneNumberId, account.accessToken);
        
        const result = await api.createTemplate(account.businessAccountId, {
          name: input.name,
          language: input.language,
          category: input.category,
          headerType: input.headerType,
          headerText: input.headerText,
          bodyText: input.bodyText,
          footerText: input.footerText,
          buttons: input.buttons,
          variableType: input.variableType,
          variableExamples: input.variableExamples,
        });

        // Sync templates to get the new one in the database
        try {
          const templates = await api.getTemplates(account.businessAccountId);
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
        } catch (syncError) {
          console.error("Error syncing templates after creation:", syncError);
        }

        // Determina a mensagem baseada no status
        let message = "Template criado com sucesso";
        let success = true;
        
        if (result.status === "PENDING") {
          message = "Template criado e enviado para aprovação da Meta. Aguarde a revisão (pode levar até 24h).";
        } else if (result.status === "REJECTED") {
          success = false;
          const rejectedReason = (result as any).rejectedReason;
          if (rejectedReason) {
            message = `Template rejeitado pela Meta: ${rejectedReason}`;
          } else {
            message = "Template rejeitado pela Meta. Sugestões:\n" +
              "• Use categoria UTILITY ao invés de MARKETING\n" +
              "• Remova termos como 'oferta', 'promoção', 'investimento'\n" +
              "• Evite urgência ('último dia', 'restam poucas')\n" +
              "• Simplifique o texto - menos é mais\n" +
              "• Crie o template diretamente no business.facebook.com para ver o motivo exato";
          }
        } else if (result.status === "APPROVED") {
          message = "Template aprovado e pronto para uso!";
        }

        return { 
          success, 
          templateId: result.id, 
          status: result.status,
          message
        };
      }),

    // Delete a template via Meta API
    deleteTemplate: protectedProcedure
      .input(z.object({
        accountId: z.number(),
        templateName: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const account = await db.getWhatsappBusinessAccountById(input.accountId);
        if (!account || account.userId !== ctx.user.id) {
          throw new Error("Conta não encontrada");
        }

        const api = new MetaWhatsAppApi(account.phoneNumberId, account.accessToken);
        await api.deleteTemplate(account.businessAccountId, input.templateName);

        // Remove from local database
        // Note: We'll sync to update the list
        const templates = await api.getTemplates(account.businessAccountId);
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

        return { success: true };
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
        bodyParams: z.array(z.object({
          value: z.string(),
          parameterName: z.string().optional(),
        })).optional(),
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

    // =====================================================
    // Blacklist Management
    // =====================================================

    // Get blacklist for an account
    getBlacklist: protectedProcedure
      .input(z.object({ accountId: z.number() }))
      .query(async ({ ctx, input }) => {
        const account = await db.getWhatsappBusinessAccountById(input.accountId);
        if (!account || account.userId !== ctx.user.id) {
          throw new Error("Conta não encontrada");
        }

        return await db.getBlacklist(account.id);
      }),

    // Add to blacklist manually
    addToBlacklist: protectedProcedure
      .input(z.object({
        accountId: z.number(),
        phoneNumber: z.string().min(1),
        reason: z.enum(["sair", "cancelar", "spam_report", "manual", "bounce"]).default("manual"),
      }))
      .mutation(async ({ ctx, input }) => {
        const account = await db.getWhatsappBusinessAccountById(input.accountId);
        if (!account || account.userId !== ctx.user.id) {
          throw new Error("Conta não encontrada");
        }

        const result = await db.addToBlacklist({
          businessAccountId: account.id,
          phoneNumber: input.phoneNumber,
          reason: input.reason,
        });

        return result;
      }),

    // Remove from blacklist
    removeFromBlacklist: protectedProcedure
      .input(z.object({
        accountId: z.number(),
        phoneNumber: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const account = await db.getWhatsappBusinessAccountById(input.accountId);
        if (!account || account.userId !== ctx.user.id) {
          throw new Error("Conta não encontrada");
        }

        await db.removeFromBlacklist(account.id, input.phoneNumber);
        return { success: true };
      }),

    // Check if a phone is blacklisted
    isBlacklisted: protectedProcedure
      .input(z.object({
        accountId: z.number(),
        phoneNumber: z.string().min(1),
      }))
      .query(async ({ ctx, input }) => {
        const account = await db.getWhatsappBusinessAccountById(input.accountId);
        if (!account || account.userId !== ctx.user.id) {
          throw new Error("Conta não encontrada");
        }

        const isBlacklisted = await db.isPhoneBlacklisted(account.id, input.phoneNumber);
        return { isBlacklisted };
      }),

    // Filter blacklisted numbers from a list
    filterBlacklisted: protectedProcedure
      .input(z.object({
        accountId: z.number(),
        phoneNumbers: z.array(z.string()),
      }))
      .mutation(async ({ ctx, input }) => {
        const account = await db.getWhatsappBusinessAccountById(input.accountId);
        if (!account || account.userId !== ctx.user.id) {
          throw new Error("Conta não encontrada");
        }

        return await db.filterBlacklistedNumbers(account.id, input.phoneNumbers);
      }),
  }),

  // =====================================================
  // Contact Lists
  // =====================================================
  contactLists: router({
    // List all contact lists for the user
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getContactLists(ctx.user.id);
    }),

    // Get a specific list by ID
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const list = await db.getContactListById(input.id);
        if (!list || list.userId !== ctx.user.id) {
          throw new Error("Lista não encontrada");
        }
        return list;
      }),

    // Create a new contact list
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        company: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const listData: any = {
          userId: ctx.user.id,
          name: input.name,
        };
        
        // Only include optional fields if they have values
        if (input.company !== undefined && input.company !== null && input.company.trim() !== "") {
          listData.company = input.company;
        }
        if (input.description !== undefined && input.description !== null && input.description.trim() !== "") {
          listData.description = input.description;
        }
        
        const id = await db.createContactList(listData);
        return { success: true, id };
      }),

    // Update a contact list
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        company: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const list = await db.getContactListById(input.id);
        if (!list || list.userId !== ctx.user.id) {
          throw new Error("Lista não encontrada");
        }

        const { id, ...updateData } = input;
        await db.updateContactList(id, updateData);
        return { success: true };
      }),

    // Delete a contact list
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const list = await db.getContactListById(input.id);
        if (!list || list.userId !== ctx.user.id) {
          throw new Error("Lista não encontrada");
        }

        await db.deleteContactList(input.id);
        return { success: true };
      }),

    // Get contacts in a list
    getContacts: protectedProcedure
      .input(z.object({
        listId: z.number(),
        statusFilter: z.enum(["active", "invalid", "opted_out", "spam_reported"]).optional(),
      }))
      .query(async ({ ctx, input }) => {
        const list = await db.getContactListById(input.listId);
        if (!list || list.userId !== ctx.user.id) {
          throw new Error("Lista não encontrada");
        }

        return await db.getContactListItems(input.listId, input.statusFilter);
      }),

    // Add contacts to a list (import)
    addContacts: protectedProcedure
      .input(z.object({
        listId: z.number(),
        contacts: z.array(z.object({
          phoneNumber: z.string().min(1),
          name: z.string().optional(),
          email: z.string().optional(),
          customFields: z.string().optional(), // JSON string
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const list = await db.getContactListById(input.listId);
        if (!list || list.userId !== ctx.user.id) {
          throw new Error("Lista não encontrada");
        }

        const contactsToAdd = input.contacts.map((c) => ({
          listId: input.listId,
          phoneNumber: c.phoneNumber.replace(/\D/g, ""), // Clean phone number
          name: c.name,
          email: c.email,
          customFields: c.customFields,
          status: "active" as const,
        }));

        const result = await db.addContactListItems(contactsToAdd);
        return { success: true, ...result };
      }),

    // Update a contact
    updateContact: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        email: z.string().optional(),
        customFields: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const contact = await db.getContactListItemById(input.id);
        if (!contact) {
          throw new Error("Contato não encontrado");
        }

        const list = await db.getContactListById(contact.listId);
        if (!list || list.userId !== ctx.user.id) {
          throw new Error("Sem permissão");
        }

        const { id, ...updateData } = input;
        await db.updateContactListItem(id, updateData);
        return { success: true };
      }),

    // Opt-out a contact (manual)
    optOutContact: protectedProcedure
      .input(z.object({
        id: z.number(),
        reason: z.enum(["manual", "sair", "spam", "bounce"]).default("manual"),
      }))
      .mutation(async ({ ctx, input }) => {
        const contact = await db.getContactListItemById(input.id);
        if (!contact) {
          throw new Error("Contato não encontrado");
        }

        const list = await db.getContactListById(contact.listId);
        if (!list || list.userId !== ctx.user.id) {
          throw new Error("Sem permissão");
        }

        await db.markContactAsOptedOut(contact.listId, contact.phoneNumber, input.reason);
        return { success: true };
      }),

    // Opt-out by phone (used when user replies SAIR)
    optOutByPhone: protectedProcedure
      .input(z.object({
        phoneNumber: z.string().min(1),
        reason: z.enum(["manual", "sair", "spam", "bounce"]),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.markContactAsOptedOutByPhone(ctx.user.id, input.phoneNumber.replace(/\D/g, ""), input.reason);
        return { success: true };
      }),

    // Reactivate a contact
    reactivateContact: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const contact = await db.getContactListItemById(input.id);
        if (!contact) {
          throw new Error("Contato não encontrado");
        }

        const list = await db.getContactListById(contact.listId);
        if (!list || list.userId !== ctx.user.id) {
          throw new Error("Sem permissão");
        }

        await db.reactivateContact(input.id);
        return { success: true };
      }),

    // Delete a contact
    deleteContact: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const contact = await db.getContactListItemById(input.id);
        if (!contact) {
          throw new Error("Contato não encontrado");
        }

        const list = await db.getContactListById(contact.listId);
        if (!list || list.userId !== ctx.user.id) {
          throw new Error("Sem permissão");
        }

        await db.deleteContactListItem(input.id);
        return { success: true };
      }),

    // Clear all contacts from a list
    clearContacts: protectedProcedure
      .input(z.object({ listId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const list = await db.getContactListById(input.listId);
        if (!list || list.userId !== ctx.user.id) {
          throw new Error("Lista não encontrada");
        }

        await db.deleteAllContactListItems(input.listId);
        return { success: true };
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
        // Retry configuration
        autoRetryEnabled: z.boolean().optional().default(true),
        maxRetries: z.number().min(0).max(10).optional().default(3),
        retryDelayMinutes: z.number().min(1).max(1440).optional().default(30),
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
          // Retry settings
          autoRetryEnabled: input.autoRetryEnabled,
          maxRetries: input.maxRetries,
          retryDelayMinutes: input.retryDelayMinutes,
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

        // Get template to extract body text for variable ordering
        const template = await db.getWhatsappTemplateByName(account.id, campaign.templateName);
        let templateBodyText = "";
        if (template) {
          const components = JSON.parse(template.components);
          const bodyComponent = components.find((c: any) => c.type === "BODY");
          templateBodyText = bodyComponent?.text || "";
        }

        const api = new MetaWhatsAppApi(account.phoneNumberId, account.accessToken);

        // Filter out blacklisted recipients before sending
        const phoneNumbers = recipients.map(r => r.phoneNumber);
        const { allowed: allowedPhones, blocked: blockedPhones } = await db.filterBlacklistedNumbers(account.id, phoneNumbers);
        const blockedSet = new Set(blockedPhones.map(p => p.replace(/\D/g, "")));

        console.log(`[Campaign Send] Total recipients: ${recipients.length}, Blacklisted: ${blockedPhones.length}`);

        // Send messages to all pending recipients (excluding blacklisted)
        let sentCount = 0;
        let failedCount = 0;
        let skippedBlacklisted = 0;

        for (const recipient of recipients) {
          // Check if recipient is blacklisted
          const normalizedPhone = recipient.phoneNumber.replace(/\D/g, "");
          if (blockedSet.has(normalizedPhone)) {
            console.log(`[Campaign Send] Skipping blacklisted recipient: ${recipient.phoneNumber}`);
            // Mark as failed with reason
            await db.updateCampaignRecipient(recipient.id, {
              status: "failed",
              errorMessage: "Contato na blacklist (opt-out)",
            });
            skippedBlacklisted++;
            failedCount++;
            continue;
          }

          try {
            console.log(`[Campaign Send] Processing recipient: ${recipient.phoneNumber}, name: ${recipient.name}`);
            console.log(`[Campaign Send] Template variables before processing:`, templateVariables);
            
            // Process template variables, replacing recipient name markers
            const processedTemplateVars = processVariablesWithRecipientName(
              templateVariables,
              recipient.name
            );
            console.log(`[Campaign Send] Template variables after processing:`, processedTemplateVars);
            
            // Merge template variables with recipient-specific variables
            const recipientVariables = recipient.variables
              ? JSON.parse(recipient.variables)
              : {};
            const mergedVariables = { ...processedTemplateVars, ...recipientVariables };
            console.log(`[Campaign Send] Merged variables:`, mergedVariables);
            console.log(`[Campaign Send] Template body text:`, templateBodyText);

            // Build body params from variables in the correct order
            let bodyParams = mapVariablesToOrderedArray(templateBodyText, mergedVariables);
            console.log(`[Campaign Send] Body params (ordered):`, bodyParams);
            // Filter out empty values
            if (bodyParams.every(p => !p.value)) {
              bodyParams = [];
              console.log(`[Campaign Send] All params empty, setting to empty array`);
            }

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

    // Get retry statistics for a campaign
    getRetryStats: protectedProcedure
      .input(z.object({ campaignId: z.number() }))
      .query(async ({ ctx, input }) => {
        const campaign = await db.getCampaignById(input.campaignId);
        if (!campaign || campaign.userId !== ctx.user.id) {
          throw new Error("Campanha não encontrada");
        }

        const retryStats = await db.getRecipientsRetryStats(input.campaignId);
        return {
          ...retryStats,
          maxRetries: campaign.maxRetries,
          retryDelayMinutes: campaign.retryDelayMinutes,
          autoRetryEnabled: campaign.autoRetryEnabled,
        };
      }),

    // Manual retry for failed messages
    retryFailed: protectedProcedure
      .input(z.object({ campaignId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const campaign = await db.getCampaignById(input.campaignId);
        if (!campaign || campaign.userId !== ctx.user.id) {
          throw new Error("Campanha não encontrada");
        }

        const { campaignScheduler } = await import("./whatsappBusiness/campaignScheduler");
        const result = await campaignScheduler.manualRetry(input.campaignId);

        return result;
      }),

    // Update retry settings for a campaign
    updateRetrySettings: protectedProcedure
      .input(z.object({
        campaignId: z.number(),
        maxRetries: z.number().min(0).max(10).optional(),
        retryDelayMinutes: z.number().min(1).max(1440).optional(),
        autoRetryEnabled: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const campaign = await db.getCampaignById(input.campaignId);
        if (!campaign || campaign.userId !== ctx.user.id) {
          throw new Error("Campanha não encontrada");
        }

        const { campaignId, ...settings } = input;
        await db.updateCampaign(campaignId, settings);

        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
