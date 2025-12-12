# Documento de Arquitetura - Sistema de Mensageria

## 1. Visão Geral

O Sistema de Mensageria é uma plataforma web que permite gerenciar e enviar mensagens através de múltiplas plataformas de comunicação (WhatsApp e Telegram). O sistema oferece funcionalidades de autenticação, gerenciamento de conexões, envio de mensagens, configuração de webhooks e análise de mensagens usando IA.

### 1.1 Objetivos Principais

- Gerenciar múltiplas conexões WhatsApp e Telegram
- Enviar mensagens através das plataformas integradas
- Configurar webhooks para receber mensagens
- Analisar mensagens de grupos usando IA (Google Gemini)
- Gerar resumos automáticos de grupos WhatsApp

## 2. Arquitetura Geral

O sistema segue uma arquitetura **monolítica full-stack** com separação clara entre frontend e backend, compartilhando código TypeScript através do diretório `shared`.

```
┌─────────────────────────────────────────────────────────┐
│                    Cliente (Browser)                    │
│  React + Vite + tRPC Client + TanStack Query           │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/HTTPS
                     │ tRPC over HTTP
┌────────────────────▼────────────────────────────────────┐
│              Servidor Express.js                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  tRPC Router (API Endpoints)                     │  │
│  │  - Auth Routes                                   │  │
│  │  - WhatsApp Routes                               │  │
│  │  - Telegram Routes                               │  │
│  │  - Messages Routes                               │  │
│  │  - Webhook Routes                                │  │
│  │  - Settings Routes                               │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Express Routes                                  │  │
│  │  - /api/auth/* (Google OAuth)                   │  │
│  │  - /api/whatsapp/* (Webhooks)                   │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼────┐ ┌─────▼─────┐ ┌───▼──────────┐
│   MySQL    │ │  Backend  │ │ Google OAuth │
│  Database  │ │   Docker  │ │    Server    │
│  (Drizzle) │ │ (WhatsApp)│ │              │
└────────────┘ └───────────┘ └──────────────┘
```

## 3. Stack Tecnológico

### 3.1 Frontend

- **React 19.1.1** - Biblioteca UI
- **Vite 7.1.7** - Build tool e dev server
- **TypeScript 5.9.3** - Linguagem de programação
- **tRPC 11.6.0** - API type-safe client
- **TanStack Query 5.90.2** - Gerenciamento de estado servidor
- **Wouter 3.7.1** - Roteamento
- **TailwindCSS 4.1.14** - Estilização
- **Radix UI** - Componentes acessíveis
- **Framer Motion** - Animações

### 3.2 Backend

- **Node.js** - Runtime
- **Express.js 4.21.2** - Framework web
- **tRPC Server 11.6.0** - API type-safe server
- **TypeScript 5.9.3** - Linguagem de programação
- **Drizzle ORM 0.44.5** - ORM para MySQL
- **MySQL2 3.15.0** - Driver MySQL
- **Passport.js 0.7.0** - Autenticação
- **Express Session** - Gerenciamento de sessões
- **Jose 6.1.0** - JWT handling

### 3.3 Banco de Dados

- **MySQL** - Banco de dados relacional
- **Drizzle Kit** - Migrations e schema management

### 3.4 Integrações Externas

- **Google OAuth 2.0** - Autenticação
- **Backend Docker** - Serviço externo para WhatsApp/Telegram
- **Google Gemini API** - Análise de mensagens com IA

### 3.5 Ferramentas de Desenvolvimento

- **Vitest** - Testes
- **Prettier** - Formatação de código
- **ESBuild** - Bundling para produção
- **TSX** - Execução TypeScript

## 4. Estrutura de Diretórios

