import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import fs from "fs";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import passport from "../auth/google";
import authRoutes from "../auth/routes";
import whatsappRoutes from "../whatsapp/routes";
import whatsappBusinessWebhookRoutes from "../whatsappBusiness/webhookRoutes";
import internalRoutes from "../internal/routes";
import { campaignScheduler } from "../whatsappBusiness/campaignScheduler";
import session from "express-session";
import cookieParser from "cookie-parser";
import { ENV } from "./env";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Configurar trust proxy para funcionar corretamente atrás de proxy reverso (nginx, traefik, etc.)
  // Isso garante que req.protocol e req.hostname usem os headers X-Forwarded-*
  app.set('trust proxy', true);
  
  // Middleware para forçar protocolo e hostname corretos quando OAUTH_SERVER_URL está configurada
  // Isso garante que o Passport use a URL correta para o redirect_uri
  // O Passport pode construir o redirect_uri dinamicamente usando req.protocol e req.hostname
  if (ENV.oAuthServerUrl) {
    const oauthUrl = new URL(ENV.oAuthServerUrl);
    app.use((req: any, res, next) => {
      // Apenas sobrescrever se for uma rota de OAuth
      if (req.path.startsWith('/api/auth/google')) {
        // Forçar protocolo e hostname corretos para OAuth usando Object.defineProperty
        // req.protocol e req.hostname são propriedades somente leitura, então precisamos sobrescrevê-las
        const originalGet = req.get;
        
        Object.defineProperty(req, 'protocol', {
          get: () => oauthUrl.protocol.replace(':', ''),
          configurable: true,
          enumerable: true
        });
        
        Object.defineProperty(req, 'hostname', {
          get: () => oauthUrl.hostname,
          configurable: true,
          enumerable: true
        });
        
        req.get = function(header: string) {
          if (header && header.toLowerCase() === 'host') {
            return oauthUrl.host;
          }
          return originalGet ? originalGet.call(this, header) : req.headers[header?.toLowerCase() || header];
        };
      }
      next();
    });
  }
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // Cookie parser
  app.use(cookieParser());
  
  // Session middleware (necessário para Passport)
  app.use(
    session({
      secret: ENV.jwtSecret || 'fallback-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: ENV.isProduction,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
      },
    })
  );
  
  // Passport middleware
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Debug: Adicionar middleware para logar todas as requisições à API (ANTES das rotas)
  app.use('/api/*', (req, res, next) => {
    console.log('[API Request]', req.method, req.originalUrl, 'Path:', req.path);
    next();
  });
  
  // Google OAuth routes
  app.use('/api/auth', authRoutes);
  console.log('[Server] Rotas de autenticação registradas em /api/auth');
  
  // WhatsApp routes
  app.use('/api/whatsapp', whatsappRoutes);

  // Endpoint público para o cliente obter a URL do backend (Socket.IO) em runtime
  app.get('/api/config', (_req, res) => {
    res.json({ backendUrl: ENV.clientBackendUrl });
  });

  // Internal API routes (backend-to-frontend communication)
  app.use('/api/internal', internalRoutes);
  console.log('[Server] Internal API routes registradas em /api/internal');

  // WhatsApp Business API webhook routes (for receiving message status updates from Meta)
  app.use('/api/whatsapp-business', whatsappBusinessWebhookRoutes);
  console.log('[Server] WhatsApp Business webhook registrado em /api/whatsapp-business/webhook');

  // OAuth callback under /api/oauth/callback (Manus - manter para compatibilidade)
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  // IMPORTANTE: Mesmo com NODE_ENV=development, se os arquivos buildados existem (Docker),
  // devemos usar serveStatic porque o client/ não está disponível no container
  const nodeEnv = process.env.NODE_ENV || "production";
  const distPublicPath = path.resolve(process.cwd(), "dist", "public");
  const indexPath = path.resolve(distPublicPath, "index.html");
  const hasBuiltFiles = fs.existsSync(distPublicPath) && fs.existsSync(indexPath);
  
  console.log(`[Server] Environment: NODE_ENV=${nodeEnv}`);
  console.log(`[Server] Working directory: ${process.cwd()}`);
  console.log(`[Server] Checking for built files at: ${distPublicPath}`);
  console.log(`[Server] Built files exist: ${hasBuiltFiles}`);
  if (hasBuiltFiles) {
    console.log(`[Server] index.html found at: ${indexPath}`);
  } else {
    console.log(`[Server] index.html NOT found at: ${indexPath}`);
    // Listar o que existe em dist/ para debug
    const distPath = path.resolve(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      try {
        const distContents = fs.readdirSync(distPath);
        console.log(`[Server] Contents of dist/: ${distContents.join(", ")}`);
      } catch (e) {
        console.log(`[Server] Could not read dist/ directory`);
      }
    }
  }
  
  if (nodeEnv === "development" && !hasBuiltFiles) {
    // Apenas usar Vite se estiver em desenvolvimento LOCAL (sem Docker)
    // e os arquivos buildados não existirem
    console.log("[Server] Using Vite dev server (development mode, no built files)");
    await setupVite(app, server);
  } else {
    // Usar arquivos estáticos se:
    // 1. Estiver em produção, OU
    // 2. Os arquivos buildados existirem (caso Docker com NODE_ENV=development)
    console.log("[Server] Using static file serving");
    serveStatic(app);
  }

  // Handler para rotas não encontradas (404) - deve ser o último middleware
  app.use((req, res, next) => {
    if (req.originalUrl.startsWith("/api/")) {
      console.error('[404] Rota da API não encontrada:', req.method, req.originalUrl);
      res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
    } else {
      next();
    }
  });

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log('[Server] Rotas disponíveis:');
    console.log('  - GET  /api/auth/google');
    console.log('  - GET  /api/auth/google/callback');
    console.log('  - POST /api/auth/logout');
    console.log('  - GET  /api/auth/me');

    // Start the campaign scheduler
    campaignScheduler.start();
  });
}

startServer().catch(console.error);
