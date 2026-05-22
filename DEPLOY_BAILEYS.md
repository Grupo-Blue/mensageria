# Deploy: aplicar migrations do Baileys em produção

A PR #22 (disparo em massa via Baileys) adicionou duas migrations Drizzle
que **precisam ser aplicadas manualmente** em ambientes existentes
(produção e qualquer staging que já tenha dados):

- `0009_loose_falcon` — cria as tabelas `baileys_campaigns` e
  `baileys_campaign_recipients`.
- `0010_curved_next_avengers` — adiciona as colunas de mídia em
  `baileys_campaigns` e `warmup_daily_limit` em `whatsapp_connections`.

> Por que manualmente? A infraestrutura de migrations do repo tem
> entradas pendentes pré-existentes (`0007_concerned_pestilence` tem
> `ALTER TABLE ADD COLUMN` não-idempotente que estoura em bancos onde
> as colunas já existem). Rodar `pnpm db:push` direto em produção tenta
> aplicar 0007 e falha. Por isso este script ops, que faz só o que falta
> de forma segura.

## Sintoma sem aplicar

A página **Disparos WhatsApp** ficará vazia (ou já o front mostrava 500
antes desta PR) e os logs do servidor terão:

```
[baileysCampaigns.list] Schema baileys ausente neste banco — devolvendo lista vazia.
Rode em produção: cd frontend && node scripts/apply-baileys-migrations.mjs
```

## Como aplicar

### Pré-requisitos
- Node.js 18+ na máquina que vai executar o script.
- Acesso ao banco de produção via URL no formato `mysql://USER:PASS@HOST:3306/DB`.
- Código atualizado (precisa dos arquivos em `frontend/drizzle/`).

### Passos

```bash
cd frontend

# Aponte para o banco que você quer migrar
export DATABASE_URL='mysql://USER:PASS@HOST:3306/mensageria'

# Rode o script (idempotente — pode rodar quantas vezes quiser)
node scripts/apply-baileys-migrations.mjs
```

Saída esperada (caso tudo já esteja em ordem):

```
Conectando em ...
[0009_loose_falcon] aplicando tabelas baileys...
  estado prévio: baileys_campaigns=OK, baileys_campaign_recipients=OK
  2 statement(s) executado(s) (CREATE TABLE IF NOT EXISTS — idempotente)
[0010_curved_next_avengers] verificando colunas novas...
  ✓ baileys_campaigns.media_url: já existe
  ...
[__drizzle_migrations] reconciliando...
  ✓ __drizzle_migrations: 0007_concerned_pestilence já registrada
  ...
✅ Sucesso
```

Saída no primeiro deploy (criando tudo):

```
[0009_loose_falcon] aplicando tabelas baileys...
  estado prévio: baileys_campaigns=AUSENTE, baileys_campaign_recipients=AUSENTE
  2 statement(s) executado(s) (CREATE TABLE IF NOT EXISTS — idempotente)
[0010_curved_next_avengers] verificando colunas novas...
  + baileys_campaigns.media_url: adicionando (varchar(1000))...
  + baileys_campaigns.media_type: adicionando (enum('image','document','audio'))...
  ...
[__drizzle_migrations] reconciliando...
  + __drizzle_migrations: 0009_loose_falcon registrada
  + __drizzle_migrations: 0010_curved_next_avengers registrada
✅ Sucesso
```

## O que o script faz exatamente

1. Garante que `__drizzle_migrations` existe.
2. Aplica `drizzle/0009_loose_falcon.sql` (que usa `CREATE TABLE IF NOT EXISTS`).
3. Para cada coluna nova da 0010, verifica via `information_schema` e só faz
   `ALTER TABLE ADD COLUMN` se faltar (MySQL não tem `ADD COLUMN IF NOT EXISTS`).
4. Reconcilia `__drizzle_migrations`: registra 0007, 0008, 0009 e 0010 se ainda
   não estiverem — assim `pnpm db:push` futuro vira no-op.

## Garantias

- **Idempotente:** rodar várias vezes não causa nenhum efeito além da primeira.
- **Não-destrutivo:** nenhum `DROP`, `TRUNCATE` ou `UPDATE` de dados existentes.
- **Auditável:** imprime o que encontrou e o que mudou.

## Verificação pós-aplicação

1. Recarregue a página **Disparos WhatsApp** — deve carregar sem erro.
2. (Opcional) consulte o banco:
   ```sql
   SHOW TABLES LIKE 'baileys%';
   -- esperado: baileys_campaign_recipients, baileys_campaigns
   SELECT COUNT(*) FROM `__drizzle_migrations`;
   -- esperado: 10 (ou maior se houver migrations posteriores)
   ```
