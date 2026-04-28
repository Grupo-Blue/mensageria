import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({
  selectResults: [] as any[][],
  operations: [] as any[],
}));

function createQuery(result?: any[]) {
  const query: any = {};
  for (const method of ["from", "where", "limit", "leftJoin", "orderBy"]) {
    query[method] = vi.fn(() => query);
  }
  query.then = (resolve: any, reject: any) => Promise.resolve(result ?? []).then(resolve, reject);
  query.catch = (reject: any) => Promise.resolve(result ?? []).catch(reject);
  query.finally = (onFinally: any) => Promise.resolve(result ?? []).finally(onFinally);
  return query;
}

const getDbMock = vi.hoisted(() =>
  vi.fn(async () => ({
    select: vi.fn(() => createQuery(dbState.selectResults.shift() ?? [])),
    insert: vi.fn((table: any) => ({
      values: vi.fn(async (values: any) => {
        dbState.operations.push({ type: "insert", table, values });
        return [];
      }),
    })),
    update: vi.fn((table: any) => ({
      set: vi.fn((values: any) => ({
        where: vi.fn(async () => {
          dbState.operations.push({ type: "update", table, values });
          return [];
        }),
      })),
    })),
  }))
);

vi.mock("../db", () => ({ getDb: getDbMock }));

import stripeWebhookRouter, { __setStripeForTest } from "./stripeWebhook";

function makeStripeMock(eventRef: { current: any }) {
  return {
    webhooks: {
      constructEvent: vi.fn((body: Buffer, signature: string) => {
        expect(Buffer.isBuffer(body)).toBe(true);
        if (signature !== "valid_signature") throw new Error("bad signature");
        return eventRef.current;
      }),
    },
    subscriptions: {
      retrieve: vi.fn(async () => ({
        id: "sub_123",
        current_period_start: 1_700_000_000,
        current_period_end: 1_702_592_000,
      })),
    },
  };
}

async function postWebhook(app: express.Express, signature = "valid_signature") {
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Unable to bind test server");

    return await fetch(`http://127.0.0.1:${address.port}/api/stripe/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature,
      },
      body: JSON.stringify({ test: true }),
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  }
}

describe("stripeWebhookRouter", () => {
  const eventRef = { current: undefined as any };
  let stripeMock: ReturnType<typeof makeStripeMock>;
  let app: express.Express;

  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    dbState.selectResults = [];
    dbState.operations = [];
    getDbMock.mockClear();
    stripeMock = makeStripeMock(eventRef);
    __setStripeForTest(stripeMock);
    app = express();
    app.use("/api/stripe", stripeWebhookRouter);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("AC-1: upserts an active subscription on checkout.session.completed", async () => {
    eventRef.current = {
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "42", planId: "10", billingCycle: "yearly" },
          customer: "cus_123",
          subscription: "sub_123",
        },
      },
    };
    dbState.selectResults = [[]];

    const response = await postWebhook(app);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(stripeMock.subscriptions.retrieve).toHaveBeenCalledWith("sub_123");
    expect(dbState.operations).toEqual([
      expect.objectContaining({
        type: "insert",
        values: expect.objectContaining({
          userId: 42,
          planId: 10,
          status: "active",
          billingCycle: "yearly",
          stripeCustomerId: "cus_123",
          stripeSubscriptionId: "sub_123",
          currentPeriodStart: new Date(1_700_000_000 * 1000),
          currentPeriodEnd: new Date(1_702_592_000 * 1000),
        }),
      }),
    ]);
  });

  it("AC-2: records a succeeded payment on invoice.paid", async () => {
    eventRef.current = {
      type: "invoice.paid",
      data: {
        object: {
          id: "in_paid_123",
          subscription: "sub_123",
          amount_paid: 12345,
          currency: "brl",
          payment_intent: "pi_123",
          status_transitions: { paid_at: 1_700_000_100 },
        },
      },
    };
    dbState.selectResults = [[{ id: 7, userId: 42, stripeSubscriptionId: "sub_123" }]];

    const response = await postWebhook(app);

    expect(response.status).toBe(200);
    expect(dbState.operations).toEqual([
      expect.objectContaining({
        type: "insert",
        values: expect.objectContaining({
          userId: 42,
          subscriptionId: 7,
          amount: "123.45",
          currency: "BRL",
          status: "succeeded",
          stripeInvoiceId: "in_paid_123",
          stripePaymentIntentId: "pi_123",
          paidAt: new Date(1_700_000_100 * 1000),
        }),
      }),
    ]);
  });

  it("AC-3: marks subscription past_due and records failed payment on invoice.payment_failed", async () => {
    eventRef.current = {
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_failed_123",
          subscription: "sub_123",
          amount_due: 9900,
          currency: "usd",
          payment_intent: "pi_failed_123",
        },
      },
    };
    dbState.selectResults = [[{ id: 7, userId: 42, stripeSubscriptionId: "sub_123" }]];

    const response = await postWebhook(app);

    expect(response.status).toBe(200);
    expect(dbState.operations).toEqual([
      expect.objectContaining({ type: "update", values: { status: "past_due" } }),
      expect.objectContaining({
        type: "insert",
        values: expect.objectContaining({
          userId: 42,
          subscriptionId: 7,
          amount: "99",
          currency: "USD",
          status: "failed",
          stripeInvoiceId: "in_failed_123",
          stripePaymentIntentId: "pi_failed_123",
          paidAt: null,
        }),
      }),
    ]);
  });

  it("updates subscription fields on customer.subscription.updated", async () => {
    eventRef.current = {
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          status: "trialing",
          current_period_start: 1_700_000_000,
          current_period_end: 1_702_592_000,
          canceled_at: null,
          trial_end: 1_700_086_400,
        },
      },
    };
    dbState.selectResults = [[{ id: 7, userId: 42, stripeSubscriptionId: "sub_123" }]];

    const response = await postWebhook(app);

    expect(response.status).toBe(200);
    expect(dbState.operations).toEqual([
      expect.objectContaining({
        type: "update",
        values: expect.objectContaining({
          status: "trialing",
          currentPeriodStart: new Date(1_700_000_000 * 1000),
          currentPeriodEnd: new Date(1_702_592_000 * 1000),
          canceledAt: null,
          trialEndsAt: new Date(1_700_086_400 * 1000),
        }),
      }),
    ]);
  });

  it("AC-4: marks subscription canceled on customer.subscription.deleted", async () => {
    eventRef.current = {
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_123" } },
    };
    dbState.selectResults = [[{ id: 7, userId: 42, stripeSubscriptionId: "sub_123" }]];

    const response = await postWebhook(app);

    expect(response.status).toBe(200);
    expect(dbState.operations).toEqual([
      expect.objectContaining({
        type: "update",
        values: expect.objectContaining({ status: "canceled", canceledAt: expect.any(Date) }),
      }),
    ]);
  });

  it("AC-5: rejects invalid Stripe signatures before touching the database", async () => {
    eventRef.current = {
      type: "checkout.session.completed",
      data: { object: {} },
    };

    const response = await postWebhook(app, "invalid_signature");

    expect(response.status).toBe(400);
    expect(getDbMock).not.toHaveBeenCalled();
    expect(stripeMock.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(dbState.operations).toEqual([]);
  });

  it("ignores unsupported events with a 200 received response", async () => {
    eventRef.current = { type: "charge.refunded", data: { object: { id: "ch_123" } } };

    const response = await postWebhook(app);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(getDbMock).not.toHaveBeenCalled();
  });
});
