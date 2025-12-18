import "dotenv/config";
import mysql from "mysql2/promise";

function parseDatabaseUrl(url: string): {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
} {
  try {
    const parsedUrl = new URL(url);
    return {
      host: parsedUrl.hostname,
      port: parseInt(parsedUrl.port) || 3306,
      user: parsedUrl.username,
      password: parsedUrl.password,
      database: parsedUrl.pathname.replace(/^\//, ''),
    };
  } catch (error) {
    throw new Error(`Invalid DATABASE_URL format: ${url}. Error: ${error}`);
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL não configurado no .env");
    process.exit(1);
  }

  const config = parseDatabaseUrl(databaseUrl);
  console.log("🔌 Conectando ao banco de dados...");
  console.log(`   Host: ${config.host}:${config.port}`);
  console.log(`   Database: ${config.database}`);
  console.log(`   User: ${config.user}`);

  let connection: mysql.Connection | null = null;

  try {
    connection = await mysql.createConnection(config);
    console.log("✅ Conectado com sucesso!\n");

    // Verificar se a tabela existe
    console.log("📋 Verificando tabelas existentes...");
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'contact_lists'"
    ) as any[];

    if (tables.length > 0) {
      console.log("⚠️  Tabela contact_lists já existe");
      console.log("📊 Verificando estrutura...\n");
      
      // Verificar estrutura
      const [columns] = await connection.execute(
        "DESCRIBE contact_lists"
      ) as any[];
      
      console.log("Estrutura atual:");
      columns.forEach((col: any) => {
        console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
      });
      
      console.log("\n⚠️  Para recriar a tabela (apagará dados existentes), descomente as linhas DROP TABLE no SQL");
    } else {
      console.log("✅ Tabela contact_lists não existe, criando...\n");
    }

    // SQL para criar/corrigir as tabelas
    const sql = `
-- Drop tables if they exist (descomente se quiser recriar)
-- DROP TABLE IF EXISTS \`contact_list_items\`;
-- DROP TABLE IF EXISTS \`contact_lists\`;

-- Create contact_lists table
CREATE TABLE IF NOT EXISTS \`contact_lists\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`user_id\` int NOT NULL,
  \`name\` varchar(255) NOT NULL,
  \`company\` varchar(255) DEFAULT NULL,
  \`description\` text DEFAULT NULL,
  \`total_contacts\` int NOT NULL DEFAULT 0,
  \`invalid_contacts\` int NOT NULL DEFAULT 0,
  \`opted_out_contacts\` int NOT NULL DEFAULT 0,
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT \`contact_lists_id\` PRIMARY KEY(\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create contact_list_items table
CREATE TABLE IF NOT EXISTS \`contact_list_items\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`list_id\` int NOT NULL,
  \`phone_number\` varchar(20) NOT NULL,
  \`name\` varchar(255) DEFAULT NULL,
  \`email\` varchar(320) DEFAULT NULL,
  \`custom_fields\` text DEFAULT NULL,
  \`status\` enum('active','invalid','opted_out','spam_reported') NOT NULL DEFAULT 'active',
  \`opted_out_at\` timestamp NULL DEFAULT NULL,
  \`opted_out_reason\` varchar(50) DEFAULT NULL,
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT \`contact_list_items_id\` PRIMARY KEY(\`id\`),
  CONSTRAINT \`contact_list_items_list_id_phone_number_unique\` UNIQUE(\`list_id\`, \`phone_number\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create indexes
CREATE INDEX IF NOT EXISTS \`idx_contact_lists_user_id\` ON \`contact_lists\` (\`user_id\`);
CREATE INDEX IF NOT EXISTS \`idx_contact_list_items_list_id\` ON \`contact_list_items\` (\`list_id\`);
CREATE INDEX IF NOT EXISTS \`idx_contact_list_items_status\` ON \`contact_list_items\` (\`status\`);
CREATE INDEX IF NOT EXISTS \`idx_contact_list_items_phone\` ON \`contact_list_items\` (\`phone_number\`);
`;

    // Criar tabelas primeiro
    console.log("📦 Criando tabelas...\n");
    
    // Criar contact_lists
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`contact_lists\` (
          \`id\` int AUTO_INCREMENT NOT NULL,
          \`user_id\` int NOT NULL,
          \`name\` varchar(255) NOT NULL,
          \`company\` varchar(255) DEFAULT NULL,
          \`description\` text DEFAULT NULL,
          \`total_contacts\` int NOT NULL DEFAULT 0,
          \`invalid_contacts\` int NOT NULL DEFAULT 0,
          \`opted_out_contacts\` int NOT NULL DEFAULT 0,
          \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT \`contact_lists_id\` PRIMARY KEY(\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log("✅ Tabela contact_lists criada/verificada");
    } catch (error: any) {
      if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error(`❌ Erro ao criar contact_lists: ${error.message}`);
      } else {
        console.log("⏭️  Tabela contact_lists já existe");
      }
    }

    // Criar contact_list_items
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`contact_list_items\` (
          \`id\` int AUTO_INCREMENT NOT NULL,
          \`list_id\` int NOT NULL,
          \`phone_number\` varchar(20) NOT NULL,
          \`name\` varchar(255) DEFAULT NULL,
          \`email\` varchar(320) DEFAULT NULL,
          \`custom_fields\` text DEFAULT NULL,
          \`status\` enum('active','invalid','opted_out','spam_reported') NOT NULL DEFAULT 'active',
          \`opted_out_at\` timestamp NULL DEFAULT NULL,
          \`opted_out_reason\` varchar(50) DEFAULT NULL,
          \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT \`contact_list_items_id\` PRIMARY KEY(\`id\`),
          CONSTRAINT \`contact_list_items_list_id_phone_number_unique\` UNIQUE(\`list_id\`, \`phone_number\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log("✅ Tabela contact_list_items criada/verificada");
    } catch (error: any) {
      if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error(`❌ Erro ao criar contact_list_items: ${error.message}`);
      } else {
        console.log("⏭️  Tabela contact_list_items já existe");
      }
    }

    // Criar índices
    console.log("\n📊 Criando índices...\n");
    const indexes = [
      { name: 'idx_contact_lists_user_id', table: 'contact_lists', column: 'user_id' },
      { name: 'idx_contact_list_items_list_id', table: 'contact_list_items', column: 'list_id' },
      { name: 'idx_contact_list_items_status', table: 'contact_list_items', column: 'status' },
      { name: 'idx_contact_list_items_phone', table: 'contact_list_items', column: 'phone_number' },
    ];

    for (const idx of indexes) {
      try {
        // Verificar se o índice já existe
        const [existingIndexes] = await connection.execute(
          `SHOW INDEX FROM \`${idx.table}\` WHERE Key_name = ?`,
          [idx.name]
        ) as any[];
        
        if (existingIndexes.length === 0) {
          await connection.execute(
            `CREATE INDEX \`${idx.name}\` ON \`${idx.table}\` (\`${idx.column}\`)`
          );
          console.log(`✅ Índice ${idx.name} criado`);
        } else {
          console.log(`⏭️  Índice ${idx.name} já existe`);
        }
      } catch (error: any) {
        if (error.code !== 'ER_DUP_KEYNAME') {
          console.error(`❌ Erro ao criar índice ${idx.name}: ${error.message}`);
        }
      }
    }

    console.log("\n✅ Processo concluído!");
    console.log("\n📝 Próximos passos:");
    console.log("   1. Reinicie o servidor se estiver rodando");
    console.log("   2. Tente criar uma lista novamente");

  } catch (error: any) {
    console.error("\n❌ Erro:", error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error("\n💡 O MySQL não está rodando. Inicie com:");
      console.error("   brew services start mysql");
      console.error("   ou");
      console.error("   docker start mysql-mensageria");
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log("\n🔌 Conexão fechada");
    }
  }
}

main();

