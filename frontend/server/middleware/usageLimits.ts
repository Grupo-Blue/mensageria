import { TRPCError } from "@trpc/server";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import {
  plans,
  subscriptions,
  usageRecords,
  whatsappConnections,
  whatsappBusinessAccounts,
  campaigns,
} from "../../drizzle/schema";
import { getDb } from "../db";

export type LimitType =
  | "whatsapp_connection"
  | "business_account"
  | "campaign"
  | "message_api"
  | "message_template"
  | "contacts";

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  message?: string;
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

/**
 * Get user's plan limits
 */
export async function getUserPlanLimits(userId: number) {
  const db = await getDb();

  // Get user's active subscription and plan
  const [subscription] = await db
    .select({
      plan: plans,
    })
    .from(subscriptions)
    .leftJoin(plans, eq(subscriptions.planId, plans.id))
    .where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"))
    )
    .limit(1);

  if (subscription?.plan) {
    return {
      maxWhatsappConnections: subscription.plan.maxWhatsappConnections,
      maxBusinessAccounts: subscription.plan.maxBusinessAccounts,
      maxCampaignsPerMonth: subscription.plan.maxCampaignsPerMonth,
      maxContactsPerList: subscription.plan.maxContactsPerList,
      maxMessagesPerMonth: subscription.plan.maxMessagesPerMonth,
      maxTemplateMessagesPerMonth: subscription.plan.maxTemplateMessagesPerMonth,
      hasWebhooks: subscription.plan.hasWebhooks,
      hasApiAccess: subscription.plan.hasApiAccess,
      hasAiFeatures: subscription.plan.hasAiFeatures,
      planName: subscription.plan.name,
      planSlug: subscription.plan.slug,
    };
  }

  // Return free plan limits if no active subscription
  const [freePlan] = await db
    .select()
    .from(plans)
    .where(eq(plans.slug, "free"))
    .limit(1);

  if (freePlan) {
    return {
      maxWhatsappConnections: freePlan.maxWhatsappConnections,
      maxBusinessAccounts: freePlan.maxBusinessAccounts,
      maxCampaignsPerMonth: freePlan.maxCampaignsPerMonth,
      maxContactsPerList: freePlan.maxContactsPerList,
      maxMessagesPerMonth: freePlan.maxMessagesPerMonth,
      maxTemplateMessagesPerMonth: freePlan.maxTemplateMessagesPerMonth,
      hasWebhooks: freePlan.hasWebhooks,
      hasApiAccess: freePlan.hasApiAccess,
      hasAiFeatures: freePlan.hasAiFeatures,
      planName: freePlan.name,
      planSlug: freePlan.slug,
    };
  }

  // Default free limits if no free plan exists
  return {
    maxWhatsappConnections: 1,
    maxBusinessAccounts: 0,
    maxCampaignsPerMonth: 1,
    maxContactsPerList: 100,
    maxMessagesPerMonth: 100,
    maxTemplateMessagesPerMonth: 0,
    hasWebhooks: false,
    hasApiAccess: false,
    hasAiFeatures: false,
    planName: "Free",
    planSlug: "free",
  };
}

/**
 * Check if user can perform an action based on their plan limits
 */
