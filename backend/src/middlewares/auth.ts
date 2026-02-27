import { Request, Response, NextFunction } from 'express';
import AppError from '../errors/AppError.js';

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
  const authHeader = request.headers['x-auth-api'];
  try {
    if (!process.env.X_AUTH_API || !authHeader || authHeader !== process.env.X_AUTH_API) {
      throw new AppError('Acesso negado.', 401);
    }

    return next();
  } catch {
    throw new AppError('Acesso negado.', 401);
  }
}

export default auth;
