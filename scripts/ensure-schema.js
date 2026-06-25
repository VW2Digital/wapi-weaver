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
        console.error(`[Schema] Não foi possível conectar ao banco de dados após ${maxAttempts} tentativas.`);
        throw err;
      }
      console.warn(`[Schema] Aguardando banco de dados inicializar... (Tentativa ${attempt}/${maxAttempts}). Erro: ${err.message}`);
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

    logSchema("Garantindo linha singleton de platform_settings (id=1)...");
    await connection.query(
      `
      INSERT IGNORE INTO platform_settings (id, meta_graph_version)
      VALUES (1, 'v20.0')
    `,
    );

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
         LIMIT 1`
      );
      if (cols.length > 0) {
        if (cols[0].IS_NULLABLE === 'NO') {
          logSchema('Migrando bot_settings.instance_id de NOT NULL para NULL...');
          await connection.query(
            `ALTER TABLE bot_settings MODIFY COLUMN instance_id VARCHAR(50) NULL`
          );
          logSchema('Migração bot_settings.instance_id concluída.');
        }
        // Sempre limpa strings vazias — independente da versão anterior
        const [updateResult] = await connection.query(
          `UPDATE bot_settings SET instance_id = NULL WHERE instance_id = ''`
        );
        if (Number(updateResult?.affectedRows) > 0) {
          logSchema(`Limpeza: ${updateResult.affectedRows} registro(s) com instance_id vazio convertidos para NULL.`);
        }
      }
    } catch (err) {
      console.warn('[Schema] Falha ao migrar bot_settings.instance_id (não crítico):', err.message);
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
           AND REFERENCED_TABLE_NAME = 'bot_steps'`
      );
      for (const fk of fksSteps) {
        const fkName = fk.CONSTRAINT_NAME || fk.constraint_name;
        if (fkName) {
          logSchema(`Migração: Removendo chave estrangeira obsoleta \`${fkName}\` da tabela \`bot_steps\`...`);
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
           AND REFERENCED_TABLE_NAME = 'bot_steps'`
      );
      for (const fk of fksOptions) {
        const fkName = fk.CONSTRAINT_NAME || fk.constraint_name;
        if (fkName) {
          logSchema(`Migração: Removendo chave estrangeira obsoleta \`${fkName}\` da tabela \`bot_step_options\`...`);
          await connection.query(`ALTER TABLE \`bot_step_options\` DROP FOREIGN KEY \`${fkName}\``);
          logSchema(`Chave estrangeira \`${fkName}\` de \`bot_step_options\` removida.`);
        }
      }
    } catch (err) {
      console.warn('[Schema] Falha ao migrar/remover chaves estrangeiras de next_step_id (não crítico):', err.message);
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
        instance_id VARCHAR(50) NOT NULL,
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

    // Adiciona colunas que podem não ter sido criadas na v1
    await ensureColumnExists(connection, "bot_steps", "media_url", "VARCHAR(1024) NULL");
    await ensureColumnExists(connection, "bot_steps", "position_x", "FLOAT NOT NULL DEFAULT 0");
    await ensureColumnExists(connection, "bot_steps", "position_y", "FLOAT NOT NULL DEFAULT 0");
    await ensureColumnExists(connection, "bot_steps", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
    await ensureColumnExists(connection, "bot_steps", "updated_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");

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

    // Insere flows de demonstração iniciais para testes locais
    try {
      const [users] = await connection.query("SELECT id FROM users LIMIT 1");
      if (users.length > 0) {
        logSchema("Garantindo flows iniciais de demonstração...");
        await connection.query(
          `
          INSERT IGNORE INTO whatsapp_flows (id, user_id, flow_id, flow_name, status)
          VALUES (UUID(), ?, '789123456', 'Orçamento de Serviços', 'published')
          `,
          [users[0].id]
        );
      }
    } catch (err) {
      console.warn('[Schema] Falha ao inserir flow de demonstração (não crítico):', err.message);
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
