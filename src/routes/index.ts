import { Router } from 'express';
import whatsapp from './modules/whatsapp';
import telegram from './modules/telegram';
const routes = Router();

routes.use('/whatsapp', whatsapp);
routes.use('/telegram', telegram);

export default routes;
