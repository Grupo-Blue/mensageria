import { z } from 'zod';

/**
 * Schema de validação das variáveis de ambiente
 * Valida no startup para evitar erros em runtime
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'developer', 'production', 'test']).default('development'),
  PORT: z.string().optional(),
  LOCAL_PORT: z.string().default('3333'),

  // Autenticação
  X_AUTH_API: z.string().min(1, 'X_AUTH_API é obrigatório para autenticação').optional(),
  AUTH_TOKEN: z.string().optional(),
  SECRET_KEY: z.string().min(32, 'SECRET_KEY deve ter pelo menos 32 caracteres').optional(),

  // CORS
  ALLOWED_ORIGINS: z.string().optional(),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CALL_BACK_URL_TO_SEND_USER_ID: z.string().url().optional().or(z.literal('')),

  // WhatsApp
  WHATSAPP_GROUPS_CALLBACK_URL: z.string().url().optional().or(z.literal('')),
  WHATSAPP_IDENTIFICATION: z.string().default('mensageria'),

  // Redis (para BullMQ)
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string().optional(),

  // API
  API_URL: z.string().url().optional().or(z.literal('')),
});

type EnvConfig = z.infer<typeof envSchema>;

let config: EnvConfig;

export const validateEnv = (): EnvConfig => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Erro na validação das variáveis de ambiente:');
    result.error.issues.forEach((issue) => {
      console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
    });

    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn('⚠️  Continuando em modo desenvolvimento com valores padrão...');
    }
  }

  config = result.success ? result.data : (envSchema.parse({}) as EnvConfig);
  return config;
};

export const getEnv = (): EnvConfig => {
  if (!config) {
    return validateEnv();
  }
  return config;
};

export const getPort = (): number => {
  const env = getEnv();
  return Number(env.PORT || env.LOCAL_PORT || 3333);
};

export const getAllowedOrigins = (): string[] => {
  const env = getEnv();
  if (!env.ALLOWED_ORIGINS) {
    // Em desenvolvimento, permitir localhost
    if (env.NODE_ENV !== 'production') {
      return ['http://localhost:3000', 'http://localhost:3333', 'http://localhost:5173'];
    }
    return [];
  }
  return env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
};

export default { validateEnv, getEnv, getPort, getAllowedOrigins };
