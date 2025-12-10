# Build stage
FROM node:20-alpine AS builder
WORKDIR /usr/src/app

# Instalar dependências do sistema necessárias para build
RUN apk add --no-cache python3 make g++

# Copiar package.json e yarn.lock
COPY package.json yarn.lock ./

# Instalar dependências
RUN yarn install --frozen-lockfile

# Copiar código fonte
COPY . ./

# Build da aplicação
RUN yarn build

# Production stage
FROM node:20-alpine AS production
WORKDIR /usr/src/app

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Instalar apenas dependências de produção
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && \
    yarn cache clean

# Copiar build do stage anterior
COPY --from=builder /usr/src/app/build ./build
COPY --from=builder /usr/src/app/src/swagger.json ./build/swagger.json
COPY --from=builder /usr/src/app/src/views ./build/views

# Criar diretórios necessários com permissões corretas
RUN mkdir -p tmp auth_info_baileys && \
    chown -R nodejs:nodejs /usr/src/app

# Trocar para usuário não-root
USER nodejs

# Expor porta
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3333/health || exit 1

# Rodar em produção
ENV NODE_ENV=production
CMD ["node", "./build/server.js"]
