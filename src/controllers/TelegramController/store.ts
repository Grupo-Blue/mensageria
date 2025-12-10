import { Request, Response } from 'express';
import { sendMessage } from '../../services/Telegram';
import { sendTelegramSchema, validateSchema } from '../../schemas';
import AppError from '../../errors/AppError';

const store = async (req: Request, res: Response): Promise<Response> => {
  // Validação com Zod
  const validation = validateSchema(sendTelegramSchema, req.body);

  if (!validation.success) {
    throw new AppError(validation.error, 400);
  }

  const { telegramUserId, message } = validation.data;

  await sendMessage({
    telegramUserId: String(telegramUserId),
    message,
  });

  return res.status(200).json({
    success: true,
    message: 'Mensagem enviada com sucesso!',
  });
};

export default store;
