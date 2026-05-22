/**
 * Rate limiting in-memory para o backend Baileys.
 *
 * Sem dependência externa: usa um Map por nome de bucket, janela fixa
 * (resetando a contagem quando expira). Emite os headers padrão
 * `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` e
 * `Retry-After` em 429.
 *
 * Em memória — não compartilha estado entre instâncias. Para escalar
 * horizontalmente substituir o backing por Redis (bullmq já está no
 * package.json e pode ser reaproveitado).
 */
import { Request, Response, NextFunction } from 'express';

interface Hit {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Map<string, Hit>>();

// Limpeza periódica de chaves expiradas para evitar crescimento ilimitado.
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const bucket of buckets.values()) {
    for (const [key, hit] of bucket) {
      if (hit.resetAt <= now) bucket.delete(key);
    }
  }
}, 60_000);
cleanup.unref?.();

export interface RateLimitOptions {
  /** Identificador do bucket (rotas com a mesma chave compartilham contagem). */
  name: string;
  /** Tamanho da janela em milissegundos. */
  windowMs: number;
  /** Máximo de requisições por chave dentro da janela. */
  max: number;
  /** Função que extrai a chave de identificação do cliente. */
  keyFn?: (req: Request) => string;
}

/** Chave preferindo a API key (per-connection), depois tenant, depois IP. */
export function apiKeyOrIpKey(req: Request): string {
  const apiKey = (req.headers['x-api-key'] as string | undefined)
    || (req.headers['x-auth-api'] as string | undefined);
  if (apiKey) return `key:${apiKey}`;
  const tenant = (req as Request & { tenant?: { identification?: string } }).tenant?.identification;
  if (tenant) return `tenant:${tenant}`;
  return `ip:${req.ip || 'unknown'}`;
}

export function rateLimit(options: RateLimitOptions) {
  const { name, windowMs, max } = options;
  const keyFn = options.keyFn ?? ((req) => `ip:${req.ip || 'unknown'}`);
  if (!buckets.has(name)) buckets.set(name, new Map());
  const bucket = buckets.get(name)!;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn(req);
    const now = Date.now();
    let hit = bucket.get(key);
    if (!hit || hit.resetAt <= now) {
      hit = { count: 0, resetAt: now + windowMs };
      bucket.set(key, hit);
    }
    hit.count += 1;

    const remaining = Math.max(0, max - hit.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(hit.resetAt / 1000)));

    if (hit.count > max) {
      const retryAfter = Math.max(1, Math.ceil((hit.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'Limite de requisições excedido. Tente novamente em alguns instantes.',
        retryAfterSeconds: retryAfter,
      });
    }

    return next();
  };
}
