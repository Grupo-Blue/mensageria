# Instruções para agentes de IA

Este arquivo orienta **Cursor**, **Claude Code** e outros assistentes que editam este repositório.

## Leitura obrigatória

| Documento | Conteúdo |
|-----------|----------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Estrutura do monorepo, onde colocar cada tipo de código |
| [docs/DATABASE-MIGRATIONS.md](docs/DATABASE-MIGRATIONS.md) | Fluxo Drizzle, comandos, checklist de migrations |
| [CLAUDE.md](CLAUDE.md) | Regras resumidas (Claude Code lê na raiz) |
| [.cursor/rules/](.cursor/rules/) | Regras Cursor (`architecture`, `database-migrations`) |

## Regras críticas

1. **Arquitetura:** `frontend/` = app + API + banco; `backend/` = Baileys/Telegram Docker. Nunca misturar.
2. **Migrations:** Toda mudança de schema passa por `frontend/drizzle/` + journal. Ver checklist em `docs/DATABASE-MIGRATIONS.md`.
3. **Conclusão:** Não encerrar tarefas com impacto em DB sem validar schema, `.sql` e journal.
4. **Qualidade:** TypeScript tipado, sem TODOs, tarefa completa.

## Checklist antes de encerrar

### Sempre

- [ ] Arquivos no diretório correto (`frontend/` vs `backend/`)
- [ ] Sem TODOs ou código pela metade

### Se a tarefa envolve banco de dados

- [ ] `frontend/drizzle/schema.ts` atualizado
- [ ] Migration `frontend/drizzle/NNNN_*.sql` gerada e no journal
- [ ] `pnpm db:verify-migrations` (em `frontend/`) — ou instruções claras ao usuário
- [ ] `frontend/server/db.ts` e routers atualizados

## Comandos (executar em `frontend/`)

```bash
pnpm db:push:direct      # gerar + aplicar migration (dev)
pnpm db:verify-migrations # validar journal
pnpm db:push              # apply seguro (Docker/local)
```

## Cursor

Regras em `.cursor/rules/*.mdc` com `alwaysApply: true` reforçam arquitetura e migrations.

## Claude Code

Usa [CLAUDE.md](CLAUDE.md) na raiz do projeto automaticamente.
