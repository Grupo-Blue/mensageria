import { Router } from 'express';
import whatsapp from './modules/whatsapp';
const routes = Router();

routes.use('/whatsapp', whatsapp);

export default routes;
