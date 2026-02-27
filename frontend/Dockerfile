FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Dependências de build (algumas libs nativas precisam de compilação)
RUN apk add --no-cache python3 make g++

# Instalar pnpm (mesma versão definida em package.json)
RUN npm install -g pnpm@10.4.1

# Copiar arquivos de manifesto primeiro para aproveitar cache de camadas
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Instalar dependências (inclui devDependencies para conseguir rodar o build)
# Usando --no-frozen-lockfile temporariamente para evitar problemas de sincronização
RUN pnpm install --no-frozen-lockfile

# Copiar todo o código do frontend (client + server + shared, etc.)
# O .dockerignore garante que node_modules não seja sobrescrito
COPY . .

# Reinstalar dependências após copiar arquivos para garantir que tudo está sincronizado
# Isso garante que patches e overrides sejam aplicados corretamente
RUN pnpm install --no-frozen-lockfile

# Build args para URLs acessíveis pelo browser (Vite embute em build-time)
ARG VITE_BACKEND_API_URL=http://localhost:5600
ENV VITE_BACKEND_API_URL=$VITE_BACKEND_API_URL

# Criar .env vazio se não existir (para evitar erro no COPY posterior)
RUN if [ ! -f .env ]; then touch .env; fi

# Build completo: Vite (frontend) + esbuild (servidor Express/tRPC)
RUN pnpm build


FROM node:20-alpine AS runner

WORKDIR /usr/src/app

# Opcional: utilitário PID 1 mais seguro (pode ser removido se não quiser)
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
ENV PORT=3000

# Copiar apenas o necessário para rodar em produção
COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/.env ./.env
COPY --from=builder /usr/src/app/.env ./dist/.env

# Expor a porta HTTP do servidor Express
EXPOSE 3000

# Iniciar o servidor Express que serve o frontend já buildado
CMD [ "dumb-init", "node", "dist/index.js" ]


