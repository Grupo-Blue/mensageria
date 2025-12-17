FROM node:20-alpine
WORKDIR /usr/src/app

# Instalar dependências do sistema (inclui git para instalar pacotes via repositórios)
RUN apk add --no-cache python3 make g++ git

# Copiar package.json e yarn.lock
COPY package.json yarn.lock ./

# Instalar dependências
RUN yarn install

# Copiar código fonte
COPY . ./

# Expor porta
EXPOSE 3333

# Usar tsx para rodar TypeScript diretamente (sem build)
CMD ["yarn", "dev"]

