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

const parseJson = <T>(raw: unknown, fallback: T): T => {
  if (raw === undefined || raw === null || raw === '') {
    return fallback;
  }

  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      console.error('Não foi possível fazer o parse do JSON recebido:', error);
      return fallback;
    }
  }

  if (typeof raw === 'object') {
    return raw as T;
  }

  return fallback;
};

const extractProcedures = (req: Request): string[] => {
  const cleanedPath = req.path.replace(/^\/+/, '');
  if (!cleanedPath) {
    return [];
  }

  return cleanedPath.split(',').filter(Boolean);
};

const buildBatchPayload = (value: unknown, fallbackKeys: string[]): BatchInput => {
  if (value === undefined || value === null || value === '') {
    return fallbackKeys.reduce<BatchInput>((accumulator, _key, index) => {
      accumulator[String(index)] = {};
      return accumulator;
    }, {});
  }

  const parsed = parseJson<unknown>(value, {});

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    if ('json' in parsed && Object.keys(parsed).length === 1) {
      return { '0': parsed as BatchInputItem };
    }

    const entries = Object.entries(parsed);
    if (entries.every(([key]) => /^\d+$/.test(key))) {
      if (entries.length === 0) {
        return fallbackKeys.reduce<BatchInput>((accumulator, _key, index) => {
          accumulator[String(index)] = {};
          return accumulator;
        }, {});
      }
      return parsed as BatchInput;
    }

    return { '0': { json: parsed } };
  }

  return { '0': { json: parsed } };
};

const handleTrpcRequest = async (req: Request, res: Response): Promise<void> => {
  const procedures = extractProcedures(req);

  if (!procedures.length) {
    res.status(404).json({
      error: 'Procedimento não informado',
    });
    return;
  }

  const inputSource = req.method === 'GET' ? req.query.input : req.body?.input ?? req.body;
  const batchInput = buildBatchPayload(inputSource, procedures);
  const orderedKeys = Object.keys(batchInput).sort((a, b) => Number(a) - Number(b));

  if (orderedKeys.length && orderedKeys.length !== procedures.length) {
    console.warn(
      'Quantidade de procedimentos não corresponde aos parâmetros recebidos:',
      { procedures, batchInput },
    );
  }

  const results = await Promise.all(
    procedures.map((procedure, index) => {
      const key = orderedKeys[index] ?? String(index);
      const payload = batchInput[key];
      return executeProcedure(procedure, payload);
    }),
  );

  const isBatchRequest = req.query.batch !== undefined || procedures.length > 1;
  res.json(isBatchRequest ? results : results[0]);
};

router.all('*', (req, res) => {
  void handleTrpcRequest(req, res);
});

export default router;
