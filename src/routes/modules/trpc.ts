import { Request, Response, Router } from 'express';
import groupStore from '../../services/Baileys/groupStore';
import settingsStore from '../../services/settingsStore';

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
        const input = payload.json as Record<string, unknown>;
        const userId = Number(input.userId ?? 1) || 1;
        const data = await settingsStore.updateSettings(userId, input);
        return {
          result: {
            data,
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
