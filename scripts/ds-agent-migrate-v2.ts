/**
 * Migration: Cria todas as tabelas do DS Agente, incluindo Atribuições, Sessões, Uso e Logs.
 * Execute: npx tsx scripts/ds-agent-migrate-v2.ts
 */

import mysql from "mysql2/promise";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

const config = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "wapi_user",
  password: process.env.DB_PASSWORD || "S0xbxPfKazBVT8JFy1UEOjIsrjox",
  database: process.env.DB_NAME || "wapi_weaver",
  multipleStatements: true,
};

async function main() {
  const conn = await mysql.createConnection(config);

  try {
    console.log("🔄 Verificando e atualizando esquema do DS Agente...\n");

    // 1. Folders
    console.log("  ✓ Garantindo ds_agent_folders...");
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ds_agent_folders (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Agents
    console.log("  ✓ Garantindo ds_agents...");
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ds_agents (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        folder_id VARCHAR(36) NULL,
        name VARCHAR(255) NOT NULL,
        provider VARCHAR(50) NOT NULL DEFAULT 'openai',
        api_key_encrypted TEXT NULL,
        model VARCHAR(100) NOT NULL DEFAULT 'gpt-4o-mini',
        status ENUM('active', 'inactive') DEFAULT 'inactive',
        system_prompt LONGTEXT NULL,
        answer_only_assigned TINYINT(1) DEFAULT 0,
        chunk_responses TINYINT(1) DEFAULT 0,
        process_images TINYINT(1) DEFAULT 0,
        process_audio TINYINT(1) DEFAULT 0,
        disable_outside_hours TINYINT(1) DEFAULT 0,
        pause_on_human TINYINT(1) DEFAULT 1,
        wait_time_seconds INT DEFAULT 0,
        max_messages_per_interaction INT DEFAULT 5,
        temperature DECIMAL(3,2) DEFAULT 0.70,
        max_tokens INT DEFAULT 1000,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (folder_id) REFERENCES ds_agent_folders(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Check system_prompt column
    const [cols]: any = await conn.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ds_agents' AND COLUMN_NAME = 'system_prompt'
    `);
    if (cols.length === 0) {
      console.log("  + Adicionando coluna system_prompt...");
      await conn.query(`ALTER TABLE ds_agents ADD COLUMN system_prompt LONGTEXT NULL AFTER status;`);
    }

    // 3. Subagents
    console.log("  ✓ Garantindo ds_agent_subagents...");
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ds_agent_subagents (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        agent_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(255) NOT NULL DEFAULT '',
        instructions TEXT NULL,
        exec_order INT DEFAULT 0,
        model VARCHAR(100) DEFAULT 'gpt-4o-mini',
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES ds_agents(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Knowledge
    console.log("  ✓ Garantindo ds_agent_knowledge...");
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ds_agent_knowledge (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        agent_id VARCHAR(36) NOT NULL,
        title VARCHAR(255) NOT NULL,
        type ENUM('text', 'faq', 'url', 'pdf') DEFAULT 'text',
        content LONGTEXT NULL,
        status ENUM('pending', 'indexed', 'error') DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES ds_agents(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Tools
    console.log("  ✓ Garantindo ds_agent_tools...");
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ds_agent_tools (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        agent_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        permissions JSON NULL,
        require_confirmation TINYINT(1) DEFAULT 1,
        is_active TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES ds_agents(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. Assignments
    console.log("  ✓ Garantindo ds_agent_assignments...");
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ds_agent_assignments (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        agent_id VARCHAR(36) NOT NULL,
        whatsapp_session_id VARCHAR(36) NULL,
        funnel_stage_id VARCHAR(36) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES ds_agents(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. Sessions
    console.log("  ✓ Garantindo ds_agent_sessions...");
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ds_agent_sessions (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        agent_id VARCHAR(36) NOT NULL,
        contact_id VARCHAR(36) NULL,
        status ENUM('active', 'paused', 'completed') DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES ds_agents(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. Usage
    console.log("  ✓ Garantindo ds_agent_usage...");
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ds_agent_usage (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        agent_id VARCHAR(36) NOT NULL,
        session_id VARCHAR(36) NULL,
        prompt_tokens INT DEFAULT 0,
        completion_tokens INT DEFAULT 0,
        total_tokens INT DEFAULT 0,
        tools_called JSON NULL,
        response_time_ms INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES ds_agents(id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES ds_agent_sessions(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 9. Logs
    console.log("  ✓ Garantindo ds_agent_logs...");
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ds_agent_logs (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        agent_id VARCHAR(36) NOT NULL,
        level ENUM('info', 'warn', 'error') DEFAULT 'info',
        message TEXT NOT NULL,
        details JSON NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES ds_agents(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("\n✅ Todas as tabelas do DS Agente foram migradas!");
  } catch (err) {
    console.error("❌ Erro na migração:", err);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
