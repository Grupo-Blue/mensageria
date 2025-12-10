import { Router } from 'express';
import {
  store,
} from '../../controllers/TelegramController';
import auth from '../../middlewares/auth';


const router = Router();

router.post('/', auth, (req, res, next) => {
  /*
  #swagger.path = '/telegram'
  #swagger.tags = ['Telegram']
  #swagger.description = 'Endpoint para envio de mensagem via Telegram.'

  #swagger.security = [{
          "apiKeyAuth": []
  }]

  #swagger.parameters['data'] = {
    in: 'body',
    description: 'Número de telefone do destinatário, com DDD e mensagem que deseja enviar',
    required: true,
    type: 'string',
    schema: { $ref: "#/definitions/SendTelegramMessage" }
  }

  #swagger.responses[200] = {
    schema: { $ref: "#/definitions/SendedTelegramMessage" },
    description: 'Mensagem enviada com sucesso'
  }

  #swagger.responses[400] = {
    schema: { $ref: "#/definitions/IsNotTelegramNumber" },
    description: 'Este número não está cadastrado no Telegram'
  }
  */

  next()
}, store);

export default router;
