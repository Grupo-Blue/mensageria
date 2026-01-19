# Roadmap SaaS - Sistema de Mensageria

## Resumo Executivo

Este documento apresenta o plano completo para transformar o sistema de mensageria em um produto SaaS comercializável, focado em:

1. **API de WhatsApp não oficial multitenant** (via Baileys)
2. **Sistema de envio de mensagens em massa via API Oficial** (Meta WhatsApp Business)

---

## Estado Atual do Sistema

### O que JÁ EXISTE (Funcional)

| Categoria | Funcionalidade | Status |
|-----------|---------------|--------|
| **Multi-tenancy** | Isolamento de dados por userId | ✅ Implementado |
| **Autenticação** | OAuth (Google, GitHub, Apple, Microsoft) | ✅ Implementado |
| **WhatsApp Baileys** | Conexões múltiplas por usuário | ✅ Implementado |
| **WhatsApp Baileys** | QR Code para autenticação | ✅ Implementado |
| **WhatsApp Baileys** | Envio/recebimento de mensagens | ✅ Implementado |
| **WhatsApp Baileys** | Webhooks customizados por conexão | ✅ Implementado |
| **WhatsApp Baileys** | API Key por conexão | ✅ Implementado |
| **WhatsApp Business** | Gerenciamento de contas Meta | ✅ Implementado |
| **WhatsApp Business** | Sincronização de templates | ✅ Implementado |
| **WhatsApp Business** | Criação de templates | ✅ Implementado |
| **Campanhas** | Criação e gestão de campanhas | ✅ Implementado |
| **Campanhas** | Importação de contatos | ✅ Implementado |
| **Campanhas** | Variáveis dinâmicas por destinatário | ✅ Implementado |
| **Campanhas** | Retry automático com configuração | ✅ Implementado |
| **Campanhas** | Estatísticas (sent, delivered, read, failed) | ✅ Implementado |
| **Contatos** | Listas de contatos | ✅ Implementado |
| **Contatos** | Blacklist/Opt-out automático | ✅ Implementado |
| **Telegram** | Conexão de bots | ✅ Implementado |
| **IA** | Resumo automático com Google Gemini | ✅ Implementado |

### O que NÃO EXISTE (Precisa Implementar)

| Categoria | Funcionalidade | Prioridade |
|-----------|---------------|------------|
| **Billing** | Sistema de planos e preços | 🔴 CRÍTICO |
| **Billing** | Integração com gateway de pagamento | 🔴 CRÍTICO |
| **Billing** | Limites de uso por plano | 🔴 CRÍTICO |
| **Billing** | Controle de créditos/mensagens | 🔴 CRÍTICO |
| **Infraestrutura** | Rate limiting | 🔴 CRÍTICO |
| **Infraestrutura** | Logs de auditoria | 🟡 IMPORTANTE |
| **Infraestrutura** | Health checks e monitoring | 🟡 IMPORTANTE |
| **Admin** | Painel administrativo completo | 🟡 IMPORTANTE |
| **Onboarding** | Fluxo de primeiro acesso | 🟡 IMPORTANTE |
| **Legal** | Termos de Serviço | 🔴 CRÍTICO |
| **Legal** | Política de Privacidade | 🔴 CRÍTICO |
| **Marketing** | Landing page | 🟡 IMPORTANTE |
| **Documentação** | API pública documentada | 🟡 IMPORTANTE |
| **Suporte** | Sistema de tickets/chat | 🟢 DESEJÁVEL |

---

## Plano de Implementação

### FASE 1: Fundação SaaS (Crítico)

#### 1.1 Sistema de Planos e Billing

**Tabelas necessárias:**

