# Migrations e banco de dados

Fluxo **obrigatório** para qualquer tarefa que crie ou altere tabelas/colunas no MySQL.

## Localização oficial

| Item | Caminho |
|------|---------|
| Schema Drizzle | `frontend/drizzle/schema.ts` |
| Relações | `frontend/drizzle/relations.ts` |
| Config Drizzle Kit | `frontend/drizzle.config.ts` |
| Migrations SQL | `frontend/drizzle/NNNN_nome.sql` |
| Journal | `frontend/drizzle/meta/_journal.json` |
| Scripts de apply | `frontend/scripts/run-migrations.mjs`, `migrate-safe.sh` |

> A pasta `frontend/drizzle/_legacy_migrations/` é **arquivo histórico** — não faz parte do journal e **não deve** receber migrations novas.

## Fluxo de desenvolvimento

### 1. Alterar o schema

```typescript
// frontend/drizzle/schema.ts
export const minhaTabela = mysqlTable("minha_tabela", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

- Exportar tipos `Insert*` / inferidos se o padrão do arquivo exigir.
- Atualizar `relations.ts` quando houver FKs ou relações Drizzle.

### 2. Gerar a migration

No diretório `frontend/`:

```bash
# Requer DATABASE_URL no ambiente
pnpm db:push:direct
# equivale a: drizzle-kit generate && drizzle-kit migrate
```

Isso gera o `.sql` em `frontend/drizzle/` e atualiza `meta/_journal.json`.

### 3. Verificar arquivos

```bash
cd frontend
pnpm db:verify-migrations
```

Falha se algum arquivo listado no journal estiver ausente.

### 4. Aplicar (local / Docker)

```bash
cd frontend
pnpm db:push          # migrate-safe: verify + run-migrations.mjs
# ou
pnpm db:migrate       # apenas run-migrations.mjs
```

No Docker Compose da raiz, o serviço `drizzle-migrations` roda antes do frontend.

### 5. Usar no código

- Importar tabelas de `../drizzle/schema` (ou caminho relativo correto).
- Adicionar funções em `frontend/server/db.ts`.
- Expor via tRPC em `routers.ts` ou `server/routers/<nome>.ts`.

## O que é proibido

| Proibido | Motivo |
|----------|--------|
| `CREATE TABLE` manual no banco sem migration | Drift entre ambientes |
| Alterar colunas só em `db.ts` ou SQL inline | Schema e código divergem |
| Novas migrations em `_legacy_migrations/` | Fora do journal Drizzle |
| `drizzle-kit generate` em produção/deploy | Gera drift; deploy só **aplica** journal existente |
| Concluir tarefa sem `.sql` no journal | Produção não recebe a mudança |

## Checklist obrigatório (agentes de IA)

Antes de marcar uma tarefa com impacto em banco como **concluída**:

```
[ ] Identifiquei todas as tabelas/colunas novas ou alteradas
[ ] Atualizei frontend/drizzle/schema.ts (e relations.ts se necessário)
[ ] Executei ou orientei geração via pnpm db:push:direct (em frontend/)
[ ] Existe arquivo frontend/drizzle/NNNN_*.sql correspondente
[ ] Journal frontend/drizzle/meta/_journal.json inclui a nova entrada
[ ] pnpm db:verify-migrations passaria (arquivos presentes)
[ ] Atualizei frontend/server/db.ts e routers afetados
[ ] Não criei DDL paralelo (exceto padrão ensureBaileysSchema já existente para recovery)
```

Se não for possível rodar comandos (sem `DATABASE_URL`), **documente** na resposta o que o usuário deve executar e **não** afirme que migrations estão aplicadas.

## Comandos úteis

| Comando | Onde | Função |
|---------|------|--------|
| `pnpm db:push:direct` | `frontend/` | Gera + aplica migration (dev) |
| `pnpm db:push` | `frontend/` | Verify + apply (script seguro) |
| `pnpm db:migrate` | `frontend/` | Apenas apply |
| `pnpm db:verify-migrations` | `frontend/` | Valida journal vs arquivos `.sql` |

## Deploy

- Imagem `Dockerfile.drizzle` / serviço `drizzle-migrations`: **só aplica** migrations versionadas.
- `run-migrations.mjs` é idempotente e tolera DDL já existente em migrations antigas.
- Self-heal em `ensureBaileysSchema.ts` é fallback de produção, **não** o caminho para features novas.

## Exemplo completo

1. Adicionar `baileys_foo` em `schema.ts`.
2. `cd frontend && pnpm db:push:direct`
3. Confirmar `frontend/drizzle/0011_*.sql` e entrada no journal.
4. `pnpm db:verify-migrations`
5. Implementar `getBaileysFoo` / `createBaileysFoo` em `db.ts`.
6. Expor procedure em `routers.ts`.