```
/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── _core/         # Core hooks e utilitários
│   │   ├── components/    # Componentes React
│   │   │   └── ui/        # Componentes UI base (Radix)
│   │   ├── contexts/      # React Contexts
│   │   ├── hooks/         # Custom hooks
│   │   ├── lib/           # Bibliotecas e configurações
│   │   ├── pages/         # Páginas da aplicação
│   │   └── types/         # Tipos TypeScript
│   ├── public/            # Arquivos estáticos
│   └── index.html         # HTML entry point
│
├── server/                 # Backend Express
│   ├── _core/             # Core do servidor
│   │   ├── index.ts       # Entry point do servidor
│   │   ├── context.ts     # Context do tRPC
│   │   ├── trpc.ts        # Configuração tRPC
│   │   ├── env.ts         # Variáveis de ambiente
│   │   ├── sdk.ts         # SDK de autenticação
│   │   └── vite.ts        # Setup Vite dev server
│   ├── auth/              # Autenticação
│   │   ├── google.ts      # Google OAuth strategy
│   │   └── routes.ts      # Rotas de autenticação
│   ├── whatsapp/          # Rotas WhatsApp
│   │   └── routes.ts      # Webhooks e grupos
│   ├── db.ts              # Funções de acesso ao banco
│   └── routers.ts         # Rotas tRPC principais
│
├── shared/                 # Código compartilhado
│   └── _core/
│       ├── types.ts       # Tipos compartilhados
│       ├── const.ts       # Constantes
│       └── errors.ts      # Erros customizados
│
├── drizzle/                # Schema e migrations
│   ├── schema.ts          # Schema do banco
│   ├── relations.ts       # Relações entre tabelas
│   ├── migrations/        # Migrations SQL
│   └── meta/              # Metadados do Drizzle
│
├── package.json           # Dependências e scripts
├── tsconfig.json          # Configuração TypeScript
├── vite.config.ts         # Configuração Vite
└── drizzle.config.ts      # Configuração Drizzle
```

## 5. Componentes Principais

### 5.1 Autenticação

O sistema utiliza dois métodos de autenticação:

#### 5.1.1 Google OAuth (Passport.js)
- Fluxo OAuth 2.0 completo
- Sessões Express com cookies HTTP-only
- Serialização/deserialização de usuários
- Callback: `/api/auth/google/callback`

#### 5.1.2 SDK de Autenticação (Manus)
- Autenticação via JWT em cookies
- Integração com servidor OAuth externo
- Verificação de sessão em cada requisição
- Sincronização automática de usuários

**Fluxo de Autenticação:**
```
1. Usuário acessa /api/auth/google
2. Redirecionamento para Google OAuth
3. Google retorna código de autorização
4. Servidor troca código por token
5. Cria/atualiza usuário no banco
6. Cria sessão Express
7. Redireciona para aplicação
```

### 5.2 API tRPC

A API é organizada em routers modulares:

#### 5.2.1 Router: `auth`
- `me` - Retorna usuário atual
- `logout` - Encerra sessão

#### 5.2.2 Router: `whatsapp`
- `list` - Lista conexões WhatsApp do usuário
- `create` - Cria nova conexão e gera QR Code
- `getQRCode` - Obtém QR Code de conexão
- `checkStatus` - Verifica status da conexão
- `disconnect` - Desconecta conexão
- `delete` - Remove conexão
- `saveConnection` - Salva conexão existente
- `sync` - Sincroniza conexões com backend Docker
- `sendMessage` - Envia mensagem via WhatsApp

#### 5.2.3 Router: `telegram`
- `list` - Lista conexões Telegram
- `create` - Cria conexão com bot token
- `disconnect` - Desconecta bot
- `delete` - Remove conexão
- `sendMessage` - Envia mensagem via Telegram

#### 5.2.4 Router: `messages`
- `list` - Lista histórico de mensagens

#### 5.2.5 Router: `webhook`
- `getConfig` - Obtém configuração de webhook
- `saveConfig` - Salva configuração
- `getLogs` - Lista logs de webhooks
- `testWebhook` - Testa webhook

#### 5.2.6 Router: `settings`
- `get` - Obtém configurações do usuário
- `update` - Atualiza configurações
- `analyzeMessages` - Analisa mensagens com IA

#### 5.2.7 Router: `whatsappGroups`
- `list` - Lista grupos WhatsApp
- `save` - Salva/atualiza grupo

### 5.3 Middleware tRPC

- **`publicProcedure`** - Endpoints públicos (sem autenticação)
- **`protectedProcedure`** - Requer autenticação
- **`adminProcedure`** - Requer role de admin

### 5.4 Banco de Dados

#### 5.4.1 Schema Principal

**Tabela: `users`**
- Armazena informações de usuários
- Campos: id, openId, name, email, loginMethod, role, timestamps

**Tabela: `whatsapp_connections`**
- Conexões WhatsApp por usuário
- Campos: id, userId, identification, status, qrCode, phoneNumber, timestamps

**Tabela: `telegram_connections`**
- Conexões Telegram por usuário
- Campos: id, userId, botToken, botUsername, status, timestamps

**Tabela: `messages`**
- Histórico de mensagens enviadas
- Campos: id, userId, platform, connectionId, recipient, content, mediaUrl, status, errorMessage, sentAt

**Tabela: `settings`**
- Configurações por usuário
- Campos: id, userId, googleApiKey, resumeGroupId, resumeGroupIdToSend, resumeHourOfDay, enableGroupResume, resumePrompt, resumeConnectionId

