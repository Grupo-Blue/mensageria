# Migrations legadas (arquivadas)

Estes arquivos `.sql` **não fazem parte** do histórico de migrations rastreado pelo
Drizzle (`drizzle/meta/_journal.json`). São de esquemas de numeração antigos, criados
antes da padronização do fluxo atual, e ficavam soltos em `drizzle/`.

A pasta `drizzle/migrations/` mantém apenas cópias de fallback (ex.: `0008_seed_planos_gtm.sql`)
usadas pelo `scripts/run-migrations.mjs` se o arquivo raiz estiver ausente no container.
Os arquivos oficiais ficam em `drizzle/NNNN_*.sql` conforme `meta/_journal.json`.

As tabelas/colunas que eles criavam **já estão presentes** no banco e cobertas pelas
migrations oficiais `0000`–`0009` em `drizzle/`. Foram mantidos aqui apenas como
referência histórica — **não são executados** pelo `drizzle-kit migrate` nem pelo
`pnpm db:push`.

O fluxo oficial de migrations usa exclusivamente os arquivos `drizzle/NNNN_*.sql`
listados em `drizzle/meta/_journal.json`.
