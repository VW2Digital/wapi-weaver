import mysql from "mysql2/promise";

function formatDbError(err) {
  if (!err) return err;
  return {
    message: err.message,
    code: err.code,
    errno: err.errno,
    sqlState: err.sqlState,
    sqlMessage: err.sqlMessage,
    sql: err.sql,
  };
}

function logSchema(message) {
  console.log(`[Schema] ${message}`);
}

async function ensureTableExists(connection, tableName, createSql) {
  const [rows] = await connection.query(
    `
      SELECT 1
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      LIMIT 1
    `,
    [tableName],
  );

  if (rows.length === 0) {
    logSchema(`Tabela \`${tableName}\` não existe. Criando...`);
    await connection.query(createSql);
    logSchema(`Tabela \`${tableName}\` criada com sucesso.`);
    return false;
  }

  return true;
}

async function ensureColumnExists(connection, tableName, columnName, columnDefinition) {
  try {
    const [columns] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
    if (columns.length === 0) {
      logSchema(`Adicionando coluna ausente \`${columnName}\` na tabela \`${tableName}\`...`);
      await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDefinition}`);
      logSchema(`Coluna \`${columnName}\` criada com sucesso.`);
    }
  } catch (err) {
    console.error(`[Schema] Erro ao validar coluna \`${columnName}\` em \`${tableName}\`:`, formatDbError(err));
    throw err;
  }
}

async function tableExists(connection, tableName) {
  const [rows] = await connection.query(
    `
      SELECT 1
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      LIMIT 1
    `,
    [tableName],
  );
  return rows.length > 0;
}

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
  return rows.length > 0;
}

async function indexExists(connection, tableName, indexName) {
  const [rows] = await connection.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
    `,
    [tableName, indexName],
  );
  return Number(rows?.[0]?.total ?? 0) > 0;
}

async function countDuplicateWaMessageGroups(connection) {
  const [rows] = await connection.query(`
    SELECT COUNT(*) AS total
    FROM (
      SELECT user_id, wa_message_id
      FROM direct_messages
      WHERE wa_message_id IS NOT NULL
      GROUP BY user_id, wa_message_id
      HAVING COUNT(*) > 1
    ) dup
  `);

  return Number(rows?.[0]?.total ?? 0);
}

async function backupTableHasRows(connection, backupTableName) {
  if (!(await tableExists(connection, backupTableName))) {
    return false;
  }

  const [rows] = await connection.query(`SELECT COUNT(*) AS total FROM \`${backupTableName}\``);
  return Number(rows?.[0]?.total ?? 0) > 0;
}

async function prepareDirectMessagesUniqueIndex(connection) {
  const tableName = "direct_messages";
  const indexName = "uq_direct_messages_user_wa_id";
  const backupTableName = "direct_messages_backup_before_unique_index";

  logSchema(`Validando tabela ${tableName}...`);

  if (!(await tableExists(connection, tableName))) {
    logSchema(`Tabela ${tableName} não existe. Nada a preparar.`);
    return;
  }

  if (!(await columnExists(connection, tableName, "wa_message_id"))) {
    logSchema(`Coluna wa_message_id não existe em ${tableName}. Nada a preparar.`);
    return;
  }

  if (await indexExists(connection, tableName, indexName)) {
    logSchema(`Índice ${indexName} já existe. Nada a fazer.`);
    return;
  }

  logSchema("Normalizando wa_message_id vazio para NULL...");
  const [normalizeEmptyResult] = await connection.query(`
    UPDATE direct_messages
    SET wa_message_id = NULL
    WHERE wa_message_id = ''
  `);
  const [normalizeTrimResult] = await connection.query(`
    UPDATE direct_messages
    SET wa_message_id = NULL
    WHERE wa_message_id IS NOT NULL
      AND TRIM(wa_message_id) = ''
  `);
  const [normalizeUndefinedResult] = await connection.query(`
    UPDATE direct_messages
    SET wa_message_id = NULL
    WHERE wa_message_id IS NOT NULL
      AND LOWER(TRIM(wa_message_id)) IN ('undefined', 'null')
  `);
  logSchema(
    `Normalização concluída. Registros ajustados: ${Number(normalizeEmptyResult?.affectedRows ?? 0) + Number(normalizeTrimResult?.affectedRows ?? 0) + Number(normalizeUndefinedResult?.affectedRows ?? 0)}.`,
  );

  logSchema("Verificando duplicidades em direct_messages(user_id, wa_message_id)...");
  const duplicateGroups = await countDuplicateWaMessageGroups(connection);
  logSchema(`${duplicateGroups} grupos duplicados encontrados.`);

  if (duplicateGroups > 0) {
    const backupHasRows = await backupTableHasRows(connection, backupTableName);

    if (!backupHasRows) {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`${backupTableName}\` AS
        SELECT dm.*
        FROM direct_messages dm
        JOIN (
          SELECT user_id, wa_message_id
          FROM direct_messages
          WHERE wa_message_id IS NOT NULL
          GROUP BY user_id, wa_message_id
          HAVING COUNT(*) > 1
        ) dup
          ON dm.user_id = dup.user_id
         AND dm.wa_message_id = dup.wa_message_id
      `);
      logSchema(`Backup de duplicados criado em ${backupTableName}.`);
    } else {
      logSchema(`Tabela de backup ${backupTableName} já existe com dados. Backup adicional ignorado para preservar histórico.`);
    }

    await connection.query(`DROP TEMPORARY TABLE IF EXISTS tmp_direct_messages_ranked`);
    await connection.query(`
      CREATE TEMPORARY TABLE tmp_direct_messages_ranked AS
      SELECT id
      FROM (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY user_id, wa_message_id
            ORDER BY
              CASE WHEN body IS NULL OR TRIM(body) = '' THEN 1 ELSE 0 END ASC,
              CASE WHEN metadata IS NULL THEN 1 ELSE 0 END ASC,
              created_at ASC,
              id ASC
          ) AS row_num
        FROM direct_messages
        WHERE wa_message_id IS NOT NULL
      ) ranked
      WHERE ranked.row_num > 1
    `);

    const [deleteResult] = await connection.query(`
      DELETE dm
      FROM direct_messages dm
      INNER JOIN tmp_direct_messages_ranked dup ON dup.id = dm.id
    `);
    logSchema(`${Number(deleteResult?.affectedRows ?? 0)} registros duplicados removidos.`);

    await connection.query(`DROP TEMPORARY TABLE IF EXISTS tmp_direct_messages_ranked`);
  } else {
    logSchema("Nenhuma duplicidade encontrada.");
  }

  const duplicateGroupsAfterCleanup = await countDuplicateWaMessageGroups(connection);
  if (duplicateGroupsAfterCleanup > 0) {
    throw new Error(
      `[Schema] Ainda existem ${duplicateGroupsAfterCleanup} grupos duplicados em direct_messages(user_id, wa_message_id) após a deduplicação automática.`,
    );
  }
}

