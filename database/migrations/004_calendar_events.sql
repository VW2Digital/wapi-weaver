-- ==============================================================================
-- BLIV CRM / WAPI WEAVER - MIGRATION 004: CALENDAR EVENTS
-- ==============================================================================
-- NOTA: Arquivo em SQL puro, sem comandos DELIMITER ou procedimentos armazenados.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS calendar_events (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,

  title VARCHAR(255) NOT NULL,
  description TEXT NULL,

  event_type VARCHAR(50) NOT NULL DEFAULT 'reuniao',
  status VARCHAR(50) NOT NULL DEFAULT 'agendado',

  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT FALSE,
  timezone VARCHAR(100) NOT NULL DEFAULT 'America/Sao_Paulo',

  contact_id VARCHAR(36) NULL,
  responsible_user_id VARCHAR(36) NULL,
  team_id VARCHAR(36) NULL,
  ds_agent_id VARCHAR(36) NULL,

  location VARCHAR(500) NULL,
  meeting_url VARCHAR(1000) NULL,
  color VARCHAR(30) NULL DEFAULT '#7C3AED',

  recurrence_type VARCHAR(50) NULL DEFAULT 'none',
  recurrence_rule TEXT NULL,

  reminder_minutes INT NULL,

  created_by_type ENUM('user', 'ds_agent', 'system') NOT NULL DEFAULT 'user',
  created_by_user_id VARCHAR(36) NULL,
  created_by_agent_id VARCHAR(36) NULL,

  metadata JSON NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,

  INDEX idx_calendar_tenant_start (tenant_id, start_at),
  INDEX idx_calendar_tenant_end (tenant_id, end_at),
  INDEX idx_calendar_tenant_resp_start (tenant_id, responsible_user_id, start_at),
  INDEX idx_calendar_tenant_agent_start (tenant_id, ds_agent_id, start_at),
  INDEX idx_calendar_contact (contact_id),
  INDEX idx_calendar_team (team_id),
  INDEX idx_calendar_deleted (deleted_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
  FOREIGN KEY (responsible_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY (ds_agent_id) REFERENCES ds_agents(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE ds_agent_tools MODIFY COLUMN tool_key VARCHAR(100) NOT NULL;
