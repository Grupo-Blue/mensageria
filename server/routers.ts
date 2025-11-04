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

  whatsapp: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getWhatsappConnections(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({ identification: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const existing = await db.getWhatsappConnectionByIdentification(input.identification);
        if (existing) throw new Error("Identificação já existe");
        await db.createWhatsappConnection({ userId: ctx.user.id, identification: input.identification, status: "connecting" });
        try {
          const response = await axios.post(`${BACKEND_API_URL}/whatsapp/qrcode`, { identification: input.identification });
          const connection = await db.getWhatsappConnectionByIdentification(input.identification);
          if (connection) await db.updateWhatsappConnection(connection.id, { qrCode: response.data.qrCode, status: "qr_code" });
          return { success: true, qrCode: response.data.qrCode };
        } catch (error: any) {
          throw new Error(error.response?.data?.message || "Erro ao gerar QR Code");
        }
      }),
    getQRCode: protectedProcedure.input(z.object({ identification: z.string() })).query(async ({ input }) => {
      const connection = await db.getWhatsappConnectionByIdentification(input.identification);
      if (!connection) throw new Error("Conexão não encontrada");
      return { qrCode: connection.qrCode, status: connection.status };
    }),
    checkStatus: protectedProcedure.input(z.object({ identification: z.string() })).query(async ({ input }) => {
      try {
        const response = await axios.get(`${BACKEND_API_URL}/whatsapp/status/${input.identification}`);
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
        await axios.post(`${BACKEND_API_URL}/whatsapp/disconnect`, { identification: input.identification });
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
    sendMessage: protectedProcedure.input(z.object({ connectionId: z.number(), identification: z.string(), recipient: z.string(), message: z.string() })).mutation(async ({ ctx, input }) => {
      await db.createMessage({ userId: ctx.user.id, platform: "whatsapp", connectionId: input.connectionId, recipient: input.recipient, content: input.message, status: "pending" });
      try {
        await axios.post(`${BACKEND_API_URL}/whatsapp/send`, { identification: input.identification, number: input.recipient, message: input.message });
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
        const response = await axios.post(`${BACKEND_API_URL}/telegram/connect`, { token: input.botToken });
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
        await axios.post(`${BACKEND_API_URL}/telegram/send`, { token: input.botToken, chatId: input.chatId, message: input.message });
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
    update: protectedProcedure.input(z.object({ googleApiKey: z.string().optional(), resumeGroupId: z.string().optional(), resumeGroupIdToSend: z.string().optional(), resumeHourOfDay: z.number().min(0).max(23).optional(), enableGroupResume: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
      await db.upsertUserSettings(ctx.user.id, input);
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
