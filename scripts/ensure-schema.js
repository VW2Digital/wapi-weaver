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
    const [columns] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [
      columnName,
    ]);
    if (columns.length === 0) {
      logSchema(`Adicionando coluna ausente \`${columnName}\` na tabela \`${tableName}\`...`);
      await connection.query(
        `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDefinition}`,
      );
      logSchema(`Coluna \`${columnName}\` criada com sucesso.`);
    }
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME" || err.errno === 1060) {
      logSchema(`Coluna \`${columnName}\` já existe na tabela \`${tableName}\` (tratado via ER_DUP_FIELDNAME).`);
      return;
    }
    console.error(
      `[Schema] Erro ao validar coluna \`${columnName}\` em \`${tableName}\`:`,
      formatDbError(err),
    );
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
      logSchema(
        `Tabela de backup ${backupTableName} já existe com dados. Backup adicional ignorado para preservar histórico.`,
      );
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
  let connection;
  const maxAttempts = 20;
  const delayMs = 3000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      connection = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "3306", 10),
        user: process.env.DB_USER || "wapi_user",
        password: process.env.DB_PASSWORD || "S0xbxPfKazBVT8JFy1UEOjIsrjox",
        database: process.env.DB_NAME || "wapi_weaver",
      });
      logSchema("Conexão com o banco de dados estabelecida com sucesso.");
      break;
    } catch (err) {
      if (attempt === maxAttempts) {
        console.error(
          `[Schema] Não foi possível conectar ao banco de dados após ${maxAttempts} tentativas.`,
        );
        throw err;
      }
      console.warn(
        `[Schema] Aguardando banco de dados inicializar... (Tentativa ${attempt}/${maxAttempts}). Erro: ${err.message}`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  try {
    logSchema("Validando schema do banco...");

    await ensureColumnExists(
      connection,
      "profiles",
      "rate_limit_per_second",
      "INT NOT NULL DEFAULT 10",
    );
    await ensureColumnExists(connection, "profiles", "whatsapp_verify_token", "VARCHAR(255) NULL");
    await ensureColumnExists(connection, "profiles", "whatsapp_access_token", "TEXT NULL");
    await ensureColumnExists(
      connection,
      "profiles",
      "whatsapp_phone_number_id",
      "VARCHAR(100) NULL",
    );
    await ensureColumnExists(connection, "profiles", "whatsapp_waba_id", "VARCHAR(100) NULL");
    await ensureColumnExists(connection, "profiles", "whatsapp_business_id", "VARCHAR(100) NULL");
    await ensureColumnExists(connection, "profiles", "whatsapp_business_phone", "VARCHAR(50) NULL");
    await ensureColumnExists(connection, "profiles", "whatsapp_app_secret", "TEXT NULL");
    await ensureColumnExists(connection, "profiles", "whatsapp_app_id", "VARCHAR(100) NULL");
    await ensureColumnExists(
      connection,
      "profiles",
      "meta_graph_version",
      "VARCHAR(50) NOT NULL DEFAULT 'v20.0'",
    );
    await ensureColumnExists(connection, "profiles", "salvy_api_key", "TEXT NULL");
    await ensureColumnExists(connection, "profiles", "api_key", "VARCHAR(255) NULL");

    await ensureTableExists(
      connection,
      "platform_settings",
      `
      CREATE TABLE IF NOT EXISTS platform_settings (
        id INT NOT NULL PRIMARY KEY DEFAULT 1,
        meta_app_id VARCHAR(255) NULL,
        meta_app_secret TEXT NULL,
        meta_config_id VARCHAR(255) NULL,
        meta_graph_version VARCHAR(50) NOT NULL DEFAULT 'v20.0',
        cron_secret TEXT NULL,
        head_tags TEXT NULL,
        body_tags TEXT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        updated_by VARCHAR(36) NULL,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    );

    await ensureColumnExists(connection, "platform_settings", "sidebar_order", "TEXT NULL");
    await ensureColumnExists(connection, "platform_settings", "seo_title", "VARCHAR(128) NULL");
    await ensureColumnExists(connection, "platform_settings", "seo_description", "VARCHAR(320) NULL");
    await ensureColumnExists(connection, "platform_settings", "license_key", "VARCHAR(255) NULL");
    await ensureColumnExists(connection, "platform_settings", "license_token", "TEXT NULL");
    await ensureColumnExists(connection, "platform_settings", "installation_id", "VARCHAR(255) NULL");
    await ensureColumnExists(connection, "platform_settings", "license_grace_period_start", "DATETIME NULL");

    logSchema("Garantindo linha singleton de platform_settings (id=1)...");
    await connection.query(
      `
      INSERT IGNORE INTO platform_settings (id, meta_graph_version)
      VALUES (1, 'v20.0')
    `,
    );

    // Garante colunas de licença na platform_settings (compatibilidade com versões antigas)
    await ensureColumnExists(connection, "platform_settings", "license_key", "VARCHAR(255) NULL");
    await ensureColumnExists(connection, "platform_settings", "license_token", "TEXT NULL");
    await ensureColumnExists(connection, "platform_settings", "installation_id", "VARCHAR(255) NULL");
    await ensureColumnExists(connection, "platform_settings", "license_grace_period_start", "DATETIME NULL");

    // Tabela dedicada para o sistema de licença SaaS
    await ensureTableExists(
      connection,
      "license_settings",
      `
      CREATE TABLE IF NOT EXISTS license_settings (
        id INT NOT NULL PRIMARY KEY DEFAULT 1,
        license_key_encrypted TEXT NULL,
        license_status VARCHAR(50) NULL,
        plan VARCHAR(100) NULL,
        features_json JSON NULL,
        domain VARCHAR(255) NULL,
        installation_id VARCHAR(255) NULL,
        activated_at DATETIME NULL,
        last_validated_at DATETIME NULL,
        expires_at DATETIME NULL,
        cache_valid_until DATETIME NULL,
        grace_until DATETIME NULL,
        last_error TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
    );

    logSchema("Garantindo linha singleton de license_settings (id=1)...");
    await connection.query(
      `
      INSERT IGNORE INTO license_settings (id, license_status, installation_id, last_error)
      VALUES (1, 'absent', UUID(), 'Licença não encontrada localmente.')
    `,
    );
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
        type ENUM('text', 'reaction', 'image', 'audio', 'video', 'document', 'sticker', 'location', 'contacts') NOT NULL DEFAULT 'text',
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

    // Garantir colunas adicionais na tabela contacts
    await ensureColumnExists(connection, "contacts", "is_pinned", "BOOLEAN NOT NULL DEFAULT false");
    await ensureColumnExists(
      connection,
      "contacts",
      "is_archived",
      "BOOLEAN NOT NULL DEFAULT false",
    );
    await ensureColumnExists(
      connection,
      "contacts",
      "chat_status",
      "VARCHAR(50) NOT NULL DEFAULT 'aberto'",
    );
    await ensureColumnExists(connection, "contacts", "is_unread", "BOOLEAN NOT NULL DEFAULT false");
    await ensureColumnExists(connection, "contacts", "kanban_stage_id", "VARCHAR(36) NULL");

    await ensureTableExists(
      connection,
      "tags",
      `
      CREATE TABLE IF NOT EXISTS tags (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        color VARCHAR(50) NOT NULL DEFAULT '#8B5CF6',
        icon VARCHAR(50) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_tag (user_id, name),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    );
    await ensureColumnExists(connection, "tags", "icon", "VARCHAR(50) NULL");

    await ensureTableExists(
      connection,
      "conversation_tags",
      `
      CREATE TABLE IF NOT EXISTS conversation_tags (
        contact_number VARCHAR(50) NOT NULL,
        tag_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        PRIMARY KEY (contact_number, tag_id),
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    );

    await ensureTableExists(
      connection,
      "message_tags",
      `
      CREATE TABLE IF NOT EXISTS message_tags (
        message_id VARCHAR(36) NOT NULL,
        tag_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        PRIMARY KEY (message_id, tag_id),
        FOREIGN KEY (message_id) REFERENCES direct_messages(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    );

    // Garantir enum atualizado para direct_messages.type
    try {
      await connection.query(`
        ALTER TABLE \`direct_messages\` 
        MODIFY COLUMN \`type\` ENUM('text', 'reaction', 'image', 'audio', 'video', 'document', 'sticker', 'location', 'contacts') NOT NULL DEFAULT 'text'
      `);
    } catch (err) {
      console.warn(
        "[Schema] Falha ao atualizar enum de direct_messages.type (pode já estar atualizado):",
        err.message,
      );
    }

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
      "conversation_tags",
      "idx_conversation_tags_contact",
      "CREATE INDEX idx_conversation_tags_contact ON conversation_tags(contact_number)",
    );
    await ensureIndexExists(
      connection,
      "conversation_tags",
      "idx_conversation_tags_tag",
      "CREATE INDEX idx_conversation_tags_tag ON conversation_tags(tag_id)",
    );
    await ensureIndexExists(
      connection,
      "conversation_tags",
      "idx_conversation_tags_user",
      "CREATE INDEX idx_conversation_tags_user ON conversation_tags(user_id)",
    );
    await ensureIndexExists(
      connection,
      "message_tags",
      "idx_message_tags_message",
      "CREATE INDEX idx_message_tags_message ON message_tags(message_id)",
    );
    await ensureIndexExists(
      connection,
      "message_tags",
      "idx_message_tags_tag",
      "CREATE INDEX idx_message_tags_tag ON message_tags(tag_id)",
    );
    await ensureIndexExists(
      connection,
      "message_tags",
      "idx_message_tags_user",
      "CREATE INDEX idx_message_tags_user ON message_tags(user_id)",
    );

    // BotFlow Tables
    await ensureTableExists(
      connection,
      "bot_settings",
      `
      CREATE TABLE IF NOT EXISTS bot_settings (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        instance_id VARCHAR(50) NULL,
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        pause_timeout_minutes INT NOT NULL DEFAULT 60,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_bot_settings_instance (user_id, instance_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    );

    // Migração: garante que instance_id é NULL (era NOT NULL em versões antigas)
    // sem essa correção, usuários sem WhatsApp configurado não conseguem salvar o fluxo do bot
    try {
      const [cols] = await connection.query(
        `SELECT IS_NULLABLE FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'bot_settings'
           AND COLUMN_NAME = 'instance_id'
         LIMIT 1`,
      );
      if (cols.length > 0) {
        if (cols[0].IS_NULLABLE === "NO") {
          logSchema("Migrando bot_settings.instance_id de NOT NULL para NULL...");
          await connection.query(
            `ALTER TABLE bot_settings MODIFY COLUMN instance_id VARCHAR(50) NULL`,
          );
          logSchema("Migração bot_settings.instance_id concluída.");
        }
        // Sempre limpa strings vazias — independente da versão anterior
        const [updateResult] = await connection.query(
          `UPDATE bot_settings SET instance_id = NULL WHERE instance_id = ''`,
        );
        if (Number(updateResult?.affectedRows) > 0) {
          logSchema(
            `Limpeza: ${updateResult.affectedRows} registro(s) com instance_id vazio convertidos para NULL.`,
          );
        }
      }
    } catch (err) {
      console.warn("[Schema] Falha ao migrar bot_settings.instance_id (não crítico):", err.message);
    }

    await ensureTableExists(
      connection,
      "bot_steps",
      `
      CREATE TABLE IF NOT EXISTS bot_steps (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        bot_settings_id VARCHAR(36) NOT NULL,
        step_order INT NOT NULL DEFAULT 1,
        trigger_type VARCHAR(50) NOT NULL DEFAULT 'keyword',
        trigger_value VARCHAR(255) NULL,
        message_type VARCHAR(50) NOT NULL DEFAULT 'text',
        message_content TEXT NULL,
        media_url VARCHAR(1024) NULL,
        media_caption TEXT NULL,
        footer_text VARCHAR(255) NULL,
        buttons_config JSON NULL,
        next_step_id VARCHAR(36) NULL,
        delay_seconds INT NOT NULL DEFAULT 0,
        position_x FLOAT NOT NULL DEFAULT 0,
        position_y FLOAT NOT NULL DEFAULT 0,
        assign_team_id VARCHAR(36) NULL,
        assign_user_id VARCHAR(36) NULL,
        handoff_message TEXT NULL,
        card_color VARCHAR(50) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (bot_settings_id) REFERENCES bot_settings(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    );

    // Migração: remove as chaves estrangeiras obsoletas de next_step_id
    // para permitir valores sentinel como -999 (handoff) e -997 (restart)
    try {
      const [fksSteps] = await connection.query(
        `SELECT CONSTRAINT_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'bot_steps'
           AND COLUMN_NAME = 'next_step_id'
           AND REFERENCED_TABLE_NAME = 'bot_steps'`,
      );
      for (const fk of fksSteps) {
        const fkName = fk.CONSTRAINT_NAME || fk.constraint_name;
        if (fkName) {
          logSchema(
            `Migração: Removendo chave estrangeira obsoleta \`${fkName}\` da tabela \`bot_steps\`...`,
          );
          await connection.query(`ALTER TABLE \`bot_steps\` DROP FOREIGN KEY \`${fkName}\``);
          logSchema(`Chave estrangeira \`${fkName}\` de \`bot_steps\` removida.`);
        }
      }

      const [fksOptions] = await connection.query(
        `SELECT CONSTRAINT_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'bot_step_options'
           AND COLUMN_NAME = 'next_step_id'
           AND REFERENCED_TABLE_NAME = 'bot_steps'`,
      );
      for (const fk of fksOptions) {
        const fkName = fk.CONSTRAINT_NAME || fk.constraint_name;
        if (fkName) {
          logSchema(
            `Migração: Removendo chave estrangeira obsoleta \`${fkName}\` da tabela \`bot_step_options\`...`,
          );
          await connection.query(`ALTER TABLE \`bot_step_options\` DROP FOREIGN KEY \`${fkName}\``);
          logSchema(`Chave estrangeira \`${fkName}\` de \`bot_step_options\` removida.`);
        }
      }
    } catch (err) {
      console.warn(
        "[Schema] Falha ao migrar/remover chaves estrangeiras de next_step_id (não crítico):",
        err.message,
      );
    }

    await ensureTableExists(
      connection,
      "bot_step_options",
      `
      CREATE TABLE IF NOT EXISTS bot_step_options (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        step_id VARCHAR(36) NOT NULL,
        option_number INT NOT NULL,
        label VARCHAR(50) NOT NULL,
        description VARCHAR(255) NULL,
        next_step_id VARCHAR(36) NULL,
        assign_team_id VARCHAR(36) NULL,
        assign_user_id VARCHAR(36) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (step_id) REFERENCES bot_steps(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    );

    await ensureTableExists(
      connection,
      "bot_conversation_state",
      `
      CREATE TABLE IF NOT EXISTS bot_conversation_state (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        contact_number VARCHAR(50) NOT NULL,
        instance_id VARCHAR(50) NULL,
        current_step_id VARCHAR(36) NULL,
        last_interaction DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        is_paused BOOLEAN NOT NULL DEFAULT FALSE,
        paused_until DATETIME NULL,
        bot_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_bot_conv_state (user_id, contact_number, instance_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (current_step_id) REFERENCES bot_steps(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    );

    // Migração: garante que bot_conversation_state.instance_id é NULL (era NOT NULL em versões antigas)
    try {
      const [cols] = await connection.query(
        `SELECT IS_NULLABLE FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'bot_conversation_state'
           AND COLUMN_NAME = 'instance_id'
         LIMIT 1`,
      );
      if (cols.length > 0 && cols[0].IS_NULLABLE === "NO") {
        logSchema("Migrando bot_conversation_state.instance_id de NOT NULL para NULL...");
        await connection.query(
          `ALTER TABLE bot_conversation_state MODIFY COLUMN instance_id VARCHAR(50) NULL`,
        );
        logSchema("Migração bot_conversation_state.instance_id concluída.");
      }
    } catch (err) {
      console.warn(
        "[Schema] Falha ao migrar bot_conversation_state.instance_id (não crítico):",
        err.message,
      );
    }

    // Adiciona colunas que podem não ter sido criadas na v1
    await ensureColumnExists(connection, "bot_steps", "media_url", "VARCHAR(1024) NULL");
    await ensureColumnExists(connection, "bot_steps", "position_x", "FLOAT NOT NULL DEFAULT 0");
    await ensureColumnExists(connection, "bot_steps", "position_y", "FLOAT NOT NULL DEFAULT 0");
    await ensureColumnExists(
      connection,
      "bot_steps",
      "created_at",
      "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
    );
    await ensureColumnExists(
      connection,
      "bot_steps",
      "updated_at",
      "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    );

    await ensureIndexExists(
      connection,
      "bot_steps",
      "idx_bot_steps_settings",
      "CREATE INDEX idx_bot_steps_settings ON bot_steps(bot_settings_id)",
    );
    await ensureIndexExists(
      connection,
      "bot_step_options",
      "idx_bot_step_options_step",
      "CREATE INDEX idx_bot_step_options_step ON bot_step_options(step_id)",
    );
    await ensureIndexExists(
      connection,
      "bot_conversation_state",
      "idx_bot_conv_state_contact",
      "CREATE INDEX idx_bot_conv_state_contact ON bot_conversation_state(contact_number)",
    );

    await ensureTableExists(
      connection,
      "ai_agent_settings",
      `
      CREATE TABLE IF NOT EXISTS ai_agent_settings (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        instance_id VARCHAR(50) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        api_key VARCHAR(255) NULL,
        model VARCHAR(50) NOT NULL DEFAULT 'gemini-2.5-flash',
        system_prompt TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_ai_agent_instance (user_id, instance_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    );

    await ensureTableExists(
      connection,
      "knowledge_base",
      `
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        ai_agent_settings_id VARCHAR(36) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (ai_agent_settings_id) REFERENCES ai_agent_settings(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    );

    await ensureTableExists(
      connection,
      "whatsapp_flows",
      `
      CREATE TABLE IF NOT EXISTS whatsapp_flows (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        flow_id VARCHAR(100) NOT NULL UNIQUE,
        flow_name VARCHAR(255) NOT NULL,
        waba_id VARCHAR(100) NULL,
        phone_number_id VARCHAR(100) NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        flow_json JSON NULL,
        endpoint_url VARCHAR(500) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    );

    await ensureTableExists(
      connection,
      "whatsapp_flow_submissions",
      `
      CREATE TABLE IF NOT EXISTS whatsapp_flow_submissions (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        contact_phone VARCHAR(50) NOT NULL,
        flow_id VARCHAR(100) NOT NULL,
        flow_token VARCHAR(255) NULL,
        response_json JSON NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    );

    // Tabelas de Equipes e Atribuições
    await ensureTableExists(
      connection,
      "teams",
      `
      CREATE TABLE IF NOT EXISTS teams (
        id          VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id     VARCHAR(36) NOT NULL,
        name        VARCHAR(255) NOT NULL,
        description TEXT NULL,
        auto_assign_mode ENUM('manual', 'round_robin', 'least_busy') NOT NULL DEFAULT 'manual',
        created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    );

    await ensureTableExists(
      connection,
      "team_members",
      `
      CREATE TABLE IF NOT EXISTS team_members (
        id        VARCHAR(36) NOT NULL PRIMARY KEY,
        team_id   VARCHAR(36) NOT NULL,
        user_id   VARCHAR(36) NOT NULL,
        role      ENUM('agent', 'supervisor') NOT NULL DEFAULT 'agent',
        joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_team_member (team_id, user_id),
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    );

    await ensureTableExists(
      connection,
      "conversation_assignments",
      `
      CREATE TABLE IF NOT EXISTS conversation_assignments (
        id            VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id       VARCHAR(36) NOT NULL,
        contact_phone VARCHAR(50) NOT NULL,
        team_id       VARCHAR(36) NULL,
        agent_id      VARCHAR(36) NULL,
        assigned_by   VARCHAR(36) NULL,
        assigned_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        unassigned_at DATETIME NULL,
        is_active     BOOLEAN NOT NULL DEFAULT true,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
        FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    );

    // Instagram and Bot Flow Updates
    await ensureTableExists(
      connection,
      "instagram_accounts",
      `
      CREATE TABLE IF NOT EXISTS instagram_accounts (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        ig_user_id VARCHAR(100) NOT NULL UNIQUE,
        username VARCHAR(100) NULL,
        access_token TEXT NOT NULL,
        token_expires_at DATETIME NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    );

    await ensureTableExists(
      connection,
      "facebook_pages",
      `
      CREATE TABLE IF NOT EXISTS facebook_pages (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        workspace_id VARCHAR(36) NULL,
        user_id VARCHAR(36) NOT NULL,
        page_id VARCHAR(64) NOT NULL UNIQUE,
        page_name VARCHAR(255) NULL,
        page_access_token TEXT NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        permissions_json TEXT NULL,
        token_expires_at VARCHAR(64) NULL,
        webhook_subscribed BOOLEAN NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    );

    await ensureTableExists(
      connection,
      "instagram_webhook_events",
      `
      CREATE TABLE IF NOT EXISTS instagram_webhook_events (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NULL,
        raw JSON NOT NULL,
        processed BOOLEAN NOT NULL DEFAULT FALSE,
        received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    );

    await ensureTableExists(
      connection,
      "facebook_webhook_events",
      `
      CREATE TABLE IF NOT EXISTS facebook_webhook_events (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NULL,
        raw JSON NOT NULL,
        processed BOOLEAN NOT NULL DEFAULT FALSE,
        received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `,
    );

    // Índice para busca por user_id em instagram_accounts
    try {
      await connection.query(
        `CREATE INDEX idx_instagram_accounts_user ON instagram_accounts(user_id)`,
      );
      logSchema("Índice idx_instagram_accounts_user adicionado.");
    } catch (e) {}

    // Índice para busca por user_id em facebook_pages
    try {
      await connection.query(
        `CREATE INDEX idx_facebook_pages_user ON facebook_pages(user_id)`,
      );
      logSchema("Índice idx_facebook_pages_user adicionado.");
    } catch (e) {}

    // Migração segura: converte coluna channel de ENUM para VARCHAR(50) em todas as tabelas.
    // Isso evita "Data truncated" ao adicionar novos canais (ex: whatsapp_group, facebook, web, etc).
    // Antes de alterar, normaliza valores NULL/vazios para 'unknown'.
    const channelTablesToMigrate = ['contacts', 'direct_messages', 'bot_conversation_state'];
    for (const tbl of channelTablesToMigrate) {
      try {
        const exists = await tableExists(connection, tbl);
        if (!exists) continue;
        const colExists = await columnExists(connection, tbl, 'channel');
        if (!colExists) continue;

        // 1. Loga os valores atuais para diagnóstico
        const [distinctChannels] = await connection.query(`SELECT DISTINCT channel FROM \`${tbl}\``);
        logSchema(`[${tbl}] Valores de channel encontrados: ${distinctChannels.map(r => r.channel).join(', ') || 'nenhum'}`);

        // 2. Normaliza NULL e vazios
        await connection.query(`UPDATE \`${tbl}\` SET channel = 'unknown' WHERE channel IS NULL OR TRIM(channel) = ''`);

        // 3. Converte para VARCHAR(50) — seguro para qualquer valor existente
        await connection.query(`ALTER TABLE \`${tbl}\` MODIFY COLUMN channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp'`);
        logSchema(`Coluna channel de \`${tbl}\` convertida para VARCHAR(50) com segurança.`);
      } catch (e) {
        logSchema(`Aviso: não foi possível migrar channel em \`${tbl}\`: ${e.message}`);
      }
    }

    // Criar índices recomendados de otimização para o canal Messenger
    try {
      await connection.query(
        `CREATE INDEX idx_contacts_channel_external ON contacts(channel, external_contact_id)`,
      );
      logSchema("Índice idx_contacts_channel_external adicionado a contacts.");
    } catch (e) {}

    try {
      await connection.query(
        `CREATE INDEX idx_dm_channel_provider ON direct_messages(channel, provider_account_id)`,
      );
      logSchema("Índice idx_dm_channel_provider adicionado a direct_messages.");
    } catch (e) {}

    try {
      await connection.query(
        `CREATE INDEX idx_contacts_user_channel ON contacts(user_id, channel)`,
      );
      logSchema("Índice idx_contacts_user_channel adicionado a contacts.");
    } catch (e) {}

    // Columns to contacts — usa VARCHAR(50) para ser à prova do futuro
    await ensureColumnExists(
      connection,
      "contacts",
      "channel",
      "VARCHAR(50) NOT NULL DEFAULT 'whatsapp'",
    );
    await ensureColumnExists(
      connection,
      "contacts",
      "external_contact_id",
      "VARCHAR(255) NULL",
    );
    try {
      await connection.query(
        `ALTER TABLE contacts ADD UNIQUE KEY uq_contact_channel_external (user_id, channel, external_contact_id)`,
      );
      logSchema("Única restrição uq_contact_channel_external adicionada a contacts.");
    } catch (e) {}

    // Columns to direct_messages — usa VARCHAR(50) para ser à prova do futuro
    await ensureColumnExists(
      connection,
      "direct_messages",
      "channel",
      "VARCHAR(50) NOT NULL DEFAULT 'whatsapp'",
    );
    await ensureColumnExists(
      connection,
      "direct_messages",
      "provider_message_id",
      "VARCHAR(255) NULL",
    );
    await ensureColumnExists(
      connection,
      "direct_messages",
      "provider_account_id",
      "VARCHAR(255) NULL",
    );
    try {
      await connection.query(
        `ALTER TABLE direct_messages ADD UNIQUE KEY uq_dm_channel_msg (user_id, channel, provider_message_id)`,
      );
      logSchema("Única restrição uq_dm_channel_msg adicionada a direct_messages.");
    } catch (e) {}

    // Columns to bot_conversation_state — usa VARCHAR(50) para ser à prova do futuro
    await ensureColumnExists(
      connection,
      "bot_conversation_state",
      "channel",
      "VARCHAR(50) NOT NULL DEFAULT 'whatsapp'",
    );
    await ensureColumnExists(
      connection,
      "bot_conversation_state",
      "provider_account_id",
      "VARCHAR(255) NULL",
    );
    // Adiciona channel à unique key para isolar WhatsApp de Instagram
    // Idempotente: verifica se o índice novo já existe antes de recriar.
    try {
      const newKeyExists = await indexExists(connection, 'bot_conversation_state', 'uq_bot_conv_state');
      if (!newKeyExists) {
        // Tenta remover a versão antiga sem channel (pode não existir)
        try {
          await connection.query(`ALTER TABLE bot_conversation_state DROP INDEX uq_bot_conv_state`);
          logSchema("Índice uq_bot_conv_state antigo removido de bot_conversation_state.");
        } catch (e) {}
        await connection.query(
          `ALTER TABLE bot_conversation_state ADD UNIQUE KEY uq_bot_conv_state (user_id, contact_number, instance_id, channel)`,
        );
        logSchema("Nova unique key uq_bot_conv_state (com channel) adicionada.");
      } else {
        logSchema("Índice uq_bot_conv_state já existe com a definição correta. Ignorando.");
      }
    } catch (e) {
      logSchema(`Aviso: não foi possível atualizar uq_bot_conv_state: ${e.message}`);
    }

    await ensureColumnExists(
      connection,
      "templates",
      "display_format",
      "VARCHAR(20) NULL",
    );

    // Bloco de ENUM removido: a conversão para VARCHAR(50) já foi feita acima (idempotente).
    // Não há necessidade de alterar ENUM novamente aqui.

    // Columns to bot_settings (Flows)
    await ensureColumnExists(
      connection,
      "bot_settings",
      "name",
      "VARCHAR(150) NULL",
    );
    await ensureColumnExists(
      connection,
      "bot_settings",
      "channel",
      "VARCHAR(50) NOT NULL DEFAULT 'whatsapp'",
    );
    await ensureColumnExists(
      connection,
      "bot_settings",
      "priority",
      "INT NOT NULL DEFAULT 0",
    );
    // Adiciona channel à unique key para permitir fluxos separados por canal
    try {
      await connection.query(
        `ALTER TABLE bot_settings DROP INDEX uq_bot_settings_instance`,
      );
      logSchema("Índice uq_bot_settings_instance antigo removido de bot_settings.");
    } catch (e) {}
    try {
      await connection.query(
        `ALTER TABLE bot_settings ADD UNIQUE KEY uq_bot_settings_instance (user_id, instance_id, channel)`,
      );
      logSchema("Nova unique key uq_bot_settings_instance (com channel) adicionada.");
    } catch (e) {
      logSchema("Aviso: não foi possível recriar uq_bot_settings_instance (pode já existir).");
    }
    await ensureColumnExists(
      connection,
      "bot_settings",
      "trigger_type",
      "VARCHAR(50) NOT NULL DEFAULT 'start'",
    );
    await ensureColumnExists(
      connection,
      "bot_settings",
      "trigger_value",
      "VARCHAR(255) NULL",
    );
    await ensureColumnExists(
      connection,
      "bot_settings",
      "is_default",
      "BOOLEAN NOT NULL DEFAULT FALSE",
    );

    // --- MIGRATIONS PARA WHATSAPP GRUPOS ---
    logSchema("Iniciando migrações do WhatsApp Grupos...");
    // Nota: a conversão para VARCHAR(50) já foi realizada no bloco anterior de forma idempotente.
    // Não é necessário repetir aqui, mas garantimos o caso de tabelas criadas sem channel algum.
    for (const tbl of ['contacts', 'direct_messages']) {
      try {
        const exists = await tableExists(connection, tbl);
        if (!exists) continue;
        const col = await columnExists(connection, tbl, 'channel');
        if (!col) continue;
        // Se ainda for ENUM por algum motivo, converte. Se já for VARCHAR, o ALTER é no-op no MySQL 8.
        await connection.query(`UPDATE \`${tbl}\` SET channel = 'unknown' WHERE channel IS NULL OR TRIM(channel) = ''`);
        await connection.query(`ALTER TABLE \`${tbl}\` MODIFY COLUMN channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp'`);
      } catch (e) {
        logSchema(`Aviso (grupos): não foi possível garantir VARCHAR em \`${tbl}\`.channel: ${e.message}`);
      }
    }
    
    await ensureColumnExists(connection, "direct_messages", "sender_wa_id", "VARCHAR(50) NULL");
    await ensureColumnExists(connection, "direct_messages", "sender_name", "VARCHAR(255) NULL");
    await ensureColumnExists(connection, "direct_messages", "recipient_type", "VARCHAR(50) NULL");
    await ensureColumnExists(connection, "direct_messages", "external_group_id", "VARCHAR(100) NULL");
    await ensureColumnExists(connection, "direct_messages", "raw_payload", "JSON NULL");

    // Adicionar updated_at à tabela lists (para rastrear edições)
    await ensureColumnExists(
      connection,
      "lists",
      "updated_at",
      "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    );

    await ensureTableExists(
      connection,
      "whatsapp_groups",
      `
      CREATE TABLE whatsapp_groups (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        instance_id VARCHAR(100) NULL,
        group_id VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        invite_link TEXT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        error_message TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `
    );

    await ensureTableExists(
      connection,
      "whatsapp_group_participants",
      `
      CREATE TABLE whatsapp_group_participants (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        group_id VARCHAR(100) NOT NULL,
        wa_id VARCHAR(50) NOT NULL,
        name VARCHAR(255) NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        joined_at DATETIME NULL,
        left_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `
    );
    logSchema("Migrações do WhatsApp Grupos concluídas.");

    await ensureTableExists(
      connection,
      "chat_sessions",
      `
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        contact_id VARCHAR(36) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pendente',
        started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        answered_at DATETIME NULL,
        closed_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `
    );
    logSchema("Tabela chat_sessions validada/criada.");

    // Insere flows de demonstração iniciais para testes locais
    try {
      const [users] = await connection.query("SELECT id FROM users");
      if (users.length > 0) {
        for (const u of users) {
          logSchema(`Garantindo flows iniciais de demonstração para o usuário ${u.id}...`);
          await connection.query(
            `
            INSERT IGNORE INTO whatsapp_flows (id, user_id, flow_id, flow_name, status)
            VALUES (UUID(), ?, '789123456', 'Orçamento de Serviços', 'published')
            `,
            [u.id],
          );

          logSchema(`Garantindo equipes iniciais de demonstração para o usuário ${u.id}...`);
          const [existingTeams] = await connection.query("SELECT id FROM teams WHERE user_id = ?", [
            u.id,
          ]);
          if (existingTeams.length === 0) {
            const supportTeamId = `demo-team-support-${u.id.substring(0, 8)}`;
            const salesTeamId = `demo-team-sales-${u.id.substring(0, 8)}`;

            await connection.query(
              `INSERT IGNORE INTO teams (id, user_id, name, description, auto_assign_mode)
               VALUES 
                 (?, ?, 'Suporte Técnico', 'Equipe de suporte e atendimento técnico', 'round_robin'),
                 (?, ?, 'Comercial', 'Equipe de vendas e novos negócios', 'manual')`,
              [supportTeamId, u.id, salesTeamId, u.id],
            );

            await connection.query(
              `INSERT IGNORE INTO team_members (id, team_id, user_id, role)
               VALUES 
                 (UUID(), ?, ?, 'supervisor'),
                 (UUID(), ?, ?, 'agent')`,
              [supportTeamId, u.id, salesTeamId, u.id],
            );
          }

          // Seeding de Grupo WhatsApp de Demonstração
          const demoGroupId = "120363999999999999@g.us";
          const [existingGroups] = await connection.query("SELECT 1 FROM whatsapp_groups WHERE group_id = ? AND user_id = ?", [demoGroupId, u.id]);
          if (existingGroups.length === 0) {
            logSchema(`Garantindo grupo fictício de demonstração para o usuário ${u.id}...`);
            const newGroupRecordId = `demo-group-${u.id.substring(0, 8)}`;
            await connection.query(
              `INSERT IGNORE INTO whatsapp_groups (id, user_id, instance_id, group_id, name, description, invite_link, status)
               VALUES (?, ?, 'demo-instance', ?, 'Grupo de Testes Bliv', 'Grupo de demonstração para testes de mensageria.', 'https://chat.whatsapp.com/demo-invite-link', 'active')`,
              [newGroupRecordId, u.id, demoGroupId]
            );

            await connection.query(
              `INSERT IGNORE INTO contacts (id, user_id, phone_e164, name, source, channel, chat_status, is_unread)
               VALUES (UUID(), ?, ?, 'Grupo de Testes Bliv', 'whatsapp_group', 'whatsapp_group', 'aberto', false)
               ON DUPLICATE KEY UPDATE name = VALUES(name), channel = 'whatsapp_group'`,
              [u.id, demoGroupId]
            );

            await connection.query(
              `INSERT IGNORE INTO whatsapp_group_participants (id, user_id, group_id, wa_id, name, status)
               VALUES 
                 (UUID(), ?, ?, '5511999999999', 'Renato (Suporte)', 'active'),
                 (UUID(), ?, ?, '5511888888888', 'Maria (Comercial)', 'active')`,
              [u.id, demoGroupId, u.id, demoGroupId]
            );

            await connection.query(
              `INSERT IGNORE INTO direct_messages (id, user_id, contact_phone, direction, type, body, status, channel, sender_wa_id, sender_name, recipient_type, external_group_id)
               VALUES (UUID(), ?, ?, 'incoming', 'text', 'Olá pessoal, este é o nosso grupo de testes!', 'delivered', 'whatsapp_group', '5511999999999', 'Renato (Suporte)', 'group', ?)`,
              [u.id, demoGroupId, demoGroupId]
            );
          }
        }
      }
    } catch (err) {
      console.warn("[Schema] Falha ao inserir dados de demonstração (não crítico):", err.message);
    }

    logSchema("Schema validado com sucesso.");
  } finally {
    await connection.end();
  }
}

const isDirectRun =
  process.argv[1] &&
  new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href === import.meta.url;

if (isDirectRun) {
  ensureDatabaseSchema().catch((error) => {
    console.error("Erro durante a validação automática do schema:", formatDbError(error));
    process.exit(1);
  });
}
