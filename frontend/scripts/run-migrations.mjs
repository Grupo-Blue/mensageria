#!/usr/bin/env node
/**
 * Entrypoint de migrations para o serviço Docker (mensageria-migration-*).
 *
 * Substitui `drizzle-kit generate && drizzle-kit migrate` em produção:
 *  - Não gera migrations novas (evita drift no deploy).
 *  - Garante que todos os .sql do journal existem (copia de drizzle/migrations/ se preciso).
 *  - Aplica cada migration com tolerância a DDL já existente (0007, 0010).
 *  - Garante colunas Baileys e reconcilia __drizzle_migrations.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DRIZZLE_DIR = path.resolve(__dirname, "..", "drizzle");
const LEGACY_MIGRATIONS_DIR = path.join(DRIZZLE_DIR, "migrations");
const JOURNAL_PATH = path.join(DRIZZLE_DIR, "meta", "_journal.json");

const COLUMNS_TO_ENSURE = [
  {
    table: "baileys_campaigns",
    column: "updated_at",
    type: "timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP",
  },
  { table: "baileys_campaigns", column: "media_url", type: "varchar(1000)" },
  { table: "baileys_campaigns", column: "media_type", type: "enum('image','document','audio')" },
  { table: "baileys_campaigns", column: "media_file_name", type: "varchar(255)" },
  { table: "baileys_campaigns", column: "media_mime_type", type: "varchar(100)" },
  { table: "whatsapp_connections", column: "warmup_daily_limit", type: "int" },
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

function loadJournal() {
  if (!fs.existsSync(JOURNAL_PATH)) {
    throw new Error(`Journal não encontrado: ${JOURNAL_PATH}`);
  }
  return JSON.parse(fs.readFileSync(JOURNAL_PATH, "utf8"));
}

/** Copia drizzle/migrations/{tag}.sql → drizzle/{tag}.sql quando o journal exige e o arquivo raiz falta. */
function syncMigrationFiles(journal) {
  const synced = [];
  for (const entry of journal.entries) {
    const target = path.join(DRIZZLE_DIR, `${entry.tag}.sql`);
    if (fs.existsSync(target)) continue;
    const legacy = path.join(LEGACY_MIGRATIONS_DIR, `${entry.tag}.sql`);
    if (fs.existsSync(legacy)) {
      fs.copyFileSync(legacy, target);
      synced.push(entry.tag);
    }
  }
  if (synced.length > 0) {
    console.log(`[sync] Arquivos restaurados em drizzle/: ${synced.join(", ")}`);
  }
  const missing = journal.entries
    .map((e) => e.tag)
    .filter((tag) => !fs.existsSync(path.join(DRIZZLE_DIR, `${tag}.sql`)));
  if (missing.length > 0) {
    throw new Error(
      `Migration(s) ausente(s) no container: ${missing.map((t) => `${t}.sql`).join(", ")}`,
    );
  }
}

function fixCreateTableIfNotExists() {
  const files = fs
    .readdirSync(DRIZZLE_DIR)
    .filter((f) => f.endsWith(".sql") && /^\d+_/.test(f));
  for (const file of files) {
    const filePath = path.join(DRIZZLE_DIR, file);
    let content = fs.readFileSync(filePath, "utf8");
    const updated = content.replace(
      /CREATE TABLE\s+(?!IF NOT EXISTS)`/g,
      "CREATE TABLE IF NOT EXISTS `",
    );
    if (updated !== content) {
      fs.writeFileSync(filePath, updated, "utf8");
      console.log(`[fix] CREATE TABLE IF NOT EXISTS aplicado em ${file}`);
    }
  }
}

function splitStatements(sql) {
  return sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isIgnorableSqlError(err) {
  const code = err?.code;
  const errno = err?.errno;
  const msg = String(err?.sqlMessage ?? err?.message ?? "").toLowerCase();
  if (code === "ER_TABLE_EXISTS_ERROR" || errno === 1050) return true;
  if (code === "ER_DUP_FIELDNAME" || errno === 1060) return true;
  if (code === "ER_DUP_KEYNAME" || errno === 1061) return true;
  if (code === "ER_DUP_ENTRY" || errno === 1062) return true;
  if (msg.includes("duplicate column")) return true;
  if (msg.includes("duplicate key name")) return true;
  if (msg.includes("already exists")) return true;
  return false;
}

async function ensureDrizzleMigrationsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`__drizzle_migrations\` (
      id int AUTO_INCREMENT PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint NOT NULL
    )
  `);
}

