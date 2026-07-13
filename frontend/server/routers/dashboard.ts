import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";

/**
 * Dashboard do usuário. As procedures são finas de propósito — a agregação mora no
 * db.ts, como no resto do projeto.
 */
export const dashboardRouter = router({
  /** Bloco "AGORA": telefones por estado, capacidade do dia, fila e campanhas ativas. */
  overview: protectedProcedure.query(async ({ ctx }) => {
    return await db.getDashboardOverview(ctx.user.id);
  }),

  /** Uma linha por telefone: estado, enviados hoje, warmup e proxy. Alimenta alertas. */
  connectionsHealth: protectedProcedure.query(async ({ ctx }) => {
    return await db.getConnectionsHealth(ctx.user.id);
  }),

  /** Série diária de envios (3 fontes somadas) + totais do período. */
  sendHistory: protectedProcedure
    .input(z.object({ days: z.number().int().min(7).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      return await db.getSendHistory(ctx.user.id, input.days);
    }),
});
