#!/usr/bin/env node

/**
 * Script para corrigir migrations do Drizzle que tentam criar tabelas que já existem
 * Adiciona IF NOT EXISTS ou verifica se a tabela existe antes de criar
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const drizzleDir = path.join(__dirname, '../drizzle');

// Lista de migrations para verificar
const migrationFiles = fs.readdirSync(drizzleDir)
  .filter(file => file.endsWith('.sql') && file.match(/^\d+_/))
  .sort();

console.log('🔍 Verificando migrations...\n');

migrationFiles.forEach(file => {
  const filePath = path.join(drizzleDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Substituir CREATE TABLE por CREATE TABLE IF NOT EXISTS
  const createTableRegex = /CREATE TABLE\s+`([^`]+)`/g;
  const matches = [...content.matchAll(createTableRegex)];
  
  matches.forEach(match => {
    const tableName = match[1];
    const fullMatch = match[0];
    
    // Se não tem IF NOT EXISTS, adicionar
    if (!content.includes(`CREATE TABLE IF NOT EXISTS \`${tableName}\``)) {
      content = content.replace(
        fullMatch,
        `CREATE TABLE IF NOT EXISTS \`${tableName}\``
      );
      modified = true;
      console.log(`✅ Corrigido: ${file} - Tabela: ${tableName}`);
    }
  });

  // Substituir CREATE INDEX por CREATE INDEX IF NOT EXISTS (MySQL não suporta, então usar DROP IF EXISTS antes)
  const createIndexRegex = /CREATE INDEX\s+`([^`]+)`/g;
  const indexMatches = [...content.matchAll(createIndexRegex)];
  
  indexMatches.forEach(match => {
    const indexName = match[1];
    const fullMatch = match[0];
    
    // MySQL não suporta CREATE INDEX IF NOT EXISTS, então vamos comentar índices duplicados
    // Mas vamos deixar como está por enquanto, pois o erro é apenas na criação de tabelas
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`💾 Arquivo salvo: ${file}\n`);
  }
});

console.log('✅ Verificação concluída!');

