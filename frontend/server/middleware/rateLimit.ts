import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

// Store for rate limiting (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

/**
 * Simple in-memory rate limiter for tRPC
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const key = identifier;
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    // Create new entry
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetIn: windowMs,
    };
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.resetTime - now,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetIn: entry.resetTime - now,
  };
}

/**
 * Global rate limiter - 1000 requests per 15 minutes per IP
 */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: {
    error: "Muitas requisições. Por favor, aguarde alguns minutos e tente novamente.",
    retryAfter: 15 * 60, // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use X-Forwarded-For header if behind proxy, otherwise use IP
    return (
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.ip ||
      req.socket.remoteAddress ||
      "unknown"
    );
  },
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === "/health" || req.path === "/api/health";
  },
});

/**
 * API rate limiter - 60 requests per minute per API key
 */
export const apiKeyRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: {
    error: "Limite de requisições da API atingido. Aguarde um momento.",
    retryAfter: 60, // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const apiKey = req.headers["x-api-key"] as string;
    return apiKey || "no-key";
  },
  skip: (req: Request) => {
    // Only apply to requests with API key
    return !req.headers["x-api-key"];
  },
});

/**
 * Message sending rate limiter - 30 messages per minute per user
 */
export const messageRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: {
    error: "Limite de envio de mensagens atingido. Aguarde um momento.",
    retryAfter: 60, // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use user ID from session if available
    const userId = (req as any).user?.id;
    return userId ? `user-${userId}` : req.ip || "unknown";
  },
});

/**
 * Login rate limiter - 5 attempts per 15 minutes per IP
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    error: "Muitas tentativas de login. Por favor, aguarde 15 minutos.",
    retryAfter: 15 * 60, // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return (
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.ip ||
      "unknown"
    );
  },
});

/**
 * Webhook rate limiter - 100 requests per minute per endpoint
 */
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    error: "Limite de webhooks atingido.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limit middleware for tRPC procedures
 * Use this in procedures that need rate limiting
 */
export function createTRPCRateLimiter(
  maxRequests: number = 60,
  windowMs: number = 60000
) {
  return async (opts: { ctx: any; next: () => Promise<any> }) => {
    const { ctx, next } = opts;

    // Get identifier (user ID or IP)
    const identifier = ctx.user?.id
      ? `user-${ctx.user.id}`
      : ctx.req?.ip || "unknown";

    const result = checkRateLimit(identifier, maxRequests, windowMs);

    if (!result.allowed) {
      throw new Error(
        `Rate limit exceeded. Try again in ${Math.ceil(result.resetIn / 1000)} seconds.`
      );
    }

    // Add rate limit info to response headers if available
    if (ctx.res) {
      ctx.res.setHeader("X-RateLimit-Limit", maxRequests);
      ctx.res.setHeader("X-RateLimit-Remaining", result.remaining);
      ctx.res.setHeader(
        "X-RateLimit-Reset",
        Math.ceil((Date.now() + result.resetIn) / 1000)
      );
    }

    return next();
  };
}

/**
 * Express middleware to apply rate limiting headers
 */
export function rateLimitHeaders(
  req: Request,
  res: Response,
  next: () => void
) {
  // Set default headers
  res.setHeader("X-RateLimit-Policy", "1000;w=900"); // 1000 requests per 15 minutes
  next();
}
