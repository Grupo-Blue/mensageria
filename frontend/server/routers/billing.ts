import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
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
} from "../../drizzle/schema";
import { getDb } from "../db";

// Stripe initialization (will be null if not configured)
let stripe: any = null;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    const Stripe = require("stripe");
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });
  }
} catch (e) {
  console.warn("[Billing] Stripe not available:", e);
}

// Helper to get current billing period
function getCurrentPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start, end };
}

// Helper to format date for MySQL
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export const billingRouter = router({
  // Get all available plans
  getPlans: publicProcedure.query(async () => {
    const db = await getDb();
    const allPlans = await db
      .select()
      .from(plans)
      .where(eq(plans.isActive, true))
      .orderBy(plans.sortOrder);

    return allPlans.map((plan: any) => ({
      ...plan,
      priceMonthly: parseFloat(plan.priceMonthly),
      priceYearly: plan.priceYearly ? parseFloat(plan.priceYearly) : null,
    }));
  }),

  // Get current user's subscription
  getCurrentSubscription: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();

    const [subscription] = await db
      .select({
        subscription: subscriptions,
        plan: plans,
      })
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.userId, ctx.user.id))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    if (!subscription) {
      // Return free plan info for users without subscription
      const [freePlan] = await db
        .select()
        .from(plans)
        .where(eq(plans.slug, "free"))
        .limit(1);

      return {
        subscription: null,
        plan: freePlan
          ? {
              ...freePlan,
              priceMonthly: parseFloat(freePlan.priceMonthly),
              priceYearly: freePlan.priceYearly
                ? parseFloat(freePlan.priceYearly)
                : null,
            }
          : null,
        isFreePlan: true,
      };
    }

    return {
      subscription: subscription.subscription,
      plan: subscription.plan
        ? {
            ...subscription.plan,
            priceMonthly: parseFloat(subscription.plan.priceMonthly),
            priceYearly: subscription.plan.priceYearly
              ? parseFloat(subscription.plan.priceYearly)
              : null,
          }
        : null,
      isFreePlan: subscription.plan?.slug === "free",
    };
  }),

  // Get current usage for the billing period
  getUsage: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const { start, end } = getCurrentPeriod();

    // Get or create usage record
    let [usageRecord] = await db
      .select()
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.userId, ctx.user.id),
          eq(usageRecords.periodStart, formatDate(start))
        )
      )
      .limit(1);

    if (!usageRecord) {
      // Create new usage record for this period
      await db.insert(usageRecords).values({
        userId: ctx.user.id,
        periodStart: formatDate(start),
        periodEnd: formatDate(end),
      });

      [usageRecord] = await db
        .select()
        .from(usageRecords)
        .where(
          and(
            eq(usageRecords.userId, ctx.user.id),
            eq(usageRecords.periodStart, formatDate(start))
          )
        )
        .limit(1);
    }

    // Get current counts from actual tables
    const [connectionsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(whatsappConnections)
      .where(eq(whatsappConnections.userId, ctx.user.id));

    const [businessAccountsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(whatsappBusinessAccounts)
      .where(eq(whatsappBusinessAccounts.userId, ctx.user.id));

    const [campaignsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.userId, ctx.user.id),
          gte(campaigns.createdAt, start),
          lte(campaigns.createdAt, end)
        )
      );

    // Get plan limits
    const [subscription] = await db
      .select({
        plan: plans,
      })
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(
        and(
          eq(subscriptions.userId, ctx.user.id),
          eq(subscriptions.status, "active")
        )
      )
      .limit(1);

    let planLimits = {
      maxWhatsappConnections: 1,
      maxBusinessAccounts: 0,
      maxCampaignsPerMonth: 1,
      maxMessagesPerMonth: 100,
      maxTemplateMessagesPerMonth: 0,
      maxContactsPerList: 100,
    };

    if (subscription?.plan) {
      planLimits = {
        maxWhatsappConnections: subscription.plan.maxWhatsappConnections,
        maxBusinessAccounts: subscription.plan.maxBusinessAccounts,
        maxCampaignsPerMonth: subscription.plan.maxCampaignsPerMonth,
        maxMessagesPerMonth: subscription.plan.maxMessagesPerMonth,
        maxTemplateMessagesPerMonth:
          subscription.plan.maxTemplateMessagesPerMonth,
        maxContactsPerList: subscription.plan.maxContactsPerList,
      };
    } else {
      // Get free plan limits
      const [freePlan] = await db
        .select()
        .from(plans)
        .where(eq(plans.slug, "free"))
        .limit(1);

      if (freePlan) {
        planLimits = {
          maxWhatsappConnections: freePlan.maxWhatsappConnections,
          maxBusinessAccounts: freePlan.maxBusinessAccounts,
          maxCampaignsPerMonth: freePlan.maxCampaignsPerMonth,
          maxMessagesPerMonth: freePlan.maxMessagesPerMonth,
          maxTemplateMessagesPerMonth: freePlan.maxTemplateMessagesPerMonth,
          maxContactsPerList: freePlan.maxContactsPerList,
        };
      }
    }

    return {
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      current: {
        whatsappConnections: Number(connectionsCount?.count || 0),
        businessAccounts: Number(businessAccountsCount?.count || 0),
        campaignsCreated: Number(campaignsCount?.count || 0),
        messagesViaApi: usageRecord?.messagesViaApi || 0,
        messagesViaTemplate: usageRecord?.messagesViaTemplate || 0,
      },
      limits: planLimits,
    };
  }),

  // Create Stripe checkout session
  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        planSlug: z.string(),
        billingCycle: z.enum(["monthly", "yearly"]),
        successUrl: z.string().optional(),
        cancelUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!stripe) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe não está configurado",
        });
      }

      const db = await getDb();

      // Get the plan
      const [plan] = await db
        .select()
        .from(plans)
        .where(and(eq(plans.slug, input.planSlug), eq(plans.isActive, true)))
        .limit(1);

      if (!plan) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Plano não encontrado",
        });
      }

      if (plan.isEnterprise) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Para o plano Enterprise, entre em contato conosco",
        });
      }

      const priceId =
        input.billingCycle === "yearly"
          ? plan.stripePriceIdYearly
          : plan.stripePriceIdMonthly;

      if (!priceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Preço não configurado para este plano",
        });
      }

      // Get or create Stripe customer
      let stripeCustomerId: string;

      const [existingSubscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, ctx.user.id))
        .limit(1);

      if (existingSubscription?.stripeCustomerId) {
        stripeCustomerId = existingSubscription.stripeCustomerId;
      } else {
        const customer = await stripe.customers.create({
          email: ctx.user.email,
          name: ctx.user.name,
          metadata: {
            userId: ctx.user.id.toString(),
          },
        });
        stripeCustomerId = customer.id;
      }

      const appUrl = process.env.APP_URL || "http://localhost:5173";

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url:
          input.successUrl || `${appUrl}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: input.cancelUrl || `${appUrl}/billing?canceled=true`,
        metadata: {
          userId: ctx.user.id.toString(),
          planId: plan.id.toString(),
          billingCycle: input.billingCycle,
        },
        subscription_data: {
          metadata: {
            userId: ctx.user.id.toString(),
            planId: plan.id.toString(),
          },
        },
      });

      return {
        sessionId: session.id,
        url: session.url,
      };
    }),

  // Create Stripe customer portal session
  createPortalSession: protectedProcedure
    .input(
      z.object({
        returnUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!stripe) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe não está configurado",
        });
      }

      const db = await getDb();

      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, ctx.user.id))
        .limit(1);

      if (!subscription?.stripeCustomerId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Nenhuma assinatura encontrada",
        });
      }

      const appUrl = process.env.APP_URL || "http://localhost:5173";

      const session = await stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: input.returnUrl || `${appUrl}/billing`,
      });

      return {
        url: session.url,
      };
    }),

  // Get payment history
  getPaymentHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();

      const paymentsList = await db
        .select()
        .from(payments)
        .where(eq(payments.userId, ctx.user.id))
        .orderBy(desc(payments.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [total] = await db
        .select({ count: sql<number>`count(*)` })
        .from(payments)
        .where(eq(payments.userId, ctx.user.id));

      return {
        payments: paymentsList.map((p: any) => ({
          ...p,
          amount: parseFloat(p.amount),
        })),
        total: Number(total?.count || 0),
      };
    }),

  // Cancel subscription
  cancelSubscription: protectedProcedure
    .input(
      z.object({
        reason: z.string().optional(),
        cancelAtPeriodEnd: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, ctx.user.id),
            eq(subscriptions.status, "active")
          )
        )
        .limit(1);

      if (!subscription) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Nenhuma assinatura ativa encontrada",
        });
      }

      // Cancel on Stripe if configured
      if (stripe && subscription.stripeSubscriptionId) {
        if (input.cancelAtPeriodEnd) {
          await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: true,
          });
        } else {
          await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
        }
      }

      // Update local subscription
      await db
        .update(subscriptions)
        .set({
          status: input.cancelAtPeriodEnd ? "active" : "canceled",
          canceledAt: new Date(),
          cancelReason: input.reason,
        })
        .where(eq(subscriptions.id, subscription.id));

      return { success: true };
    }),

  // Check if user can perform action (limit check)
  checkLimit: protectedProcedure
    .input(
      z.object({
        type: z.enum([
          "whatsapp_connection",
          "business_account",
          "campaign",
          "message_api",
          "message_template",
        ]),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      const { start, end } = getCurrentPeriod();

      // Get user's plan limits
      const [subscription] = await db
        .select({
          plan: plans,
        })
        .from(subscriptions)
        .leftJoin(plans, eq(subscriptions.planId, plans.id))
        .where(
          and(
            eq(subscriptions.userId, ctx.user.id),
            eq(subscriptions.status, "active")
          )
        )
        .limit(1);

      let limits = {
        maxWhatsappConnections: 1,
        maxBusinessAccounts: 0,
        maxCampaignsPerMonth: 1,
        maxMessagesPerMonth: 100,
        maxTemplateMessagesPerMonth: 0,
      };

      if (subscription?.plan) {
        limits = {
          maxWhatsappConnections: subscription.plan.maxWhatsappConnections,
          maxBusinessAccounts: subscription.plan.maxBusinessAccounts,
          maxCampaignsPerMonth: subscription.plan.maxCampaignsPerMonth,
          maxMessagesPerMonth: subscription.plan.maxMessagesPerMonth,
          maxTemplateMessagesPerMonth:
            subscription.plan.maxTemplateMessagesPerMonth,
        };
      } else {
        // Get free plan limits
        const [freePlan] = await db
          .select()
          .from(plans)
          .where(eq(plans.slug, "free"))
          .limit(1);

        if (freePlan) {
          limits = {
            maxWhatsappConnections: freePlan.maxWhatsappConnections,
            maxBusinessAccounts: freePlan.maxBusinessAccounts,
            maxCampaignsPerMonth: freePlan.maxCampaignsPerMonth,
            maxMessagesPerMonth: freePlan.maxMessagesPerMonth,
            maxTemplateMessagesPerMonth: freePlan.maxTemplateMessagesPerMonth,
          };
        }
      }

      let current = 0;
      let limit = 0;
      let allowed = true;

      switch (input.type) {
        case "whatsapp_connection": {
          const [count] = await db
            .select({ count: sql<number>`count(*)` })
            .from(whatsappConnections)
            .where(eq(whatsappConnections.userId, ctx.user.id));
          current = Number(count?.count || 0);
          limit = limits.maxWhatsappConnections;
          allowed = current < limit;
          break;
        }
        case "business_account": {
          const [count] = await db
            .select({ count: sql<number>`count(*)` })
            .from(whatsappBusinessAccounts)
            .where(eq(whatsappBusinessAccounts.userId, ctx.user.id));
          current = Number(count?.count || 0);
          limit = limits.maxBusinessAccounts;
          allowed = current < limit;
          break;
        }
        case "campaign": {
          const [count] = await db
            .select({ count: sql<number>`count(*)` })
            .from(campaigns)
            .where(
              and(
                eq(campaigns.userId, ctx.user.id),
                gte(campaigns.createdAt, start),
                lte(campaigns.createdAt, end)
              )
            );
          current = Number(count?.count || 0);
          limit = limits.maxCampaignsPerMonth;
          allowed = current < limit;
          break;
        }
        case "message_api": {
          const [usage] = await db
            .select()
            .from(usageRecords)
            .where(
              and(
                eq(usageRecords.userId, ctx.user.id),
                eq(usageRecords.periodStart, formatDate(start))
              )
            )
            .limit(1);
          current = usage?.messagesViaApi || 0;
          limit = limits.maxMessagesPerMonth;
          allowed = current < limit;
          break;
        }
        case "message_template": {
          const [usage] = await db
            .select()
            .from(usageRecords)
            .where(
              and(
                eq(usageRecords.userId, ctx.user.id),
                eq(usageRecords.periodStart, formatDate(start))
              )
            )
            .limit(1);
          current = usage?.messagesViaTemplate || 0;
          limit = limits.maxTemplateMessagesPerMonth;
          allowed = current < limit;
          break;
        }
      }

      return {
        allowed,
        current,
        limit,
        type: input.type,
        message: allowed
          ? null
          : `Limite de ${input.type.replace("_", " ")} atingido. Faça upgrade do seu plano.`,
      };
    }),

  // Increment usage counter
  incrementUsage: protectedProcedure
    .input(
      z.object({
        type: z.enum([
          "messages_api",
          "messages_template",
          "campaigns",
          "contacts",
        ]),
        amount: z.number().min(1).default(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const { start, end } = getCurrentPeriod();

      // Get or create usage record
      let [usageRecord] = await db
        .select()
        .from(usageRecords)
        .where(
          and(
            eq(usageRecords.userId, ctx.user.id),
            eq(usageRecords.periodStart, formatDate(start))
          )
        )
        .limit(1);

      if (!usageRecord) {
        await db.insert(usageRecords).values({
          userId: ctx.user.id,
          periodStart: formatDate(start),
          periodEnd: formatDate(end),
        });
      }

      // Update the appropriate counter
      const updateField: any = {};
      switch (input.type) {
        case "messages_api":
          updateField.messagesViaApi = sql`${usageRecords.messagesViaApi} + ${input.amount}`;
          break;
        case "messages_template":
          updateField.messagesViaTemplate = sql`${usageRecords.messagesViaTemplate} + ${input.amount}`;
          break;
        case "campaigns":
          updateField.campaignsCreated = sql`${usageRecords.campaignsCreated} + ${input.amount}`;
          break;
        case "contacts":
          updateField.contactsCreated = sql`${usageRecords.contactsCreated} + ${input.amount}`;
          break;
      }

      await db
        .update(usageRecords)
        .set(updateField)
        .where(
          and(
            eq(usageRecords.userId, ctx.user.id),
            eq(usageRecords.periodStart, formatDate(start))
          )
        );

      return { success: true };
    }),

  // Send enterprise contact request
  sendEnterpriseContactRequest: protectedProcedure
    .input(
      z.object({
        companyName: z.string().min(1),
        phone: z.string().optional(),
        message: z.string().optional(),
        expectedUsage: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Here you would typically send an email to the enterprise contact
      // For now, we'll just log it and return success
      console.log("[Enterprise Contact Request]", {
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        userName: ctx.user.name,
        ...input,
      });

      // TODO: Implement email sending using nodemailer or similar
      // const enterpriseEmail = process.env.ENTERPRISE_CONTACT_EMAIL;
      // await sendEmail(enterpriseEmail, 'Nova solicitação Enterprise', ...);

      return {
        success: true,
        message:
          "Sua solicitação foi enviada. Entraremos em contato em breve!",
      };
    }),
});
