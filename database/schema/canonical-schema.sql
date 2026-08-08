-- ==============================================================================
-- BLIV CRM / WAPI WEAVER - CANONICAL DATABASE SCHEMA (FONTE UNICA DE VERDADE)
-- ==============================================================================
-- USAGE: Instalação Nova (source of truth para scripts/create-all-tables.js)
-- Para upgrade de instalações existentes, as migrações estão em database/migrations/.
-- NENHUM COMANDO DELIMITER OU PROCEDIMENTO ARMAZENADO. 100% SQL PURO IDEMPOTENTE.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profiles (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NULL,
  full_name VARCHAR(255) NULL,
  avatar_url TEXT NULL,
  display_name VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  company_name VARCHAR(255) NULL,
  company_document VARCHAR(100) NULL,
  company_address TEXT NULL,
  company_website VARCHAR(255) NULL,
  rate_limit_per_second INT NOT NULL DEFAULT 10,
  whatsapp_verify_token VARCHAR(255) NULL,
  whatsapp_access_token TEXT NULL,
  whatsapp_phone_number_id VARCHAR(100) NULL,
  whatsapp_waba_id VARCHAR(100) NULL,
  whatsapp_business_id VARCHAR(100) NULL,
  whatsapp_business_phone VARCHAR(50) NULL,
  whatsapp_app_secret TEXT NULL,
  whatsapp_app_id VARCHAR(100) NULL,
  meta_graph_version VARCHAR(50) NOT NULL DEFAULT 'v20.0',
  salvy_api_key TEXT NULL,
  api_key TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_roles (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  role ENUM('admin_master', 'admin', 'user') NOT NULL DEFAULT 'user',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_unique_user_id (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS platform_settings (
  id INT NOT NULL PRIMARY KEY DEFAULT 1,
  meta_app_id VARCHAR(255) NULL,
  meta_app_secret TEXT NULL,
  meta_config_id VARCHAR(255) NULL,
  meta_graph_version VARCHAR(50) NOT NULL DEFAULT 'v20.0',
  cron_secret TEXT NULL,
  head_tags TEXT NULL,
  body_tags TEXT NULL,
  sidebar_order TEXT NULL,
  seo_title VARCHAR(128) NULL,
  seo_description VARCHAR(320) NULL,
  license_key VARCHAR(255) NULL,
  license_token TEXT NULL,
  installation_id VARCHAR(255) NULL,
  license_grace_period_start DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by VARCHAR(36) NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS licenses (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  license_key_hash VARCHAR(255) NOT NULL,
  license_key_preview VARCHAR(255) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255) NOT NULL,
  plan VARCHAR(50) NOT NULL DEFAULT 'basic',
  status ENUM('active', 'suspended', 'cancelled', 'expired') NOT NULL DEFAULT 'active',
  tenant_id VARCHAR(36) NULL UNIQUE,
  expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS license_activations (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  license_id VARCHAR(36) NOT NULL,
  domain VARCHAR(255) NULL,
  ip_address VARCHAR(45) NULL,
  installation_id VARCHAR(255) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  activated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS license_validation_logs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  license_id VARCHAR(36) NULL,
  domain VARCHAR(255) NULL,
  ip_address VARCHAR(45) NULL,
  status VARCHAR(50) NOT NULL,
  message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contacts (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  phone_e164 VARCHAR(50) NULL,
  contact_number VARCHAR(50) NULL,
  name VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  company VARCHAR(255) NULL,
  position VARCHAR(255) NULL,
  notes TEXT NULL,
  status VARCHAR(50) NULL,
  responsible_user_id VARCHAR(36) NULL,
  source VARCHAR(255) NULL,
  source_type VARCHAR(50) NULL,
  source_name VARCHAR(255) NULL,
  source_id VARCHAR(36) NULL,
  external_id VARCHAR(255) NULL,
  external_contact_id VARCHAR(255) NULL,
  metadata JSON NULL,
  opted_out BOOLEAN NOT NULL DEFAULT false,
  channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
  custom_fields JSON NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  chat_status VARCHAR(50) NOT NULL DEFAULT 'aberto',
  is_unread BOOLEAN NOT NULL DEFAULT false,
  kanban_stage_id VARCHAR(36) NULL,
  last_interaction_at DATETIME NULL,
  normalized_phone VARCHAR(50) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_contacts_user_phone (user_id, phone_e164),
  INDEX idx_contacts_tenant (tenant_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `groups` (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_groups (
  contact_id VARCHAR(36) NOT NULL,
  group_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (contact_id, group_id),
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS custom_fields (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  field_key VARCHAR(100) NOT NULL,
  field_label VARCHAR(255) NOT NULL,
  field_type ENUM('text', 'number', 'date', 'select', 'boolean') NOT NULL DEFAULT 'text',
  options_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_custom_fields_user_key (user_id, field_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_custom_fields (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  label VARCHAR(255) NOT NULL,
  `key` VARCHAR(100) NOT NULL,
  type ENUM('text','textarea','number','currency','date','datetime','select','multi_select','boolean','email','phone','url') NOT NULL DEFAULT 'text',
  placeholder TEXT NULL,
  options JSON NULL,
  default_value TEXT NULL,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  show_on_form BOOLEAN NOT NULL DEFAULT TRUE,
  show_on_table BOOLEAN NOT NULL DEFAULT FALSE,
  show_on_details BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_field (user_id, `key`),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_custom_field_values (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  contact_id VARCHAR(36) NOT NULL,
  custom_field_id VARCHAR(36) NOT NULL,
  value TEXT NULL,
  value_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_contact_field (user_id, contact_id, custom_field_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (custom_field_id) REFERENCES contact_custom_fields(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tags (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(50) NOT NULL DEFAULT '#8B5CF6',
  icon VARCHAR(50) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_tag (user_id, name),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_tags (
  contact_id VARCHAR(36) NOT NULL,
  tag_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  PRIMARY KEY (contact_id, tag_id),
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversation_tags (
  contact_number VARCHAR(50) NOT NULL,
  tag_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (contact_number, tag_id, user_id),
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS templates (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  name VARCHAR(255) NOT NULL,
  language VARCHAR(10) NOT NULL DEFAULT 'pt_BR',
  category VARCHAR(50) NOT NULL DEFAULT 'MARKETING',
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  components JSON NULL,
  parameter_format VARCHAR(50) NULL,
  allow_category_change BOOLEAN NOT NULL DEFAULT TRUE,
  cta_url_link_tracking_opted_out BOOLEAN NOT NULL DEFAULT FALSE,
  message_send_ttl_seconds INT NULL,
  sub_category VARCHAR(100) NULL,
  display_format VARCHAR(100) NULL,
  is_primary_device_delivery_only BOOLEAN NOT NULL DEFAULT FALSE,
  meta_template_id VARCHAR(255) NULL,
  synced_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_templates_user_name_lang (user_id, name, language),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lists (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS list_contacts (
  list_id VARCHAR(36) NOT NULL,
  contact_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (list_id, contact_id),
  FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaigns (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  name VARCHAR(255) NOT NULL,
  message_type VARCHAR(50) NOT NULL DEFAULT 'text',
  template_id VARCHAR(36) NULL,
  list_id VARCHAR(36) NULL,
  payload JSON NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  scheduled_at DATETIME NULL,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  totals JSON NULL,
  total_contacts INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaign_logs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  campaign_id VARCHAR(36) NOT NULL,
  contact_number VARCHAR(50) NOT NULL,
  status ENUM('sent', 'delivered', 'read', 'failed') NOT NULL DEFAULT 'sent',
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaign_messages (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  campaign_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  contact_id VARCHAR(36) NULL,
  contact_number VARCHAR(50) NULL,
  to_phone VARCHAR(50) NULL,
  message_type VARCHAR(50) NOT NULL DEFAULT 'text',
  message_body TEXT NULL,
  attempts INT NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  error JSON NULL,
  error_message TEXT NULL,
  wa_message_id VARCHAR(255) NULL,
  sent_at DATETIME NULL,
  delivered_at DATETIME NULL,
  read_at DATETIME NULL,
  failed_at DATETIME NULL,
  pricing_billable BOOLEAN NOT NULL DEFAULT false,
  pricing_category VARCHAR(50) NULL,
  conversation_id VARCHAR(100) NULL,
  conversation_origin VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bot_settings (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  instance_id VARCHAR(50) NULL,
  name VARCHAR(150) NULL,
  channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
  priority INT NOT NULL DEFAULT 0,
  trigger_type VARCHAR(50) NOT NULL DEFAULT 'start',
  trigger_value VARCHAR(255) NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  pause_timeout_minutes INT NOT NULL DEFAULT 60,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bot_flows (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  name VARCHAR(255) NOT NULL,
  trigger_keyword VARCHAR(255) NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  flow_data JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bot_steps (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  flow_id VARCHAR(36) NULL,
  user_id VARCHAR(36) NULL,
  tenant_id VARCHAR(36) NULL,
  bot_settings_id VARCHAR(36) NULL,
  step_order INT NOT NULL DEFAULT 0,
  trigger_type VARCHAR(50) NULL,
  trigger_value VARCHAR(255) NULL,
  next_step_id VARCHAR(36) NULL,
  step_type VARCHAR(50) NULL,
  content JSON NULL,
  message_type VARCHAR(50) NOT NULL DEFAULT 'text',
  message_content TEXT NULL,
  media_url VARCHAR(1024) NULL,
  media_caption TEXT NULL,
  footer_text VARCHAR(255) NULL,
  buttons_config JSON NULL,
  delay_seconds INT NOT NULL DEFAULT 0,
  position_x FLOAT NOT NULL DEFAULT 0,
  position_y FLOAT NOT NULL DEFAULT 0,
  assign_team_id VARCHAR(36) NULL,
  assign_user_id VARCHAR(36) NULL,
  handoff_message TEXT NULL,
  card_color VARCHAR(50) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bot_step_options (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
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

CREATE TABLE IF NOT EXISTS bot_flow_executions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  bot_flow_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  contact_number VARCHAR(50) NOT NULL,
  current_node_id VARCHAR(100) NULL,
  status ENUM('active', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'active',
  variables_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (bot_flow_id) REFERENCES bot_flows(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bot_conversation_state (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  contact_number VARCHAR(50) NOT NULL,
  instance_id VARCHAR(100) NULL,
  channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
  bot_active BOOLEAN NOT NULL DEFAULT true,
  is_paused BOOLEAN NOT NULL DEFAULT false,
  paused_until DATETIME NULL,
  current_flow_id VARCHAR(36) NULL,
  current_step_id VARCHAR(100) NULL,
  state_data JSON NULL,
  provider_account_id VARCHAR(255) NULL,
  last_interaction DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teams (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  auto_assign_mode ENUM('manual', 'round_robin', 'least_busy') NOT NULL DEFAULT 'manual',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS team_members (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  team_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  role ENUM('agent', 'supervisor') NOT NULL DEFAULT 'agent',
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_team_member (team_id, user_id),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversation_assignments (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  contact_phone VARCHAR(50) NOT NULL,
  team_id VARCHAR(36) NULL,
  agent_id VARCHAR(36) NULL,
  assigned_by VARCHAR(36) NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unassigned_at DATETIME NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_funnels (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_by_user_id VARCHAR(36) NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_stages (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  funnel_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT NULL,
  color VARCHAR(50) NOT NULL DEFAULT '#3b82f6',
  probability_percent INT NOT NULL DEFAULT 50,
  sort_order INT NOT NULL DEFAULT 0,
  is_won_stage BOOLEAN NOT NULL DEFAULT false,
  is_lost_stage BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by_user_id VARCHAR(36) NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (funnel_id) REFERENCES sales_funnels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS opportunity_lost_reasons (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS opportunities (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  funnel_id VARCHAR(36) NOT NULL,
  stage_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  primary_contact_id VARCHAR(36) NULL,
  company_name VARCHAR(255) NULL,
  owner_user_id VARCHAR(36) NULL,
  created_by_user_id VARCHAR(36) NULL,
  value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
  probability_percent INT NOT NULL DEFAULT 50,
  expected_close_date DATETIME NULL,
  source VARCHAR(100) NULL,
  temperature VARCHAR(50) NOT NULL DEFAULT 'warm',
  priority VARCHAR(50) NOT NULL DEFAULT 'medium',
  status ENUM('open','won','lost') NOT NULL DEFAULT 'open',
  lost_reason_id VARCHAR(36) NULL,
  lost_notes TEXT NULL,
  closed_at DATETIME NULL,
  kanban_order DOUBLE NOT NULL DEFAULT 0.0,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (funnel_id) REFERENCES sales_funnels(id) ON DELETE CASCADE,
  FOREIGN KEY (stage_id) REFERENCES sales_stages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS opportunity_contacts (
  opportunity_id VARCHAR(36) NOT NULL,
  contact_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  role VARCHAR(100) NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (opportunity_id, contact_id),
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS opportunity_tags (
  opportunity_id VARCHAR(36) NOT NULL,
  tag_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  PRIMARY KEY (opportunity_id, tag_id),
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS opportunity_stage_history (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  opportunity_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  from_stage_id VARCHAR(36) NULL,
  to_stage_id VARCHAR(36) NOT NULL,
  changed_by_user_id VARCHAR(36) NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS opportunity_activities (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  opportunity_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  due_date DATETIME NULL,
  completed_at DATETIME NULL,
  created_by_user_id VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS opportunity_notes (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  opportunity_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  note TEXT NOT NULL,
  created_by_user_id VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS opportunity_audit_logs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  opportunity_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  action VARCHAR(100) NOT NULL,
  field_name VARCHAR(100) NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  created_by_user_id VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_activities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  contact_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NULL,
  tenant_id VARCHAR(36) NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  source_type VARCHAR(50) NULL,
  source_id VARCHAR(36) NULL,
  payload JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ds_agent_folders (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ds_agents (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  folder_id VARCHAR(36) NULL,
  name VARCHAR(255) NOT NULL,
  prompt TEXT NULL,
  provider VARCHAR(100) NOT NULL DEFAULT 'OpenAI Padrão',
  model VARCHAR(100) NOT NULL DEFAULT 'gpt-4o-mini',
  api_key_encrypted TEXT NULL,
  instructions_basic TEXT NULL,
  instructions_advanced TEXT NULL,
  mode ENUM('basico','avancado') NOT NULL DEFAULT 'basico',
  reply_with_assigned_agent BOOLEAN NOT NULL DEFAULT FALSE,
  split_replies_in_blocks BOOLEAN NOT NULL DEFAULT FALSE,
  process_images BOOLEAN NOT NULL DEFAULT FALSE,
  disabled_outside_platform BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (folder_id) REFERENCES ds_agent_folders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ds_agent_documents (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  agent_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NULL,
  content_text LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES ds_agents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ds_agent_knowledge_files (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  agent_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size_kb INT NOT NULL DEFAULT 0,
  page_count INT NOT NULL DEFAULT 1,
  status ENUM('ativo','inativo') NOT NULL DEFAULT 'ativo',
  storage_path TEXT NOT NULL,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES ds_agents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ds_agent_knowledge_links (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  agent_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NOT NULL,
  url TEXT NOT NULL,
  status ENUM('pendente','indexado','erro') NOT NULL DEFAULT 'pendente',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES ds_agents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ds_agent_tools (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  agent_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NOT NULL,
  tool_key ENUM('google_calendar','consulta_crm','enviar_proposta','webhook_customizado','gerenciar_tags') NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  config JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ds_tool (agent_id, tool_key),
  FOREIGN KEY (agent_id) REFERENCES ds_agents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ds_agent_calendar_availability (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  agent_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NOT NULL,
  weekday TINYINT NOT NULL,
  start_time TIME NOT NULL DEFAULT '08:00:00',
  end_time TIME NOT NULL DEFAULT '18:00:00',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_ds_cal_avail (agent_id, weekday),
  FOREIGN KEY (agent_id) REFERENCES ds_agents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ds_agent_followups (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  agent_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('manual','generativo') NOT NULL DEFAULT 'manual',
  recurrence ENUM('unico','recorrente','diario') NOT NULL DEFAULT 'unico',
  wait_amount INT NOT NULL DEFAULT 10,
  wait_unit ENUM('minutos','horas','dias') NOT NULL DEFAULT 'minutos',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES ds_agents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ds_agent_usage_logs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  agent_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NOT NULL,
  model VARCHAR(100) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  category ENUM('action_analysis','completion','embedding','query_rewriting','transcription') NOT NULL,
  tokens INT NOT NULL DEFAULT 0,
  cost_usd DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_sessions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  contact_id VARCHAR(36) NULL,
  contact_number VARCHAR(50) NULL,
  channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
  assigned_to VARCHAR(36) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'aguardando',
  last_message_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  answered_at DATETIME NULL,
  closed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS direct_messages (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  contact_phone VARCHAR(50) NOT NULL,
  contact_number VARCHAR(50) NULL,
  direction ENUM('inbound', 'outbound', 'incoming', 'outgoing') NOT NULL DEFAULT 'inbound',
  message_type VARCHAR(50) NOT NULL DEFAULT 'text',
  type ENUM('text', 'reaction', 'image', 'audio', 'video', 'document', 'sticker', 'location', 'contacts') NOT NULL DEFAULT 'text',
  body TEXT NULL,
  media_url TEXT NULL,
  wa_message_id VARCHAR(255) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'sent',
  reply_to_message_id VARCHAR(255) NULL,
  channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
  provider_message_id VARCHAR(255) NULL,
  provider_account_id VARCHAR(255) NULL,
  sender_wa_id VARCHAR(50) NULL,
  sender_name VARCHAR(255) NULL,
  recipient_type VARCHAR(50) NULL,
  external_group_id VARCHAR(100) NULL,
  raw_payload JSON NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS message_tags (
  message_id VARCHAR(36) NOT NULL,
  tag_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (message_id, tag_id),
  FOREIGN KEY (message_id) REFERENCES direct_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'UTILITY',
  language VARCHAR(20) NOT NULL DEFAULT 'pt_BR',
  status VARCHAR(50) NOT NULL DEFAULT 'APPROVED',
  components_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS whatsapp_flows (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
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

CREATE TABLE IF NOT EXISTS whatsapp_groups (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS whatsapp_group_participants (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS incoming_webhooks (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  field_labels JSON NULL,
  status ENUM('listening','paused') NOT NULL DEFAULT 'listening',
  events_count INT NOT NULL DEFAULT 0,
  leads_count INT NOT NULL DEFAULT 0,
  last_event_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS incoming_webhook_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  webhook_id VARCHAR(36) NOT NULL,
  contact_id VARCHAR(36) NULL,
  idempotency_key VARCHAR(64) NULL,
  status ENUM('received','processing','processed','failed') NOT NULL DEFAULT 'received',
  action VARCHAR(50) NULL,
  raw_payload JSON NOT NULL,
  mapped_standard_fields JSON NULL,
  mapped_custom_fields JSON NULL,
  unmapped_fields JSON NULL,
  headers JSON NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  error_code VARCHAR(50) NULL,
  error_message TEXT NULL,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  processing_duration_ms INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (webhook_id) REFERENCES incoming_webhooks(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webhook_field_mappings (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  webhook_id VARCHAR(36) NOT NULL,
  external_field VARCHAR(255) NOT NULL,
  target_type ENUM('standard','custom','ignore') NOT NULL,
  target_key VARCHAR(100) NULL,
  custom_field_id VARCHAR(36) NULL,
  transformation VARCHAR(50) NULL,
  default_value TEXT NULL,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_webhook_field (user_id, webhook_id, external_field),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (webhook_id) REFERENCES incoming_webhooks(id) ON DELETE CASCADE,
  FOREIGN KEY (custom_field_id) REFERENCES contact_custom_fields(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS outgoing_webhooks (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  url VARCHAR(500) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  status ENUM('active','paused') NOT NULL DEFAULT 'active',
  retry_count INT NOT NULL DEFAULT 3,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS outgoing_webhook_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  outgoing_webhook_id VARCHAR(36) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload_sent JSON NOT NULL,
  response_status INT NULL,
  response_body TEXT NULL,
  attempt_number INT NOT NULL DEFAULT 1,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (outgoing_webhook_id) REFERENCES outgoing_webhooks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_agent_settings (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
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

CREATE TABLE IF NOT EXISTS knowledge_base (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NULL,
  ai_agent_settings_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (ai_agent_settings_id) REFERENCES ai_agent_settings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS instagram_accounts (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  ig_user_id VARCHAR(100) NOT NULL UNIQUE,
  username VARCHAR(100) NULL,
  access_token TEXT NOT NULL,
  app_id VARCHAR(100) NULL,
  app_secret VARCHAR(255) NULL,
  token_expires_at DATETIME NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS instagram_webhook_events (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NULL,
  raw JSON NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS facebook_webhook_events (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NULL,
  raw JSON NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscription_plans (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  slug VARCHAR(80) NULL,
  description TEXT NULL,
  price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  price_yearly DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  max_contacts INT NOT NULL DEFAULT 1000,
  max_campaigns INT NOT NULL DEFAULT 10,
  max_agents INT NOT NULL DEFAULT 1,
  max_funnels INT NOT NULL DEFAULT 1,
  max_users INT NOT NULL DEFAULT 1,
  features_json JSON NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL UNIQUE,
  plan_id VARCHAR(36) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  customer_id VARCHAR(255) NULL,
  current_period_start DATETIME NULL,
  current_period_end DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscription_events (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  tenant_id VARCHAR(255) NULL,
  subscription_id VARCHAR(36) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  previous_status VARCHAR(32) NULL,
  new_status VARCHAR(32) NULL,
  source VARCHAR(64) NOT NULL DEFAULT 'system',
  gateway_event_id VARCHAR(255) NULL,
  payload_json JSON NULL,
  raw_payload LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscription_plan_changes (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  subscription_id VARCHAR(36) NOT NULL,
  old_plan VARCHAR(64) NOT NULL,
  new_plan VARCHAR(64) NOT NULL,
  effective_date DATETIME NOT NULL,
  applied_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billing_plans (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
  billing_interval ENUM('day', 'week', 'month', 'year') NOT NULL DEFAULT 'month',
  billing_interval_count INT NOT NULL DEFAULT 1,
  duration_days INT NOT NULL DEFAULT 30,
  features JSON NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  subscription_plan_id VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (subscription_plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billing_invoices (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  plan_id VARCHAR(36) NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
  status ENUM('pending', 'paid', 'cancelled', 'refunded', 'failed') NOT NULL DEFAULT 'pending',
  due_date DATETIME NULL,
  paid_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billing_payments (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  invoice_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NOT NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'mercadopago',
  provider_payment_id VARCHAR(255) NULL,
  external_reference VARCHAR(255) NULL,
  payment_method VARCHAR(50) NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  status_detail TEXT NULL,
  approved_at DATETIME NULL,
  expires_at DATETIME NULL,
  qr_code TEXT NULL,
  qr_code_base64 LONGTEXT NULL,
  ticket_url TEXT NULL,
  payload_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES billing_invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  payload_json JSON NOT NULL,
  error_message TEXT NULL,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_gateway_settings (
  id CHAR(36) NOT NULL PRIMARY KEY,
  tenant_id VARCHAR(191) NOT NULL UNIQUE,
  provider VARCHAR(40) NOT NULL DEFAULT 'mercadopago',
  environment ENUM('sandbox', 'production') NOT NULL DEFAULT 'sandbox',
  checkout_mode ENUM('redirect', 'transparent') NOT NULL DEFAULT 'redirect',
  sandbox_public_key TEXT NULL,
  sandbox_client_id TEXT NULL,
  sandbox_access_token TEXT NULL,
  sandbox_client_secret TEXT NULL,
  production_public_key TEXT NULL,
  production_client_id TEXT NULL,
  production_access_token TEXT NULL,
  production_client_secret TEXT NULL,
  webhook_secret TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tenant_storage (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NULL,
  entity_id VARCHAR(255) NULL,
  details_json JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webhook_events (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  tenant_id VARCHAR(36) NULL,
  event_type VARCHAR(100) NOT NULL,
  payload_json JSON NOT NULL,
  status ENUM('pending', 'processed', 'failed') NOT NULL DEFAULT 'pending',
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  received_at DATETIME NULL,
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS platform_banners (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  subtitle TEXT NULL,
  cta_label VARCHAR(100) NULL,
  cta_url VARCHAR(500) NULL,
  image_path VARCHAR(500) NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_by VARCHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO platform_settings (id, meta_graph_version) 
VALUES (1, 'v20.0') 
ON DUPLICATE KEY UPDATE id=1;
