import { Request, Response } from 'express';
import { sendMessage } from '../../services/Baileys/index.js';

const store = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { phone, message } = req.body;
    
    // Validação rigorosa do telefone
    if (!phone) {
      console.error('[WhatsApp Store] Erro: campo phone não fornecido');
      throw new Error('Necessário enviar os campos phone e message');
    }
    
    if (typeof phone !== 'string' || phone.trim() === '') {
      console.error('[WhatsApp Store] Erro: phone inválido:', phone);
      throw new Error('Campo phone deve ser uma string não vazia');
    }
    
    if (!message) {
      console.error('[WhatsApp Store] Erro: campo message não fornecido');
      throw new Error('Necessário enviar os campos phone e message');
    }

    // Extrair token (identificação da conexão) da query string
    const token = req.query.token as string | undefined;

    // Log detalhado para rastreamento
    console.log('[WhatsApp Store] Enviando mensagem:', {
      timestamp: new Date().toISOString(),
      phone: phone.trim(),
      phoneLength: phone.trim().length,
      messageLength: message.length,
      identification: token,
      requestBody: { phone, message },
    });

    const data = await sendMessage({
      toPhone: phone.trim(), // Garantir que não há espaços
      message,
      identification: token,
    })

    console.log('[WhatsApp Store] Mensagem enviada com sucesso:', {
      phone: phone.trim(),
      identification: token,
    });

    return res.json(data);
  } catch (err) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : typeof (err as any)?.message === 'string'
          ? (err as any).message
          : 'Erro ao enviar mensagem';
    console.error('[WhatsApp Store] Erro ao processar:', {
      error: errorMessage,
      stack: err instanceof Error ? err.stack : undefined,
      body: req.body,
      query: req.query,
    });
    return res.status(400).json({ error: errorMessage });
  }
};

export default store;
