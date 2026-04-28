import express from "express";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { payments, subscriptions } from "../../drizzle/schema";

const stripeWebhookRouter = express.Router();

type LocalSubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "trialing"
  | "paused"
  | "incomplete";

let stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" })
  : null;

export function __setStripeForTest(mockStripe: any) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("__setStripeForTest is only available in test environment");
  }
  stripe = mockStripe;
}

function stripeId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return null;
}

function stripeDate(timestamp: number | null | undefined): Date | null {
  return timestamp ? new Date(timestamp * 1000) : null;
}

function mapSubscriptionStatus(status: string): LocalSubscriptionStatus {
  switch (status) {
    case "active":
    case "canceled":
    case "past_due":
    case "trialing":
    case "paused":
    case "incomplete":
      return status;
    case "unpaid":
      return "past_due";
    case "incomplete_expired":
    default:
      return "incomplete";
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = Number.parseInt(session.metadata?.userId ?? "", 10);
  const planId = Number.parseInt(session.metadata?.planId ?? "", 10);
  const billingCycle = session.metadata?.billingCycle === "yearly" ? "yearly" : "monthly";
  const stripeSubscriptionId = stripeId(session.subscription);

  if (!Number.isInteger(userId) || !Number.isInteger(planId) || !stripeSubscriptionId) {
    throw new Error("checkout.session.completed missing required subscription metadata");
  }
  if (!stripe) {
    throw new Error("Stripe client is not configured");
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const currentPeriodStart = stripeDate(stripeSubscription.current_period_start);
  const currentPeriodEnd = stripeDate(stripeSubscription.current_period_end);

  if (!currentPeriodStart || !currentPeriodEnd) {
    throw new Error("Stripe subscription missing current period dates");
  }

  const db = await getDb();
  const values = {
    userId,
    planId,
    status: "active" as const,
    billingCycle,
    stripeCustomerId: stripeId(session.customer),
    stripeSubscriptionId,
    currentPeriodStart,
    currentPeriodEnd,
  };

  const [existingSubscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (existingSubscription) {
    await db
      .update(subscriptions)
      .set(values)
      .where(eq(subscriptions.id, existingSubscription.id));
    return;
  }

  await db.insert(subscriptions).values(values);
}

async function findLocalSubscription(stripeSubscriptionId: string) {
  const db = await getDb();
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);

  return { db, subscription };
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const stripeSubscriptionId = stripeId(invoice.subscription);
  if (!stripeSubscriptionId) return;

  const { db, subscription } = await findLocalSubscription(stripeSubscriptionId);
  if (!subscription) return;

  await db.insert(payments).values({
    userId: subscription.userId,
    subscriptionId: subscription.id,
    amount: String((invoice.amount_paid ?? 0) / 100),
    currency: (invoice.currency ?? "brl").toUpperCase(),
    status: "succeeded" as const,
    stripeInvoiceId: invoice.id,
    stripePaymentIntentId: stripeId(invoice.payment_intent),
    paidAt: stripeDate(invoice.status_transitions?.paid_at),
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const stripeSubscriptionId = stripeId(invoice.subscription);
  if (!stripeSubscriptionId) return;

  const { db, subscription } = await findLocalSubscription(stripeSubscriptionId);
  if (!subscription) return;

  await db
    .update(subscriptions)
    .set({ status: "past_due" as const })
    .where(eq(subscriptions.id, subscription.id));

  await db.insert(payments).values({
    userId: subscription.userId,
    subscriptionId: subscription.id,
    amount: String((invoice.amount_due ?? invoice.amount_remaining ?? 0) / 100),
    currency: (invoice.currency ?? "brl").toUpperCase(),
    status: "failed" as const,
    stripeInvoiceId: invoice.id,
    stripePaymentIntentId: stripeId(invoice.payment_intent),
    paidAt: null,
  });
}

async function handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription) {
  const { db, subscription } = await findLocalSubscription(stripeSubscription.id);
  if (!subscription) return;

  await db
    .update(subscriptions)
    .set({
      status: mapSubscriptionStatus(stripeSubscription.status),
      currentPeriodStart: stripeDate(stripeSubscription.current_period_start),
      currentPeriodEnd: stripeDate(stripeSubscription.current_period_end),
      canceledAt: stripeDate(stripeSubscription.canceled_at),
      trialEndsAt: stripeDate(stripeSubscription.trial_end),
    })
    .where(eq(subscriptions.id, subscription.id));
}

async function handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
  const { db, subscription } = await findLocalSubscription(stripeSubscription.id);
  if (!subscription) return;

  await db
    .update(subscriptions)
    .set({ status: "canceled" as const, canceledAt: new Date() })
    .where(eq(subscriptions.id, subscription.id));
}

stripeWebhookRouter.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.header("stripe-signature");

    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET || !stripe) {
      return res.status(400).send("Webhook signature verification failed");
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error) {
      console.warn("[Stripe Webhook] Invalid signature:", error);
      return res.status(400).send("Webhook signature verification failed");
    }

    try {
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        case "invoice.paid":
          await handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;
        case "invoice.payment_failed":
          await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        case "customer.subscription.updated":
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;
        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
        default:
          break;
      }

      return res.status(200).json({ received: true });
    } catch (error) {
      console.error("[Stripe Webhook] Failed to process event:", error);
      return res.status(500).json({ error: "Failed to process webhook" });
    }
  }
);

export default stripeWebhookRouter;
