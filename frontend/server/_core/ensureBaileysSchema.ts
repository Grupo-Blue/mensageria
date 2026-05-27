/**
 * Self-heal de schema no boot do servidor: garante que as tabelas/colunas
 * Baileys existem antes de o Express começar a aceitar requisições.
 *
 * Por quê: a migration `0009_loose_falcon` (tabelas baileys) e a
 * `0010_curved_next_avengers` (colunas de mídia + warmup) podem não ter
 * sido aplicadas em produção (a 0007 pré-existente é não-idempotente e
 * faz `pnpm db:push` falhar). Em vez de exigir um passo manual no deploy,
 * o servidor aplica o que falta sozinho no startup.
 *
 * Garantias:
 *  - Idempotente (CREATE IF NOT EXISTS + check via information_schema).
 *  - Não-destrutivo (nada de DROP/TRUNCATE/UPDATE de dados existentes).
 *  - Não-bloqueante: qualquer falha é só logada — o servidor sobe mesmo
 *    assim, e o try/catch defensivo em `baileysCampaigns.list` evita 500
 *    no curto prazo até o problema ser investigado.
 *
 * As DDLs ficam inline aqui (não dependem de acesso a arquivos no runtime),
 * espelhando exatamente o `schema.ts` declarado em `frontend/drizzle/`.
 */
import mysql from "mysql2/promise";

/** CREATE TABLE de `baileys_campaign_recipients` (espelha schema.ts). */
const DDL_BAILEYS_CAMPAIGN_RECIPIENTS = `CREATE TABLE IF NOT EXISTS \`baileys_campaign_recipients\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`campaign_id\` int NOT NULL,
  \`phone_number\` varchar(20) NOT NULL,
  \`name\` varchar(255),
  \`variables\` text,
  \`status\` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
  \`sent_variant_index\` int,
  \`whatsapp_message_id\` varchar(255),
  \`error_message\` text,
  \`retry_count\` int NOT NULL DEFAULT 0,
  \`last_retry_at\` timestamp,
  \`sent_at\` timestamp,
  \`created_at\` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT \`baileys_campaign_recipients_id\` PRIMARY KEY(\`id\`)
)`;

/** CREATE TABLE de `baileys_campaigns` (espelha schema.ts — inclui updated_at + colunas de mídia). */
const DDL_BAILEYS_CAMPAIGNS = `CREATE TABLE IF NOT EXISTS \`baileys_campaigns\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`user_id\` int NOT NULL,
  \`connection_id\` int NOT NULL,
  \`name\` varchar(255) NOT NULL,
  \`description\` text,
  \`message_variants\` text NOT NULL,
  \`status\` enum('draft','scheduled','running','paused','completed','failed') NOT NULL DEFAULT 'draft',
  \`scheduled_at\` timestamp,
  \`started_at\` timestamp,
  \`completed_at\` timestamp,
  \`total_recipients\` int NOT NULL DEFAULT 0,
  \`sent_count\` int NOT NULL DEFAULT 0,
  \`failed_count\` int NOT NULL DEFAULT 0,
  \`max_retries\` int NOT NULL DEFAULT 3,
  \`retry_delay_minutes\` int NOT NULL DEFAULT 30,
  \`auto_retry_enabled\` boolean NOT NULL DEFAULT true,
  \`min_delay_seconds\` int NOT NULL DEFAULT 8,
  \`max_delay_seconds\` int NOT NULL DEFAULT 25,
  \`daily_limit\` int,
  \`media_url\` varchar(1000),
  \`media_type\` enum('image','document','audio'),
  \`media_file_name\` varchar(255),
  \`media_mime_type\` varchar(100),
  \`created_at\` timestamp NOT NULL DEFAULT (now()),
  \`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT \`baileys_campaigns_id\` PRIMARY KEY(\`id\`)
)`;

/**
 * Colunas que precisam existir mesmo em bancos onde a tabela já foi criada
 * por uma versão anterior (incompleta) da migration. MySQL 8 não tem
 * ADD COLUMN IF NOT EXISTS — é necessário consultar information_schema antes.
 */
const COLUMNS_TO_ENSURE: Array<{ table: string; column: string; type: string }> = [
  // baileys_campaigns: updated_at foi perdido no trim original do 0009
  { table: "baileys_campaigns", column: "updated_at", type: "timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP" },
  // baileys_campaigns: colunas de mídia (migration 0010)
  { table: "baileys_campaigns", column: "media_url", type: "varchar(1000)" },
  { table: "baileys_campaigns", column: "media_type", type: "enum('image','document','audio')" },
  { table: "baileys_campaigns", column: "media_file_name", type: "varchar(255)" },
  { table: "baileys_campaigns", column: "media_mime_type", type: "varchar(100)" },
  // whatsapp_connections: warmup_daily_limit (migration 0010)
  { table: "whatsapp_connections", column: "warmup_daily_limit", type: "int" },
];

interface ParsedDbUrl {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

function parseDatabaseUrl(raw: string): ParsedDbUrl {
  const u = new URL(raw);
  return {
    host: u.hostname,
    port: Number(u.port) || 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
  };
}

async function columnExists(
  conn: mysql.Connection,
  database: string,
  table: string,
  column: string,
): Promise<boolean> {
  const [rows] = (await conn.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema=? AND table_name=? AND column_name=?",
    [database, table, column],
  )) as [unknown[], unknown];
  return rows.length > 0;
}

/**
 * Aplica idempotentemente o schema Baileys ao banco apontado por DATABASE_URL.
 * Nunca lança — qualquer erro vira log. Retorna `void`.
 */
export async function ensureBaileysSchema(): Promise<void> {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.warn("[ensureBaileysSchema] DATABASE_URL não definida — pulando self-heal de schema");
    return;
  }

  let conn: mysql.Connection | null = null;
  try {
    const cfg = parseDatabaseUrl(raw);
    conn = await mysql.createConnection(cfg);

    // 1. Tabelas baileys — CREATE TABLE IF NOT EXISTS (idempotente)
    await conn.query(DDL_BAILEYS_CAMPAIGN_RECIPIENTS);
    await conn.query(DDL_BAILEYS_CAMPAIGNS);

    // 2. Colunas que talvez faltem em tabelas pré-existentes
    const added: string[] = [];
    for (const { table, column, type } of COLUMNS_TO_ENSURE) {
      if (await columnExists(conn, cfg.database, table, column)) continue;
      await conn.query(`ALTER TABLE \`${table}\` ADD \`${column}\` ${type}`);
      added.push(`${table}.${column}`);
    }

    if (added.length > 0) {
      console.warn(
        `[ensureBaileysSchema] self-heal aplicado: ${added.length} coluna(s) adicionada(s) — ${added.join(", ")}`,
      );
    } else {
      console.log("[ensureBaileysSchema] schema baileys OK (tabelas e colunas verificadas)");
    }
  } catch (error) {
    // Não impedir o boot — o servidor sobe e o try/catch em baileysCampaigns.list
    // segura o sintoma no curto prazo.
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[ensureBaileysSchema] falha no self-heal (servidor continua subindo):", msg);
  } finally {
    if (conn) {
      try {
        await conn.end();
      } catch {
        /* ignore */
      }
    }
  }
}