export async function checkUsageLimit(
  userId: number,
  limitType: LimitType
): Promise<LimitCheckResult> {
  const db = await getDb();
  const { start, end } = getCurrentPeriod();
  const limits = await getUserPlanLimits(userId);

  let current = 0;
  let limit = 0;

  switch (limitType) {
    case "whatsapp_connection": {
      const [count] = await db
        .select({ count: sql<number>`count(*)` })
        .from(whatsappConnections)
        .where(eq(whatsappConnections.userId, userId));
      current = Number(count?.count || 0);
      limit = limits.maxWhatsappConnections;
      break;
    }

    case "business_account": {
      const [count] = await db
        .select({ count: sql<number>`count(*)` })
        .from(whatsappBusinessAccounts)
        .where(eq(whatsappBusinessAccounts.userId, userId));
      current = Number(count?.count || 0);
      limit = limits.maxBusinessAccounts;
      break;
    }

    case "campaign": {
      const [count] = await db
        .select({ count: sql<number>`count(*)` })
        .from(campaigns)
        .where(
          and(
            eq(campaigns.userId, userId),
            gte(campaigns.createdAt, start),
            lte(campaigns.createdAt, end)
          )
        );
      current = Number(count?.count || 0);
      limit = limits.maxCampaignsPerMonth;
      break;
    }

    case "message_api": {
      const [usage] = await db
        .select()
        .from(usageRecords)
        .where(
          and(
            eq(usageRecords.userId, userId),
            eq(usageRecords.periodStart, formatDate(start))
          )
        )
        .limit(1);
      current = usage?.messagesViaApi || 0;
      limit = limits.maxMessagesPerMonth;
      break;
    }

    case "message_template": {
      const [usage] = await db
        .select()
        .from(usageRecords)
        .where(
          and(
            eq(usageRecords.userId, userId),
            eq(usageRecords.periodStart, formatDate(start))
          )
        )
        .limit(1);
      current = usage?.messagesViaTemplate || 0;
      limit = limits.maxTemplateMessagesPerMonth;
      break;
    }

    case "contacts": {
      // This is a per-list limit, not a total count
      // Will be checked differently when adding contacts
      current = 0;
      limit = limits.maxContactsPerList;
      break;
    }
  }

  const allowed = current < limit;
  const typeLabels: Record<LimitType, string> = {
    whatsapp_connection: "conexões WhatsApp",
    business_account: "contas Business",
    campaign: "campanhas",
    message_api: "mensagens via API",
    message_template: "mensagens via template",
    contacts: "contatos por lista",
  };

  return {
    allowed,
    current,
    limit,
    message: allowed
      ? undefined
      : `Limite de ${typeLabels[limitType]} atingido (${current}/${limit}). Faça upgrade do seu plano para continuar.`,
  };
}

/**
 * Throw error if limit is exceeded
 */
export async function enforceLimit(
  userId: number,
  limitType: LimitType
): Promise<void> {
  const result = await checkUsageLimit(userId, limitType);

  if (!result.allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: result.message || "Limite do plano atingido",
    });
  }
}

/**
 * Check if user has a specific feature enabled
 */
export async function checkFeature(
  userId: number,
  feature: "webhooks" | "api_access" | "ai_features"
): Promise<boolean> {
  const limits = await getUserPlanLimits(userId);

  switch (feature) {
    case "webhooks":
      return limits.hasWebhooks;
    case "api_access":
      return limits.hasApiAccess;
    case "ai_features":
      return limits.hasAiFeatures;
    default:
      return false;
  }
}

/**
 * Throw error if feature is not available
 */
export async function enforceFeature(
  userId: number,
  feature: "webhooks" | "api_access" | "ai_features"
): Promise<void> {
  const hasFeature = await checkFeature(userId, feature);

  if (!hasFeature) {
    const featureLabels = {
      webhooks: "Webhooks",
      api_access: "Acesso à API",
      ai_features: "Recursos de IA",
    };

    throw new TRPCError({
      code: "FORBIDDEN",
      message: `${featureLabels[feature]} não está disponível no seu plano. Faça upgrade para acessar este recurso.`,
    });
  }
}

/**
 * Increment usage counter for the current period
 */
export async function incrementUsage(
  userId: number,
  type: "messages_api" | "messages_template" | "campaigns" | "contacts",
  amount: number = 1
): Promise<void> {
  const db = await getDb();
  const { start, end } = getCurrentPeriod();

  // Get or create usage record
  let [usageRecord] = await db
    .select()
    .from(usageRecords)
    .where(
      and(
        eq(usageRecords.userId, userId),
        eq(usageRecords.periodStart, formatDate(start))
      )
    )
    .limit(1);

  if (!usageRecord) {
    await db.insert(usageRecords).values({
      userId,
      periodStart: formatDate(start),
      periodEnd: formatDate(end),
    });
  }

  // Update the appropriate counter
  const updateField: any = {};
  switch (type) {
    case "messages_api":
      updateField.messagesViaApi = sql`${usageRecords.messagesViaApi} + ${amount}`;
      break;
    case "messages_template":
      updateField.messagesViaTemplate = sql`${usageRecords.messagesViaTemplate} + ${amount}`;
      break;
    case "campaigns":
      updateField.campaignsCreated = sql`${usageRecords.campaignsCreated} + ${amount}`;
      break;
    case "contacts":
      updateField.contactsCreated = sql`${usageRecords.contactsCreated} + ${amount}`;
      break;
  }

  await db
    .update(usageRecords)
    .set(updateField)
    .where(
      and(
        eq(usageRecords.userId, userId),
        eq(usageRecords.periodStart, formatDate(start))
      )
    );
}
