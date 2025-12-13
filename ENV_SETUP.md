# Configuração de Variáveis de Ambiente

Este projeto possui dois arquivos `.env.example` que devem ser copiados e configurados:

1. **`.env.example`** (raiz do projeto) - Para o frontend
2. **`backend/.env.example`** - Para o backend

## Como Configurar

### 1. Frontend (Raiz do Projeto)

```bash
# Copiar o arquivo de exemplo
cp .env.example .env

# Editar o arquivo .env com suas configurações
nano .env  # ou use seu editor preferido
```

### 2. Backend

```bash
# Navegar para a pasta do backend
cd backend

# Copiar o arquivo de exemplo
cp .env.example .env

# Editar o arquivo .env com suas configurações
nano .env  # ou use seu editor preferido
```

## Variáveis de Ambiente - Frontend

### Configurações Básicas
- `NODE_ENV`: Ambiente de execução (`development` ou `production`)
- `VITE_APP_ID`: ID da aplicação (usado pelo Vite)

### Autenticação
- `JWT_SECRET`: Chave secreta para JWT (gere uma chave segura: `openssl rand -base64 32`)

### Banco de Dados
- `DATABASE_URL`: URL de conexão MySQL no formato: `mysql://user:password@host:port/database`

### OAuth Google
- `OAUTH_SERVER_URL`: URL do servidor OAuth
- `OWNER_OPEN_ID`: OpenID do proprietário/admin (obtido após primeiro login)
- `GOOGLE_CLIENT_ID`: Client ID do Google OAuth (Google Cloud Console)
- `GOOGLE_CLIENT_SECRET`: Client Secret do Google OAuth (Google Cloud Console)

### Storage
- `BUILT_IN_FORGE_API_URL`: URL da API de storage
- `BUILT_IN_FORGE_API_KEY`: Chave da API de storage

### Backend
- `BACKEND_API_URL`: URL da API do backend (padrão: `http://localhost:3000`)

### Frontend (Opcional)
- `FRONTEND_URL`: URL do frontend para callbacks OAuth (padrão: `http://localhost:3000`)
  - Use esta variável se o servidor frontend estiver rodando em uma porta diferente

## Variáveis de Ambiente - Backend

### Configurações Básicas
- `NODE_ENV`: Ambiente de execução (`development` ou `production`)
- `PORT` / `LOCAL_PORT`: Porta do servidor (padrão: `3333`)
- `MENSAGERIA_HOST`: URL do host do sistema
- `SYSTEM_NAME`: Nome do sistema

### Autenticação
- `SECRET_KEY`: Chave secreta para JWT
- `X_AUTH_API`: Chave de autenticação da API
- `AUTH_TOKEN`: Token de autenticação para rotas protegidas

### API Externa
- `API_URL`: URL da API do cliente (usado no Swagger)

### Telegram
- `TELEGRAM_BOT_TOKEN`: Token do bot (obtido via @BotFather)
- `TELEGRAM_CALL_BACK_URL_TO_SEND_USER_ID`: URL de callback

### WhatsApp
- `IDENTIFICATION`: Nomes das conexões separados por vírgula (ex: `numero1,numero2,groupresume`)
- `WHATSAPP_GROUPS_CALLBACK_URL`: URL de callback para grupos

### Google Gemini AI
- `GOOGLE_API_KEY`: Chave da API do Google Gemini (para resumos automáticos)

### Resumo de Grupos WhatsApp
- `RESUME_WHATSAPP_GROUP_ID`: ID do grupo para monitorar
- `RESUME_WHATSAPP_GROUP_ID_TO_SEND`: ID do grupo para enviar resumo
- `RESUME_HOUR_OF_DAY`: Hora do dia para enviar resumo (0-23, padrão: 22)

### Redis
- `REDIS_HOST`: Host do Redis (padrão: `127.0.0.1`)
- `REDIS_PORT`: Porta do Redis (padrão: `6379`)
- `REDIS_NAME`: Nome da conexão Redis

### Email (Nodemailer)
- `MAIL_HOST`: Host do servidor SMTP
- `MAIL_PORT`: Porta do servidor SMTP (587 para TLS, 465 para SSL)
- `MAIL_USER`: Usuário do email
- `MAIL_PASS`: Senha do email (use App Password para Gmail)

### Google Sheets (Opcional)
- `GOOGLE_SHEETS_API_KEY`: Chave da API do Google Sheets
- `GOOGLE_SPREADSHEET_ID`: ID da planilha

## Como Obter as Credenciais

### Google OAuth
1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Ative a API "Google+ API"
4. Vá em "Credenciais" > "Criar credenciais" > "ID do cliente OAuth"
5. Configure as URLs de redirecionamento autorizadas
6. Copie o `Client ID` e `Client Secret`

### Telegram Bot Token
1. Abra o Telegram e procure por [@BotFather](https://t.me/botfather)
2. Envie `/newbot` e siga as instruções
3. Copie o token fornecido

### Google Gemini API Key
1. Acesse [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Crie uma nova API key
3. Copie a chave gerada

### Redis
- Se estiver usando Docker: `docker run -d -p 6379:6379 redis:alpine`
- Ou instale localmente seguindo a [documentação oficial](https://redis.io/docs/getting-started/)

## Segurança

⚠️ **IMPORTANTE**: 
- Nunca commite arquivos `.env` no Git
- Use chaves diferentes para desenvolvimento e produção
- Gere chaves seguras usando: `openssl rand -base64 32`
- Mantenha suas credenciais em segredo

## Verificação

Após configurar os arquivos `.env`, verifique se todas as variáveis necessárias estão preenchidas:

```bash
# Frontend
cd .
cat .env | grep -v "^#" | grep -v "^$"

# Backend
cd backend
cat .env | grep -v "^#" | grep -v "^$"
```

