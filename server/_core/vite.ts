import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

// Compatibilidade com Node.js 18 (import.meta.dirname só está disponível no Node.js 20.11.0+)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  // IMPORTANTE: Registrar vite.middlewares diretamente
  // As rotas da API já são registradas ANTES do Vite no server/_core/index.ts,
  // então o Express já vai interceptá-las antes de chegar aqui.
  // O Vite precisa processar assets estáticos (CSS, JS, HMR, etc.) sem interferência.
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    // Não interceptar rotas da API - deixar passar para as rotas do Express
    if (url.startsWith("/api/")) {
      return next();
    }

    try {
      // Em desenvolvimento, o código pode estar rodando de diferentes locais
      // Usar process.cwd() como base, que sempre aponta para o diretório de trabalho
      // No Docker, isso será /usr/src/app
      // Localmente, será a raiz do projeto
      const clientTemplate = path.resolve(process.cwd(), "client", "index.html");
      
      if (!fs.existsSync(clientTemplate)) {
        console.error("[Vite] Could not find client/index.html at:", clientTemplate);
        console.error("[Vite] Current working directory:", process.cwd());
        console.error("[Vite] __dirname:", __dirname);
        throw new Error(`Client template not found: ${clientTemplate}`);
      }

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // Em produção, o código está em dist/index.js, então __dirname será dist/_core
  // Os arquivos estáticos estão em dist/public (configurado no vite.config.ts)
  // Tentar múltiplos caminhos possíveis
  const possiblePaths = [
    path.resolve(__dirname, "..", "public"), // dist/_core -> dist/public
    path.resolve(process.cwd(), "dist", "public"), // raiz -> dist/public
    path.resolve(process.cwd(), "public"), // raiz -> public (fallback)
  ];
  
  const distPath = possiblePaths.find(p => fs.existsSync(p));
  
  if (!distPath) {
    console.error("[Static] Could not find the build directory. Tried paths:", possiblePaths);
    console.error("[Static] Current working directory:", process.cwd());
    console.error("[Static] __dirname:", __dirname);
    throw new Error(`Build directory not found. Tried: ${possiblePaths.join(", ")}`);
  }
  
  console.log(`[Static] Serving static files from: ${distPath}`);
  
  // Verificar se index.html existe
  const indexPath = path.resolve(distPath, "index.html");
  if (!fs.existsSync(indexPath)) {
    console.error(`[Static] index.html not found at: ${indexPath}`);
    throw new Error(`index.html not found at: ${indexPath}`);
  }
  
  console.log(`[Static] index.html found at: ${indexPath}`);
  
  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (req, res, next) => {
    // Não interceptar rotas da API - deixar passar para as rotas do Express
    if (req.originalUrl.startsWith("/api/")) {
      return next();
    }
    res.sendFile(indexPath);
  });
}
