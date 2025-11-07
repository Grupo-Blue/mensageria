import { Router } from 'express';
import path from 'path'
import {
  store,
} from '../../controllers/WhatsappController';
import auth from '../../middlewares/auth';
import groupStore from '../../services/Baileys/groupStore';
import { listConnections } from '../../services/Baileys';


const router = Router();

router.get('/qrcode', (req, res) => {
  /* #swagger.path = '/whatsapp/qrcode'
     #swagger.tags = ['Whatsapp']
     #swagger.description = 'Endpoint que deve ser acessado via browser para escanear o QR Code e conectar o número de Whatsapp.' */
  /* #swagger.parameters['token'] = {
    in: 'query',
    description: 'Token de acesso',
    type: 'string'
  }
  */
  const { token } = req.query
  if (!token || token !== process.env.AUTH_TOKEN) {
    return res.status(401).json({
      error: 'Acesso negado!'
    })
  }
  res.sendFile(path.join(process.cwd(), process.env.NODE_ENV === 'production' ? 'build' : 'src', '/views', '/qrcode.html'));
});
router.post('/', auth, (req, res, next) => {
  /*
  #swagger.path = '/whatsapp'
  #swagger.tags = ['Whatsapp']
  #swagger.description = 'Endpoint para envio de mensagem via whatsapp.'

  #swagger.security = [{
          "apiKeyAuth": []
  }]

  #swagger.parameters['data'] = {
    in: 'body',
    description: 'Número de telefone do destinatário, com DDD e mensagem que deseja enviar',
    required: true,
    type: 'string',
    schema: { $ref: "#/definitions/SendWhatsappMessage" }
  }

  #swagger.responses[200] = {
    schema: { $ref: "#/definitions/SendedWhatsappMessage" },
    description: 'Mensagem enviada com sucesso'
  }

  #swagger.responses[400] = {
    schema: { $ref: "#/definitions/IsNotWhatsappNumber" },
    description: 'Este número não está cadastrado no Whatsapp'
  }
  */

  next()
}, store);

router.get('/groups', auth, (_req, res) => {
  const groups = groupStore.listAll();
  return res.json(groups);
});

router.get('/connections', auth, (_req, res) => {
  return res.json(listConnections());
});

export default router;
