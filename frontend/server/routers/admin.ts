import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { eq, and, desc, gte, lte, sql, like, or, count, sum } from "drizzle-orm";
import {
  plans,
  subscriptions,
  usageRecords,
  payments,
  users,
  whatsappConnections,
  whatsappBusinessAccounts,
  campaigns,
  messages,
  adminLogs,
  errorLogs,
  systemSettings,
  auditLogs,
  contactLists,
  contactListItems,
} from "../../drizzle/schema";
import { getDb } from "../db";

// Admin procedure - only users with role 'admin' can access
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Acesso negado. Apenas administradores podem acessar este recurso.",
    });
  }
  return next();
});

// Helper to log admin actions
async function logAdminAction(
  db: any,
  adminUserId: number,
  action: string,
  targetType: string | null,
  targetId: number | null,
  details: any = null,
  previousValue: any = null,
  newValue: any = null,
  ipAddress: string | null = null,
  userAgent: string | null = null
) {
  await db.insert(adminLogs).values({
    adminUserId,
    action,
    targetType,
    targetId,
    details: details ? JSON.stringify(details) : null,
    previousValue: previousValue ? JSON.stringify(previousValue) : null,
    newValue: newValue ? JSON.stringify(newValue) : null,
    ipAddress,
    userAgent,
  });
}

// Pagination schema
const paginationSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  search: z.string().optional(),
});

