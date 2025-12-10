import { Router } from 'express';
import whatsapp from './modules/whatsapp';
import telegram from './modules/telegram';
import trpc from './modules/trpc';
import { apiRateLimit, messageRateLimit } from '../middlewares/rateLimit';

const routes = Router();

// Aplica rate limiting por rota
routes.use('/whatsapp', messageRateLimit, whatsapp);
routes.use('/telegram', messageRateLimit, telegram);
routes.use('/api/trpc', apiRateLimit, trpc);

export default routes;