**Tabela: `whatsapp_groups`**
- Grupos WhatsApp sincronizados
- Campos: id, sessionId, groupId, groupName, lastMessageAt, timestamps

**Tabela: `webhook_config`**
- Configurações de webhook por usuário
- Campos: id, userId, webhookUrl, webhookSecret, enabled, connectionName, timestamps

**Tabela: `webhook_logs`**
- Logs de webhooks para auditoria
- Campos: id, webhookConfigId, fromNumber, messageId, text, status, response, errorMessage, createdAt

## 6. Fluxos de Dados

### 6.1 Fluxo de Envio de Mensagem WhatsApp

```
1. Cliente chama trpc.whatsapp.sendMessage.useMutation()
2. Requisição vai para /api/trpc/whatsapp.sendMessage
3. Middleware protectedProcedure valida autenticação
4. Router cria registro de mensagem no banco (status: pending)
5. Router faz POST para BACKEND_API_URL/whatsapp?token={identification}
6. Backend Docker processa e envia mensagem
7. Se sucesso: mensagem enviada
8. Se erro: status atualizado para failed com errorMessage
```

### 6.2 Fluxo de Conexão WhatsApp

```
1. Usuário cria nova conexão via trpc.whatsapp.create
2. Sistema cria registro no banco (status: connecting)
3. Sistema retorna URL do QR Code do backend Docker
4. Usuário escaneia QR Code
5. Backend Docker notifica conexão estabelecida
6. Cliente pode chamar whatsapp.checkStatus periodicamente
7. Sistema atualiza status para "connected" e salva phoneNumber
```

### 6.3 Fluxo de Webhook

```
1. Mensagem chega no backend Docker WhatsApp
2. Backend Docker faz POST para /api/whatsapp/webhook
3. Sistema verifica configuração de webhook do usuário
4. Se habilitado, faz POST para webhookUrl configurada
5. Registra log em webhook_logs (success/error)
6. Retorna resposta ao backend Docker
```

### 6.4 Fluxo de Análise de Mensagens (IA)

```
1. Usuário configura googleApiKey nas settings
2. Usuário faz pergunta sobre grupo via settings.analyzeMessages
3. Sistema faz POST para BACKEND_API_URL/whatsapp/analyze-messages
4. Backend Docker usa Gemini API para analisar mensagens
5. Retorna resposta analítica ao usuário
```

## 7. Segurança

### 7.1 Autenticação

- **Cookies HTTP-only** - Previne acesso via JavaScript
- **Cookies Secure** - Apenas HTTPS em produção
- **JWT com expiração** - Tokens temporários
- **Sessões Express** - Gerenciamento server-side

### 7.2 Autorização

- **Middleware de autenticação** - Validação em cada requisição protegida
- **Role-based access** - Controle de acesso por roles (user/admin)
- **Isolamento de dados** - Usuários só acessam seus próprios dados

### 7.3 Validação

- **Zod schemas** - Validação de entrada em todos os endpoints
- **TypeScript** - Type safety em tempo de compilação
- **Sanitização de inputs** - Prevenção de SQL injection via Drizzle ORM

### 7.4 Segurança de API Externa

- **BACKEND_API_TOKEN** - Token de autenticação para backend Docker
- **Webhook secrets** - Autenticação Bearer token em webhooks
- **Timeout de requisições** - Prevenção de hanging requests

## 8. Integrações Externas

### 8.1 Backend Docker (WhatsApp/Telegram)

