#!/usr/bin/env node
/**
 * Script ops idempotente para aplicar as migrations Baileys (0009 + 0010)
 * em qualquer ambiente — local, staging ou produção.
 *
 * O que faz:
 *  1. Garante a existência de `__drizzle_migrations`.
 *  2. Aplica `drizzle/0009_loose_falcon.sql` (tabelas baileys) — o arquivo
 *     usa CREATE TABLE IF NOT EXISTS, é seguro reaplicar.
 *  3. Para cada coluna nova da `0010_curved_next_avengers` (mídia em
 *     baileys_campaigns + warmupDailyLimit em whatsapp_connections),
 *     verifica em information_schema e só faz ALTER ADD COLUMN se faltar
 *     (MySQL não tem ADD COLUMN IF NOT EXISTS).
 *  4. Reconcilia `__drizzle_migrations`: registra 0007/0008/0009/0010 se
 *     ainda não estiverem. Assim `pnpm db:push` futuro vira no-op.
 *
 * Não é destrutivo: nada é dropado, nada é truncado, nada é renomeado.
 *
 * Uso:
 *   cd frontend
 *   export DATABASE_URL='mysql://USER:PASS@HOST:3306/DB'
 *   node scripts/apply-baileys-migrations.mjs
 *
 * Códigos de saída:
 *   0 = sucesso (mesmo que nada tenha sido alterado)
 *   1 = erro
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DRIZZLE_DIR = path.resolve(__dirname, "..", "drizzle");
const JOURNAL_PATH = path.join(DRIZZLE_DIR, "meta", "_journal.json");

// Colunas que precisam existir — checadas e adicionadas individualmente
// (MySQL 8 não suporta ALTER TABLE ADD COLUMN IF NOT EXISTS). Inclui:
//  - updated_at em baileys_campaigns (faltou no trim do 0009)
//  - colunas de mídia da 0010_curved_next_avengers
//  - warmup_daily_limit em whatsapp_connections (também da 0010)
const COLUMNS_TO_ENSURE = [
  { table: "baileys_campaigns", column: "updated_at", type: "timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP" },
  { table: "baileys_campaigns", column: "media_url", type: "varchar(1000)" },
  { table: "baileys_campaigns", column: "media_type", type: "enum('image','document','audio')" },
  { table: "baileys_campaigns", column: "media_file_name", type: "varchar(255)" },
  { table: "baileys_campaigns", column: "media_mime_type", type: "varchar(100)" },
  { table: "whatsapp_connections", column: "warmup_daily_limit", type: "int" },
];

// Migrations a serem reconciliadas em __drizzle_migrations.
const TARGET_MIGRATIONS = [
  "0007_concerned_pestilence",
  "0008_seed_planos_gtm",
  "0009_loose_falcon",
  "0010_curved_next_avengers",
];

function parseDatabaseUrl(raw) {
  if (!raw) throw new Error("DATABASE_URL não está definida no ambiente");
  const u = new URL(raw);
  return {
    host: u.hostname,
    port: Number(u.port) || 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
  };
}

async function ensureDrizzleMigrationsTable(c) {
  await c.query(`
    CREATE TABLE IF NOT EXISTS \`__drizzle_migrations\` (
      id int AUTO_INCREMENT PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint NOT NULL
    )
  `);
}

async function applyMigrationFile(c, filename) {
  const filePath = path.join(DRIZZLE_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo de migration não encontrado: ${filePath}`);
  }
  const sql = fs.readFileSync(filePath, "utf8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await c.query(stmt);
  }
  return statements.length;
}

async function columnExists(c, db, table, column) {
  const [rows] = await c.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema=? AND table_name=? AND column_name=?",
    [db, table, column],
  );
  return rows.length > 0;
}

async function tableExists(c, db, table) {
  const [rows] = await c.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema=? AND table_name=?",
    [db, table],
  );
  return rows.length > 0;
}

async function reconcileDrizzleMigrations(c) {
  if (!fs.existsSync(JOURNAL_PATH)) {
    console.warn(`! Journal não encontrado em ${JOURNAL_PATH} — pulando reconciliação`);
    return;
  }
  const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, "utf8"));
  const [existing] = await c.query("SELECT created_at FROM `__drizzle_migrations`");
  const existingWhens = new Set(existing.map((r) => String(r.created_at)));

  for (const tag of TARGET_MIGRATIONS) {
    const entry = journal.entries.find((e) => e.tag === tag);
    if (!entry) {
      console.warn(`  ! Journal sem entrada para ${tag} — pulando`);
      continue;
    }
    if (existingWhens.has(String(entry.when))) {
      console.log(`  ✓ __drizzle_migrations: ${tag} já registrada`);
      continue;
    }
    const sqlPath = path.join(DRIZZLE_DIR, `${tag}.sql`);
    if (!fs.existsSync(sqlPath)) {
      console.warn(`  ! ${tag}.sql não encontrado — pulando reconciliação`);
      continue;
    }
    const hash = crypto.createHash("sha256").update(fs.readFileSync(sqlPath)).digest("hex");
    await c.query("INSERT INTO `__drizzle_migrations` (hash, created_at) VALUES (?, ?)", [
      hash,
      entry.when,
    ]);
    console.log(`  + __drizzle_migrations: ${tag} registrada`);
  }
}

async function main() {
  const cfg = parseDatabaseUrl(process.env.DATABASE_URL);
  console.log(`Conectando em ${cfg.host}:${cfg.port}/${cfg.database} como ${cfg.user}...`);
  const c = await mysql.createConnection(cfg);
  try {
    // 0. Garante __drizzle_migrations
    await ensureDrizzleMigrationsTable(c);

    // 1. Aplica 0009_loose_falcon — todas as DDLs do arquivo usam CREATE TABLE IF NOT EXISTS
    console.log("\n[0009_loose_falcon] aplicando tabelas baileys...");
    const before9 = await Promise.all([
      tableExists(c, cfg.database, "baileys_campaigns"),
      tableExists(c, cfg.database, "baileys_campaign_recipients"),
    ]);
    console.log(
      `  estado prévio: baileys_campaigns=${before9[0] ? "OK" : "AUSENTE"}, baileys_campaign_recipients=${before9[1] ? "OK" : "AUSENTE"}`,
    );
    const n9 = await applyMigrationFile(c, "0009_loose_falcon.sql");
    console.log(`  ${n9} statement(s) executado(s) (CREATE TABLE IF NOT EXISTS — idempotente)`);

    // 2. Garante colunas que precisam existir (updated_at + 0010)
    console.log("\n[colunas baileys] verificando...");
    let added = 0;
    for (const { table, column, type } of COLUMNS_TO_ENSURE) {
      const exists = await columnExists(c, cfg.database, table, column);
      if (exists) {
        console.log(`  ✓ ${table}.${column}: já existe`);
        continue;
      }
      console.log(`  + ${table}.${column}: adicionando (${type})...`);
      await c.query(`ALTER TABLE \`${table}\` ADD \`${column}\` ${type}`);
      added++;
    }
    console.log(`  ${added} coluna(s) adicionada(s)`);

    // 3. Reconcilia __drizzle_migrations
    console.log("\n[__drizzle_migrations] reconciliando...");
    await reconcileDrizzleMigrations(c);

    // 4. Verificação final
    console.log("\n=== Verificação final ===");
    const [tables] = await c.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema=? AND table_name LIKE 'baileys%' ORDER BY table_name",
      [cfg.database],
    );
    console.log(
      `Tabelas baileys: [${tables.map((r) => r.TABLE_NAME || r.table_name).join(", ") || "NENHUMA"}]`,
    );
    const [migs] = await c.query("SELECT COUNT(*) n FROM `__drizzle_migrations`");
    console.log(`__drizzle_migrations: ${migs[0].n} linhas`);

    console.log("\n✅ Sucesso");
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error("\n❌ FALHA:", e.message);
  if (e.code) console.error(`   código: ${e.code}`);
  if (e.sqlMessage) console.error(`   sqlMessage: ${e.sqlMessage}`);
  process.exit(1);
});