```typescript
// drizzle/schema.ts

// Planos disponíveis
export const plans = mysqlTable('plans', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(), // Free, Starter, Pro, Enterprise
  slug: varchar('slug', { length: 50 }).notNull().unique(),
  description: text('description'),

  // Preços
  priceMonthly: decimal('price_monthly', { precision: 10, scale: 2 }).notNull(),
  priceYearly: decimal('price_yearly', { precision: 10, scale: 2 }),
  currency: varchar('currency', { length: 3 }).default('BRL'),

  // Limites
  maxWhatsappConnections: int('max_whatsapp_connections').notNull(), // Conexões Baileys
  maxBusinessAccounts: int('max_business_accounts').notNull(), // Contas Meta
  maxCampaignsPerMonth: int('max_campaigns_per_month').notNull(),
  maxContactsPerList: int('max_contacts_per_list').notNull(),
  maxMessagesPerMonth: int('max_messages_per_month').notNull(), // Baileys
  maxTemplateMessagesPerMonth: int('max_template_messages_per_month').notNull(), // Meta

  // Features
  hasWebhooks: boolean('has_webhooks').default(false),
  hasApiAccess: boolean('has_api_access').default(false),
  hasAiFeatures: boolean('has_ai_features').default(false),
  hasPrioritySupport: boolean('has_priority_support').default(false),
  hasCustomBranding: boolean('has_custom_branding').default(false),

  isActive: boolean('is_active').default(true),
  sortOrder: int('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// Assinaturas dos usuários
export const subscriptions = mysqlTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: int('user_id').notNull().references(() => users.id),
  planId: int('plan_id').notNull().references(() => plans.id),

  // Status
  status: mysqlEnum('status', [
    'active', 'canceled', 'past_due', 'trialing', 'paused'
  ]).default('active'),

  // Datas
  currentPeriodStart: timestamp('current_period_start').notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  canceledAt: timestamp('canceled_at'),
  trialEndsAt: timestamp('trial_ends_at'),

  // Gateway de pagamento
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});

// Uso mensal do usuário
export const usageRecords = mysqlTable('usage_records', {
  id: serial('id').primaryKey(),
  userId: int('user_id').notNull().references(() => users.id),

  // Período
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),

  // Contadores
  whatsappConnectionsCount: int('whatsapp_connections_count').default(0),
  businessAccountsCount: int('business_accounts_count').default(0),
  campaignsCreated: int('campaigns_created').default(0),
  messagesViaApi: int('messages_via_api').default(0), // Baileys
  messagesViaTemplate: int('messages_via_template').default(0), // Meta

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
}, (table) => ({
  userPeriodUnique: unique().on(table.userId, table.periodStart),
}));

// Histórico de pagamentos
export const payments = mysqlTable('payments', {
  id: serial('id').primaryKey(),
  userId: int('user_id').notNull().references(() => users.id),
  subscriptionId: int('subscription_id').references(() => subscriptions.id),

  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('BRL'),
  status: mysqlEnum('status', ['pending', 'succeeded', 'failed', 'refunded']).default('pending'),

  // Gateway
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  stripeInvoiceId: varchar('stripe_invoice_id', { length: 255 }),

  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

**Planos Definidos:**

| Plano | Preço/mês | Conexões Baileys | Contas Meta | Campanhas/mês | Mensagens/mês |
|-------|-----------|------------------|-------------|---------------|---------------|
| **Free** | R$ 0 | 1 | 0 | 1 | 100 |
| **Starter** | R$ 57 | 3 | 1 | 10 | 5.000 |
| **Pro** | R$ 297 | 10 | 3 | 50 | 25.000 |
| **Enterprise** | Sob consulta | Ilimitado | 10+ | Ilimitado | 100.000+ |

> **Nota:** O plano Enterprise terá um botão "Fale Conosco" que abre email para contato comercial, pois o preço será avaliado caso a caso.

#### 1.2 Middleware de Verificação de Limites

```typescript
// server/middleware/usageLimits.ts

export async function checkUsageLimit(
  userId: number,
  limitType: 'connections' | 'campaigns' | 'messages' | 'businessAccounts'
): Promise<{ allowed: boolean; current: number; limit: number; message?: string }> {
  // 1. Buscar plano atual do usuário
  // 2. Buscar uso atual do período
  // 3. Comparar com limites do plano
  // 4. Retornar se pode ou não
}

