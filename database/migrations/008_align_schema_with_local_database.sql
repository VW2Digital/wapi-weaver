-- Migration 008: Align schema exactly with local database
-- Restores 8 local tables and drops 4 legacy repo-only tables absent from local dump.

-- 1. Create missing local tables
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  tenant_id VARCHAR(36) NOT NULL,
  contact_phone VARCHAR(50) NULL,
  model VARCHAR(100) NOT NULL,
  prompt_tokens INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_ai_tenant (tenant_id, created_at),
  FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ds_agent_assignments (
  id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NOT NULL,
  agent_id VARCHAR(36) NOT NULL,
  whatsapp_session_id VARCHAR(36) NULL,
  funnel_stage_id VARCHAR(36) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_ds_agent_assignments_tenant (tenant_id),
  INDEX idx_ds_agent_assignments_agent (agent_id),
  FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES ds_agents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ds_agent_knowledge (
  id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NOT NULL,
  agent_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  type ENUM('text','faq','url','pdf') DEFAULT 'text',
  content LONGTEXT NULL,
  status ENUM('pending','indexed','error') DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_ds_agent_knowledge_tenant (tenant_id),
  INDEX idx_ds_agent_knowledge_agent (agent_id),
  FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES ds_agents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ds_agent_logs (
  id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NOT NULL,
  agent_id VARCHAR(36) NOT NULL,
  level ENUM('info','warn','error') DEFAULT 'info',
  message TEXT NOT NULL,
  details JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_ds_agent_logs_tenant (tenant_id),
  INDEX idx_ds_agent_logs_agent (agent_id),
  FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES ds_agents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ds_agent_sessions (
  id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NOT NULL,
  agent_id VARCHAR(36) NOT NULL,
  contact_id VARCHAR(36) NULL,
  status ENUM('active','paused','completed') DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_ds_agent_sessions_tenant (tenant_id),
  INDEX idx_ds_agent_sessions_agent (agent_id),
  FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES ds_agents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ds_agent_subagents (
  id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NOT NULL,
  agent_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(255) NOT NULL DEFAULT '',
  instructions TEXT NULL,
  exec_order INT DEFAULT 0,
  model VARCHAR(100) DEFAULT 'gpt-4o-mini',
  status ENUM('active','inactive') DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_ds_agent_subagents_tenant (tenant_id),
  INDEX idx_ds_agent_subagents_agent (agent_id),
  FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES ds_agents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ds_agent_usage (
  id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NOT NULL,
  agent_id VARCHAR(36) NOT NULL,
  session_id VARCHAR(36) NULL,
  prompt_tokens INT DEFAULT 0,
  completion_tokens INT DEFAULT 0,
  total_tokens INT DEFAULT 0,
  tools_called JSON NULL,
  response_time_ms INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_ds_agent_usage_tenant (tenant_id),
  INDEX idx_ds_agent_usage_agent (agent_id),
  INDEX idx_ds_agent_usage_session (session_id),
  FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES ds_agents(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES ds_agent_sessions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS salvy_numbers (
  id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  salvy_id VARCHAR(100) NOT NULL,
  phone_number VARCHAR(50) NOT NULL,
  area_code INT NULL,
  name VARCHAR(255) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  cost_center VARCHAR(255) NULL,
  cancel_reason TEXT NULL,
  created_at_remote DATETIME NULL,
  canceled_at DATETIME NULL,
  raw JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_salvy (user_id, salvy_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Drop 4 repo-only tables absent from local database
DROP TABLE IF EXISTS bot_flow_executions;
DROP TABLE IF EXISTS ds_agent_documents;
DROP TABLE IF EXISTS tenant_storage;
DROP TABLE IF EXISTS whatsapp_templates;
