import { Router, Request, Response } from 'express';
import whatsapp from './modules/whatsapp';
import telegram from './modules/telegram';
import trpc from './modules/trpc';

const routes = Router();

// Redirecionar callback do Google OAuth para o frontend (porta 3000)
routes.get('/api/auth/google/callback', (req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
  const redirectUrl = `${frontendUrl}/api/auth/google/callback${queryString ? `?${queryString}` : ''}`;
  console.log('[Backend] Redirecionando callback OAuth para frontend:', redirectUrl);
  res.redirect(redirectUrl);
});

// Redirecionar rota de início do Google OAuth também
routes.get('/api/auth/google', (req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const redirectUrl = `${frontendUrl}/api/auth/google`;
  console.log('[Backend] Redirecionando início OAuth para frontend:', redirectUrl);
  res.redirect(redirectUrl);
});

routes.use('/whatsapp', whatsapp);
routes.use('/telegram', telegram);
routes.use('/api/trpc', trpc);

export default routes;
