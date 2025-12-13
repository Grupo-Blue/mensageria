import { Router } from 'express';
import passport from './google';
import { ENV } from '../_core/env';
import { COOKIE_NAME } from '../../shared/const';
import { getSessionCookieOptions } from '../_core/cookies';
import { sdk } from '../_core/sdk';

const router = Router();

// Rota para iniciar autenticação Google
router.get('/google', (req, res, next) => {
  console.log('[Auth] Iniciando autenticação Google OAuth');
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false 
  })(req, res, next);
});

// Callback do Google OAuth
router.get(
  '/google/callback',
  (req, res, next) => {
    console.log('[Auth] Recebendo callback do Google OAuth', {
      query: req.query,
      url: req.url,
      host: req.get('host'),
      protocol: req.protocol
    });
    passport.authenticate('google', { 
      session: false,
      failureRedirect: '/?error=auth_failed' 
    })(req, res, next);
  },
  async (req, res) => {
    try {
      const user = req.user as any;
      
      if (!user) {
        return res.redirect('/?error=no_user');
      }

      // Criar token JWT usando o SDK
      const token = await sdk.signSession({
        openId: user.openId,
        appId: ENV.appId || 'mensageria-app',
        name: user.name || user.email || 'User',
      }, {
        expiresInMs: 7 * 24 * 60 * 60 * 1000, // 7 dias
      });

      // Definir cookie com token
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
      });

      // Redirecionar para o dashboard
      res.redirect('/');
    } catch (error) {
      console.error('[Auth] Callback error:', error);
      res.redirect('/?error=callback_failed');
    }
  }
);

// Rota de logout
router.post('/logout', (req, res) => {
  const cookieOptions = getSessionCookieOptions(req);
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
  res.json({ success: true });
});

// Rota para obter usuário atual
router.get('/me', (req, res) => {
  const user = (req as any).user;
  res.json(user || null);
});

export default router;
