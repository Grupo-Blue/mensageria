# Deploy: migrations Baileys

A PR #22 (disparo em massa via Baileys) adicionou duas migrations Drizzle:

- `0009_loose_falcon` — cria as tabelas `baileys_campaigns` e
  `baileys_campaign_recipients`.
- `0010_curved_next_avengers` — adiciona as colunas de mídia em
  `baileys_campaigns` e `warmup_daily_limit` em `whatsapp_connections`.

> Por que precisa de tratamento especial? A migration pré-existente
> `0007_concerned_pestilence` tem `ALTER TABLE ADD COLUMN` não-idempotente
> que estoura em bancos onde as colunas já existem (caso de produção).
> Por isso `pnpm db:push` direto falha — e por isso temos o self-heal abaixo.

## ✨ Caminho recomendado (zero ops manual): self-heal no boot

A partir da PR #23, **o servidor aplica o schema sozinho no startup**.
Para corrigir produção, basta:

1. **Mergear a PR #23 em `master`.**
2. **Disparar o workflow de deploy de produção** (`docker-prod.yml` → "Run workflow").
3. Pronto. Na primeira inicialização do novo container, o servidor:
   - cria as tabelas baileys se não existirem,
   - adiciona as colunas que faltarem (mídia, `warmup_daily_limit`, `updated_at`),
   - loga `[ensureBaileysSchema] self-heal aplicado: N coluna(s) adicionada(s)`
     ou `[ensureBaileysSchema] schema baileys já está em ordem`.

O self-heal é **idempotente**, **não-destrutivo** (sem DROP/TRUNCATE/UPDATE) e
**não-bloqueante** (falha vira só log — o servidor sobe mesmo assim). Se por
algum motivo o self-heal falhar, o `try/catch` defensivo em
`baileysCampaigns.list` ainda evita o 500 (devolve lista vazia com log claro).

## 🛠️ Caminho manual (script ops, ainda disponível)

Se você tem acesso ao `DATABASE_URL` e prefere rodar manualmente
(local, staging, ou pra ter certeza antes de subir):

```bash
cd frontend
export DATABASE_URL='mysql://USER:PASS@HOST:3306/mensageria'
node scripts/apply-baileys-migrations.mjs
```

O script faz o mesmo que o self-heal, mais a reconciliação do
`__drizzle_migrations` (registra 0007/0008/0009/0010 — assim `pnpm db:push`
futuro vira no-op).

## Verificação pós-aplicação

1. Recarregue a página **Disparos WhatsApp** — deve carregar sem erro.
2. (Opcional) consulte o banco:
   ```sql
   SHOW TABLES LIKE 'baileys%';
   -- esperado: baileys_campaign_recipients, baileys_campaigns
   SHOW COLUMNS FROM baileys_campaigns LIKE 'media_%';
   -- esperado: media_url, media_type, media_file_name, media_mime_type
   ```

## O que cada parte garante

| Camada | O que faz | Quando ativa |
|---|---|---|
| `ensureBaileysSchema` no boot do servidor | Cria tabelas/colunas que faltarem | Toda inicialização do container |
| `try/catch` em `baileysCampaigns.list` | Devolve `[]` em vez de 500 se schema ainda não foi aplicado | Sempre — fallback de segurança |
| `scripts/apply-baileys-migrations.mjs` | Igual ao self-heal + reconcilia `__drizzle_migrations` | Manual, opcional |
