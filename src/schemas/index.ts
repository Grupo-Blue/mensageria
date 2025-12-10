import { z } from 'zod';

/**
 * Schema para envio de mensagem WhatsApp
 */
export const sendWhatsappSchema = z.object({
  phone: z
    .string()
    .min(1, 'O campo phone é obrigatório')
    .max(20, 'Número de telefone muito longo')
    .refine(
      (val) => /^\+?[\d\s\-()]+$/.test(val),
      'Formato de telefone inválido'
    ),
  message: z
    .string()
    .min(1, 'O campo message é obrigatório')
    .max(4096, 'Mensagem muito longa (máximo 4096 caracteres)'),
});

export type SendWhatsappInput = z.infer<typeof sendWhatsappSchema>;

/**
 * Schema para envio de mensagem Telegram
 */
export const sendTelegramSchema = z.object({
  telegramUserId: z
    .union([z.string(), z.number()])
    .refine(
      (val) => {
        const num = typeof val === 'string' ? parseInt(val, 10) : val;
        return !isNaN(num) && num > 0;
      },
      'telegramUserId deve ser um número válido'
    ),
  message: z
    .string()
    .min(1, 'O campo message é obrigatório')
    .max(4096, 'Mensagem muito longa (máximo 4096 caracteres)'),
});

export type SendTelegramInput = z.infer<typeof sendTelegramSchema>;

/**
 * Schema para configuração de webhook
 */
export const webhookConfigSchema = z.object({
  webhook_url: z
    .string()
    .url('URL do webhook inválida')
    .optional()
    .or(z.literal('')),
  webhook_secret: z
    .string()
    .max(256, 'Secret muito longo')
    .optional(),
  webhook_enabled: z.boolean().optional(),
});

export type WebhookConfigInput = z.infer<typeof webhookConfigSchema>;

/**
 * Schema para configurações do usuário
 */
export const settingsSchema = z.object({
  userId: z.number().positive().optional(),
  google_api_key: z.string().max(256).optional(),
  webhook_url: z.string().url().optional().or(z.literal('')),
  webhook_secret: z.string().max(256).optional(),
  webhook_enabled: z.boolean().optional(),
  resume_enabled: z.boolean().optional(),
  resume_prompt: z.string().max(4096).optional(),
  resume_hour: z.number().min(0).max(23).optional(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

/**
 * Helper para validar e retornar erro formatado
 */
export const validateSchema = <T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } => {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    return { success: false, error: errors };
  }

  return { success: true, data: result.data };
};
