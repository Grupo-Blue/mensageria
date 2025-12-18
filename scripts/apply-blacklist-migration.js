// Script to apply the blacklist migration
// Run with: node scripts/apply-blacklist-migration.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config();

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  console.log('Connecting to database...');
  
  const url = new URL(databaseUrl);
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    multipleStatements: true
  });

  console.log('Connected!');

  const sqlPath = path.join(__dirname, '../drizzle/0009_whatsapp_blacklist.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  console.log('Executing migration...');
  
  try {
    await connection.query(sql);
    console.log('Migration applied successfully!');
  } catch (error) {
    if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.message.includes('already exists')) {
      console.log('Table already exists, skipping...');
    } else {
      throw error;
    }
  }

  await connection.end();
  console.log('Done!');
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});

