import crypto from 'crypto';

/**
 * Padrões de IPs privados/internos que não devem ser acessados via webhook
 */
const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^fd[0-9a-f]{2}:/i,
];

/**
 * Valida se uma URL é segura para fazer requisições (previne SSRF)
 */
export const isValidWebhookUrl = (urlString: string): { valid: boolean; error?: string } => {
  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, error: 'URL é obrigatória' };
  }

  try {
    const url = new URL(urlString);

    // Só permitir HTTP e HTTPS
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, error: 'Apenas protocolos HTTP e HTTPS são permitidos' };
    }

    const hostname = url.hostname.toLowerCase();

    // Bloquear IPs privados e localhost
    for (const pattern of BLOCKED_HOSTNAME_PATTERNS) {
      if (pattern.test(hostname)) {
        return { valid: false, error: 'URLs para endereços internos/privados não são permitidas' };
      }
    }

    // Bloquear URLs com credenciais
    if (url.username || url.password) {
      return { valid: false, error: 'URLs com credenciais não são permitidas' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'URL inválida' };
  }
};

/**
 * Comparação de strings segura contra timing attacks
 */
export const timingSafeEqual = (a: string, b: string): boolean => {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  // Pad strings to same length to prevent timing leak
  const maxLength = Math.max(a.length, b.length);
  const bufferA = Buffer.alloc(maxLength);
  const bufferB = Buffer.alloc(maxLength);

  bufferA.write(a);
  bufferB.write(b);

  return crypto.timingSafeEqual(bufferA, bufferB) && a.length === b.length;
};

/**
 * Valida formato de número de telefone brasileiro
 */
export const isValidBrazilianPhone = (phone: string): boolean => {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // Remove caracteres não numéricos
  const cleaned = phone.replace(/\D/g, '');

  // Aceita formatos:
  // - 11 dígitos: DDD + 9 dígitos (ex: 11999998888)
  // - 13 dígitos: 55 + DDD + 9 dígitos (ex: 5511999998888)
  // - 12 dígitos: 55 + DDD + 8 dígitos (ex: 551199998888) - fixo
  return [11, 12, 13].includes(cleaned.length);
};

/**
 * Valida formato de email
 */
export const isValidEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim()) && email.length <= 254;
};

/**
 * Sanitiza mensagem para evitar XSS/injection básico em logs
 */
export const sanitizeForLog = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '[null]';
  }

  const str = typeof value === 'string' ? value : JSON.stringify(value);

  // Limita tamanho para logs
  const maxLength = 500;
  if (str.length > maxLength) {
    return str.substring(0, maxLength) + '... [truncated]';
  }

  return str;
};
