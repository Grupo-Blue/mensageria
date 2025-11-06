import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import axios from "axios";

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
    sendMessage: protectedProcedure.input(z.object({ connectionId: z.number(), identification: z.string(), recipient: z.string(), message: z.string() })).mutation(async ({ ctx, input }) => {
      await db.createMessage({ userId: ctx.user.id, platform: "whatsapp", connectionId: input.connectionId, recipient: input.recipient, content: input.message, status: "pending" });
      try {
        const apiToken = process.env.BACKEND_API_TOKEN;
        if (!apiToken) throw new Error('BACKEND_API_TOKEN não configurado');
        
        await axios.post(`${BACKEND_API_URL}/whatsapp?token=${input.identification}`, 
          { phone: input.recipient, message: input.message },
          { headers: { 'x-auth-api': apiToken } }
        );
        return { success: true };
      } catch (error: any) {
        throw new Error(error.response?.data?.message || "Erro ao enviar mensagem");
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
});

export type AppRouter = typeof appRouter;