// Usar em cada endpoint que consome recursos
export const protectedWithLimitsProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  // Verificar status da assinatura
  const subscription = await getActiveSubscription(ctx.user.id);
  if (!subscription || subscription.status !== 'active') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Assinatura inativa' });
  }
  return next({ ctx: { ...ctx, subscription } });
});
```

#### 1.3 Integração Stripe

**Dependências:**
```bash
pnpm add stripe @stripe/stripe-js
```

**Endpoints necessários:**
- `billing.getPlans` - Lista planos disponíveis
- `billing.getCurrentSubscription` - Assinatura atual
- `billing.createCheckoutSession` - Criar sessão de pagamento
- `billing.createPortalSession` - Portal do cliente Stripe
- `billing.getUsage` - Uso atual do período
- `billing.getPaymentHistory` - Histórico de pagamentos
- Webhook: `/api/stripe/webhook` - Eventos do Stripe

#### 1.4 Rate Limiting

```typescript
// server/middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';

// Rate limit global por IP
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // 1000 requests por janela
  message: 'Muitas requisições, tente novamente em alguns minutos',
});

// Rate limit por API Key (para uso de API)
export const apiKeyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 60, // 60 requests por minuto
  keyGenerator: (req) => req.headers['x-api-key'] as string,
});

// Rate limit para envio de mensagens
export const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // 30 mensagens por minuto
  keyGenerator: (req) => req.user?.id.toString(),
});
```

#### 1.5 Documentos Legais

**Termos de Serviço** (`/terms`) - Pontos essenciais:
- Descrição do serviço
- Uso aceitável (proibir spam, conteúdo ilegal)
- Responsabilidade sobre contas WhatsApp (risco de ban)
- Política de reembolso
- Limitação de responsabilidade
- Jurisdição (Brasil)

**Política de Privacidade** (`/privacy`) - Pontos essenciais:
- Dados coletados (pessoais + mensagens)
- Uso dos dados
- Compartilhamento com terceiros (Meta, Stripe)
- Retenção de dados
- Direitos do usuário (LGPD)
- Cookies

---

### FASE 2: Experiência do Usuário

#### 2.1 Landing Page

**Seções necessárias:**
1. Hero com proposta de valor
2. Features principais (API WhatsApp, Campanhas, Multi-conexão)
3. Tabela de preços
4. FAQ
5. Depoimentos/casos de uso
6. CTA para cadastro
7. Footer com links legais

**Rota:** `/` para visitantes não logados

#### 2.2 Onboarding Flow

```
1. Cadastro/Login
2. Escolha de plano (ou trial de 7 dias)
3. Wizard de primeira configuração:
   a. Conectar primeiro WhatsApp (QR Code)
   b. Testar envio de mensagem
   c. Configurar webhook (opcional)