**Configuração:**
- URL: `BACKEND_API_URL` (default: http://localhost:5600)
- Autenticação: Header `x-auth-api` com `BACKEND_API_TOKEN`

**Endpoints Utilizados:**
- `GET /whatsapp/qrcode?token={identification}` - Obter QR Code
- `GET /whatsapp/status/{identification}` - Verificar status
- `POST /whatsapp/disconnect` - Desconectar
- `GET /whatsapp/connections` - Listar conexões
- `POST /whatsapp?token={identification}` - Enviar mensagem
- `POST /whatsapp/configure-resume` - Configurar resumo automático
- `POST /whatsapp/analyze-messages` - Analisar mensagens
- `POST /telegram/connect` - Conectar bot Telegram
- `POST /telegram/send` - Enviar mensagem Telegram
- `POST /whatsapp/webhook` - Receber mensagens (webhook)

### 8.2 Google OAuth

**Configuração:**
- `GOOGLE_CLIENT_ID` - Client ID do OAuth
- `GOOGLE_CLIENT_SECRET` - Client Secret
- Callback URL: `/api/auth/google/callback`

### 8.3 Google Gemini API

**Uso:**
- Análise de mensagens de grupos
- Geração de resumos automáticos
- Configurado via `googleApiKey` nas settings do usuário

## 9. Variáveis de Ambiente

### 9.1 Obrigatórias

```bash
DATABASE_URL=mysql://user:password@host:port/database
JWT_SECRET=secret-key-for-jwt-signing
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 9.2 Opcionais

```bash
NODE_ENV=production|development
PORT=3000
BACKEND_API_URL=http://localhost:5600
BACKEND_API_TOKEN=token-for-backend-auth
OAUTH_SERVER_URL=https://oauth-server-url
VITE_APP_ID=app-id-for-manus-auth
OWNER_OPEN_ID=openid-for-admin-user
```

## 10. Build e Deploy

### 10.1 Desenvolvimento

```bash
# Instalar dependências
pnpm install

# Rodar em modo desenvolvimento
pnpm dev

# O servidor inicia em http://localhost:3000
# Vite HMR habilitado para hot-reload
```

### 10.2 Produção

```bash
# Build do frontend e backend
pnpm build

# Iniciar servidor de produção
pnpm start

# O servidor serve arquivos estáticos do frontend
# e processa requisições de API
```

### 10.3 Migrations

```bash
# Gerar migrations do schema
pnpm db:push

# Isso executa:
# 1. drizzle-kit generate (gera SQL)
# 2. drizzle-kit migrate (aplica migrations)
```

## 11. Estrutura de Frontend

### 11.1 Páginas Principais

- **Home** (`/`) - Dashboard principal
- **WhatsApp** (`/whatsapp`) - Gerenciamento de conexões WhatsApp
- **Telegram** (`/telegram`) - Gerenciamento de bots Telegram
- **SendMessage** (`/send-message`) - Envio de mensagens
- **Settings** (`/settings`) - Configurações do usuário
- **WebhookConfig** (`/webhook`) - Configuração de webhooks
- **API** (`/api`) - Documentação/testes de API

### 11.2 Componentes Principais

- **DashboardLayout** - Layout principal com sidebar
- **AIChatBox** - Interface de chat para análise de mensagens
- **ErrorBoundary** - Tratamento de erros React

### 11.3 Hooks Customizados

- **useAuth** - Gerenciamento de autenticação
- **useMobile** - Detecção de dispositivo móvel
- **useComposition** - Composição de componentes

## 12. Considerações de Performance

### 12.1 Frontend

- **Code splitting** - Vite faz split automático
- **Tree shaking** - Remoção de código não utilizado
- **Lazy loading** - Componentes carregados sob demanda
- **React Query caching** - Cache de requisições tRPC

### 12.2 Backend

- **Connection pooling** - MySQL2 gerencia pool de conexões
- **Lazy database connection** - Conexão criada sob demanda
- **Request timeout** - Timeout configurado para requisições externas
- **Static file serving** - Arquivos estáticos servidos diretamente em produção

## 13. Monitoramento e Logs

### 13.1 Logs do Servidor

- Console logs para operações importantes
- Logs de erro com stack traces
- Logs de autenticação e autorização

### 13.2 Auditoria

- **webhook_logs** - Todos os webhooks são logados
- **messages** - Histórico completo de mensagens enviadas
- **users.lastSignedIn** - Último acesso de cada usuário

## 14. Escalabilidade

### 14.1 Limitações Atuais

- Arquitetura monolítica - um único processo Node.js
- Banco de dados MySQL único
- Sessões em memória (Express Session)

### 14.2 Melhorias Futuras

- **Redis** - Para sessões distribuídas
- **Load balancer** - Múltiplas instâncias do servidor
- **Database replication** - Read replicas para MySQL
- **Message queue** - Para processamento assíncrono de mensagens
- **Caching layer** - Redis para cache de dados frequentes

## 15. Manutenção e Evolução

### 15.1 Migrations

- Migrations versionadas em `drizzle/migrations/`
- Schema definido em `drizzle/schema.ts`
- Comando: `pnpm db:push`

### 15.2 Type Safety

- TypeScript em todo o código
- Tipos compartilhados via `shared/_core/types.ts`
- Tipos inferidos do schema Drizzle
- Tipos inferidos do router tRPC

### 15.3 Testes

- Vitest configurado
- Estrutura preparada para testes unitários e de integração

## 16. Documentação Adicional

- **README.md** - Instruções de instalação e uso
- **TODO.md** - Lista de tarefas pendentes
- **Schema Drizzle** - Documentação inline no código

---

**Versão do Documento:** 1.0  
**Última Atualização:** 2024  
**Autor:** Equipe de Desenvolvimento