async function ensureIndexExists(connection, tableName, indexName, definitionSql) {
  if (tableName === "direct_messages" && indexName === "uq_direct_messages_user_wa_id") {
    await prepareDirectMessagesUniqueIndex(connection);
  }

  const exists = await indexExists(connection, tableName, indexName);
  if (exists) {
    logSchema(`Índice ${indexName} já existe. Ignorando criação.`);
    return;
  }

  try {
    logSchema(`Criando índice ${indexName}...`);
    await connection.query(definitionSql);
    logSchema(`Índice ${indexName} criado com sucesso.`);
  } catch (err) {
    console.error(`[Schema] Falha ao criar índice único ${indexName}.`, formatDbError(err));
    console.error(
      `[Schema] Motivo provável: existem duplicidades em ${tableName}(user_id, wa_message_id) ou dados inconsistentes impedindo a criação do índice.`,
    );
    console.error(`[Schema] Execute a rotina de deduplicação ou revise os dados.`);
    throw err;
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
    logSchema("Validando schema do banco...");

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

    await ensureTableExists(
      connection,
      "direct_messages",
      `
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
    `,
    );

    await ensureTableExists(
      connection,
      "whatsapp_business_profile_logs",
      `
      CREATE TABLE IF NOT EXISTS whatsapp_business_profile_logs (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NULL,
        phone_number_id VARCHAR(100) NULL,
        action ENUM('fetch_profile','update_profile','upload_profile_picture','update_profile_picture') NOT NULL,
        old_data_json JSON NULL,
        new_data_json JSON NULL,
        meta_response_json JSON NULL,
        success BOOLEAN NOT NULL DEFAULT false,
        error_code VARCHAR(100) NULL,
        error_message TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    );

    await ensureIndexExists(
      connection,
      "whatsapp_business_profile_logs",
      "idx_wab_profile_logs_user_created",
      "CREATE INDEX idx_wab_profile_logs_user_created ON whatsapp_business_profile_logs(user_id, created_at DESC)",
    );
    await ensureIndexExists(
      connection,
      "whatsapp_business_profile_logs",
      "idx_wab_profile_logs_phone_created",
      "CREATE INDEX idx_wab_profile_logs_phone_created ON whatsapp_business_profile_logs(phone_number_id, created_at DESC)",
    );

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

    logSchema("Schema validado com sucesso.");
  } finally {
    await connection.end();
  }
}

const isDirectRun = process.argv[1] && new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href === import.meta.url;

if (isDirectRun) {
  ensureDatabaseSchema().catch((error) => {
    console.error("Erro durante a validação automática do schema:", formatDbError(error));
    process.exit(1);
  });
}
