import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { ENV } from '../_core/env';
import { getUserByOpenId, upsertUser } from '../db';

// Validar variáveis de ambiente
if (!ENV.googleClientId || !ENV.googleClientSecret) {
  console.error('[Google OAuth] ERROR: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required!');
  console.error('[Google OAuth] Current values:', {
    clientId: ENV.googleClientId ? 'SET' : 'MISSING',
    clientSecret: ENV.googleClientSecret ? 'SET' : 'MISSING',
    backendApiUrl: ENV.backendApiUrl,
  });
  throw new Error('Google OAuth credentials not configured');
}

// Função para obter a URL base do callback
// Em desenvolvimento, usar a URL do frontend (porta 3000 por padrão)
// Em produção, usar a URL de produção
function getCallbackBaseUrl(): string {
  if (ENV.isProduction) {
    return 'https://mensageria.grupoblue.com.br';
  }
  
  // Em desenvolvimento, usar FRONTEND_URL ou padrão localhost:3000
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return frontendUrl;
}

const baseUrl = getCallbackBaseUrl();
const callbackURL = `${baseUrl}/api/auth/google/callback`;

console.log('[Google OAuth] Initializing with:', {
  clientId: ENV.googleClientId.substring(0, 20) + '...',
  callbackURL,
  isProduction: ENV.isProduction,
  baseUrl,
});

// Configurar estratégia do Google OAuth
passport.use(
  new GoogleStrategy(
    {
      clientID: ENV.googleClientId,
      clientSecret: ENV.googleClientSecret,
      callbackURL,
      scope: ['profile', 'email'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Criar/atualizar usuário no banco
        const openId = `google-${profile.id}`;
        const email = profile.emails?.[0]?.value || '';
        const name = profile.displayName || '';

        await upsertUser({
          openId,
          email,
          name,
          loginMethod: 'google',
          lastSignedIn: new Date(),
        });

        const user = await getUserByOpenId(openId);
        
        if (!user) {
          return done(new Error('Failed to create user'), undefined);
        }

        return done(null, user);
      } catch (error) {
        console.error('[Google OAuth] Error:', error);
        return done(error as Error, undefined);
      }
    }
  )
);

// Serializar usuário para sessão
passport.serializeUser((user: any, done) => {
  done(null, user.openId);
});

// Deserializar usuário da sessão
passport.deserializeUser(async (openId: string, done) => {
  try {
    const user = await getUserByOpenId(openId);
    done(null, user || null);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
