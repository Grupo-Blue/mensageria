import { Request, Response, NextFunction } from 'express';
import AppError from '../errors/AppError';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitOptions {
  windowMs?: number; // Janela de tempo em ms (padrão: 15 minutos)
  maxRequests?: number; // Máximo de requisições por janela (padrão: 100)
  message?: string;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

/**
 * Rate limiter em memória
 * Para produção com múltiplas instâncias, use Redis
 */
class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Limpa entradas expiradas a cada minuto
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store.entries()) {
        if (now > entry.resetTime) {
          this.store.delete(key);
        }
      }
    }, 60000);
  }

  get(key: string): RateLimitEntry | undefined {
    return this.store.get(key);
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry);
  }

  increment(key: string, windowMs: number): RateLimitEntry {
    const now = Date.now();
    const existing = this.store.get(key);

    if (!existing || now > existing.resetTime) {
      const entry = {
        count: 1,
        resetTime: now + windowMs,
      };
      this.store.set(key, entry);
      return entry;
    }

    existing.count++;
    return existing;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

const defaultLimiter = new RateLimiter();

/**
 * Middleware de rate limiting
 */
export const rateLimit = (options: RateLimitOptions = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutos
    maxRequests = 100,
    message = 'Muitas requisições. Tente novamente mais tarde.',
    keyGenerator = (req: Request) => {
      // Usa IP como chave padrão
      const forwarded = req.headers['x-forwarded-for'];
      const ip = typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req.ip || req.socket.remoteAddress || 'unknown';
      return ip;
    },
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const entry = defaultLimiter.increment(key, windowMs);

    // Headers informativos
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));

    if (entry.count > maxRequests) {
      res.setHeader('Retry-After', Math.ceil((entry.resetTime - Date.now()) / 1000));
      throw new AppError(message, 429);
    }

    next();
  };
};

/**
 * Rate limiter mais restritivo para endpoints sensíveis (auth, etc)
 */
export const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  maxRequests: 10, // Apenas 10 tentativas
  message: 'Muitas tentativas. Aguarde 15 minutos.',
});

/**
 * Rate limiter padrão para API
 */
export const apiRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  maxRequests: 60, // 60 requisições por minuto
  message: 'Limite de requisições excedido. Aguarde um momento.',
});

/**
 * Rate limiter para envio de mensagens
 */
export const messageRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  maxRequests: 30, // 30 mensagens por minuto
  message: 'Limite de envio de mensagens excedido. Aguarde um momento.',
});

export default { rateLimit, strictRateLimit, apiRateLimit, messageRateLimit };