4. Dashboard com checklist de próximos passos
```

#### 2.3 Dashboard Melhorado

**Métricas a exibir:**
- Uso atual vs limite do plano (barra de progresso)
- Conexões ativas
- Mensagens enviadas no período
- Campanhas em execução
- Alertas (limite próximo, conexão offline, etc)

---

### FASE 3: Admin e Operações

#### 3.1 Painel Administrativo Completo

**Rota:** `/admin` (apenas para usuários com role: 'admin')

---

##### 3.1.1 Dashboard Admin (Visão Geral)

**Cards de métricas principais:**

| Métrica | Descrição |
|---------|-----------|
| **Total de Usuários** | Quantidade total de usuários cadastrados |
| **Usuários Ativos** | Usuários com assinatura ativa (últimos 30 dias) |
| **Conexões WhatsApp** | Total de conexões Baileys ativas |
| **Conexões Offline** | Conexões com status 'disconnected' |
| **Contas Business** | Total de contas WhatsApp Business cadastradas |
| **Campanhas em Execução** | Campanhas com status 'running' |
| **Erros nas Últimas 24h** | Mensagens com status 'failed' |
| **MRR (Receita Mensal)** | Soma de todas assinaturas ativas |

**Gráficos:**
- Novos usuários por dia (últimos 30 dias)
- Mensagens enviadas por dia
- Receita por mês (últimos 12 meses)
- Distribuição de planos (pizza)

---

##### 3.1.2 Gerenciamento de Usuários

**Tabela de usuários com:**
- ID, Nome, Email
- Plano atual
- Status da assinatura
- Data de cadastro
- Último login
- Conexões ativas
- Ações (ver detalhes, editar, suspender)

**Filtros:**
- Por plano (Free, Starter, Pro, Enterprise)
- Por status (ativo, cancelado, inadimplente)
- Por data de cadastro
- Busca por nome/email

**Ações disponíveis:**
- Ver perfil completo do usuário
- Alterar plano manualmente
- Cancelar/pausar assinatura
- Adicionar créditos extras
- Enviar email
- Fazer login como usuário (impersonate)

---

##### 3.1.3 Gerenciamento de Assinaturas

**Visão de assinaturas:**
- Lista de todas assinaturas
- Status em tempo real
- Próxima cobrança
- Histórico de pagamentos

**Ações:**
- Cancelar assinatura
- Pausar assinatura
- Reativar assinatura
- Aplicar desconto
- Estender período
- Forçar retry de pagamento

**Relatório de Churn:**
- Usuários que cancelaram no mês
- Motivos de cancelamento
- Tempo médio de vida do cliente

---

##### 3.1.4 Monitoramento de Conexões

**Tabela de conexões WhatsApp (Baileys):**
- Usuário
- Identificação
- Status (connected/disconnected/qr_code)
- Número de telefone
- Última conexão
- Mensagens enviadas

**Tabela de contas Business (Meta):**
- Usuário
- Nome da conta
- Phone Number ID
- Status
- Templates aprovados

**Alertas automáticos:**
- Conexões offline há mais de 1 hora
- Muitas falhas de envio
- QR Code pendente há mais de 24h

---

##### 3.1.5 Monitoramento de Erros

**Dashboard de erros:**
- Total de erros por tipo
- Erros por hora (gráfico)
- Taxa de erro (% de falhas)

**Tipos de erro monitorados:**
- Falha de envio WhatsApp (Baileys)
- Falha de envio Meta API
- Falha de webhook
- Erros de autenticação
- Rate limit atingido

**Tabela de erros recentes:**
- Timestamp
- Usuário
- Tipo de erro
- Mensagem de erro
- Contexto (campanha, conexão, etc)
- Stack trace (colapsável)

---

##### 3.1.6 Configurações do Sistema

**Stripe:**
- Status da conexão com Stripe
- Webhook URL configurada
- Último evento recebido
- Botão para testar conexão
- Link para dashboard Stripe

**Planos:**
- Editar limites dos planos
- Ativar/desativar planos
- Criar novo plano
- Definir preços

**Email:**
- Configuração SMTP
- Templates de email
- Teste de envio

**Sistema:**
- Modo manutenção (ativar/desativar)
- Variáveis de ambiente (readonly)
- Versão do sistema
- Status dos serviços (frontend, backend Docker, banco)

---

##### 3.1.7 Logs e Auditoria

**Logs de admin:**
- Todas ações dos administradores
- Quem fez, o quê, quando
- Filtro por admin, ação, data

**Logs de sistema:**
- Erros de aplicação
- Requisições lentas
- Eventos importantes

---

**Tabelas necessárias:**

```typescript
// Logs de ações administrativas
export const adminLogs = mysqlTable('admin_logs', {
  id: serial('id').primaryKey(),
  adminUserId: int('admin_user_id').notNull().references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  // Ações: user.view, user.edit, user.suspend, subscription.cancel,
  // subscription.pause, subscription.change_plan, settings.update, etc
  targetType: varchar('target_type', { length: 50 }), // user, subscription, plan, settings
  targetId: int('target_id'),
  previousValue: json('previous_value'), // Estado anterior
  newValue: json('new_value'), // Estado novo
  details: json('details'), // Detalhes adicionais
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Logs de erros do sistema
export const errorLogs = mysqlTable('error_logs', {
  id: serial('id').primaryKey(),
  userId: int('user_id').references(() => users.id), // Pode ser null para erros de sistema
  errorType: varchar('error_type', { length: 50 }).notNull(),
  // Tipos: message_send_failed, webhook_failed, auth_failed, rate_limit, api_error
  errorCode: varchar('error_code', { length: 50 }),
  message: text('message').notNull(),
  stackTrace: text('stack_trace'),
  context: json('context'), // campaignId, connectionId, etc
  resolved: boolean('resolved').default(false),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: int('resolved_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

// Configurações globais do sistema
export const systemSettings = mysqlTable('system_settings', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: text('value'),
  type: varchar('type', { length: 20 }).default('string'), // string, number, boolean, json
  description: text('description'),
  isPublic: boolean('is_public').default(false), // Se pode ser exposto no frontend
  updatedBy: int('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
});
```

---

##### 3.1.8 Endpoints do Admin Router

```typescript
// server/routers/admin.ts

export const adminRouter = router({
  // Dashboard
  getDashboardStats: adminProcedure.query(/* ... */),
  getRevenueChart: adminProcedure.query(/* ... */),
  getUserGrowthChart: adminProcedure.query(/* ... */),
  getMessagesChart: adminProcedure.query(/* ... */),

  // Usuários
  listUsers: adminProcedure.input(paginationSchema).query(/* ... */),
  getUser: adminProcedure.input(z.object({ userId: z.number() })).query(/* ... */),
  updateUser: adminProcedure.input(updateUserSchema).mutation(/* ... */),
  suspendUser: adminProcedure.input(z.object({ userId: z.number(), reason: z.string() })).mutation(/* ... */),
  impersonateUser: adminProcedure.input(z.object({ userId: z.number() })).mutation(/* ... */),

  // Assinaturas
  listSubscriptions: adminProcedure.input(paginationSchema).query(/* ... */),
  getSubscription: adminProcedure.input(z.object({ subscriptionId: z.number() })).query(/* ... */),
  cancelSubscription: adminProcedure.input(z.object({ subscriptionId: z.number(), reason: z.string() })).mutation(/* ... */),
  pauseSubscription: adminProcedure.input(z.object({ subscriptionId: z.number() })).mutation(/* ... */),
  resumeSubscription: adminProcedure.input(z.object({ subscriptionId: z.number() })).mutation(/* ... */),
  changePlan: adminProcedure.input(z.object({ subscriptionId: z.number(), planId: z.number() })).mutation(/* ... */),
  extendSubscription: adminProcedure.input(z.object({ subscriptionId: z.number(), days: z.number() })).mutation(/* ... */),
  addCredits: adminProcedure.input(z.object({ userId: z.number(), credits: z.number(), type: z.string() })).mutation(/* ... */),

  // Conexões
  listAllConnections: adminProcedure.input(paginationSchema).query(/* ... */),
  listOfflineConnections: adminProcedure.query(/* ... */),
  getConnectionDetails: adminProcedure.input(z.object({ connectionId: z.number() })).query(/* ... */),

  // Erros
  listErrors: adminProcedure.input(errorFilterSchema).query(/* ... */),
  getErrorStats: adminProcedure.query(/* ... */),
  resolveError: adminProcedure.input(z.object({ errorId: z.number() })).mutation(/* ... */),

  // Planos
  listPlans: adminProcedure.query(/* ... */),
  createPlan: adminProcedure.input(createPlanSchema).mutation(/* ... */),
  updatePlan: adminProcedure.input(updatePlanSchema).mutation(/* ... */),
  togglePlan: adminProcedure.input(z.object({ planId: z.number(), isActive: z.boolean() })).mutation(/* ... */),

  // Configurações
  getSystemSettings: adminProcedure.query(/* ... */),
  updateSystemSetting: adminProcedure.input(z.object({ key: z.string(), value: z.string() })).mutation(/* ... */),
  testStripeConnection: adminProcedure.mutation(/* ... */),
  testEmailConnection: adminProcedure.mutation(/* ... */),
  toggleMaintenanceMode: adminProcedure.mutation(/* ... */),

  // Logs
  getAdminLogs: adminProcedure.input(logFilterSchema).query(/* ... */),
  getSystemLogs: adminProcedure.input(logFilterSchema).query(/* ... */),

  // Relatórios
  getChurnReport: adminProcedure.input(dateRangeSchema).query(/* ... */),
  getRevenueReport: adminProcedure.input(dateRangeSchema).query(/* ... */),
  exportUsers: adminProcedure.input(exportFilterSchema).mutation(/* ... */),
});
```

---

##### 3.1.9 Layout do Admin Panel

```
/admin
├── /admin                     → Dashboard (visão geral)
├── /admin/users               → Lista de usuários
│   └── /admin/users/:id       → Detalhes do usuário
├── /admin/subscriptions       → Gerenciamento de assinaturas
├── /admin/connections         → Monitoramento de conexões
├── /admin/errors              → Dashboard de erros
├── /admin/plans               → Gerenciamento de planos
├── /admin/settings            → Configurações do sistema
│   ├── /admin/settings/stripe → Configurações Stripe
│   ├── /admin/settings/email  → Configurações de email
│   └── /admin/settings/system → Configurações gerais
└── /admin/logs                → Logs e auditoria
```

#### 3.2 Logs de Auditoria

```typescript
export const auditLogs = mysqlTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: int('user_id').notNull(),
  action: varchar('action', { length: 100 }).notNull(), // 'message.sent', 'campaign.started', etc
  resourceType: varchar('resource_type', { length: 50 }),
  resourceId: varchar('resource_id', { length: 100 }),
  metadata: json('metadata'), // Detalhes adicionais
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

#### 3.3 Monitoring e Alertas

- Health check endpoints (`/health`, `/ready`)
- Métricas de uso (Prometheus/Grafana ou similar)
- Alertas por email quando:
  - Conexão WhatsApp cai
  - Limite de uso atingido (80%, 100%)
  - Pagamento falha
  - Campanha completa

---

### FASE 4: Melhorias de Segurança

#### 4.1 API Keys Melhoradas

```typescript
// Adicionar campos na tabela users ou criar tabela separada
export const apiKeys = mysqlTable('api_keys', {
  id: serial('id').primaryKey(),
  userId: int('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 100 }).notNull(), // "Production", "Development"
  keyHash: varchar('key_hash', { length: 64 }).notNull(), // SHA-256 do key
  keyPrefix: varchar('key_prefix', { length: 8 }).notNull(), // Primeiros 8 chars para identificação

  // Permissões granulares
  permissions: json('permissions'), // ['messages:send', 'contacts:read', etc]

  // Restrições
  allowedIps: json('allowed_ips'), // Lista de IPs permitidos

  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});
```

#### 4.2 2FA (Two-Factor Authentication)

- Implementar TOTP (Google Authenticator)
- Obrigatório para contas com plano Enterprise
- Opcional para outros planos

---

## Checklist de Implementação

### Prioridade 1 - Lançamento MVP (Obrigatório)

- [ ] **Criar tabelas de planos e assinaturas**
  - [ ] plans
  - [ ] subscriptions
  - [ ] usage_records
  - [ ] payments

- [ ] **Implementar sistema de billing**
  - [ ] Router `billing` com endpoints básicos
  - [ ] Integração Stripe (checkout + webhooks)
  - [ ] Página de preços
  - [ ] Página de checkout

- [ ] **Implementar verificação de limites**
  - [ ] Middleware de verificação em endpoints críticos
  - [ ] Contadores de uso por período
  - [ ] Mensagens de erro amigáveis quando limite atingido

- [ ] **Rate limiting**
  - [ ] Rate limit global
  - [ ] Rate limit por API key
  - [ ] Rate limit de mensagens

- [ ] **Documentos legais**
  - [ ] Termos de Serviço
  - [ ] Política de Privacidade
  - [ ] Páginas acessíveis no frontend

- [ ] **Landing page básica**
  - [ ] Hero section
  - [ ] Features
  - [ ] Preços
  - [ ] CTA

### Prioridade 2 - Pós-Lançamento (Semanas seguintes)

- [ ] **Admin Panel Completo**
  - [ ] Dashboard com métricas (usuários, conexões, MRR, erros)
  - [ ] Gerenciamento de usuários (lista, filtros, ações)
  - [ ] Gerenciamento de assinaturas (cancelar, pausar, alterar plano)
  - [ ] Monitoramento de conexões (status, alertas)
  - [ ] Dashboard de erros (tipos, gráficos, resolução)
  - [ ] Configurações do sistema (Stripe, email, manutenção)
  - [ ] Gerenciamento de planos (criar, editar, ativar/desativar)
  - [ ] Logs de auditoria (ações admin, logs sistema)

- [ ] **Tabelas para Admin**
  - [ ] admin_logs
  - [ ] error_logs
  - [ ] system_settings

- [ ] **Onboarding melhorado**
  - [ ] Wizard de primeira configuração
  - [ ] Checklist de setup

- [ ] **Dashboard do usuário com métricas**
  - [ ] Uso vs limites
  - [ ] Gráficos de envio

- [ ] **Documentação API pública**
  - [ ] Swagger/OpenAPI
  - [ ] Exemplos de uso

### Prioridade 3 - Crescimento

- [ ] **2FA**
- [ ] **API Keys avançadas** (permissões, IPs permitidos)
- [ ] **Sistema de suporte/tickets**
- [ ] **Notificações por email**
- [ ] **Relatórios exportáveis**

---

## Estimativa de Complexidade

| Item | Complexidade | Arquivos Afetados |
|------|--------------|-------------------|
| Tabelas de billing | Baixa | schema.ts, 1 migration |
| Router billing | Média | routers.ts ou novo arquivo |
| Integração Stripe | Alta | Novo arquivo + webhooks |
| Verificação de limites | Média | Middleware + routers existentes |
| Rate limiting | Baixa | Middleware Express |
| Landing page | Média | Novo componente React |
| Termos/Privacidade | Baixa | 2 páginas estáticas |
| **Admin Panel - Dashboard** | Média | 1 página + queries agregadas |
| **Admin Panel - Usuários** | Média | 2 páginas + CRUD completo |
| **Admin Panel - Assinaturas** | Alta | 1 página + integração Stripe |
| **Admin Panel - Conexões** | Baixa | 1 página + queries existentes |
| **Admin Panel - Erros** | Média | 1 página + nova tabela |
| **Admin Panel - Configurações** | Alta | 3 páginas + lógica sistema |
| **Admin Panel - Logs** | Baixa | 1 página + queries |
| **Admin Router completo** | Alta | ~500 linhas de código |

---

## Variáveis de Ambiente Necessárias

```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Planos (IDs do Stripe)
STRIPE_PRICE_STARTER_MONTHLY=price_xxx
STRIPE_PRICE_STARTER_YEARLY=price_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_PRO_YEARLY=price_xxx
# Enterprise não tem price_id pois é sob consulta

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email@seudominio.com
SMTP_PASS=xxx
SMTP_FROM_NAME=Sistema de Mensageria
SMTP_FROM_EMAIL=noreply@seudominio.com

# Email de contato para Enterprise
ENTERPRISE_CONTACT_EMAIL=comercial@seudominio.com

# URLs
APP_URL=https://app.seudominio.com
LANDING_URL=https://seudominio.com

# Admin
ADMIN_EMAILS=admin@seudominio.com,outro@seudominio.com
```

---

## Próximos Passos Recomendados

1. **Definir planos e preços** - Decisão de negócio
2. **Criar conta Stripe** - Obter credenciais
3. **Implementar tabelas de billing** - Schema + migration
4. **Implementar verificação de limites** - Proteger recursos
5. **Criar landing page** - Primeira impressão
6. **Escrever documentos legais** - Compliance
7. **Configurar domínio e SSL** - Produção
8. **Lançar beta fechado** - Validar com usuários reais
