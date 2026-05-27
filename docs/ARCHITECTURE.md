# Arquitetura — Sistema de Mensageria

Documento de referência para desenvolvedores e agentes de IA (Cursor, Claude Code, etc.).

## Visão geral

Monorepo com dois serviços principais:

| Camada | Pasta | Responsabilidade |
|--------|--------|------------------|
| **Frontend (app)** | `frontend/` | React (UI), Express + tRPC (API), Drizzle ORM, migrations MySQL |
| **Backend (WhatsApp/Telegram)** | `backend/` | Serviço Docker com Baileys, Telegram, filas, Socket.IO |

O **banco de dados MySQL** é acessado pelo `frontend/server`. O `backend/` comunica-se com o frontend via HTTP (`BACKEND_API_URL`).

```
┌─────────────────┐     HTTP/tRPC      ┌──────────────────────────────┐
│  browser        │ ◄────────────────► │  frontend/                   │
│  (React)        │                    │  client/  → UI                 │
└─────────────────┘                    │  server/  → Express + tRPC     │
                                       │  drizzle/ → schema + migrations│
                                       └──────────────┬───────────────┘
                                                      │ MySQL
                                                      ▼
                                       ┌──────────────────────────────┐
                                       │  mysql                       │
                                       └──────────────────────────────┘
┌─────────────────┐     HTTP           ┌──────────────────────────────┐
│  WhatsApp Web   │ ◄────────────────► │  backend/ (Baileys, etc.)    │
└─────────────────┘                    └──────────────────────────────┘
```

## Estrutura de diretórios

```
/
├── frontend/                    # Aplicação principal (OBRIGATÓRIO para UI + API + DB)
│   ├── client/                  # React + Vite
│   │   └── src/
│   │       ├── pages/           # Páginas da aplicação
│   │       ├── components/      # Componentes UI (shadcn)
│   │       └── lib/trpc.ts      # Cliente tRPC
│   ├── server/                  # Servidor Express
│   │   ├── _core/               # Bootstrap, tRPC, auth, env
│   │   ├── routers/             # Routers tRPC modulares (billing, admin, …)
│   │   ├── routers.ts           # Router raiz `appRouter`
│   │   ├── db.ts                # Funções de acesso ao banco (Drizzle)
│   │   ├── baileysCampaign/     # Campanhas WhatsApp (Baileys)
│   │   └── whatsappBusiness/    # Campanhas Meta / WhatsApp Business API
│   ├── shared/                  # Constantes e tipos compartilhados client ↔ server
│   ├── drizzle/                 # Schema Drizzle + migrations SQL
│   │   ├── schema.ts
│   │   ├── relations.ts
│   │   ├── meta/_journal.json   # Journal oficial das migrations
│   │   └── NNNN_*.sql           # Arquivos de migration versionados
│   └── scripts/                 # migrate-safe.sh, run-migrations.mjs, …
│
├── backend/                     # Serviço Docker (Baileys / Telegram)
│   ├── Dockerfile
│   └── docker-compose.yml       # Compose isolado do backend (opcional)
│
├── docker-compose.yml           # Stack completa (frontend + backend + mysql + migrations)
└── docs/                        # Documentação (este arquivo, migrations, …)
```

### Regras de separação

- **Nunca** colocar código React em `backend/`.
- **Nunca** colocar lógica de Baileys/Telegram em `frontend/client/`.
- Queries SQL e schema ficam em `frontend/` (`server/db.ts`, `drizzle/`).
- O backend expõe APIs REST/Socket; o frontend consome via `BACKEND_API_URL`.

## Stack técnica

| Área | Tecnologia |
|------|------------|
| UI | React, Vite, Tailwind, shadcn/ui |
| API | Express, tRPC, Zod |
| ORM | Drizzle ORM (MySQL) |
| Auth | Cookies de sessão, OAuth/OIDC opcional |
| Testes (frontend) | Vitest |
| Backend service | Node 20+, Baileys, BullMQ, Socket.IO |

## Padrões de código

### tRPC

- Router raiz: `frontend/server/routers.ts` (`appRouter`).
- Routers novos ou grandes: `frontend/server/routers/<nome>.ts`.
- Endpoints autenticados: `protectedProcedure`.
- Inputs: validar com **Zod**.
- Rotas HTTP REST adicionais: prefixo `/api/` (registrar em `server/_core/index.ts`).

### Banco de dados

- Schema: `frontend/drizzle/schema.ts` e `relations.ts`.
- Acesso: `frontend/server/db.ts` (funções exportadas, Drizzle query builder).
- **Não** usar SQL raw salvo necessidade justificada.
- Operações multi-tabela: transações Drizzle.

### Frontend React

- Páginas em `client/src/pages/`.
- Chamadas à API via `trpc` (`client/src/lib/trpc.ts`).
- Componentes reutilizáveis em `client/src/components/`.

### Backend Docker

- Variáveis em `backend/.env` (ver `backend/README.md`).
- Build/deploy via `backend/Dockerfile` e `docker-compose.yml` na raiz.

## Comunicação entre serviços

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | MySQL — apenas no frontend/migrations |
| `BACKEND_API_URL` | URL do serviço Baileys (server → backend) |
| `CLIENT_BACKEND_URL` | URL que o browser usa para Socket.IO |
| `INTERNAL_SYNC_TOKEN` | Autenticação entre frontend e backend |

## Docker Compose (desenvolvimento local)

Serviços na raiz (`docker-compose.yml`):

1. **mysql** — banco `mensageria`
2. **drizzle-migrations** — aplica migrations antes do frontend subir
3. **mensageria-frontend** — app na porta 3000
4. **mensageria-backend** — Baileys na porta 5600 (host) → 3333 (container)

## Exceção documentada: self-heal no boot

`frontend/server/_core/ensureBaileysSchema.ts` aplica DDL idempotente no startup para recuperação em produção.

**Isso não substitui migrations.** Novas tabelas/colunas devem sempre passar pelo fluxo Drizzle descrito em [DATABASE-MIGRATIONS.md](./DATABASE-MIGRATIONS.md).

## Checklist rápido antes de concluir uma tarefa

### Qualquer alteração de código

- [ ] Código no diretório correto (`frontend/` vs `backend/`)
- [ ] Sem comentários TODO / código incompleto
- [ ] TypeScript sem `any` desnecessário

### Tarefa que toca banco de dados

- [ ] Schema atualizado em `frontend/drizzle/schema.ts` (+ `relations.ts` se aplicável)
- [ ] Migration SQL gerada e presente em `frontend/drizzle/`
- [ ] Entrada no `frontend/drizzle/meta/_journal.json` consistente
- [ ] `pnpm db:verify-migrations` OK (dentro de `frontend/`)
- [ ] Tipos/imports em `db.ts` e routers atualizados

Ver detalhes em [DATABASE-MIGRATIONS.md](./DATABASE-MIGRATIONS.md).

## Referências

- Migrations: [docs/DATABASE-MIGRATIONS.md](./DATABASE-MIGRATIONS.md)
- Regras Claude Code: [CLAUDE.md](../CLAUDE.md)
- Regras Cursor: [.cursor/rules/](../.cursor/rules/)
- Instruções gerais para agentes: [AGENTS.md](../AGENTS.md)