async function isMigrationApplied(conn, when) {
  const [rows] = await conn.query(
    "SELECT 1 FROM `__drizzle_migrations` WHERE created_at = ? LIMIT 1",
    [when],
  );
  return rows.length > 0;
}

async function registerMigration(conn, hash, when) {
  await conn.query("INSERT INTO `__drizzle_migrations` (hash, created_at) VALUES (?, ?)", [
    hash,
    when,
  ]);
}

async function applyMigrationFile(conn, tag) {
  const filePath = path.join(DRIZZLE_DIR, `${tag}.sql`);
  const sql = fs.readFileSync(filePath, "utf8");
  const statements = splitStatements(sql);
  let applied = 0;
  let skipped = 0;
  for (const stmt of statements) {
    try {
      await conn.query(stmt);
      applied++;
    } catch (err) {
      if (isIgnorableSqlError(err)) {
        skipped++;
        console.log(`  [skip] ${tag}: ${err.sqlMessage ?? err.message}`);
        continue;
      }
      throw err;
    }
  }
  return { applied, skipped, statements: statements.length };
}

async function columnExists(conn, database, table, column) {
  const [rows] = await conn.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema=? AND table_name=? AND column_name=?",
    [database, table, column],
  );
  return rows.length > 0;
}

async function ensureExtraColumns(conn, database) {
  const added = [];
  for (const { table, column, type } of COLUMNS_TO_ENSURE) {
    if (await columnExists(conn, database, table, column)) continue;
    await conn.query(`ALTER TABLE \`${table}\` ADD \`${column}\` ${type}`);
    added.push(`${table}.${column}`);
  }
  return added;
}

async function main() {
  console.log("🚀 Mensageria — aplicando migrations (run-migrations.mjs)\n");

  const journal = loadJournal();
  syncMigrationFiles(journal);
  fixCreateTableIfNotExists();

  const cfg = parseDatabaseUrl(process.env.DATABASE_URL);
  console.log(`📡 Banco: ${cfg.host}:${cfg.port}/${cfg.database}\n`);

  const conn = await mysql.createConnection(cfg);
  try {
    await ensureDrizzleMigrationsTable(conn);

    for (const entry of journal.entries) {
      const tag = entry.tag;
      const when = entry.when;
      const filePath = path.join(DRIZZLE_DIR, `${tag}.sql`);
      const hash = crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

      if (await isMigrationApplied(conn, when)) {
        console.log(`⏭️  ${tag}: já aplicada (journal when=${when})`);
        continue;
      }

      console.log(`▶️  ${tag}: aplicando...`);
      const result = await applyMigrationFile(conn, tag);
      await registerMigration(conn, hash, when);
      console.log(
        `✅ ${tag}: registrada (${result.applied} stmt ok, ${result.skipped} ignorado(s), ${result.statements} total)`,
      );
    }

    console.log("\n🔧 Verificando colunas Baileys / mídia / warmup...");
    const added = await ensureExtraColumns(conn, cfg.database);
    if (added.length > 0) {
      console.log(`✅ Colunas adicionadas: ${added.join(", ")}`);
    } else {
      console.log("✅ Colunas extras já existem");
    }

    const [tables] = await conn.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema=? AND table_name LIKE 'baileys%' ORDER BY table_name",
      [cfg.database],
    );
    const names = tables.map((r) => r.TABLE_NAME ?? r.table_name);
    console.log(`\n📋 Tabelas baileys: [${names.join(", ") || "nenhuma"}]`);

    const [migCount] = await conn.query("SELECT COUNT(*) AS n FROM `__drizzle_migrations`");
    console.log(`📋 __drizzle_migrations: ${migCount[0].n} registro(s)`);
    console.log("\n✅ Migrations concluídas com sucesso");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("\n❌ Falha nas migrations:", err.message);
  if (err.code) console.error(`   código: ${err.code}`);
  if (err.sqlMessage) console.error(`   sql: ${err.sqlMessage}`);
  process.exit(1);
});
