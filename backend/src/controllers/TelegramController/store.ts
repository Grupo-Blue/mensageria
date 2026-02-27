import { Request, Response } from 'express';
import { sendMessage } from '../../services/Telegram/index.js';

const store = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { telegramUserId, message } = req.body;
    if (!telegramUserId || !message) {
      throw new Error('Necessário enviar os campos telegramUserId e message');
    }
    await sendMessage({
      telegramUserId,
      message
    })

    return res.json({
      message: 'Mensagem enviada com sucesso!'
    });
  } catch (err) {
    if (err instanceof Error) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({
      error: 'Erro no servidor'
    });
  }
};

export default store;
