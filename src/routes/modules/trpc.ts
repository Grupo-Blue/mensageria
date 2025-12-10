import { Request, Response, Router } from 'express';
import groupStore from '../../services/Baileys/groupStore';
import settingsStore from '../../services/settingsStore';
import { isValidWebhookUrl } from '../../utils/security';
import { settingsSchema, validateSchema } from '../../schemas';

interface BatchInputItem {
  json?: unknown;
}

type BatchInput = Record<string, BatchInputItem>;

type TrpcResult =
  | { result: { data: unknown } }
  | { error: { code: number; message: string } };

const router = Router();

const mapGroupRecord = () =>
  groupStore.listAll().map((group, index) => ({
    id: index + 1,
    connection_id: group.sessionId ?? null,
    group_id: group.groupId,
    group_name: group.groupName,
    last_message_at: group.lastMessageAt,
    created_at: group.lastMessageAt,
    updated_at: group.lastMessageAt,
  }));

const testWebhook = async (webhookUrl: string): Promise<{ success: boolean; status?: number; message: string }> => {
  // Validação de segurança contra SSRF
  const urlValidation = isValidWebhookUrl(webhookUrl);
  if (!urlValidation.valid) {
    return {
      success: false,
      message: `URL inválida: ${urlValidation.error}`,
    };
  }

  try {
    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'Teste de webhook do sistema de mensageria',
      },
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      return {
        success: true,
        status: response.status,
        message: `Webhook respondeu com sucesso (status ${response.status})`,
      };
    }

    return {
      success: false,
      status: response.status,
      message: `Webhook respondeu com erro (status ${response.status})`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return {
      success: false,
      message: `Falha ao conectar com o webhook: ${errorMessage}`,
    };
  }
};

const executeProcedure = async (
  name: string,
  payload: BatchInputItem | undefined,
): Promise<TrpcResult> => {
  try {
    switch (name) {
      case 'whatsappGroups.list':
        return {
          result: {
            data: mapGroupRecord(),
          },
        };
      case 'settings.get': {
        const userId = Number(payload?.json ?? 1) || 1;
        const settings = await settingsStore.getSettings(userId);
        return {
          result: {
            data: settings,
          },
        };
      }
      case 'settings.save': {
        if (!payload || typeof payload.json !== 'object' || payload.json === null) {
          return {
            error: {
              code: -32602,
              message: 'Parâmetros inválidos para settings.save',
            },
          };
        }

        // Validação com Zod
        const validation = validateSchema(settingsSchema, payload.json);
        if (!validation.success) {
          return {
            error: {
              code: -32602,
              message: validation.error,
            },
          };
        }

        // Validação de URL de webhook contra SSRF
        if (validation.data.webhook_url) {
          const urlValidation = isValidWebhookUrl(validation.data.webhook_url);
          if (!urlValidation.valid) {
            return {
              error: {
                code: -32602,
                message: `URL do webhook inválida: ${urlValidation.error}`,
              },
            };
          }
        }

        const userId = validation.data.userId ?? 1;
        const data = await settingsStore.updateSettings(userId, validation.data);
        return {
          result: {
            data,
          },
        };
      }
      case 'webhooks.test': {
        const input = payload?.json as Record<string, unknown> | undefined;
        const userId = Number(input?.userId ?? 1) || 1;
        const settings = await settingsStore.getSettings(userId);

        if (!settings.webhook_url) {
          return {
            error: {
              code: -32602,
              message: 'URL do webhook não configurada',
            },
          };
        }

        const result = await testWebhook(settings.webhook_url);
        return {
          result: {
            data: result,
          },
        };
      }
      default:
        return {
          error: {
            code: -32601,
            message: `Procedimento desconhecido: ${name}`,
          },
        };
    }
  } catch (error) {
    console.error(`Falha ao executar procedimento ${name}:`, error);
    return {
      error: {
        code: -32603,
        message: 'Erro interno no servidor',
      },
    };
  }
};

const parseBatchInput = (raw: unknown): BatchInput => {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as BatchInput;
    } catch (error) {
      console.error('Não foi possível interpretar batch input da query string:', error);
      return {};
    }
  }

  if (raw && typeof raw === 'object') {
    return raw as BatchInput;
  }

  return {};
};

const handleBatchRequest = async (req: Request, res: Response): Promise<void> => {
  const proceduresParam = req.params.procedures ?? '';
  const procedures = proceduresParam.split(',').filter(Boolean);

  if (!procedures.length) {
    res.json([]);
    return;
  }

  const inputSource = req.method === 'GET' ? req.query.input : req.body?.input ?? req.body;
  const batchInput = parseBatchInput(inputSource);
  const orderedEntries = Object.keys(batchInput).sort((a, b) => Number(a) - Number(b));

  if (orderedEntries.length && orderedEntries.length !== procedures.length) {
    console.warn(
      'Quantidade de procedimentos não corresponde aos parâmetros recebidos:',
      { procedures, batchInput },
    );
  }

  const results = await Promise.all(
    procedures.map((procedure, index) => {
      const key = orderedEntries[index] ?? String(index);
      const payload = batchInput[key];
      return executeProcedure(procedure, payload);
    }),
  );

  res.json(results);
};

router.get('/:procedures', handleBatchRequest);
router.post('/:procedures', handleBatchRequest);

export default router;
