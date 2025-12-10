# Deploy do Frontend Mensageria

## Pré-requisitos

- Node.js 20.x
- PM2 instalado globalmente
- MySQL rodando localmente
- Backend Mensageria rodando (Docker na porta 5600)

## Passos de Deploy

### 1. Clonar o repositório

```bash
cd /root
git clone https://github.com/Grupo-Blue/mensageria.git
cd mensageria/frontend
```

### 2. Instalar dependências

```bash
npm install --legacy-peer-deps
```

### 3. Configurar variáveis de ambiente

Copie o arquivo `.env.example` para `.env` e preencha com os valores corretos:

```bash
cp .env.example .env
nano .env
```

Ou edite o arquivo `ecosystem.config.cjs` diretamente com as variáveis de produção.

### 4. Build do projeto

```bash
npm run build
```

### 5. Configurar banco de dados

Execute as migrações do Drizzle:

```bash
npm run db:push
```

### 6. Iniciar com PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

### 7. Verificar status

```bash
pm2 status
pm2 logs mensageria-frontend
```

## Atualização

Para atualizar o frontend em produção:

```bash
cd /root/mensageria
git pull origin master
cd frontend
npm install --legacy-peer-deps
npm run build
pm2 restart mensageria-frontend
```

## Troubleshooting

### Erro 500 ao testar webhook

Verifique se as variáveis de ambiente foram carregadas:

```bash
pm2 env <ID_DO_PROCESSO> | grep -E "(DATABASE_URL|GOOGLE_CLIENT_ID)"
```

Se não aparecerem, reinicie o PM2 com o ecosystem.config.cjs:

```bash
pm2 delete mensageria-frontend
pm2 start ecosystem.config.cjs
pm2 save
```

### Erro "Repository not found" no git

Certifique-se de estar usando o repositório correto:

```bash
git remote -v
# Deve mostrar: https://github.com/Grupo-Blue/mensageria.git
```

### Servidor não inicia

Verifique os logs de erro:

```bash
pm2 logs mensageria-frontend --err --lines 50
```

## Estrutura de Diretórios

```
/root/mensageria/
├── frontend/              # Frontend React + tRPC
│   ├── client/           # Código React
│   ├── server/           # Backend tRPC
│   ├── drizzle/          # Schema do banco
│   └── ecosystem.config.cjs  # Configuração PM2
├── src/                  # Backend Baileys (Docker)
└── docker-compose.yml
```

## Portas Utilizadas

- **3000**: Frontend Node.js (PM2)
- **5600**: Backend Baileys (Docker)
- **5601**: Micro-serviço API REST
- **5602**: Micro-serviço Webhook
- **3306**: MySQL

## Apache Proxy

O Apache deve estar configurado para fazer proxy reverso:

```apache
ProxyPass /api/auth http://localhost:3000/api/auth
ProxyPassReverse /api/auth http://localhost:3000/api/auth

ProxyPass /api/trpc http://localhost:3000/api/trpc
ProxyPassReverse /api/trpc http://localhost:3000/api/trpc

ProxyPass / http://localhost:3000/
ProxyPassReverse / http://localhost:3000/
```
