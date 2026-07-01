-- MySQL Database Schema for wapi-weaver

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
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_roles (user_id, role),
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

INSERT IGNORE INTO platform_settings (id, meta_graph_version)
VALUES (1, 'v20.0');

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NULL,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100) NULL,
  entity_id VARCHAR(100) NULL,
  actor_email VARCHAR(255) NULL,
  ip VARCHAR(50) NULL,
  user_agent TEXT NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schema_backups (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  created_by VARCHAR(36) NULL,
  source VARCHAR(255) NOT NULL,
  `sql` LONGTEXT NOT NULL,
  size_bytes INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS salvy_numbers (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
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
  UNIQUE KEY uq_user_salvy (user_id, salvy_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS contacts (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  phone_e164 VARCHAR(50) NOT NULL,
  name VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  source VARCHAR(255) NULL,
  opted_out BOOLEAN NOT NULL DEFAULT false,
  channel ENUM('whatsapp', 'instagram', 'messenger') NOT NULL DEFAULT 'whatsapp',
  external_contact_id VARCHAR(255) NULL,
  custom_fields JSON NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  chat_status VARCHAR(50) NOT NULL DEFAULT 'aberto',
  is_unread BOOLEAN NOT NULL DEFAULT false,
  kanban_stage_id VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_contact (user_id, phone_e164),
  UNIQUE KEY uq_contact_channel_external (user_id, channel, external_contact_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_tags (
  contact_id VARCHAR(36) NOT NULL,
  tag_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (contact_id, tag_id),
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lists (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
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
  added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (list_id, contact_id),
  FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS templates (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  language VARCHAR(50) NOT NULL,
  category VARCHAR(50) NULL,
  status ENUM('APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED', 'IN_APPEAL', 'PENDING_DELETION', 'DELETED') NOT NULL DEFAULT 'PENDING',
  components JSON NULL,
  parameter_format VARCHAR(20) NULL,
  allow_category_change BOOLEAN NOT NULL DEFAULT TRUE,
  cta_url_link_tracking_opted_out BOOLEAN NOT NULL DEFAULT FALSE,
  message_send_ttl_seconds INT NULL,
  sub_category VARCHAR(100) NULL,
  display_format VARCHAR(20) NULL,
  is_primary_device_delivery_only BOOLEAN NOT NULL DEFAULT FALSE,
  meta_template_id VARCHAR(255) NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_template (user_id, name, language),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaigns (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  list_id VARCHAR(36) NULL,
  template_id VARCHAR(36) NULL,
  message_type ENUM('template', 'text', 'media', 'interactive') NOT NULL,
  status ENUM('draft', 'queued', 'running', 'done', 'failed', 'cancelled') NOT NULL DEFAULT 'draft',
  payload JSON NULL,
  totals JSON NULL,
  scheduled_at DATETIME NULL,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE SET NULL,
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaign_messages (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  campaign_id VARCHAR(36) NOT NULL,
  contact_id VARCHAR(36) NULL,
  to_phone VARCHAR(50) NOT NULL,
  status ENUM('pending', 'sending', 'sent', 'delivered', 'read', 'failed') NOT NULL DEFAULT 'pending',
  wa_message_id VARCHAR(255) NULL,
  conversation_id VARCHAR(255) NULL,
  conversation_origin VARCHAR(255) NULL,
  pricing_billable BOOLEAN NULL,
  pricing_category VARCHAR(50) NULL,
  pricing_model VARCHAR(50) NULL,
  sent_at DATETIME NULL,
  delivered_at DATETIME NULL,
  read_at DATETIME NULL,
  failed_at DATETIME NULL,
  error JSON NULL,
  attempts INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webhook_events (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NULL,
  source VARCHAR(100) NOT NULL,
  raw JSON NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
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
  channel ENUM('whatsapp', 'instagram', 'messenger') NOT NULL DEFAULT 'whatsapp',
  provider_message_id VARCHAR(255) NULL,
  provider_account_id VARCHAR(255) NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversation_tags (
  contact_number VARCHAR(50) NOT NULL,
  tag_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (contact_number, tag_id),
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
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

-- Optimization Indexes
CREATE INDEX idx_conversation_tags_contact ON conversation_tags(contact_number);
CREATE INDEX idx_conversation_tags_tag ON conversation_tags(tag_id);
CREATE INDEX idx_conversation_tags_user ON conversation_tags(user_id);
CREATE INDEX idx_message_tags_message ON message_tags(message_id);
CREATE INDEX idx_message_tags_tag ON message_tags(tag_id);
CREATE INDEX idx_message_tags_user ON message_tags(user_id);
CREATE INDEX idx_campaign_messages_wa_msg ON campaign_messages(wa_message_id);
CREATE INDEX idx_campaign_messages_camp_status ON campaign_messages(campaign_id, status);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed, received_at);
CREATE INDEX idx_wab_profile_logs_user_created ON whatsapp_business_profile_logs(user_id, created_at DESC);
CREATE INDEX idx_wab_profile_logs_phone_created ON whatsapp_business_profile_logs(phone_number_id, created_at DESC);
CREATE INDEX idx_contacts_user_opted ON contacts(user_id, opted_out);
CREATE INDEX idx_direct_messages_user_phone ON direct_messages(user_id, contact_phone);
CREATE INDEX idx_direct_messages_wa_id ON direct_messages(wa_message_id);
CREATE UNIQUE INDEX uq_direct_messages_user_wa_id ON direct_messages(user_id, wa_message_id);
CREATE UNIQUE INDEX uq_dm_channel_msg ON direct_messages(user_id, channel, provider_message_id);

-- Sales Funnels
CREATE TABLE IF NOT EXISTS sales_funnels (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  description TEXT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_by_user_id VARCHAR(36) NULL,
  updated_by_user_id VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_sales_funnels_user_slug (user_id, slug),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sales Stages
CREATE TABLE IF NOT EXISTS sales_stages (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  funnel_id VARCHAR(36) NOT NULL,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  description TEXT NULL,
  color VARCHAR(30) NULL,
  probability_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  sort_order INT NOT NULL DEFAULT 0,
  is_won_stage BOOLEAN NOT NULL DEFAULT FALSE,
  is_lost_stage BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id VARCHAR(36) NULL,
  updated_by_user_id VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_sales_stages_funnel_slug (funnel_id, slug),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (funnel_id) REFERENCES sales_funnels(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Opportunity Lost Reasons
CREATE TABLE IF NOT EXISTS opportunity_lost_reasons (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_lost_reasons_user_name (user_id, name),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Opportunities
CREATE TABLE IF NOT EXISTS opportunities (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  funnel_id VARCHAR(36) NOT NULL,
  stage_id VARCHAR(36) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  primary_contact_id VARCHAR(36) NULL,
  company_name VARCHAR(255) NULL,
  owner_user_id VARCHAR(36) NULL,
  created_by_user_id VARCHAR(36) NULL,
  updated_by_user_id VARCHAR(36) NULL,
  value DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  currency CHAR(3) NOT NULL DEFAULT 'BRL',
  probability_percent DECIMAL(5,2) NULL,
  expected_close_date DATE NULL,
  closed_at DATETIME NULL,
  status ENUM('open', 'won', 'lost', 'paused', 'archived') NOT NULL DEFAULT 'open',
  source VARCHAR(100) NULL,
  temperature ENUM('cold', 'warm', 'hot') NULL,
  priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
  lost_reason_id VARCHAR(36) NULL,
  lost_reason_text TEXT NULL,
  kanban_order DECIMAL(20,10) NOT NULL DEFAULT 0,
  last_activity_at DATETIME NULL,
  next_activity_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (funnel_id) REFERENCES sales_funnels(id) ON DELETE RESTRICT,
  FOREIGN KEY (stage_id) REFERENCES sales_stages(id) ON DELETE RESTRICT,
  FOREIGN KEY (primary_contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (lost_reason_id) REFERENCES opportunity_lost_reasons(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Opportunity Contacts
CREATE TABLE IF NOT EXISTS opportunity_contacts (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  opportunity_id VARCHAR(36) NOT NULL,
  contact_id VARCHAR(36) NOT NULL,
  role VARCHAR(100) NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_opportunity_contact (opportunity_id, contact_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Opportunity Stage History
CREATE TABLE IF NOT EXISTS opportunity_stage_history (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  opportunity_id VARCHAR(36) NOT NULL,
  funnel_id VARCHAR(36) NOT NULL,
  from_stage_id VARCHAR(36) NULL,
  to_stage_id VARCHAR(36) NOT NULL,
  moved_by_user_id VARCHAR(36) NULL,
  moved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason TEXT NULL,
  old_status VARCHAR(50) NULL,
  new_status VARCHAR(50) NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
  FOREIGN KEY (funnel_id) REFERENCES sales_funnels(id) ON DELETE CASCADE,
  FOREIGN KEY (from_stage_id) REFERENCES sales_stages(id) ON DELETE SET NULL,
  FOREIGN KEY (to_stage_id) REFERENCES sales_stages(id) ON DELETE CASCADE,
  FOREIGN KEY (moved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Opportunity Activities
CREATE TABLE IF NOT EXISTS opportunity_activities (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  opportunity_id VARCHAR(36) NOT NULL,
  contact_id VARCHAR(36) NULL,
  assigned_to_user_id VARCHAR(36) NULL,
  created_by_user_id VARCHAR(36) NULL,
  type ENUM('call', 'email', 'meeting', 'task', 'note', 'whatsapp', 'proposal', 'follow_up', 'other') NOT NULL DEFAULT 'task',
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  status ENUM('pending', 'done', 'canceled') NOT NULL DEFAULT 'pending',
  due_at DATETIME NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Opportunity Notes
CREATE TABLE IF NOT EXISTS opportunity_notes (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  opportunity_id VARCHAR(36) NOT NULL,
  user_id_creator VARCHAR(36) NULL,
  body TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id_creator) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Opportunity Tags Pivot
CREATE TABLE IF NOT EXISTS opportunity_tags (
  opportunity_id VARCHAR(36) NOT NULL,
  tag_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (opportunity_id, tag_id),
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Opportunity Audit Logs
CREATE TABLE IF NOT EXISTS opportunity_audit_logs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  opportunity_id VARCHAR(36) NULL,
  user_id_actor VARCHAR(36) NULL,
  action VARCHAR(100) NOT NULL,
  old_values JSON NULL,
  new_values JSON NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id_actor) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes for CRM tables
CREATE INDEX idx_opportunities_funnel_stage_order ON opportunities(user_id, funnel_id, stage_id, kanban_order);
CREATE INDEX idx_opportunities_status ON opportunities(user_id, status);
CREATE INDEX idx_opportunities_owner ON opportunities(owner_user_id);
CREATE INDEX idx_opportunities_primary_contact ON opportunities(primary_contact_id);
CREATE INDEX idx_opportunities_expected_close ON opportunities(expected_close_date);
CREATE INDEX idx_opportunities_last_act ON opportunities(last_activity_at);
CREATE INDEX idx_opportunities_next_act ON opportunities(next_activity_at);
CREATE INDEX idx_opportunities_deleted ON opportunities(deleted_at);

CREATE INDEX idx_opt_contacts_contact ON opportunity_contacts(contact_id);
CREATE INDEX idx_opt_contacts_primary ON opportunity_contacts(opportunity_id, is_primary);

CREATE INDEX idx_stage_history_opp ON opportunity_stage_history(opportunity_id);
CREATE INDEX idx_stage_history_funnel ON opportunity_stage_history(funnel_id);
CREATE INDEX idx_stage_history_moved ON opportunity_stage_history(moved_at);

CREATE INDEX idx_opt_activities_opp ON opportunity_activities(opportunity_id);
CREATE INDEX idx_opt_activities_due ON opportunity_activities(due_at);
CREATE INDEX idx_opt_activities_status ON opportunity_activities(status);

CREATE INDEX idx_opt_notes_opp ON opportunity_notes(opportunity_id);
CREATE INDEX idx_opt_notes_pinned ON opportunity_notes(is_pinned);

CREATE INDEX idx_opt_audit_opp ON opportunity_audit_logs(opportunity_id);
CREATE INDEX idx_opt_audit_created ON opportunity_audit_logs(created_at);

-- -------------------------------------------------------------------
-- BOT DE FLUXO (BotFlow) - Fase 1
-- -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bot_settings (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  instance_id VARCHAR(50) NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  pause_timeout_minutes INT NOT NULL DEFAULT 60,
  name VARCHAR(150) NULL,
  channel ENUM('whatsapp', 'instagram', 'messenger') NOT NULL DEFAULT 'whatsapp',
  priority INT NOT NULL DEFAULT 0,
  trigger_type VARCHAR(50) NOT NULL DEFAULT 'start',
  trigger_value VARCHAR(255) NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_bot_settings_instance (user_id, instance_id, channel),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bot_steps (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  bot_settings_id VARCHAR(36) NOT NULL,
  step_order INT NOT NULL DEFAULT 1,
  trigger_type VARCHAR(50) NOT NULL DEFAULT 'keyword', -- start, keyword, button
  trigger_value VARCHAR(255) NULL,
  message_type VARCHAR(50) NOT NULL DEFAULT 'text', -- text, image, list, buttons
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
  channel ENUM('whatsapp', 'instagram', 'messenger') NOT NULL DEFAULT 'whatsapp',
  provider_account_id VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_bot_conv_state (user_id, contact_number, instance_id, channel),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (current_step_id) REFERENCES bot_steps(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes for BotFlow
CREATE INDEX idx_bot_steps_settings ON bot_steps(bot_settings_id);
CREATE INDEX idx_bot_step_options_step ON bot_step_options(step_id);
CREATE INDEX idx_bot_conv_state_contact ON bot_conversation_state(contact_number);

-- -------------------------------------------------------------------
-- INSTAGRAM MESSAGING (Phase 2)
-- -------------------------------------------------------------------

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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_instagram_accounts_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS instagram_webhook_events (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NULL,
  raw JSON NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Instagram columns for contacts (added by ensure-schema.js)
-- channel ENUM('whatsapp', 'instagram') NOT NULL DEFAULT 'whatsapp'
-- external_contact_id VARCHAR(255) NULL
-- UNIQUE KEY uq_contact_channel_external (user_id, channel, external_contact_id)

-- Instagram columns for direct_messages (added by ensure-schema.js)
-- channel ENUM('whatsapp', 'instagram') NOT NULL DEFAULT 'whatsapp'
-- provider_message_id VARCHAR(255) NULL
-- provider_account_id VARCHAR(255) NULL
-- UNIQUE KEY uq_dm_channel_msg (user_id, channel, provider_message_id)

-- Instagram columns for bot_conversation_state (added by ensure-schema.js)
-- channel ENUM('whatsapp', 'instagram') NOT NULL DEFAULT 'whatsapp'
-- provider_account_id VARCHAR(255) NULL
-- UNIQUE KEY uq_bot_conv_state (user_id, contact_number, instance_id, channel)

-- Instagram columns for bot_settings (added by ensure-schema.js)
-- name VARCHAR(150) NULL
-- channel ENUM('whatsapp', 'instagram') NOT NULL DEFAULT 'whatsapp'
-- priority INT NOT NULL DEFAULT 0
-- trigger_type VARCHAR(50) NOT NULL DEFAULT 'start'
-- trigger_value VARCHAR(255) NULL
-- is_default BOOLEAN NOT NULL DEFAULT FALSE
-- UNIQUE KEY uq_bot_settings_instance (user_id, instance_id, channel)

-- -------------------------------------------------------------------
-- AGENTE DE IA E RAG (Phase 3)
-- -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_agent_settings (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  instance_id VARCHAR(50) NULL,
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
  ai_agent_settings_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (ai_agent_settings_id) REFERENCES ai_agent_settings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------
-- WHATSAPP FLOWS
-- -------------------------------------------------------------------

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

-- -------------------------------------------------------------------
-- MULTI-AGENT TEAMS & CONVERSATION ASSIGNMENTS
-- -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS teams (
  id          VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id     VARCHAR(36) NOT NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT NULL,
  auto_assign_mode ENUM('manual', 'round_robin', 'least_busy') NOT NULL DEFAULT 'manual',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE INDEX idx_conv_assign_active ON conversation_assignments (user_id, contact_phone, is_active);
CREATE INDEX idx_conv_assign_team_agent ON conversation_assignments (team_id, agent_id, is_active);