// Date range schema
const dateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const adminRouter = router({
  // ==========================================
  // DASHBOARD
  // ==========================================

  getDashboardStats: adminProcedure.query(async () => {
    const db = await getDb();

    // Total users
    const [totalUsers] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    // Active subscriptions
    const [activeSubscriptions] = await db
      .select({ count: sql<number>`count(*)` })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active"));

    // Total connections (WhatsApp)
    const [totalConnections] = await db
      .select({ count: sql<number>`count(*)` })
      .from(whatsappConnections);

    // Connected connections
    const [connectedConnections] = await db
      .select({ count: sql<number>`count(*)` })
      .from(whatsappConnections)
      .where(eq(whatsappConnections.status, "connected"));

    // Offline connections
    const [offlineConnections] = await db
      .select({ count: sql<number>`count(*)` })
      .from(whatsappConnections)
      .where(eq(whatsappConnections.status, "disconnected"));

    // Business accounts
    const [businessAccounts] = await db
      .select({ count: sql<number>`count(*)` })
      .from(whatsappBusinessAccounts);

    // Running campaigns
    const [runningCampaigns] = await db
      .select({ count: sql<number>`count(*)` })
      .from(campaigns)
      .where(eq(campaigns.status, "running"));

    // Errors in last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const [errorsLast24h] = await db
      .select({ count: sql<number>`count(*)` })
      .from(errorLogs)
      .where(gte(errorLogs.createdAt, yesterday));

    // Calculate MRR (Monthly Recurring Revenue)
    const [mrr] = await db
      .select({
        total: sql<number>`COALESCE(SUM(p.price_monthly), 0)`,
      })
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.status, "active"));

    // New users this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [newUsersThisMonth] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(gte(users.createdAt, monthStart));

    // Users by plan
    const usersByPlan = await db
      .select({
        planName: plans.name,
        planSlug: plans.slug,
        count: sql<number>`count(*)`,
      })
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.status, "active"))
      .groupBy(plans.id);

    return {
      totalUsers: Number(totalUsers?.count || 0),
      activeSubscriptions: Number(activeSubscriptions?.count || 0),
      totalConnections: Number(totalConnections?.count || 0),
      connectedConnections: Number(connectedConnections?.count || 0),
      offlineConnections: Number(offlineConnections?.count || 0),
      businessAccounts: Number(businessAccounts?.count || 0),
      runningCampaigns: Number(runningCampaigns?.count || 0),
      errorsLast24h: Number(errorsLast24h?.count || 0),
      mrr: Number(mrr?.total || 0),
      newUsersThisMonth: Number(newUsersThisMonth?.count || 0),
      usersByPlan,
    };
  }),

  // User growth chart data
  getUserGrowthChart: adminProcedure
    .input(
      z.object({
        days: z.number().min(7).max(90).default(30),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const result = await db.execute(sql`
        SELECT
          DATE(createdAt) as date,
          COUNT(*) as count
        FROM users
        WHERE createdAt >= ${startDate}
        GROUP BY DATE(createdAt)
        ORDER BY date ASC
      `);

      return result[0] || [];
    }),

  // Revenue chart data
  getRevenueChart: adminProcedure
    .input(
      z.object({
        months: z.number().min(1).max(24).default(12),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - input.months);

      const result = await db.execute(sql`
        SELECT
          DATE_FORMAT(created_at, '%Y-%m') as month,
          SUM(amount) as revenue,
          COUNT(*) as transactions
        FROM payments
        WHERE status = 'succeeded' AND created_at >= ${startDate}
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY month ASC
      `);

      return result[0] || [];
    }),

  // Messages chart data
  getMessagesChart: adminProcedure
    .input(
      z.object({
        days: z.number().min(7).max(90).default(30),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const result = await db.execute(sql`
        SELECT
          DATE(sent_at) as date,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM messages
        WHERE sent_at >= ${startDate}
        GROUP BY DATE(sent_at)
        ORDER BY date ASC
      `);

      return result[0] || [];
    }),

  // ==========================================
  // USERS MANAGEMENT
  // ==========================================

  listUsers: adminProcedure.input(paginationSchema).query(async ({ input }) => {
    const db = await getDb();

    let query = db
      .select({
        user: users,
        subscription: subscriptions,
        plan: plans,
      })
      .from(users)
      .leftJoin(subscriptions, eq(users.id, subscriptions.userId))
      .leftJoin(plans, eq(subscriptions.planId, plans.id));

    if (input.search) {
      query = query.where(
        or(
          like(users.name, `%${input.search}%`),
          like(users.email, `%${input.search}%`)
        )
      );
    }

    const usersList = await query
      .orderBy(desc(users.createdAt))
      .limit(input.limit)
      .offset(input.offset);

    // Get total count
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(users);
    if (input.search) {
      countQuery = countQuery.where(
        or(
          like(users.name, `%${input.search}%`),
          like(users.email, `%${input.search}%`)
        )
      );
    }
    const [total] = await countQuery;

    // Get connection counts for each user
    const userIds = usersList.map((u: any) => u.user.id);
    const connectionCounts = await db
      .select({
        userId: whatsappConnections.userId,
        count: sql<number>`count(*)`,
      })
      .from(whatsappConnections)
      .where(sql`${whatsappConnections.userId} IN (${userIds.join(",") || 0})`)
      .groupBy(whatsappConnections.userId);

    const connectionCountMap = new Map(
      connectionCounts.map((c: any) => [c.userId, Number(c.count)])
    );

    return {
      users: usersList.map((u: any) => ({
        ...u.user,
        subscription: u.subscription,
        plan: u.plan,
        connectionsCount: connectionCountMap.get(u.user.id) || 0,
      })),
      total: Number(total?.count || 0),
    };
  }),

  getUser: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();

      const [result] = await db
        .select({
          user: users,
          subscription: subscriptions,
          plan: plans,
        })
        .from(users)
        .leftJoin(subscriptions, eq(users.id, subscriptions.userId))
        .leftJoin(plans, eq(subscriptions.planId, plans.id))
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Usuário não encontrado",
        });
      }

      // Get connections
      const connections = await db
        .select()
        .from(whatsappConnections)
        .where(eq(whatsappConnections.userId, input.userId));

      // Get business accounts
      const businessAccountsList = await db
        .select()
        .from(whatsappBusinessAccounts)
        .where(eq(whatsappBusinessAccounts.userId, input.userId));

      // Get campaigns count
      const [campaignsCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(campaigns)
        .where(eq(campaigns.userId, input.userId));

      // Get payment history
      const paymentHistory = await db
        .select()
        .from(payments)
        .where(eq(payments.userId, input.userId))
        .orderBy(desc(payments.createdAt))
        .limit(10);

      return {
        ...result.user,
        subscription: result.subscription,
        plan: result.plan,
        connections,
        businessAccounts: businessAccountsList,
        campaignsCount: Number(campaignsCount?.count || 0),
        paymentHistory: paymentHistory.map((p: any) => ({
          ...p,
          amount: parseFloat(p.amount),
        })),
      };
    }),

  updateUser: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        role: z.enum(["user", "admin"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!existingUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Usuário não encontrado",
        });
      }

      const { userId, ...updateData } = input;
      const filteredData = Object.fromEntries(
        Object.entries(updateData).filter(([_, v]) => v !== undefined)
      );

      if (Object.keys(filteredData).length > 0) {
        await db.update(users).set(filteredData).where(eq(users.id, userId));

        await logAdminAction(
          db,
          ctx.user.id,
          "user.update",
          "user",
          userId,
          filteredData,
          existingUser,
          { ...existingUser, ...filteredData }
        );
      }

      return { success: true };
    }),

  suspendUser: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        reason: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      // Cancel user's subscription
      await db
        .update(subscriptions)
        .set({
          status: "canceled",
          canceledAt: new Date(),
          cancelReason: `Suspended by admin: ${input.reason}`,
        })
        .where(eq(subscriptions.userId, input.userId));

      await logAdminAction(
        db,
        ctx.user.id,
        "user.suspend",
        "user",
        input.userId,
        { reason: input.reason }
      );

      return { success: true };
    }),

  // ==========================================
  // SUBSCRIPTIONS MANAGEMENT
  // ==========================================

  listSubscriptions: adminProcedure
    .input(
      paginationSchema.extend({
        status: z
          .enum(["active", "canceled", "past_due", "trialing", "paused", "incomplete"])
          .optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();

      let query = db
        .select({
          subscription: subscriptions,
          user: users,
          plan: plans,
        })
        .from(subscriptions)
        .leftJoin(users, eq(subscriptions.userId, users.id))
        .leftJoin(plans, eq(subscriptions.planId, plans.id));

      if (input.status) {
        query = query.where(eq(subscriptions.status, input.status));
      }

      const subscriptionsList = await query
        .orderBy(desc(subscriptions.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      let countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(subscriptions);
      if (input.status) {
        countQuery = countQuery.where(eq(subscriptions.status, input.status));
      }
      const [total] = await countQuery;

      return {
        subscriptions: subscriptionsList,
        total: Number(total?.count || 0),
      };
    }),

  cancelSubscription: adminProcedure
    .input(
      z.object({
        subscriptionId: z.number(),
        reason: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, input.subscriptionId))
        .limit(1);

      if (!subscription) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assinatura não encontrada",
        });
      }

      await db
        .update(subscriptions)
        .set({
          status: "canceled",
          canceledAt: new Date(),
          cancelReason: input.reason,
        })
        .where(eq(subscriptions.id, input.subscriptionId));

      await logAdminAction(
        db,
        ctx.user.id,
        "subscription.cancel",
        "subscription",
        input.subscriptionId,
        { reason: input.reason },
        subscription
      );

      return { success: true };
    }),

  pauseSubscription: adminProcedure
    .input(z.object({ subscriptionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, input.subscriptionId))
        .limit(1);

      if (!subscription) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assinatura não encontrada",
        });
      }

      await db
        .update(subscriptions)
        .set({
          status: "paused",
          pausedAt: new Date(),
        })
        .where(eq(subscriptions.id, input.subscriptionId));

      await logAdminAction(
        db,
        ctx.user.id,
        "subscription.pause",
        "subscription",
        input.subscriptionId,
        null,
        subscription
      );

      return { success: true };
    }),

  resumeSubscription: adminProcedure
    .input(z.object({ subscriptionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      await db
        .update(subscriptions)
        .set({
          status: "active",
          pausedAt: null,
        })
        .where(eq(subscriptions.id, input.subscriptionId));

      await logAdminAction(
        db,
        ctx.user.id,
        "subscription.resume",
        "subscription",
        input.subscriptionId
      );

      return { success: true };
    }),

  changePlan: adminProcedure
    .input(
      z.object({
        subscriptionId: z.number(),
        planId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, input.subscriptionId))
        .limit(1);

      if (!subscription) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assinatura não encontrada",
        });
      }

      const [plan] = await db
        .select()
        .from(plans)
        .where(eq(plans.id, input.planId))
        .limit(1);

      if (!plan) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Plano não encontrado",
        });
      }

      await db
        .update(subscriptions)
        .set({ planId: input.planId })
        .where(eq(subscriptions.id, input.subscriptionId));

      await logAdminAction(
        db,
        ctx.user.id,
        "subscription.change_plan",
        "subscription",
        input.subscriptionId,
        { newPlanId: input.planId },
        subscription,
        { ...subscription, planId: input.planId }
      );

      return { success: true };
    }),

  extendSubscription: adminProcedure
    .input(
      z.object({
        subscriptionId: z.number(),
        days: z.number().min(1).max(365),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, input.subscriptionId))
        .limit(1);

      if (!subscription) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assinatura não encontrada",
        });
      }

      const newEndDate = new Date(subscription.currentPeriodEnd);
      newEndDate.setDate(newEndDate.getDate() + input.days);

      await db
        .update(subscriptions)
        .set({ currentPeriodEnd: newEndDate })
        .where(eq(subscriptions.id, input.subscriptionId));

      await logAdminAction(
        db,
        ctx.user.id,
        "subscription.extend",
        "subscription",
        input.subscriptionId,
        { days: input.days, newEndDate: newEndDate.toISOString() }
      );

      return { success: true };
    }),

  // ==========================================
  // CONNECTIONS MONITORING
  // ==========================================

  listAllConnections: adminProcedure
    .input(
      paginationSchema.extend({
        status: z
          .enum(["connected", "disconnected", "qr_code", "connecting"])
          .optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();

      let query = db
        .select({
          connection: whatsappConnections,
          user: users,
        })
        .from(whatsappConnections)
        .leftJoin(users, eq(whatsappConnections.userId, users.id));

      if (input.status) {
        query = query.where(eq(whatsappConnections.status, input.status));
      }

      const connectionsList = await query
        .orderBy(desc(whatsappConnections.updatedAt))
        .limit(input.limit)
        .offset(input.offset);

      let countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(whatsappConnections);
      if (input.status) {
        countQuery = countQuery.where(eq(whatsappConnections.status, input.status));
      }
      const [total] = await countQuery;

      return {
        connections: connectionsList,
        total: Number(total?.count || 0),
      };
    }),

  listOfflineConnections: adminProcedure.query(async () => {
    const db = await getDb();

    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const offlineConnections = await db
      .select({
        connection: whatsappConnections,
        user: users,
      })
      .from(whatsappConnections)
      .leftJoin(users, eq(whatsappConnections.userId, users.id))
      .where(eq(whatsappConnections.status, "disconnected"))
      .orderBy(desc(whatsappConnections.updatedAt))
      .limit(50);

    return offlineConnections;
  }),

  // ==========================================
  // ERROR MONITORING
  // ==========================================

  listErrors: adminProcedure
    .input(
      paginationSchema.extend({
        errorType: z.string().optional(),
        resolved: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();

      let conditions = [];
      if (input.errorType) {
        conditions.push(eq(errorLogs.errorType, input.errorType));
      }
      if (input.resolved !== undefined) {
        conditions.push(eq(errorLogs.resolved, input.resolved));
      }

      let query = db
        .select({
          error: errorLogs,
          user: users,
        })
        .from(errorLogs)
        .leftJoin(users, eq(errorLogs.userId, users.id));

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const errorsList = await query
        .orderBy(desc(errorLogs.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      let countQuery = db.select({ count: sql<number>`count(*)` }).from(errorLogs);
      if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions));
      }
      const [total] = await countQuery;

      return {
        errors: errorsList,
        total: Number(total?.count || 0),
      };
    }),

  getErrorStats: adminProcedure.query(async () => {
    const db = await getDb();

    const last24h = new Date();
    last24h.setDate(last24h.getDate() - 1);

    // Errors by type
    const errorsByType = await db
      .select({
        errorType: errorLogs.errorType,
        count: sql<number>`count(*)`,
      })
      .from(errorLogs)
      .where(gte(errorLogs.createdAt, last24h))
      .groupBy(errorLogs.errorType);

    // Errors per hour
    const errorsPerHour = await db.execute(sql`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as hour,
        COUNT(*) as count
      FROM error_logs
      WHERE created_at >= ${last24h}
      GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00')
      ORDER BY hour ASC
    `);

    // Unresolved count
    const [unresolvedCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(errorLogs)
      .where(eq(errorLogs.resolved, false));

    return {
      errorsByType,
      errorsPerHour: errorsPerHour[0] || [],
      unresolvedCount: Number(unresolvedCount?.count || 0),
    };
  }),

  resolveError: adminProcedure
    .input(z.object({ errorId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      await db
        .update(errorLogs)
        .set({
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy: ctx.user.id,
        })
        .where(eq(errorLogs.id, input.errorId));

      await logAdminAction(db, ctx.user.id, "error.resolve", "error", input.errorId);

      return { success: true };
    }),

  // ==========================================
  // PLANS MANAGEMENT
  // ==========================================

  listPlans: adminProcedure.query(async () => {
    const db = await getDb();
    const plansList = await db.select().from(plans).orderBy(plans.sortOrder);

    return plansList.map((p: any) => ({
      ...p,
      priceMonthly: parseFloat(p.priceMonthly),
      priceYearly: p.priceYearly ? parseFloat(p.priceYearly) : null,
    }));
  }),

  createPlan: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        slug: z.string().min(1),
        description: z.string().optional(),
        priceMonthly: z.number().min(0),
        priceYearly: z.number().min(0).optional(),
        maxWhatsappConnections: z.number().min(0),
        maxBusinessAccounts: z.number().min(0),
        maxCampaignsPerMonth: z.number().min(0),
        maxContactsPerList: z.number().min(0),
        maxMessagesPerMonth: z.number().min(0),
        maxTemplateMessagesPerMonth: z.number().min(0),
        hasWebhooks: z.boolean().default(false),
        hasApiAccess: z.boolean().default(false),
        hasAiFeatures: z.boolean().default(false),
        hasPrioritySupport: z.boolean().default(false),
        hasCustomBranding: z.boolean().default(false),
        isEnterprise: z.boolean().default(false),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      const [result] = await db.insert(plans).values({
        ...input,
        priceMonthly: input.priceMonthly.toFixed(2),
        priceYearly: input.priceYearly?.toFixed(2) || null,
      });

      await logAdminAction(db, ctx.user.id, "plan.create", "plan", result.insertId, input);

      return { success: true, planId: result.insertId };
    }),

  updatePlan: adminProcedure
    .input(
      z.object({
        planId: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        priceMonthly: z.number().min(0).optional(),
        priceYearly: z.number().min(0).optional(),
        maxWhatsappConnections: z.number().min(0).optional(),
        maxBusinessAccounts: z.number().min(0).optional(),
        maxCampaignsPerMonth: z.number().min(0).optional(),
        maxContactsPerList: z.number().min(0).optional(),
        maxMessagesPerMonth: z.number().min(0).optional(),
        maxTemplateMessagesPerMonth: z.number().min(0).optional(),
        hasWebhooks: z.boolean().optional(),
        hasApiAccess: z.boolean().optional(),
        hasAiFeatures: z.boolean().optional(),
        hasPrioritySupport: z.boolean().optional(),
        hasCustomBranding: z.boolean().optional(),
        stripePriceIdMonthly: z.string().optional(),
        stripePriceIdYearly: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      const [existingPlan] = await db
        .select()
        .from(plans)
        .where(eq(plans.id, input.planId))
        .limit(1);

      if (!existingPlan) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Plano não encontrado",
        });
      }

      const { planId, priceMonthly, priceYearly, ...restInput } = input;
      const updateData: any = { ...restInput };

      if (priceMonthly !== undefined) {
        updateData.priceMonthly = priceMonthly.toFixed(2);
      }
      if (priceYearly !== undefined) {
        updateData.priceYearly = priceYearly.toFixed(2);
      }

      await db.update(plans).set(updateData).where(eq(plans.id, planId));

      await logAdminAction(
        db,
        ctx.user.id,
        "plan.update",
        "plan",
        planId,
        updateData,
        existingPlan
      );

      return { success: true };
    }),

  togglePlan: adminProcedure
    .input(
      z.object({
        planId: z.number(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      await db
        .update(plans)
        .set({ isActive: input.isActive })
        .where(eq(plans.id, input.planId));

      await logAdminAction(
        db,
        ctx.user.id,
        input.isActive ? "plan.activate" : "plan.deactivate",
        "plan",
        input.planId
      );

      return { success: true };
    }),

  // ==========================================
  // SYSTEM SETTINGS
  // ==========================================

  getSystemSettings: adminProcedure.query(async () => {
    const db = await getDb();
    const settingsList = await db.select().from(systemSettings);
    return settingsList;
  }),

  updateSystemSetting: adminProcedure
    .input(
      z.object({
        key: z.string(),
        value: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      const [existing] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, input.key))
        .limit(1);

      if (existing) {
        await db
          .update(systemSettings)
          .set({ value: input.value, updatedBy: ctx.user.id })
          .where(eq(systemSettings.key, input.key));
      } else {
        await db.insert(systemSettings).values({
          key: input.key,
          value: input.value,
          updatedBy: ctx.user.id,
        });
      }

      await logAdminAction(
        db,
        ctx.user.id,
        "settings.update",
        "settings",
        null,
        { key: input.key, value: input.value },
        existing
      );

      return { success: true };
    }),

  toggleMaintenanceMode: adminProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();

    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "maintenance_mode"))
      .limit(1);

    const newValue = setting?.value === "true" ? "false" : "true";

    if (setting) {
      await db
        .update(systemSettings)
        .set({ value: newValue, updatedBy: ctx.user.id })
        .where(eq(systemSettings.key, "maintenance_mode"));
    } else {
      await db.insert(systemSettings).values({
        key: "maintenance_mode",
        value: newValue,
        type: "boolean",
        updatedBy: ctx.user.id,
      });
    }

    await logAdminAction(
      db,
      ctx.user.id,
      "settings.toggle_maintenance",
      "settings",
      null,
      { maintenance_mode: newValue }
    );

    return { success: true, maintenanceMode: newValue === "true" };
  }),

  // ==========================================
  // LOGS
  // ==========================================

  getAdminLogs: adminProcedure
    .input(
      paginationSchema.extend({
        action: z.string().optional(),
        adminUserId: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();

      let conditions = [];
      if (input.action) {
        conditions.push(like(adminLogs.action, `%${input.action}%`));
      }
      if (input.adminUserId) {
        conditions.push(eq(adminLogs.adminUserId, input.adminUserId));
      }

      let query = db
        .select({
          log: adminLogs,
          admin: users,
        })
        .from(adminLogs)
        .leftJoin(users, eq(adminLogs.adminUserId, users.id));

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const logsList = await query
        .orderBy(desc(adminLogs.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      let countQuery = db.select({ count: sql<number>`count(*)` }).from(adminLogs);
      if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions));
      }
      const [total] = await countQuery;

      return {
        logs: logsList,
        total: Number(total?.count || 0),
      };
    }),

  // ==========================================
  // REPORTS
  // ==========================================

  getChurnReport: adminProcedure.input(dateRangeSchema).query(async ({ input }) => {
    const db = await getDb();

    const startDate = input.startDate
      ? new Date(input.startDate)
      : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const endDate = input.endDate ? new Date(input.endDate) : new Date();

    const churned = await db
      .select({
        subscription: subscriptions,
        user: users,
        plan: plans,
      })
      .from(subscriptions)
      .leftJoin(users, eq(subscriptions.userId, users.id))
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(
        and(
          eq(subscriptions.status, "canceled"),
          gte(subscriptions.canceledAt, startDate),
          lte(subscriptions.canceledAt, endDate)
        )
      )
      .orderBy(desc(subscriptions.canceledAt));

    // Calculate churn rate
    const [totalActiveStart] = await db
      .select({ count: sql<number>`count(*)` })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, "active"),
          lte(subscriptions.createdAt, startDate)
        )
      );

    const churnRate =
      Number(totalActiveStart?.count || 0) > 0
        ? (churned.length / Number(totalActiveStart.count)) * 100
        : 0;

    return {
      churnedSubscriptions: churned,
      totalChurned: churned.length,
      churnRate: churnRate.toFixed(2),
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };
  }),

  getRevenueReport: adminProcedure.input(dateRangeSchema).query(async ({ input }) => {
    const db = await getDb();

    const startDate = input.startDate
      ? new Date(input.startDate)
      : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const endDate = input.endDate ? new Date(input.endDate) : new Date();

    // Total revenue
    const [totalRevenue] = await db
      .select({
        total: sql<number>`COALESCE(SUM(amount), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.status, "succeeded"),
          gte(payments.createdAt, startDate),
          lte(payments.createdAt, endDate)
        )
      );

    // Revenue by plan
    const revenueByPlan = await db
      .select({
        planName: plans.name,
        total: sql<number>`COALESCE(SUM(payments.amount), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(payments)
      .leftJoin(subscriptions, eq(payments.subscriptionId, subscriptions.id))
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(
        and(
          eq(payments.status, "succeeded"),
          gte(payments.createdAt, startDate),
          lte(payments.createdAt, endDate)
        )
      )
      .groupBy(plans.id);

    return {
      totalRevenue: Number(totalRevenue?.total || 0),
      transactionCount: Number(totalRevenue?.count || 0),
      revenueByPlan,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };
  }),
});
