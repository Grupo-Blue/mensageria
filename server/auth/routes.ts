import { Router } from 'express';
import passport from './google';
import jwt from 'jsonwebtoken';
import { ENV } from '../_core/env';
import { COOKIE_NAME } from '../../shared/const';
import { getSessionCookieOptions } from '../_core/cookies';

const router = Router();

// Rota para iniciar autenticação Google
router.get('/google', passport.authenticate('google', { 
  scope: ['profile', 'email'],
  session: false 
}));

// Callback do Google OAuth
router.get(
  '/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: '/?error=auth_failed' 
  }),
  (req, res) => {
    try {
      const user = req.user as any;
      
      if (!user) {
        return res.redirect('/?error=no_user');
      }

      // Criar token JWT
      const token = jwt.sign(
        {
          openId: user.openId,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        ENV.jwtSecret,
        { expiresIn: '7d' }
      );

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
