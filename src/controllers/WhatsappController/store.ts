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

  // Extrair token (identificação da conexão) da query string
  const token = req.query.token as string | undefined;

  const data = await sendMessage({
    toPhone: phone,
    message,
    identification: token,
  });

  return res.status(200).json(data);
};

export default store;
