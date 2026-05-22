# Migrations legadas (arquivadas)

Estes arquivos `.sql` **não fazem parte** do histórico de migrations rastreado pelo
Drizzle (`drizzle/meta/_journal.json`). São de esquemas de numeração antigos, criados
antes da padronização do fluxo atual, e ficavam soltos em `drizzle/` e na antiga
pasta `drizzle/migrations/`, causando confusão (ex.: dois arquivos `0009_*`).

As tabelas/colunas que eles criavam **já estão presentes** no banco e cobertas pelas
migrations oficiais `0000`–`0009` em `drizzle/`. Foram mantidos aqui apenas como
referência histórica — **não são executados** pelo `drizzle-kit migrate` nem pelo
`pnpm db:push`.

O fluxo oficial de migrations usa exclusivamente os arquivos `drizzle/NNNN_*.sql`
listados em `drizzle/meta/_journal.json`.
