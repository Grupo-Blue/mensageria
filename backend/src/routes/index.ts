import { Router } from 'express';
import whatsapp from './modules/whatsapp';
import telegram from './modules/telegram';
import trpc from './modules/trpc';
import connections from './modules/connections';

const routes = Router();

// New multi-tenant connection routes (v2 API)
routes.use('/connections', connections);

// Legacy routes (kept for backward compatibility)
routes.use('/whatsapp', whatsapp);
routes.use('/telegram', telegram);
routes.use('/api/trpc', trpc);

export default routes;
