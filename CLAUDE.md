# Regras de Projeto — Sistema de Mensageria

> Documentação completa: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Migrations: [docs/DATABASE-MIGRATIONS.md](docs/DATABASE-MIGRATIONS.md) · Agentes: [AGENTS.md](AGENTS.md)

## Checklist antes de concluir qualquer tarefa

### Tarefa geral

- [ ] Código em `frontend/` ou `backend/` conforme a responsabilidade (nunca misturar)
- [ ] Sem comentários TODO; implementação completa
- [ ] TypeScript com tipos explícitos; evitar `any`

### Tarefa que envolve banco de dados (OBRIGATÓRIO)

Não marcar como concluída sem verificar **todos** os itens:

- [ ] `frontend/drizzle/schema.ts` (e `relations.ts` se aplicável) atualizado
- [ ] Migration SQL em `frontend/drizzle/NNNN_*.sql` gerada e listada em `frontend/drizzle/meta/_journal.json`
- [ ] `pnpm db:verify-migrations` executado em `frontend/` (ou instruções explícitas ao usuário)
- [ ] `frontend/server/db.ts` e routers tRPC atualizados
- [ ] **Não** criar tabelas só via SQL manual, `_legacy_migrations/` ou DDL solto

Se não puder executar migrations (sem `DATABASE_URL`), documente os comandos e **não** afirme que o banco está atualizado.

---

## Arquitetura do Projeto

### Estrutura de Diretórios Obrigatória

```
/
├── frontend/                    # App React + Express/tRPC + Drizzle
│   ├── client/                  # Aplicação React (Vite)
│   ├── server/                  # Servidor Express com tRPC
│   ├── shared/                  # Código compartilhado TypeScript
│   └── drizzle/                 # Schema e migrations do banco
│       ├── schema.ts
│       ├── relations.ts
│       ├── meta/_journal.json
│       └── NNNN_*.sql
│
├── backend/                     # Backend Docker (Baileys, Telegram)
│   ├── Dockerfile
│   └── …                        # Sem schema Drizzle aqui
│
└── docs/                        # ARCHITECTURE.md, DATABASE-MIGRATIONS.md
```

**IMPORTANTE:**

- ✅ **SEMPRE** manter separação entre `frontend/` e `backend/`
- ✅ **NUNCA** misturar código do frontend no backend ou vice-versa
- ✅ Banco de dados e migrations ficam **somente** em `frontend/drizzle/`

## Migrations e Banco de Dados

### Regra obrigatória: toda alteração de schema tem migration

1. **Definir no Schema Drizzle** — `frontend/drizzle/schema.ts` (+ `relations.ts`)
2. **Gerar migration** — em `frontend/`: `pnpm db:push:direct`
3. **Verificar** — `pnpm db:verify-migrations`
4. **Usar no código** — `frontend/server/db.ts`, routers tRPC

**NUNCA:**

- ❌ Criar tabelas diretamente no banco sem migration versionada
- ❌ Modificar schema só em código sem atualizar `schema.ts`
- ❌ Adicionar SQL em `drizzle/_legacy_migrations/` (arquivo histórico)
- ❌ Concluir a tarefa sem `.sql` no journal

### Comandos (diretório `frontend/`)

| Comando | Uso |
|---------|-----|
| `pnpm db:push:direct` | Gerar + aplicar (desenvolvimento) |
| `pnpm db:verify-migrations` | Validar journal vs arquivos |
| `pnpm db:push` | Apply via script seguro (Docker) |

Detalhes: [docs/DATABASE-MIGRATIONS.md](docs/DATABASE-MIGRATIONS.md)

### Exemplo

```typescript
// 1. frontend/drizzle/schema.ts
export const minhaNovaTabela = mysqlTable("minha_nova_tabela", { … });

// 2. cd frontend && pnpm db:push:direct

// 3. frontend/server/db.ts + routers
```

> `frontend/server/_core/ensureBaileysSchema.ts` é fallback de produção (self-heal). **Novas features** devem usar o fluxo Drizzle acima.

## Convenções de Código

### TypeScript

- ✅ TypeScript em todo o código; tipos explícitos
- ❌ `any` sem justificativa

### API (tRPC)

- Routers: `frontend/server/routers/` ou `routers.ts`
- `protectedProcedure` para rotas autenticadas
- Validar inputs com Zod

### Banco

- Drizzle ORM; transações para operações multi-tabela
- SQL raw apenas quando necessário

### Comentários

- ❌ Nunca deixar TODOs
- ✅ Completar toda a tarefa antes de finalizar

## Docker e Deploy

- Dockerfiles separados: `frontend/`, `backend/`
- `docker-compose.yml` na raiz: mysql → drizzle-migrations → frontend/backend
- Secrets via variáveis de ambiente

## Testes e Segurança

- Testes (Vitest) para funcionalidades críticas
- Validar inputs; autenticação em endpoints protegidos
- Não expor secrets em logs

## Resumo das regras críticas

1. **Arquitetura:** `frontend/` vs `backend/` — ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
2. **Migrations:** checklist obrigatório antes de concluir tarefas com DB
3. **Código:** sem TODOs; tarefa completa
4. **TypeScript:** tipos explícitos
5. **Segurança:** validação e auth adequados
