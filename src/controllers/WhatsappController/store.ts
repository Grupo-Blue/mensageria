import { Request, Response } from 'express';
import { sendMessage } from '../../services/Baileys';
import { sendWhatsappSchema, validateSchema } from '../../schemas';
import AppError from '../../errors/AppError';

const store = async (req: Request, res: Response): Promise<Response> => {
  // Validação com Zod
  const validation = validateSchema(sendWhatsappSchema, req.body);

  if (!validation.success) {
    throw new AppError(validation.error, 400);
  }

  const { phone, message } = validation.data;

  const data = await sendMessage({
    toPhone: phone,
    message,
  });

  return res.status(200).json(data);
};

export default store;
