import { Router } from 'express';
import whatsapp from './modules/whatsapp';
import telegram from './modules/telegram';
import trpc from './modules/trpc';

const routes = Router();

routes.use('/whatsapp', whatsapp);
routes.use('/telegram', telegram);
routes.use('/api/trpc', trpc);

export default routes;
