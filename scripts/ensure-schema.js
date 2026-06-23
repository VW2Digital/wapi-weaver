import mysql from "mysql2/promise";

async function ensureColumnExists(connection, tableName, columnName, columnDefinition) {
  try {
    const [columns] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
    if (columns.length === 0) {
      console.log(`Adicionando coluna ausente \`${columnName}\` na tabela \`${tableName}\`...`);
      await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDefinition}`);
      console.log(`Coluna \`${columnName}\` criada com sucesso.`);
    }
  } catch (err) {
    console.error(`Erro ao validar coluna \`${columnName}\` em \`${tableName}\`:`, err);
    throw err;
  }
}

async function ensureIndexExists(connection, tableName, indexName, definitionSql) {
  const [rows] = await connection.query(
    `
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
      LIMIT 1
    `,
    [tableName, indexName],
  );

  if (rows.length === 0) {
    console.log(`Criando índice \`${indexName}\` em \`${tableName}\`...`);
    await connection.query(definitionSql);
  }
}

export async function ensureDatabaseSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: process.env.DB_PASSWORD || "S0xbxPfKazBVT8JFy1UEOjIsrjox",
    database: process.env.DB_NAME || "wapi_weaver",
  });

  try {
    console.log("Validando schema do banco...");

    await ensureColumnExists(connection, "profiles", "rate_limit_per_second", "INT NOT NULL DEFAULT 10");
    await ensureColumnExists(connection, "profiles", "whatsapp_verify_token", "VARCHAR(255) NULL");
    await ensureColumnExists(connection, "profiles", "whatsapp_access_token", "TEXT NULL");
    await ensureColumnExists(connection, "profiles", "whatsapp_phone_number_id", "VARCHAR(100) NULL");
    await ensureColumnExists(connection, "profiles", "whatsapp_waba_id", "VARCHAR(100) NULL");
    await ensureColumnExists(connection, "profiles", "whatsapp_business_id", "VARCHAR(100) NULL");
    await ensureColumnExists(connection, "profiles", "whatsapp_business_phone", "VARCHAR(50) NULL");
    await ensureColumnExists(connection, "profiles", "whatsapp_app_secret", "TEXT NULL");
    await ensureColumnExists(
      connection,
      "profiles",
      "meta_graph_version",
      "VARCHAR(50) NOT NULL DEFAULT 'v20.0'",
    );
    await ensureColumnExists(connection, "profiles", "salvy_api_key", "TEXT NULL");
    await ensureColumnExists(connection, "profiles", "api_key", "VARCHAR(255) NULL");

    await ensureColumnExists(connection, "templates", "parameter_format", "VARCHAR(20) NULL");
    await ensureColumnExists(
      connection,
      "templates",
      "allow_category_change",
      "BOOLEAN NOT NULL DEFAULT TRUE",
    );
    await ensureColumnExists(
      connection,
      "templates",
      "cta_url_link_tracking_opted_out",
      "BOOLEAN NOT NULL DEFAULT FALSE",
    );
    await ensureColumnExists(connection, "templates", "message_send_ttl_seconds", "INT NULL");
    await ensureColumnExists(connection, "templates", "sub_category", "VARCHAR(100) NULL");
    await ensureColumnExists(
      connection,
      "templates",
      "is_primary_device_delivery_only",
      "BOOLEAN NOT NULL DEFAULT FALSE",
    );

    await connection.query(`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        contact_phone VARCHAR(50) NOT NULL,
        direction ENUM('incoming', 'outgoing') NOT NULL,
        type ENUM('text', 'reaction', 'image') NOT NULL DEFAULT 'text',
        body TEXT NOT NULL,
        wa_message_id VARCHAR(255) NULL,
        status ENUM('sent', 'delivered', 'read', 'failed') DEFAULT 'sent',
        reply_to_message_id VARCHAR(255) NULL,
        metadata JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await ensureIndexExists(
      connection,
      "direct_messages",
      "idx_direct_messages_user_phone",
      "CREATE INDEX idx_direct_messages_user_phone ON direct_messages(user_id, contact_phone)",
    );
    await ensureIndexExists(
      connection,
      "direct_messages",
      "idx_direct_messages_wa_id",
      "CREATE INDEX idx_direct_messages_wa_id ON direct_messages(wa_message_id)",
    );
    await ensureIndexExists(
      connection,
      "direct_messages",
      "uq_direct_messages_user_wa_id",
      "CREATE UNIQUE INDEX uq_direct_messages_user_wa_id ON direct_messages(user_id, wa_message_id)",
    );

    console.log("Schema validado com sucesso.");
  } finally {
    await connection.end();
  }
}

const isDirectRun = process.argv[1] && new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href === import.meta.url;

if (isDirectRun) {
  ensureDatabaseSchema().catch((error) => {
    console.error("Erro durante a validação automática do schema:", error);
    process.exit(1);
  });
}
