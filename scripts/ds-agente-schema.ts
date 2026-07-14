import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

function getDbConfig() {
  const envPath = path.resolve(process.cwd(), ".env");
  const envFile = fs.readFileSync(envPath, "utf-8");
  
  const env: Record<string, string> = {};
  envFile.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...value] = trimmed.split("=");
      env[key] = value.join("=").replace(/^"|"$/g, "").replace(/^'|'$/g, "");
    }
  });

  return {
    host: env.DB_HOST || "localhost",
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER || "root",
    password: env.DB_PASSWORD || "",
    database: env.DB_NAME || "wapi_weaver",
  };
}

async function run() {
  console.log("Connecting to the database to create DS Agente schema...");
  const config = getDbConfig();
  const conn = await mysql.createConnection(config);

  try {
    console.log("Creating ds_agent_folders...");
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

    console.log("Creating ds_agents...");
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ds_agents (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        folder_id VARCHAR(36) NULL,
        name VARCHAR(255) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        api_key_encrypted TEXT NULL,
        model VARCHAR(100) NOT NULL,
        status ENUM('active', 'inactive') DEFAULT 'inactive',
        
        -- Configurações Behavior
        answer_only_assigned BOOLEAN DEFAULT false,
        chunk_responses BOOLEAN DEFAULT false,
        process_images BOOLEAN DEFAULT false,
        process_audio BOOLEAN DEFAULT false,
        disable_outside_hours BOOLEAN DEFAULT false,
        pause_on_human BOOLEAN DEFAULT true,
        wait_time_seconds INT DEFAULT 0,
        max_messages_per_interaction INT DEFAULT 5,
        temperature DECIMAL(3,2) DEFAULT 0.7,
        max_tokens INT DEFAULT 1000,
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (folder_id) REFERENCES ds_agent_folders(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Creating ds_agent_subagents...");
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ds_agent_subagents (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        agent_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(255) NOT NULL,
        instructions TEXT NOT NULL,
        exec_order INT DEFAULT 0,
        model VARCHAR(100) NOT NULL,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES ds_agents(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Creating ds_agent_knowledge...");
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ds_agent_knowledge (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        agent_id VARCHAR(36) NOT NULL,
        title VARCHAR(255) NOT NULL,
        type ENUM('text', 'url', 'pdf', 'docx', 'qa') NOT NULL,
        content LONGTEXT NULL,
        status ENUM('pending', 'indexed', 'failed') DEFAULT 'pending',
        last_indexed_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES ds_agents(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Creating ds_agent_tools...");
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ds_agent_tools (
        id VARCHAR(36) PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        agent_id VARCHAR(36) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT NULL,
        permissions JSON NULL,
        require_confirmation BOOLEAN DEFAULT true,
        is_active BOOLEAN DEFAULT false,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES ds_agents(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Creating ds_agent_assignments...");
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
        FOREIGN KEY (agent_id) REFERENCES ds_agents(id) ON DELETE CASCADE,
        FOREIGN KEY (whatsapp_session_id) REFERENCES wapi_sessions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Creating ds_agent_sessions...");
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
        FOREIGN KEY (agent_id) REFERENCES ds_agents(id) ON DELETE CASCADE,
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Creating ds_agent_usage...");
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

    console.log("Creating ds_agent_logs...");
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

    console.log("All DS Agente tables created successfully!");

  } catch (error) {
    console.error("Error creating tables:", error);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
