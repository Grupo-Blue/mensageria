import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import 'express-async-errors';
import swaggerUi from 'swagger-ui-express';
import swaggerFile from './swagger.json';

import routes from './routes';
import AppError from './errors/AppError';
import { telegramEvents } from './services/Telegram';
import { validateEnv, getEnv, getAllowedOrigins } from './config/env';
import { sanitizeForLog } from './utils/security';

// Valida variáveis de ambiente no startup
validateEnv();

const app = express();
const env = getEnv();

// Limite de tamanho do body para prevenir ataques
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// CORS configurado com origens permitidas
const allowedOrigins = getAllowedOrigins();
app.use(cors({
  origin: env.NODE_ENV === 'production' && allowedOrigins.length > 0
    ? allowedOrigins
    : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-api'],
}));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use(routes);

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));

// Error handler melhorado
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  // Gera ID de correlação para rastreamento
  const correlationId = req.headers['x-correlation-id'] || `err-${Date.now()}`;

  // Log estruturado do erro
  console.error(JSON.stringify({
    correlationId,
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    error: {
      name: err.name,
      message: sanitizeForLog(err.message),
      stack: env.NODE_ENV !== 'production' ? err.stack : undefined,
    },
  }));

  // Resposta para erros conhecidos (AppError)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.error,
      correlationId,
    });
  }

  // Resposta para erros de validação (Zod, etc)
  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      error: 'Erro de validação',
      details: env.NODE_ENV !== 'production' ? err.message : undefined,
      correlationId,
    });
  }

  // Resposta para erros genéricos
  if (err instanceof Error) {
    // Em produção, não expõe detalhes do erro
    const statusCode = 500;
    return res.status(statusCode).json({
      success: false,
      error: env.NODE_ENV === 'production'
        ? 'Erro interno do servidor'
        : err.message,
      correlationId,
    });
  }

  // Fallback para erros desconhecidos
  return res.status(500).json({
    success: false,
    error: 'Erro interno do servidor',
    correlationId,
  });
});

// Inicializa eventos do Telegram
telegramEvents();

export default app;
