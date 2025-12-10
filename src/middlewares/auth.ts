import { Request, Response, NextFunction } from 'express';
import AppError from '../errors/AppError';
import { timingSafeEqual } from '../utils/security';
import { getEnv } from '../config/env';

interface TokenPayload {
  iat: number;
  exp: number;
  sub: string;
}

const auth = async (
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> => {
  const env = getEnv();
  const expectedKey = env.X_AUTH_API;
  const authHeader = request.headers['x-auth-api'];

  // Se X_AUTH_API não está configurado, bloqueia em produção
  if (!expectedKey) {
    if (env.NODE_ENV === 'production') {
      console.error('X_AUTH_API não configurado em produção');
      throw new AppError('Serviço indisponível.', 503);
    }
    // Em desenvolvimento, permite sem autenticação (com aviso)
    console.warn('⚠️  X_AUTH_API não configurado - autenticação desabilitada em desenvolvimento');
    return next();
  }

  // Valida o header de autenticação
  if (!authHeader || typeof authHeader !== 'string') {
    throw new AppError('Acesso negado.', 401);
  }

  // Usa comparação segura contra timing attacks
  if (!timingSafeEqual(authHeader, expectedKey)) {
    throw new AppError('Acesso negado.', 401);
  }

  return next();
};

export default auth;
