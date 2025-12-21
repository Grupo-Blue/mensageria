/**
 * Multi-Tenant Authentication Middleware
 * Supports both legacy X_AUTH_API and new per-connection API keys
 */

import { Request, Response, NextFunction } from 'express';
import AppError from '../errors/AppError';
import tokenCache from '../services/tokenCache';

export interface AuthenticatedRequest extends Request {
  tenant?: {
    connectionId: number;
    identification: string;
    userId: number;
    webhookUrl: string | null;
    webhookSecret: string | null;
  };
}

/**
 * Multi-tenant authentication middleware
 * Supports:
 * 1. Legacy mode: X_AUTH_API header (global token)
 * 2. Multi-tenant mode: Connection-specific API key
 *
 * Priority:
 * 1. Check for connection API key in x-api-key header
 * 2. Fall back to legacy X_AUTH_API mode
 */
export const multiTenantAuth = async (
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
): Promise<void> => {
  // Try connection-specific API key first
  const apiKey = request.headers['x-api-key'] as string | undefined;
  const legacyToken = request.headers['x-auth-api'] as string | undefined;

  // Get connection identification from path or query
  const connectionId = request.params.connectionId ||
                       request.query.connection as string ||
                       request.query.token as string;

  // Mode 1: Connection-specific API key (preferred for multi-tenant)
  if (apiKey) {
    const connection = tokenCache.validateApiKey(apiKey);

    if (!connection) {
      throw new AppError('API Key inválida', 401);
    }

    // If connectionId is provided, verify it matches the API key
    if (connectionId && connection.identification !== connectionId) {
      throw new AppError('API Key não corresponde à conexão solicitada', 403);
    }

    request.tenant = {
      connectionId: connection.id,
      identification: connection.identification,
      userId: connection.userId,
      webhookUrl: connection.webhookUrl,
      webhookSecret: connection.webhookSecret,
    };

    return next();
  }

  // Mode 2: Legacy X_AUTH_API (global token)
  if (legacyToken) {
    const envToken = process.env.X_AUTH_API;

    if (!envToken || legacyToken !== envToken) {
      throw new AppError('Acesso negado.', 401);
    }

    // In legacy mode, we need the connectionId from path/query
    if (connectionId) {
      const connection = tokenCache.getConnectionByIdentification(connectionId);

      if (connection) {
        request.tenant = {
          connectionId: connection.id,
          identification: connection.identification,
          userId: connection.userId,
          webhookUrl: connection.webhookUrl,
          webhookSecret: connection.webhookSecret,
        };
      }
    }

    return next();
  }

  throw new AppError('Autenticação requerida. Forneça x-api-key ou x-auth-api.', 401);
};

/**
 * Middleware that requires a specific connection to be identified
 * Use after multiTenantAuth when the endpoint operates on a specific connection
 */
export const requireConnection = async (
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
): Promise<void> => {
  if (!request.tenant?.identification) {
    throw new AppError('Conexão não especificada. Forneça connectionId no path ou query.', 400);
  }

  return next();
};

/**
 * Legacy auth middleware for backward compatibility
 * Simply validates X_AUTH_API header
 */
export const legacyAuth = async (
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = request.headers['x-auth-api'];

  if (!process.env.X_AUTH_API || !authHeader || authHeader !== process.env.X_AUTH_API) {
    throw new AppError('Acesso negado.', 401);
  }

  return next();
};

export default multiTenantAuth;







