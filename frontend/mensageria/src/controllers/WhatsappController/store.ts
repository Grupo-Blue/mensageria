import { Request, Response } from 'express';
import { sendMessage } from '../../services/Baileys';

const store = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      throw new Error('Necessário enviar os campos phone e message');
    }
    const data = await sendMessage({
      toPhone: phone,
      message
    })

    return res.json(data);
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
