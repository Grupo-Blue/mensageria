import { describe, it, expect, vi, beforeEach } from "vitest";
import { callTRPCProcedure } from "@trpc/server";

// ── Mock Stripe ──────────────────────────────────────────────────────────
const { stripeMocks } = vi.hoisted(() => {
  const m = {
    customers: { create: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
  };
  return { stripeMocks: m };
});

// ── Mock getDb ───────────────────────────────────────────────────────────
// Creates a chainable Drizzle-compatible mock that consumes pre-arranged
// results from a queue. Each terminal .limit() / destructure await pops
// the next result.
function createMockDb(results: any[][]) {
  let cursor = 0;
  const makeQuery = () => {
    const query: any = {};
    const chain = () => query;
    for (const method of [
      "from",
      "where",
      "orderBy",
      "limit",
      "leftJoin",
      "values",
    ]) {
      query[method] = chain;
    }
    query.then = (resolve: any, reject: any) =>
      Promise.resolve(results[cursor++] ?? []).then(resolve, reject);
    query.catch = (reject: any) =>
      Promise.resolve(results[cursor++] ?? []).catch(reject);
    query.finally = (onFinally: any) =>
      Promise.resolve(results[cursor++] ?? []).finally(onFinally);
    return query;
  };

  return {
    select: () => makeQuery(),
    insert: () => makeQuery(),
  };
}

// We'll rewire this per test
let mockDbResults: any[][];
vi.mock("../db", () => ({
  getDb: vi.fn(() => createMockDb(mockDbResults)),
}));

// ── Import after mocks are set up ────────────────────────────────────────
import { appRouter } from "../routers";
import { __setStripeForTest } from "./billing";

// ── Helpers ──────────────────────────────────────────────────────────────
function makeCtx(
  userOverrides?: Partial<{ id: number; name: string; email: string }>
) {
  return {
    req: {} as any,
    res: {} as any,
    user: {
      id: 42,
      name: "Test User",
      email: "test@example.com",
      ...userOverrides,
    } as any,
  };
}

async function callCreateCheckoutSession(
  input: {
    planSlug: string;
    billingCycle: "monthly" | "yearly";
    successUrl?: string;
    cancelUrl?: string;
  },
  ctx = makeCtx()
) {
  return callTRPCProcedure({
    router: appRouter,
    path: "billing.createCheckoutSession",
    type: "mutation",
    ctx,
    input,
    getRawInput: async () => input,
  });
}

// ── Test setup ───────────────────────────────────────────────────────────
describe("billing.createCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __setStripeForTest(stripeMocks);
    mockDbResults = [];
  });

  // ── AC-1: Checkout para usuário sem subscription ativa ──────────────
  it("AC-1: creates checkout session for user without subscription", async () => {
    const plan = {
      id: 10,
      name: "Starter",
      slug: "starter",
      priceMonthly: "29.90",
      priceYearly: "299.00",
      stripePriceIdMonthly: "price_monthly_starter",
      stripePriceIdYearly: "price_yearly_starter",
      isActive: true,
      isEnterprise: false,
      sortOrder: 1,
    };
    // DB queries: plan lookup, active sub check (none), customer lookup (none)
    mockDbResults = [[plan], [], []];

    stripeMocks.customers.create.mockResolvedValue({
      id: "cus_mock_123",
      email: "test@example.com",
    });
    stripeMocks.checkout.sessions.create.mockResolvedValue({
      id: "cs_mock_456",
      url: "https://checkout.stripe.com/mock",
    });

    const result = await callCreateCheckoutSession({
      planSlug: "starter",
      billingCycle: "monthly",
    });

    expect(result).toHaveProperty("sessionId", "cs_mock_456");
    expect(result).toHaveProperty("url");
    expect(result.url).toContain("checkout.stripe.com");

    expect(stripeMocks.customers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "test@example.com",
        name: "Test User",
        metadata: { userId: "42" },
      })
    );

    expect(stripeMocks.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_mock_123",
        mode: "subscription",
      })
    );
  });

  // ── AC-2: Bloqueio de checkout duplicado ────────────────────────────
  it("AC-2: blocks duplicate checkout for active subscription", async () => {
    const plan = {
      id: 10,
      name: "Starter",
      slug: "starter",
      priceMonthly: "29.90",
      priceYearly: "299.00",
      stripePriceIdMonthly: "price_monthly_starter",
      stripePriceIdYearly: "price_yearly_starter",
      isActive: true,
      isEnterprise: false,
      sortOrder: 1,
    };
    const activeSub = {
      id: 1,
      userId: 42,
      planId: 10,
      status: "active",
      billingCycle: "monthly",
      stripeCustomerId: "cus_existing",
      stripeSubscriptionId: "sub_existing",
    };
    mockDbResults = [[plan], [activeSub]];

    await expect(
      callCreateCheckoutSession({
        planSlug: "starter",
        billingCycle: "monthly",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("ativa"),
    });

    expect(stripeMocks.checkout.sessions.create).not.toHaveBeenCalled();
    expect(stripeMocks.customers.create).not.toHaveBeenCalled();
  });

  // ── AC-3: Billing cycle yearly usa price ID correto ─────────────────
  it("AC-3: yearly billing uses stripePriceIdYearly", async () => {
    const plan = {
      id: 10,
      name: "Starter",
      slug: "starter",
      priceMonthly: "29.90",
      priceYearly: "299.00",
      stripePriceIdMonthly: "price_monthly_starter",
      stripePriceIdYearly: "price_yearly_starter",
      isActive: true,
      isEnterprise: false,
      sortOrder: 1,
    };
    mockDbResults = [[plan], [], []];

    stripeMocks.customers.create.mockResolvedValue({ id: "cus_mock_123" });
    stripeMocks.checkout.sessions.create.mockResolvedValue({
      id: "cs_yearly_456",
      url: "https://checkout.stripe.com/mock",
    });

    await callCreateCheckoutSession({
      planSlug: "starter",
      billingCycle: "yearly",
    });

    expect(stripeMocks.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_yearly_starter", quantity: 1 }],
      })
    );
  });

  // ── AC-4: Metadata userId + planId na session ───────────────────────
  it("AC-4: session metadata contains userId and planId", async () => {
    const plan = {
      id: 10,
      name: "Starter",
      slug: "starter",
      priceMonthly: "29.90",
      priceYearly: "299.00",
      stripePriceIdMonthly: "price_monthly_starter",
      stripePriceIdYearly: "price_yearly_starter",
      isActive: true,
      isEnterprise: false,
      sortOrder: 1,
    };
    mockDbResults = [[plan], [], []];

    stripeMocks.customers.create.mockResolvedValue({ id: "cus_mock_123" });
    stripeMocks.checkout.sessions.create.mockResolvedValue({
      id: "cs_meta_456",
      url: "https://checkout.stripe.com/mock",
    });

    await callCreateCheckoutSession({
      planSlug: "starter",
      billingCycle: "monthly",
    });

    // Checks metadata on session itself
    expect(stripeMocks.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { userId: "42", planId: "10", billingCycle: "monthly" },
      })
    );

    // Checks metadata inside subscription_data
    expect(stripeMocks.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_data: {
          metadata: { userId: "42", planId: "10" },
        },
      })
    );
  });
});
