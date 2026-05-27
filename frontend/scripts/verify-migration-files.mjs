#!/usr/bin/env node
/**
 * Falha o build da imagem de migration se algum arquivo do journal
 * não existir em drizzle/*.sql (evita deploy com 0008 ausente no container).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRIZZLE_DIR = path.resolve(__dirname, "..", "drizzle");
const JOURNAL_PATH = path.join(DRIZZLE_DIR, "meta", "_journal.json");

function main() {
  if (!fs.existsSync(JOURNAL_PATH)) {
    console.error(`❌ Journal não encontrado: ${JOURNAL_PATH}`);
    process.exit(1);
  }
  const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, "utf8"));
  const missing = [];
  for (const entry of journal.entries) {
    const filePath = path.join(DRIZZLE_DIR, `${entry.tag}.sql`);
    if (!fs.existsSync(filePath)) {
      missing.push(entry.tag);
    }
  }
  if (missing.length > 0) {
    console.error("❌ Migrations ausentes em drizzle/ (journal exige estes arquivos):");
    for (const tag of missing) {
      console.error(`   - ${tag}.sql`);
    }
    process.exit(1);
  }
  console.log(`✅ ${journal.entries.length} migration(s) presentes em ${DRIZZLE_DIR}`);
}

main();
