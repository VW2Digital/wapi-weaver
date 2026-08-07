-- Canonical MySQL schema extracted from the working local database.
-- Source: wapi_weaver (MySQL 8.0). Data rows were intentionally removed.

-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: banco-mysql:3306
-- Tempo de geração: 07/08/2026 às 18:18
-- Versão do servidor: 8.0.46
-- Versão do PHP: 8.3.26

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Banco de dados: `wapi_weaver`
--

-- --------------------------------------------------------

--
-- Estrutura para tabela `ai_agent_settings`
--

CREATE TABLE `ai_agent_settings` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `instance_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '0',
  `api_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `model` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'gemini-2.5-flash',
  `system_prompt` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `ai_usage_logs`
--

CREATE TABLE `ai_usage_logs` (
  `id` bigint NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `model` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `prompt_tokens` int NOT NULL DEFAULT '0',
  `completion_tokens` int NOT NULL DEFAULT '0',
  `total_tokens` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actor_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `metadata` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `billing_invoices`
--

CREATE TABLE `billing_invoices` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subscription_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `plan_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoice_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `amount` decimal(10,2) NOT NULL,
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'BRL',
  `status` enum('draft','pending','paid','failed','expired','cancelled','refunded') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `due_at` datetime NOT NULL,
  `paid_at` datetime DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `external_reference` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `billing_payments`
--

CREATE TABLE `billing_payments` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subscription_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoice_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'mercadopago',
  `provider_payment_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_order_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_preference_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `external_reference` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_method` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status_detail` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'BRL',
  `installments` int NOT NULL DEFAULT '1',
  `payer_email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `raw_response` json DEFAULT NULL,
  `environment` enum('sandbox','production') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'sandbox',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `billing_plans`
--

CREATE TABLE `billing_plans` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `price` decimal(10,2) NOT NULL,
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'BRL',
  `billing_interval` enum('day','week','month','year') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'month',
  `billing_interval_count` int NOT NULL DEFAULT '1',
  `duration_days` int NOT NULL,
  `features` json DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `subscription_plan_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `billing_webhook_events`
--

CREATE TABLE `billing_webhook_events` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `environment` enum('sandbox','production') COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `resource_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `request_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `invoice_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payload_hash` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payload` json DEFAULT NULL,
  `status` enum('received','processing','processed','ignored','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'received',
  `attempts` int NOT NULL DEFAULT '0',
  `error_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `provider_created_at` datetime DEFAULT NULL,
  `received_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processing_started_at` datetime DEFAULT NULL,
  `processed_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `bot_conversation_state`
--

CREATE TABLE `bot_conversation_state` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `instance_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `current_step_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_interaction` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_paused` tinyint(1) NOT NULL DEFAULT '0',
  `paused_until` datetime DEFAULT NULL,
  `bot_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `channel` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'whatsapp',
  `provider_account_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `bot_flows`
--

CREATE TABLE `bot_flows` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `channel` varchar(50) NOT NULL DEFAULT 'whatsapp',
  `is_active` tinyint(1) NOT NULL DEFAULT '0',
  `triggers_count` int NOT NULL DEFAULT '1',
  `actions_count` int NOT NULL DEFAULT '1',
  `last_executed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `bot_settings`
--

CREATE TABLE `bot_settings` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `instance_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '0',
  `pause_timeout_minutes` int NOT NULL DEFAULT '60',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `channel` enum('whatsapp','instagram','messenger') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'whatsapp',
  `priority` int NOT NULL DEFAULT '0',
  `trigger_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'start',
  `trigger_value` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `bot_steps`
--

CREATE TABLE `bot_steps` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bot_settings_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `step_order` int NOT NULL DEFAULT '1',
  `trigger_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'keyword',
  `trigger_value` text COLLATE utf8mb4_unicode_ci,
  `message_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'text',
  `message_content` text COLLATE utf8mb4_unicode_ci,
  `media_caption` text COLLATE utf8mb4_unicode_ci,
  `footer_text` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `buttons_config` json DEFAULT NULL,
  `next_step_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `delay_seconds` int NOT NULL DEFAULT '0',
  `assign_team_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assign_user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `handoff_message` text COLLATE utf8mb4_unicode_ci,
  `card_color` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `media_url` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `position_x` float NOT NULL DEFAULT '0',
  `position_y` float NOT NULL DEFAULT '0',
  `flow_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `bot_step_options`
--

CREATE TABLE `bot_step_options` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `step_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `option_number` int NOT NULL,
  `label` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `next_step_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assign_team_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assign_user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `campaigns`
--

CREATE TABLE `campaigns` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `list_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `template_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message_type` enum('template','text','media','interactive') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('draft','queued','running','done','failed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `payload` json DEFAULT NULL,
  `totals` json DEFAULT NULL,
  `scheduled_at` datetime DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `finished_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `campaign_messages`
--

CREATE TABLE `campaign_messages` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `campaign_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `to_phone` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','sending','sent','delivered','read','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `wa_message_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `conversation_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `conversation_origin` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pricing_billable` tinyint(1) DEFAULT NULL,
  `pricing_category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pricing_model` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `delivered_at` datetime DEFAULT NULL,
  `read_at` datetime DEFAULT NULL,
  `failed_at` datetime DEFAULT NULL,
  `error` json DEFAULT NULL,
  `attempts` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `chat_sessions`
--

CREATE TABLE `chat_sessions` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'aguardando',
  `started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `answered_at` datetime DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `contacts`
--

CREATE TABLE `contacts` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone_e164` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `opted_out` tinyint(1) NOT NULL DEFAULT '0',
  `custom_fields` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_pinned` tinyint(1) NOT NULL DEFAULT '0',
  `is_archived` tinyint(1) NOT NULL DEFAULT '0',
  `chat_status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'aberto',
  `is_unread` tinyint(1) NOT NULL DEFAULT '0',
  `kanban_stage_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `channel` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'whatsapp',
  `external_contact_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `external_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `last_interaction_at` datetime DEFAULT NULL,
  `company` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `position` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `responsible_user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `normalized_phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `contact_activities`
--

CREATE TABLE `contact_activities` (
  `id` bigint UNSIGNED NOT NULL,
  `contact_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `source_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payload` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `contact_custom_fields`
--

CREATE TABLE `contact_custom_fields` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('text','textarea','number','currency','date','datetime','select','multi_select','boolean','email','phone','url') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'text',
  `placeholder` text COLLATE utf8mb4_unicode_ci,
  `options` json DEFAULT NULL,
  `default_value` text COLLATE utf8mb4_unicode_ci,
  `required` tinyint(1) NOT NULL DEFAULT '0',
  `show_on_form` tinyint(1) NOT NULL DEFAULT '1',
  `show_on_table` tinyint(1) NOT NULL DEFAULT '0',
  `show_on_details` tinyint(1) NOT NULL DEFAULT '1',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `contact_custom_field_values`
--

CREATE TABLE `contact_custom_field_values` (
  `id` bigint UNSIGNED NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `custom_field_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text COLLATE utf8mb4_unicode_ci,
  `value_json` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `contact_tags`
--

CREATE TABLE `contact_tags` (
  `contact_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tag_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `conversation_assignments`
--

CREATE TABLE `conversation_assignments` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_phone` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `team_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `agent_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assigned_by` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assigned_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `unassigned_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `conversation_tags`
--

CREATE TABLE `conversation_tags` (
  `contact_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tag_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `direct_messages`
--

CREATE TABLE `direct_messages` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_phone` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `direction` enum('incoming','outgoing') COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('text','reaction','image','audio','video','document','sticker','location','contacts') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'text',
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `wa_message_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('sent','delivered','read','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'sent',
  `reply_to_message_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `channel` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'whatsapp',
  `provider_message_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_account_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sender_wa_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sender_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recipient_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `external_group_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `raw_payload` json DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `ds_agents`
--

CREATE TABLE `ds_agents` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `folder_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'openai',
  `api_key_encrypted` text COLLATE utf8mb4_unicode_ci,
  `model` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'gpt-4o-mini',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'inactive',
  `system_prompt` longtext COLLATE utf8mb4_unicode_ci,
  `answer_only_assigned` tinyint(1) DEFAULT '0',
  `chunk_responses` tinyint(1) DEFAULT '0',
  `process_images` tinyint(1) DEFAULT '0',
  `process_audio` tinyint(1) DEFAULT '0',
  `disable_outside_hours` tinyint(1) DEFAULT '0',
  `pause_on_human` tinyint(1) DEFAULT '1',
  `wait_time_seconds` int DEFAULT '0',
  `max_messages_per_interaction` int DEFAULT '5',
  `temperature` decimal(3,2) DEFAULT '0.70',
  `max_tokens` int DEFAULT '1000',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `instructions_basic` text COLLATE utf8mb4_unicode_ci,
  `instructions_advanced` text COLLATE utf8mb4_unicode_ci,
  `mode` enum('basico','avancado') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'basico',
  `reply_with_assigned_agent` tinyint(1) NOT NULL DEFAULT '0',
  `split_replies_in_blocks` tinyint(1) NOT NULL DEFAULT '0',
  `disabled_outside_platform` tinyint(1) NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `ds_agent_assignments`
--

CREATE TABLE `ds_agent_assignments` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agent_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `whatsapp_session_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `funnel_stage_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `ds_agent_calendar_availability`
--

CREATE TABLE `ds_agent_calendar_availability` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agent_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `weekday` tinyint NOT NULL,
  `start_time` time NOT NULL DEFAULT '08:00:00',
  `end_time` time NOT NULL DEFAULT '18:00:00',
  `active` tinyint(1) NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `ds_agent_folders`
--

CREATE TABLE `ds_agent_folders` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `ds_agent_followups`
--

CREATE TABLE `ds_agent_followups` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agent_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('manual','generativo') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual',
  `recurrence` enum('unico','recorrente','diario') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unico',
  `wait_amount` int NOT NULL DEFAULT '10',
  `wait_unit` enum('minutos','horas','dias') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'minutos',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `ds_agent_knowledge`
--

CREATE TABLE `ds_agent_knowledge` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agent_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('text','faq','url','pdf') COLLATE utf8mb4_unicode_ci DEFAULT 'text',
  `content` longtext COLLATE utf8mb4_unicode_ci,
  `status` enum('pending','indexed','error') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `ds_agent_knowledge_files`
--

CREATE TABLE `ds_agent_knowledge_files` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agent_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size_kb` int NOT NULL DEFAULT '0',
  `page_count` int NOT NULL DEFAULT '1',
  `status` enum('ativo','inativo') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ativo',
  `storage_path` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `ds_agent_knowledge_links`
--

CREATE TABLE `ds_agent_knowledge_links` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agent_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pendente','indexado','erro') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pendente',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `ds_agent_logs`
--

CREATE TABLE `ds_agent_logs` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agent_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `level` enum('info','warn','error') COLLATE utf8mb4_unicode_ci DEFAULT 'info',
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `details` json DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `ds_agent_sessions`
--

CREATE TABLE `ds_agent_sessions` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agent_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','paused','completed') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `ds_agent_subagents`
--

CREATE TABLE `ds_agent_subagents` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agent_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `instructions` text COLLATE utf8mb4_unicode_ci,
  `exec_order` int DEFAULT '0',
  `model` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'gpt-4o-mini',
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `ds_agent_tools`
--

CREATE TABLE `ds_agent_tools` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agent_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `permissions` json DEFAULT NULL,
  `require_confirmation` tinyint(1) DEFAULT '1',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `ds_agent_usage`
--

CREATE TABLE `ds_agent_usage` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agent_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `session_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `prompt_tokens` int DEFAULT '0',
  `completion_tokens` int DEFAULT '0',
  `total_tokens` int DEFAULT '0',
  `tools_called` json DEFAULT NULL,
  `response_time_ms` int DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `ds_agent_usage_logs`
--

CREATE TABLE `ds_agent_usage_logs` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agent_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `model` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` enum('action_analysis','completion','embedding','query_rewriting','transcription') COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokens` int NOT NULL DEFAULT '0',
  `cost_usd` decimal(10,4) NOT NULL DEFAULT '0.0000',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `facebook_pages`
--

CREATE TABLE `facebook_pages` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `workspace_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `page_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `page_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `page_access_token` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `permissions_json` text COLLATE utf8mb4_unicode_ci,
  `token_expires_at` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `webhook_subscribed` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `facebook_webhook_events`
--

CREATE TABLE `facebook_webhook_events` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `raw` json NOT NULL,
  `processed` tinyint(1) NOT NULL DEFAULT '0',
  `received_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `incoming_webhooks`
--

CREATE TABLE `incoming_webhooks` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('listening','paused') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'listening',
  `events_count` int NOT NULL DEFAULT '0',
  `leads_count` int NOT NULL DEFAULT '0',
  `last_event_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `field_labels` json DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `incoming_webhook_events`
--

CREATE TABLE `incoming_webhook_events` (
  `id` bigint UNSIGNED NOT NULL,
  `incoming_webhook_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json NOT NULL,
  `status` enum('success','error') COLLATE utf8mb4_unicode_ci NOT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `webhook_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `idempotency_key` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `raw_payload` json NOT NULL,
  `mapped_standard_fields` json DEFAULT NULL,
  `mapped_custom_fields` json DEFAULT NULL,
  `unmapped_fields` json DEFAULT NULL,
  `headers` json DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `error_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `received_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` datetime DEFAULT NULL,
  `processing_duration_ms` int UNSIGNED DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `instagram_accounts`
--

CREATE TABLE `instagram_accounts` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ig_user_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `access_token` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_expires_at` datetime DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `instagram_webhook_events`
--

CREATE TABLE `instagram_webhook_events` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `raw` json NOT NULL,
  `processed` tinyint(1) NOT NULL DEFAULT '0',
  `received_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `knowledge_base`
--

CREATE TABLE `knowledge_base` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ai_agent_settings_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `licenses`
--

CREATE TABLE `licenses` (
  `id` bigint UNSIGNED NOT NULL,
  `license_key_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `license_key_preview` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `client_name` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `client_email` varchar(190) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `product_name` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT 'SaaS',
  `app_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'meu-saas',
  `plan` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'basic',
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `expires_at` datetime DEFAULT NULL,
  `max_activations` int NOT NULL DEFAULT '1',
  `max_users` int DEFAULT NULL,
  `features_json` json DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_customer_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_subscription_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ai_tokens_used` int NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `license_activations`
--

CREATE TABLE `license_activations` (
  `id` bigint UNSIGNED NOT NULL,
  `license_id` bigint UNSIGNED NOT NULL,
  `domain` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL,
  `app_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `installation_id` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip_address` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `activated_at` datetime NOT NULL,
  `last_check_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `license_settings`
--

CREATE TABLE `license_settings` (
  `id` int NOT NULL DEFAULT '1',
  `license_key_encrypted` text COLLATE utf8mb4_unicode_ci,
  `license_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `plan` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `features_json` json DEFAULT NULL,
  `domain` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `installation_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `activated_at` datetime DEFAULT NULL,
  `last_validated_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `cache_valid_until` datetime DEFAULT NULL,
  `grace_until` datetime DEFAULT NULL,
  `last_error` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `license_validation_logs`
--

CREATE TABLE `license_validation_logs` (
  `id` bigint UNSIGNED NOT NULL,
  `license_id` bigint UNSIGNED DEFAULT NULL,
  `domain` varchar(190) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `app_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `installation_id` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip_address` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `app_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `result` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `payload_json` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `lists`
--

CREATE TABLE `lists` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `list_contacts`
--

CREATE TABLE `list_contacts` (
  `list_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `added_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `message_tags`
--

CREATE TABLE `message_tags` (
  `message_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tag_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `notifications`
--

CREATE TABLE `notifications` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `action_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `unique_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `read_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `opportunities`
--

CREATE TABLE `opportunities` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `funnel_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stage_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `primary_contact_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `company_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `owner_user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by_user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by_user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `value` decimal(15,2) NOT NULL DEFAULT '0.00',
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'BRL',
  `probability_percent` decimal(5,2) DEFAULT NULL,
  `expected_close_date` date DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `status` enum('open','won','lost','paused','archived') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `source` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `temperature` enum('cold','warm','hot') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `priority` enum('low','medium','high','urgent') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium',
  `lost_reason_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lost_reason_text` text COLLATE utf8mb4_unicode_ci,
  `kanban_order` decimal(20,10) NOT NULL DEFAULT '0.0000000000',
  `last_activity_at` datetime DEFAULT NULL,
  `next_activity_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `opportunity_activities`
--

CREATE TABLE `opportunity_activities` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `opportunity_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assigned_to_user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by_user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` enum('call','email','meeting','task','note','whatsapp','proposal','follow_up','other') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'task',
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `status` enum('pending','done','canceled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `due_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `opportunity_audit_logs`
--

CREATE TABLE `opportunity_audit_logs` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `opportunity_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id_actor` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_values` json DEFAULT NULL,
  `new_values` json DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `opportunity_contacts`
--

CREATE TABLE `opportunity_contacts` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `opportunity_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT '0',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `opportunity_lost_reasons`
--

CREATE TABLE `opportunity_lost_reasons` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `opportunity_notes`
--

CREATE TABLE `opportunity_notes` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `opportunity_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id_creator` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_pinned` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `opportunity_stage_history`
--

CREATE TABLE `opportunity_stage_history` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `opportunity_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `funnel_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `from_stage_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `to_stage_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `moved_by_user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `moved_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `old_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `opportunity_tags`
--

CREATE TABLE `opportunity_tags` (
  `opportunity_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tag_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `outgoing_webhooks`
--

CREATE TABLE `outgoing_webhooks` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','paused') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `retry_count` int NOT NULL DEFAULT '3',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `outgoing_webhook_logs`
--

CREATE TABLE `outgoing_webhook_logs` (
  `id` bigint UNSIGNED NOT NULL,
  `outgoing_webhook_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload_sent` json NOT NULL,
  `response_status` int DEFAULT NULL,
  `response_body` text COLLATE utf8mb4_unicode_ci,
  `attempt_number` int NOT NULL DEFAULT '1',
  `success` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `payment_gateway_settings`
--

CREATE TABLE `payment_gateway_settings` (
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `environment` enum('sandbox','production') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'sandbox',
  `checkout_mode` enum('transparent','redirect') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'redirect',
  `sandbox_access_token` text COLLATE utf8mb4_unicode_ci,
  `sandbox_public_key` text COLLATE utf8mb4_unicode_ci,
  `sandbox_client_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sandbox_client_secret` text COLLATE utf8mb4_unicode_ci,
  `production_access_token` text COLLATE utf8mb4_unicode_ci,
  `production_public_key` text COLLATE utf8mb4_unicode_ci,
  `production_client_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `production_client_secret` text COLLATE utf8mb4_unicode_ci,
  `webhook_secret` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `provider` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'mercadopago',
  `id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `platform_banners`
--

CREATE TABLE `platform_banners` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subtitle` text COLLATE utf8mb4_unicode_ci,
  `cta_label` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cta_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `image_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `display_order` int NOT NULL DEFAULT '0',
  `created_by` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `platform_settings`
--

CREATE TABLE `platform_settings` (
  `id` int NOT NULL DEFAULT '1',
  `meta_app_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meta_app_secret` text COLLATE utf8mb4_unicode_ci,
  `meta_config_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meta_graph_version` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'v20.0',
  `cron_secret` text COLLATE utf8mb4_unicode_ci,
  `head_tags` text COLLATE utf8mb4_unicode_ci,
  `body_tags` text COLLATE utf8mb4_unicode_ci,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sidebar_order` text COLLATE utf8mb4_unicode_ci,
  `seo_title` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `seo_description` varchar(320) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `license_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `license_token` text COLLATE utf8mb4_unicode_ci,
  `installation_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `license_grace_period_start` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `profiles`
--

CREATE TABLE `profiles` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `full_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar_url` text COLLATE utf8mb4_unicode_ci,
  `display_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `company_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `company_document` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `company_address` text COLLATE utf8mb4_unicode_ci,
  `company_website` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rate_limit_per_second` int NOT NULL DEFAULT '10',
  `whatsapp_verify_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `whatsapp_access_token` text COLLATE utf8mb4_unicode_ci,
  `whatsapp_phone_number_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `whatsapp_waba_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `whatsapp_business_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `whatsapp_business_phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `whatsapp_app_secret` text COLLATE utf8mb4_unicode_ci,
  `meta_graph_version` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'v20.0',
  `salvy_api_key` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `api_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `whatsapp_app_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `sales_funnels`
--

CREATE TABLE `sales_funnels` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_by_user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by_user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `sales_stages`
--

CREATE TABLE `sales_stages` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `funnel_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `color` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `probability_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
  `sort_order` int NOT NULL DEFAULT '0',
  `is_won_stage` tinyint(1) NOT NULL DEFAULT '0',
  `is_lost_stage` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by_user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by_user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `salvy_numbers`
--

CREATE TABLE `salvy_numbers` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `salvy_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `area_code` int DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `cost_center` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cancel_reason` text COLLATE utf8mb4_unicode_ci,
  `created_at_remote` datetime DEFAULT NULL,
  `canceled_at` datetime DEFAULT NULL,
  `raw` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `schema_backups`
--

CREATE TABLE `schema_backups` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sql` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `size_bytes` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `subscriptions`
--

CREATE TABLE `subscriptions` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `plan_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('trial','active','expiring','pending_payment','past_due','suspended','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'trial',
  `starts_at` datetime NOT NULL,
  `expires_at` datetime NOT NULL,
  `grace_period_ends_at` datetime DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `last_payment_at` datetime DEFAULT NULL,
  `next_billing_at` datetime DEFAULT NULL,
  `auto_renew` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `subscription_events`
--

CREATE TABLE `subscription_events` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subscription_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `previous_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoice_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `subscription_plans`
--

CREATE TABLE `subscription_plans` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `max_agents` int DEFAULT '1',
  `max_funnels` int DEFAULT '1',
  `max_users` int DEFAULT '1',
  `features_json` json DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `stripe_product_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_price_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_ai_tokens` int NOT NULL DEFAULT '500000'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `subscription_plan_changes`
--

CREATE TABLE `subscription_plan_changes` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subscription_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_plan` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `new_plan` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `effective_date` datetime NOT NULL,
  `applied_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `tags`
--

CREATE TABLE `tags` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#8B5CF6',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `icon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `teams`
--

CREATE TABLE `teams` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `auto_assign_mode` enum('manual','round_robin','least_busy') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `team_members`
--

CREATE TABLE `team_members` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `team_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('agent','supervisor') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'agent',
  `joined_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `templates`
--

CREATE TABLE `templates` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `language` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('APPROVED','PENDING','REJECTED','PAUSED','DISABLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `components` json DEFAULT NULL,
  `meta_template_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `synced_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `parameter_format` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `allow_category_change` tinyint(1) DEFAULT NULL,
  `cta_url_link_tracking_opted_out` tinyint(1) DEFAULT NULL,
  `message_send_ttl_seconds` int DEFAULT NULL,
  `sub_category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_primary_device_delivery_only` tinyint(1) DEFAULT NULL,
  `display_format` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `users`
--

CREATE TABLE `users` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `user_roles`
--

CREATE TABLE `user_roles` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('admin_master','admin','user') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'user',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `webhook_bot_logs`
--

CREATE TABLE `webhook_bot_logs` (
  `id` int NOT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `flow_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `flow_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_match` tinyint(1) NOT NULL DEFAULT '0',
  `raw_conditions` json NOT NULL,
  `raw_payload` json NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `webhook_events`
--

CREATE TABLE `webhook_events` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `raw` json NOT NULL,
  `processed` tinyint(1) NOT NULL DEFAULT '0',
  `received_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `webhook_field_mappings`
--

CREATE TABLE `webhook_field_mappings` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `webhook_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `external_field` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_type` enum('standard','custom','ignore') COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_key` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `custom_field_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `transformation` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `default_value` text COLLATE utf8mb4_unicode_ci,
  `is_required` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `whatsapp_business_profile_logs`
--

CREATE TABLE `whatsapp_business_profile_logs` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone_number_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` enum('fetch_profile','update_profile','upload_profile_picture','update_profile_picture') COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_data_json` json DEFAULT NULL,
  `new_data_json` json DEFAULT NULL,
  `meta_response_json` json DEFAULT NULL,
  `success` tinyint(1) NOT NULL DEFAULT '0',
  `error_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


-- --------------------------------------------------------

--
-- Estrutura para tabela `whatsapp_flows`
--

CREATE TABLE `whatsapp_flows` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `flow_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `flow_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `waba_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone_number_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `flow_json` json DEFAULT NULL,
  `endpoint_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `whatsapp_flow_submissions`
--

CREATE TABLE `whatsapp_flow_submissions` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `contact_phone` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `flow_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `flow_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `response_json` json NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `whatsapp_groups`
--

CREATE TABLE `whatsapp_groups` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `instance_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `group_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `invite_link` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `error_message` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estrutura para tabela `whatsapp_group_participants`
--

CREATE TABLE `whatsapp_group_participants` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `group_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `wa_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `joined_at` datetime DEFAULT NULL,
  `left_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
--


--
-- Índices para tabelas despejadas
--

--
-- Índices de tabela `ai_agent_settings`
--
ALTER TABLE `ai_agent_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_ai_agent_instance` (`user_id`,`instance_id`);

--
-- Índices de tabela `ai_usage_logs`
--
ALTER TABLE `ai_usage_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ai_tenant` (`tenant_id`,`created_at`);

--
-- Índices de tabela `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `idx_audit_logs_created` (`created_at` DESC),
  ADD KEY `idx_audit_logs_tenant` (`tenant_id`);

--
-- Índices de tabela `billing_invoices`
--
ALTER TABLE `billing_invoices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `invoice_number` (`invoice_number`),
  ADD UNIQUE KEY `external_reference` (`external_reference`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `customer_id` (`customer_id`),
  ADD KEY `subscription_id` (`subscription_id`),
  ADD KEY `plan_id` (`plan_id`);

--
-- Índices de tabela `billing_payments`
--
ALTER TABLE `billing_payments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_provider_payment_env` (`provider_payment_id`,`provider`,`environment`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `customer_id` (`customer_id`),
  ADD KEY `subscription_id` (`subscription_id`),
  ADD KEY `invoice_id` (`invoice_id`);

--
-- Índices de tabela `billing_plans`
--
ALTER TABLE `billing_plans`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_billing_plans_subscription_plan_id` (`subscription_plan_id`);

--
-- Índices de tabela `billing_webhook_events`
--
ALTER TABLE `billing_webhook_events`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_billing_webhook_event` (`provider`,`environment`,`event_id`),
  ADD KEY `idx_billing_webhook_status` (`status`,`received_at`),
  ADD KEY `idx_billing_webhook_resource` (`provider`,`resource_id`);

--
-- Índices de tabela `bot_conversation_state`
--
ALTER TABLE `bot_conversation_state`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_bot_conv_state` (`user_id`,`contact_number`,`instance_id`),
  ADD KEY `current_step_id` (`current_step_id`),
  ADD KEY `idx_bot_conv_state_contact` (`contact_number`),
  ADD KEY `idx_bot_conversation_state_tenant` (`tenant_id`);

--
-- Índices de tabela `bot_flows`
--
ALTER TABLE `bot_flows`
  ADD PRIMARY KEY (`id`);

--
-- Índices de tabela `bot_settings`
--
ALTER TABLE `bot_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_bot_settings_instance` (`user_id`,`instance_id`),
  ADD KEY `idx_bot_settings_tenant` (`tenant_id`);

--
-- Índices de tabela `bot_steps`
--
ALTER TABLE `bot_steps`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `next_step_id` (`next_step_id`),
  ADD KEY `idx_bot_steps_settings` (`bot_settings_id`),
  ADD KEY `idx_bot_steps_tenant` (`tenant_id`);

--
-- Índices de tabela `bot_step_options`
--
ALTER TABLE `bot_step_options`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `next_step_id` (`next_step_id`),
  ADD KEY `idx_bot_step_options_step` (`step_id`),
  ADD KEY `idx_bot_step_options_tenant` (`tenant_id`);

--
-- Índices de tabela `campaigns`
--
ALTER TABLE `campaigns`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `list_id` (`list_id`),
  ADD KEY `template_id` (`template_id`),
  ADD KEY `idx_campaigns_tenant` (`tenant_id`);

--
-- Índices de tabela `campaign_messages`
--
ALTER TABLE `campaign_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `contact_id` (`contact_id`),
  ADD KEY `idx_campaign_messages_wa_msg` (`wa_message_id`),
  ADD KEY `idx_campaign_messages_camp_status` (`campaign_id`,`status`),
  ADD KEY `idx_camp_msg_tenant` (`tenant_id`);

--
-- Índices de tabela `chat_sessions`
--
ALTER TABLE `chat_sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `contact_id` (`contact_id`),
  ADD KEY `idx_chat_sessions_tenant` (`tenant_id`);

--
-- Índices de tabela `contacts`
--
ALTER TABLE `contacts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_user_contact` (`user_id`,`phone_e164`),
  ADD UNIQUE KEY `uq_contact_channel_external` (`user_id`,`channel`,`external_contact_id`),
  ADD KEY `idx_contacts_user_opted` (`user_id`,`opted_out`),
  ADD KEY `idx_contacts_channel_external` (`channel`,`external_contact_id`),
  ADD KEY `idx_contacts_user_channel` (`user_id`,`channel`),
  ADD KEY `idx_contacts_source_type` (`user_id`,`source_type`),
  ADD KEY `idx_contacts_source_id` (`user_id`,`source_id`),
  ADD KEY `idx_contacts_external_id` (`user_id`,`external_id`),
  ADD KEY `idx_contacts_normalized_phone` (`user_id`,`normalized_phone`),
  ADD KEY `idx_contacts_tenant` (`tenant_id`);

--
-- Índices de tabela `contact_activities`
--
ALTER TABLE `contact_activities`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_contact_activities_contact` (`contact_id`),
  ADD KEY `idx_contact_act_tenant` (`tenant_id`);

--
-- Índices de tabela `contact_custom_fields`
--
ALTER TABLE `contact_custom_fields`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_user_field` (`user_id`,`key`),
  ADD KEY `idx_cf_user` (`user_id`),
  ADD KEY `idx_cf_active` (`is_active`),
  ADD KEY `idx_cf_sort` (`user_id`,`sort_order`),
  ADD KEY `idx_contact_custom_fields_tenant` (`tenant_id`);

--
-- Índices de tabela `contact_custom_field_values`
--
ALTER TABLE `contact_custom_field_values`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_contact_field` (`user_id`,`contact_id`,`custom_field_id`),
  ADD KEY `idx_cfv_user` (`user_id`),
  ADD KEY `idx_cfv_contact` (`user_id`,`contact_id`),
  ADD KEY `idx_cfv_field` (`custom_field_id`),
  ADD KEY `contact_id` (`contact_id`);

--
-- Índices de tabela `contact_tags`
--
ALTER TABLE `contact_tags`
  ADD PRIMARY KEY (`contact_id`,`tag_id`),
  ADD KEY `tag_id` (`tag_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `idx_contact_tags_tenant` (`tenant_id`);

--
-- Índices de tabela `conversation_assignments`
--
ALTER TABLE `conversation_assignments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `team_id` (`team_id`),
  ADD KEY `agent_id` (`agent_id`),
  ADD KEY `assigned_by` (`assigned_by`),
  ADD KEY `idx_conversation_assignments_tenant` (`tenant_id`);

--
-- Índices de tabela `conversation_tags`
--
ALTER TABLE `conversation_tags`
  ADD PRIMARY KEY (`contact_number`,`tag_id`,`user_id`),
  ADD KEY `idx_conversation_tags_contact` (`contact_number`),
  ADD KEY `idx_conversation_tags_tag` (`tag_id`),
  ADD KEY `idx_conversation_tags_user` (`user_id`);

--
-- Índices de tabela `direct_messages`
--
ALTER TABLE `direct_messages`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_direct_messages_user_wa_id` (`user_id`,`wa_message_id`),
  ADD UNIQUE KEY `uq_dm_channel_msg` (`user_id`,`channel`,`provider_message_id`),
  ADD KEY `idx_direct_messages_user_phone` (`user_id`,`contact_phone`),
  ADD KEY `idx_direct_messages_wa_id` (`wa_message_id`),
  ADD KEY `idx_dm_channel_provider` (`channel`,`provider_account_id`),
  ADD KEY `idx_dm_tenant` (`tenant_id`);

--
-- Índices de tabela `ds_agents`
--
ALTER TABLE `ds_agents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `folder_id` (`folder_id`);

--
-- Índices de tabela `ds_agent_assignments`
--
ALTER TABLE `ds_agent_assignments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `agent_id` (`agent_id`);

--
-- Índices de tabela `ds_agent_calendar_availability`
--
ALTER TABLE `ds_agent_calendar_availability`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_ds_cal_avail` (`agent_id`,`weekday`),
  ADD KEY `idx_ds_cal_tenant` (`tenant_id`),
  ADD KEY `idx_ds_cal_agent` (`agent_id`);

--
-- Índices de tabela `ds_agent_folders`
--
ALTER TABLE `ds_agent_folders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `tenant_id` (`tenant_id`);

--
-- Índices de tabela `ds_agent_followups`
--
ALTER TABLE `ds_agent_followups`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ds_follow_tenant` (`tenant_id`),
  ADD KEY `idx_ds_follow_agent` (`agent_id`);

--
-- Índices de tabela `ds_agent_knowledge`
--
ALTER TABLE `ds_agent_knowledge`
  ADD PRIMARY KEY (`id`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `agent_id` (`agent_id`);

--
-- Índices de tabela `ds_agent_knowledge_files`
--
ALTER TABLE `ds_agent_knowledge_files`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ds_files_tenant` (`tenant_id`),
  ADD KEY `idx_ds_files_agent` (`agent_id`);

--
-- Índices de tabela `ds_agent_knowledge_links`
--
ALTER TABLE `ds_agent_knowledge_links`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ds_links_tenant` (`tenant_id`),
  ADD KEY `idx_ds_links_agent` (`agent_id`);

--
-- Índices de tabela `ds_agent_logs`
--
ALTER TABLE `ds_agent_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `agent_id` (`agent_id`);

--
-- Índices de tabela `ds_agent_sessions`
--
ALTER TABLE `ds_agent_sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `agent_id` (`agent_id`);

--
-- Índices de tabela `ds_agent_subagents`
--
ALTER TABLE `ds_agent_subagents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `agent_id` (`agent_id`);

--
-- Índices de tabela `ds_agent_tools`
--
ALTER TABLE `ds_agent_tools`
  ADD PRIMARY KEY (`id`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `agent_id` (`agent_id`);

--
-- Índices de tabela `ds_agent_usage`
--
ALTER TABLE `ds_agent_usage`
  ADD PRIMARY KEY (`id`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `agent_id` (`agent_id`),
  ADD KEY `session_id` (`session_id`);

--
-- Índices de tabela `ds_agent_usage_logs`
--
ALTER TABLE `ds_agent_usage_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ds_usage_tenant` (`tenant_id`),
  ADD KEY `idx_ds_usage_agent` (`agent_id`),
  ADD KEY `idx_ds_usage_created` (`created_at`);

--
-- Índices de tabela `facebook_pages`
--
ALTER TABLE `facebook_pages`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `page_id` (`page_id`),
  ADD KEY `idx_facebook_pages_user` (`user_id`);

--
-- Índices de tabela `facebook_webhook_events`
--
ALTER TABLE `facebook_webhook_events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Índices de tabela `incoming_webhooks`
--
ALTER TABLE `incoming_webhooks`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token` (`token`),
  ADD KEY `idx_incoming_webhooks_token` (`token`),
  ADD KEY `idx_incoming_webhooks_tenant` (`tenant_id`);

--
-- Índices de tabela `incoming_webhook_events`
--
ALTER TABLE `incoming_webhook_events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_incoming_webhook_events_webhook` (`incoming_webhook_id`),
  ADD KEY `idx_iwe_user` (`user_id`),
  ADD KEY `idx_iwe_webhook` (`user_id`,`webhook_id`),
  ADD KEY `idx_iwe_contact` (`contact_id`),
  ADD KEY `idx_iwe_status` (`user_id`,`status`),
  ADD KEY `idx_iwe_received` (`user_id`,`received_at`);

--
-- Índices de tabela `instagram_accounts`
--
ALTER TABLE `instagram_accounts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ig_user_id` (`ig_user_id`),
  ADD KEY `idx_instagram_accounts_user` (`user_id`);

--
-- Índices de tabela `instagram_webhook_events`
--
ALTER TABLE `instagram_webhook_events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Índices de tabela `knowledge_base`
--
ALTER TABLE `knowledge_base`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `ai_agent_settings_id` (`ai_agent_settings_id`);

--
-- Índices de tabela `licenses`
--
ALTER TABLE `licenses`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `license_key_hash` (`license_key_hash`),
  ADD UNIQUE KEY `tenant_id` (`tenant_id`),
  ADD KEY `idx_licenses_status` (`status`),
  ADD KEY `idx_licenses_app_id` (`app_id`),
  ADD KEY `idx_licenses_tenant_id` (`tenant_id`);

--
-- Índices de tabela `license_activations`
--
ALTER TABLE `license_activations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_license_activation` (`license_id`,`domain`,`installation_id`),
  ADD KEY `idx_license_activations_license_id` (`license_id`);

--
-- Índices de tabela `license_settings`
--
ALTER TABLE `license_settings`
  ADD PRIMARY KEY (`id`);

--
-- Índices de tabela `license_validation_logs`
--
ALTER TABLE `license_validation_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_license_logs_license_id` (`license_id`),
  ADD KEY `idx_license_logs_created_at` (`created_at`);

--
-- Índices de tabela `lists`
--
ALTER TABLE `lists`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `idx_lists_tenant` (`tenant_id`);

--
-- Índices de tabela `list_contacts`
--
ALTER TABLE `list_contacts`
  ADD PRIMARY KEY (`list_id`,`contact_id`),
  ADD KEY `contact_id` (`contact_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `idx_list_contacts_tenant` (`tenant_id`);

--
-- Índices de tabela `message_tags`
--
ALTER TABLE `message_tags`
  ADD PRIMARY KEY (`message_id`,`tag_id`),
  ADD KEY `idx_message_tags_message` (`message_id`),
  ADD KEY `idx_message_tags_tag` (`tag_id`),
  ADD KEY `idx_message_tags_user` (`user_id`);

--
-- Índices de tabela `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_key` (`unique_key`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Índices de tabela `opportunities`
--
ALTER TABLE `opportunities`
  ADD PRIMARY KEY (`id`),
  ADD KEY `funnel_id` (`funnel_id`),
  ADD KEY `stage_id` (`stage_id`),
  ADD KEY `created_by_user_id` (`created_by_user_id`),
  ADD KEY `updated_by_user_id` (`updated_by_user_id`),
  ADD KEY `lost_reason_id` (`lost_reason_id`),
  ADD KEY `idx_opportunities_funnel_stage_order` (`user_id`,`funnel_id`,`stage_id`,`kanban_order`),
  ADD KEY `idx_opportunities_status` (`user_id`,`status`),
  ADD KEY `idx_opportunities_owner` (`owner_user_id`),
  ADD KEY `idx_opportunities_primary_contact` (`primary_contact_id`),
  ADD KEY `idx_opportunities_expected_close` (`expected_close_date`),
  ADD KEY `idx_opportunities_last_act` (`last_activity_at`),
  ADD KEY `idx_opportunities_next_act` (`next_activity_at`),
  ADD KEY `idx_opportunities_deleted` (`deleted_at`),
  ADD KEY `idx_opportunities_tenant` (`tenant_id`);

--
-- Índices de tabela `opportunity_activities`
--
ALTER TABLE `opportunity_activities`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `contact_id` (`contact_id`),
  ADD KEY `assigned_to_user_id` (`assigned_to_user_id`),
  ADD KEY `created_by_user_id` (`created_by_user_id`),
  ADD KEY `idx_opt_activities_opp` (`opportunity_id`),
  ADD KEY `idx_opt_activities_due` (`due_at`),
  ADD KEY `idx_opt_activities_status` (`status`);

--
-- Índices de tabela `opportunity_audit_logs`
--
ALTER TABLE `opportunity_audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `user_id_actor` (`user_id_actor`),
  ADD KEY `idx_opt_audit_opp` (`opportunity_id`),
  ADD KEY `idx_opt_audit_created` (`created_at`),
  ADD KEY `idx_opt_audit_tenant` (`tenant_id`);

--
-- Índices de tabela `opportunity_contacts`
--
ALTER TABLE `opportunity_contacts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_opportunity_contact` (`opportunity_id`,`contact_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `idx_opt_contacts_contact` (`contact_id`),
  ADD KEY `idx_opt_contacts_primary` (`opportunity_id`,`is_primary`),
  ADD KEY `idx_opportunity_contacts_tenant` (`tenant_id`);

--
-- Índices de tabela `opportunity_lost_reasons`
--
ALTER TABLE `opportunity_lost_reasons`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_lost_reasons_user_name` (`user_id`,`name`),
  ADD KEY `idx_opportunity_lost_reasons_tenant` (`tenant_id`);

--
-- Índices de tabela `opportunity_notes`
--
ALTER TABLE `opportunity_notes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `user_id_creator` (`user_id_creator`),
  ADD KEY `idx_opt_notes_opp` (`opportunity_id`),
  ADD KEY `idx_opt_notes_pinned` (`is_pinned`);

--
-- Índices de tabela `opportunity_stage_history`
--
ALTER TABLE `opportunity_stage_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `from_stage_id` (`from_stage_id`),
  ADD KEY `to_stage_id` (`to_stage_id`),
  ADD KEY `moved_by_user_id` (`moved_by_user_id`),
  ADD KEY `idx_stage_history_opp` (`opportunity_id`),
  ADD KEY `idx_stage_history_funnel` (`funnel_id`),
  ADD KEY `idx_stage_history_moved` (`moved_at`),
  ADD KEY `idx_opportunity_stage_history_tenant` (`tenant_id`);

--
-- Índices de tabela `opportunity_tags`
--
ALTER TABLE `opportunity_tags`
  ADD PRIMARY KEY (`opportunity_id`,`tag_id`),
  ADD KEY `tag_id` (`tag_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Índices de tabela `outgoing_webhooks`
--
ALTER TABLE `outgoing_webhooks`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_outgoing_webhooks_tenant` (`tenant_id`);

--
-- Índices de tabela `outgoing_webhook_logs`
--
ALTER TABLE `outgoing_webhook_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_outgoing_webhook_logs_webhook` (`outgoing_webhook_id`);

--
-- Índices de tabela `payment_gateway_settings`
--
ALTER TABLE `payment_gateway_settings`
  ADD PRIMARY KEY (`tenant_id`);

--
-- Índices de tabela `platform_banners`
--
ALTER TABLE `platform_banners`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_pb_active_order` (`is_active`,`display_order`),
  ADD KEY `created_by` (`created_by`);

--
-- Índices de tabela `platform_settings`
--
ALTER TABLE `platform_settings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `updated_by` (`updated_by`);

--
-- Índices de tabela `profiles`
--
ALTER TABLE `profiles`
  ADD PRIMARY KEY (`id`);

--
-- Índices de tabela `sales_funnels`
--
ALTER TABLE `sales_funnels`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_sales_funnels_user_slug` (`user_id`,`slug`),
  ADD KEY `created_by_user_id` (`created_by_user_id`),
  ADD KEY `updated_by_user_id` (`updated_by_user_id`),
  ADD KEY `idx_sales_funnels_tenant` (`tenant_id`);

--
-- Índices de tabela `sales_stages`
--
ALTER TABLE `sales_stages`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_sales_stages_funnel_slug` (`funnel_id`,`slug`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `created_by_user_id` (`created_by_user_id`),
  ADD KEY `updated_by_user_id` (`updated_by_user_id`),
  ADD KEY `idx_sales_stages_tenant` (`tenant_id`);

--
-- Índices de tabela `salvy_numbers`
--
ALTER TABLE `salvy_numbers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_user_salvy` (`user_id`,`salvy_id`);

--
-- Índices de tabela `schema_backups`
--
ALTER TABLE `schema_backups`
  ADD PRIMARY KEY (`id`),
  ADD KEY `created_by` (`created_by`);

--
-- Índices de tabela `subscriptions`
--
ALTER TABLE `subscriptions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `tenant_id` (`tenant_id`),
  ADD KEY `customer_id` (`customer_id`),
  ADD KEY `plan_id` (`plan_id`);

--
-- Índices de tabela `subscription_events`
--
ALTER TABLE `subscription_events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `tenant_id` (`tenant_id`),
  ADD KEY `subscription_id` (`subscription_id`);

--
-- Índices de tabela `subscription_plans`
--
ALTER TABLE `subscription_plans`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`);

--
-- Índices de tabela `subscription_plan_changes`
--
ALTER TABLE `subscription_plan_changes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_plan_changes_tenant` (`tenant_id`),
  ADD KEY `idx_plan_changes_sub` (`subscription_id`),
  ADD KEY `idx_plan_changes_effective` (`effective_date`,`applied_at`);

--
-- Índices de tabela `tags`
--
ALTER TABLE `tags`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_user_tag` (`user_id`,`name`),
  ADD KEY `idx_tags_tenant` (`tenant_id`);

--
-- Índices de tabela `teams`
--
ALTER TABLE `teams`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `idx_teams_tenant` (`tenant_id`);

--
-- Índices de tabela `team_members`
--
ALTER TABLE `team_members`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_team_member` (`team_id`,`user_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Índices de tabela `templates`
--
ALTER TABLE `templates`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_user_template` (`user_id`,`name`,`language`),
  ADD KEY `idx_templates_tenant` (`tenant_id`);

--
-- Índices de tabela `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Índices de tabela `user_roles`
--
ALTER TABLE `user_roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_unique_user_id` (`user_id`);

--
-- Índices de tabela `webhook_bot_logs`
--
ALTER TABLE `webhook_bot_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_wbl_tenant_contact` (`tenant_id`,`contact_id`);

--
-- Índices de tabela `webhook_events`
--
ALTER TABLE `webhook_events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `idx_webhook_events_processed` (`processed`,`received_at`);

--
-- Índices de tabela `webhook_field_mappings`
--
ALTER TABLE `webhook_field_mappings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_webhook_field` (`user_id`,`webhook_id`,`external_field`),
  ADD KEY `idx_wfm_user` (`user_id`),
  ADD KEY `idx_wfm_webhook` (`user_id`,`webhook_id`),
  ADD KEY `idx_wfm_target_type` (`target_type`),
  ADD KEY `idx_wfm_custom_field` (`custom_field_id`),
  ADD KEY `webhook_id` (`webhook_id`);

--
-- Índices de tabela `whatsapp_business_profile_logs`
--
ALTER TABLE `whatsapp_business_profile_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_wab_profile_logs_user_created` (`user_id`,`created_at` DESC),
  ADD KEY `idx_wab_profile_logs_phone_created` (`phone_number_id`,`created_at` DESC),
  ADD KEY `idx_wab_logs_tenant` (`tenant_id`);

--
-- Índices de tabela `whatsapp_flows`
--
ALTER TABLE `whatsapp_flows`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `flow_id` (`flow_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Índices de tabela `whatsapp_flow_submissions`
--
ALTER TABLE `whatsapp_flow_submissions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Índices de tabela `whatsapp_groups`
--
ALTER TABLE `whatsapp_groups`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `group_id` (`group_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Índices de tabela `whatsapp_group_participants`
--
ALTER TABLE `whatsapp_group_participants`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- AUTO_INCREMENT para tabelas despejadas
--

--
-- AUTO_INCREMENT de tabela `ai_usage_logs`
--
ALTER TABLE `ai_usage_logs`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `contact_activities`
--
ALTER TABLE `contact_activities`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de tabela `contact_custom_field_values`
--
ALTER TABLE `contact_custom_field_values`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=34;

--
-- AUTO_INCREMENT de tabela `incoming_webhook_events`
--
ALTER TABLE `incoming_webhook_events`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `licenses`
--
ALTER TABLE `licenses`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT de tabela `license_activations`
--
ALTER TABLE `license_activations`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `license_validation_logs`
--
ALTER TABLE `license_validation_logs`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `outgoing_webhook_logs`
--
ALTER TABLE `outgoing_webhook_logs`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de tabela `webhook_bot_logs`
--
ALTER TABLE `webhook_bot_logs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Restrições para tabelas despejadas
--

--
-- Restrições para tabelas `ai_agent_settings`
--
ALTER TABLE `ai_agent_settings`
  ADD CONSTRAINT `ai_agent_settings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `ai_usage_logs`
--
ALTER TABLE `ai_usage_logs`
  ADD CONSTRAINT `ai_usage_logs_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `billing_invoices`
--
ALTER TABLE `billing_invoices`
  ADD CONSTRAINT `billing_invoices_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `billing_invoices_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `billing_invoices_ibfk_3` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `billing_invoices_ibfk_4` FOREIGN KEY (`plan_id`) REFERENCES `billing_plans` (`id`) ON DELETE RESTRICT;

--
-- Restrições para tabelas `billing_payments`
--
ALTER TABLE `billing_payments`
  ADD CONSTRAINT `billing_payments_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `billing_payments_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `billing_payments_ibfk_3` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `billing_payments_ibfk_4` FOREIGN KEY (`invoice_id`) REFERENCES `billing_invoices` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `billing_plans`
--
ALTER TABLE `billing_plans`
  ADD CONSTRAINT `fk_billing_subscription_plan` FOREIGN KEY (`subscription_plan_id`) REFERENCES `subscription_plans` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Restrições para tabelas `bot_conversation_state`
--
ALTER TABLE `bot_conversation_state`
  ADD CONSTRAINT `bot_conversation_state_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `bot_conversation_state_ibfk_2` FOREIGN KEY (`current_step_id`) REFERENCES `bot_steps` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_bot_conversation_state_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `bot_settings`
--
ALTER TABLE `bot_settings`
  ADD CONSTRAINT `bot_settings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_bot_settings_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `bot_steps`
--
ALTER TABLE `bot_steps`
  ADD CONSTRAINT `bot_steps_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `bot_steps_ibfk_2` FOREIGN KEY (`bot_settings_id`) REFERENCES `bot_settings` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_bot_steps_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `bot_step_options`
--
ALTER TABLE `bot_step_options`
  ADD CONSTRAINT `bot_step_options_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `bot_step_options_ibfk_2` FOREIGN KEY (`step_id`) REFERENCES `bot_steps` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_bot_step_options_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `campaigns`
--
ALTER TABLE `campaigns`
  ADD CONSTRAINT `campaigns_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `campaigns_ibfk_2` FOREIGN KEY (`list_id`) REFERENCES `lists` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `campaigns_ibfk_3` FOREIGN KEY (`template_id`) REFERENCES `templates` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_campaigns_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `campaign_messages`
--
ALTER TABLE `campaign_messages`
  ADD CONSTRAINT `campaign_messages_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `campaign_messages_ibfk_2` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `campaign_messages_ibfk_3` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_camp_msg_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `chat_sessions`
--
ALTER TABLE `chat_sessions`
  ADD CONSTRAINT `chat_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `chat_sessions_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_chat_sessions_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `contacts`
--
ALTER TABLE `contacts`
  ADD CONSTRAINT `contacts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_contacts_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `contact_activities`
--
ALTER TABLE `contact_activities`
  ADD CONSTRAINT `contact_activities_ibfk_1` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_contact_act_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `contact_custom_fields`
--
ALTER TABLE `contact_custom_fields`
  ADD CONSTRAINT `contact_custom_fields_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_contact_custom_fields_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `contact_custom_field_values`
--
ALTER TABLE `contact_custom_field_values`
  ADD CONSTRAINT `contact_custom_field_values_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `contact_custom_field_values_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `contact_custom_field_values_ibfk_3` FOREIGN KEY (`custom_field_id`) REFERENCES `contact_custom_fields` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `contact_tags`
--
ALTER TABLE `contact_tags`
  ADD CONSTRAINT `contact_tags_ibfk_1` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `contact_tags_ibfk_2` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `contact_tags_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_contact_tags_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `conversation_assignments`
--
ALTER TABLE `conversation_assignments`
  ADD CONSTRAINT `conversation_assignments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `conversation_assignments_ibfk_2` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `conversation_assignments_ibfk_3` FOREIGN KEY (`agent_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `conversation_assignments_ibfk_4` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_conversation_assignments_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `conversation_tags`
--
ALTER TABLE `conversation_tags`
  ADD CONSTRAINT `conversation_tags_ibfk_1` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `conversation_tags_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `direct_messages`
--
ALTER TABLE `direct_messages`
  ADD CONSTRAINT `direct_messages_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_dm_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `ds_agents`
--
ALTER TABLE `ds_agents`
  ADD CONSTRAINT `ds_agents_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `ds_agents_ibfk_2` FOREIGN KEY (`folder_id`) REFERENCES `ds_agent_folders` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `ds_agent_assignments`
--
ALTER TABLE `ds_agent_assignments`
  ADD CONSTRAINT `ds_agent_assignments_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `ds_agent_assignments_ibfk_2` FOREIGN KEY (`agent_id`) REFERENCES `ds_agents` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `ds_agent_calendar_availability`
--
ALTER TABLE `ds_agent_calendar_availability`
  ADD CONSTRAINT `ds_agent_calendar_availability_ibfk_1` FOREIGN KEY (`agent_id`) REFERENCES `ds_agents` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `ds_agent_folders`
--
ALTER TABLE `ds_agent_folders`
  ADD CONSTRAINT `ds_agent_folders_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `ds_agent_followups`
--
ALTER TABLE `ds_agent_followups`
  ADD CONSTRAINT `ds_agent_followups_ibfk_1` FOREIGN KEY (`agent_id`) REFERENCES `ds_agents` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `ds_agent_knowledge`
--
ALTER TABLE `ds_agent_knowledge`
  ADD CONSTRAINT `ds_agent_knowledge_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `ds_agent_knowledge_ibfk_2` FOREIGN KEY (`agent_id`) REFERENCES `ds_agents` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `ds_agent_knowledge_files`
--
ALTER TABLE `ds_agent_knowledge_files`
  ADD CONSTRAINT `ds_agent_knowledge_files_ibfk_1` FOREIGN KEY (`agent_id`) REFERENCES `ds_agents` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `ds_agent_knowledge_links`
--
ALTER TABLE `ds_agent_knowledge_links`
  ADD CONSTRAINT `ds_agent_knowledge_links_ibfk_1` FOREIGN KEY (`agent_id`) REFERENCES `ds_agents` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `ds_agent_logs`
--
ALTER TABLE `ds_agent_logs`
  ADD CONSTRAINT `ds_agent_logs_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `ds_agent_logs_ibfk_2` FOREIGN KEY (`agent_id`) REFERENCES `ds_agents` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `ds_agent_sessions`
--
ALTER TABLE `ds_agent_sessions`
  ADD CONSTRAINT `ds_agent_sessions_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `ds_agent_sessions_ibfk_2` FOREIGN KEY (`agent_id`) REFERENCES `ds_agents` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `ds_agent_subagents`
--
ALTER TABLE `ds_agent_subagents`
  ADD CONSTRAINT `ds_agent_subagents_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `ds_agent_subagents_ibfk_2` FOREIGN KEY (`agent_id`) REFERENCES `ds_agents` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `ds_agent_tools`
--
ALTER TABLE `ds_agent_tools`
  ADD CONSTRAINT `ds_agent_tools_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `ds_agent_tools_ibfk_2` FOREIGN KEY (`agent_id`) REFERENCES `ds_agents` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `ds_agent_usage`
--
ALTER TABLE `ds_agent_usage`
  ADD CONSTRAINT `ds_agent_usage_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `ds_agent_usage_ibfk_2` FOREIGN KEY (`agent_id`) REFERENCES `ds_agents` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `ds_agent_usage_ibfk_3` FOREIGN KEY (`session_id`) REFERENCES `ds_agent_sessions` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `ds_agent_usage_logs`
--
ALTER TABLE `ds_agent_usage_logs`
  ADD CONSTRAINT `ds_agent_usage_logs_ibfk_1` FOREIGN KEY (`agent_id`) REFERENCES `ds_agents` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `facebook_pages`
--
ALTER TABLE `facebook_pages`
  ADD CONSTRAINT `facebook_pages_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `facebook_webhook_events`
--
ALTER TABLE `facebook_webhook_events`
  ADD CONSTRAINT `facebook_webhook_events_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `incoming_webhooks`
--
ALTER TABLE `incoming_webhooks`
  ADD CONSTRAINT `incoming_webhooks_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `incoming_webhook_events`
--
ALTER TABLE `incoming_webhook_events`
  ADD CONSTRAINT `incoming_webhook_events_ibfk_1` FOREIGN KEY (`incoming_webhook_id`) REFERENCES `incoming_webhooks` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `instagram_accounts`
--
ALTER TABLE `instagram_accounts`
  ADD CONSTRAINT `instagram_accounts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `instagram_webhook_events`
--
ALTER TABLE `instagram_webhook_events`
  ADD CONSTRAINT `instagram_webhook_events_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `knowledge_base`
--
ALTER TABLE `knowledge_base`
  ADD CONSTRAINT `knowledge_base_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `knowledge_base_ibfk_2` FOREIGN KEY (`ai_agent_settings_id`) REFERENCES `ai_agent_settings` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `license_activations`
--
ALTER TABLE `license_activations`
  ADD CONSTRAINT `fk_license_activations_license` FOREIGN KEY (`license_id`) REFERENCES `licenses` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `lists`
--
ALTER TABLE `lists`
  ADD CONSTRAINT `fk_lists_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `lists_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `list_contacts`
--
ALTER TABLE `list_contacts`
  ADD CONSTRAINT `fk_list_contacts_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `list_contacts_ibfk_1` FOREIGN KEY (`list_id`) REFERENCES `lists` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `list_contacts_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `list_contacts_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `message_tags`
--
ALTER TABLE `message_tags`
  ADD CONSTRAINT `message_tags_ibfk_1` FOREIGN KEY (`message_id`) REFERENCES `direct_messages` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `message_tags_ibfk_2` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `message_tags_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `notifications_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `opportunities`
--
ALTER TABLE `opportunities`
  ADD CONSTRAINT `fk_opportunities_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `opportunities_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `opportunities_ibfk_2` FOREIGN KEY (`funnel_id`) REFERENCES `sales_funnels` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `opportunities_ibfk_3` FOREIGN KEY (`stage_id`) REFERENCES `sales_stages` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `opportunities_ibfk_4` FOREIGN KEY (`primary_contact_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `opportunities_ibfk_5` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `opportunities_ibfk_6` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `opportunities_ibfk_7` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `opportunities_ibfk_8` FOREIGN KEY (`lost_reason_id`) REFERENCES `opportunity_lost_reasons` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `opportunity_activities`
--
ALTER TABLE `opportunity_activities`
  ADD CONSTRAINT `opportunity_activities_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `opportunity_activities_ibfk_2` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `opportunity_activities_ibfk_3` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `opportunity_activities_ibfk_4` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `opportunity_activities_ibfk_5` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `opportunity_audit_logs`
--
ALTER TABLE `opportunity_audit_logs`
  ADD CONSTRAINT `fk_opt_audit_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `opportunity_audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `opportunity_audit_logs_ibfk_2` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `opportunity_audit_logs_ibfk_3` FOREIGN KEY (`user_id_actor`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `opportunity_contacts`
--
ALTER TABLE `opportunity_contacts`
  ADD CONSTRAINT `fk_opportunity_contacts_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `opportunity_contacts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `opportunity_contacts_ibfk_2` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `opportunity_contacts_ibfk_3` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `opportunity_lost_reasons`
--
ALTER TABLE `opportunity_lost_reasons`
  ADD CONSTRAINT `fk_opportunity_lost_reasons_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `opportunity_lost_reasons_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `opportunity_notes`
--
ALTER TABLE `opportunity_notes`
  ADD CONSTRAINT `opportunity_notes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `opportunity_notes_ibfk_2` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `opportunity_notes_ibfk_3` FOREIGN KEY (`user_id_creator`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `opportunity_stage_history`
--
ALTER TABLE `opportunity_stage_history`
  ADD CONSTRAINT `fk_opportunity_stage_history_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `opportunity_stage_history_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `opportunity_stage_history_ibfk_2` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `opportunity_stage_history_ibfk_3` FOREIGN KEY (`funnel_id`) REFERENCES `sales_funnels` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `opportunity_stage_history_ibfk_4` FOREIGN KEY (`from_stage_id`) REFERENCES `sales_stages` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `opportunity_stage_history_ibfk_5` FOREIGN KEY (`to_stage_id`) REFERENCES `sales_stages` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `opportunity_stage_history_ibfk_6` FOREIGN KEY (`moved_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `opportunity_tags`
--
ALTER TABLE `opportunity_tags`
  ADD CONSTRAINT `opportunity_tags_ibfk_1` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `opportunity_tags_ibfk_2` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `opportunity_tags_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `outgoing_webhooks`
--
ALTER TABLE `outgoing_webhooks`
  ADD CONSTRAINT `outgoing_webhooks_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `outgoing_webhook_logs`
--
ALTER TABLE `outgoing_webhook_logs`
  ADD CONSTRAINT `outgoing_webhook_logs_ibfk_1` FOREIGN KEY (`outgoing_webhook_id`) REFERENCES `outgoing_webhooks` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `payment_gateway_settings`
--
ALTER TABLE `payment_gateway_settings`
  ADD CONSTRAINT `payment_gateway_settings_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `platform_banners`
--
ALTER TABLE `platform_banners`
  ADD CONSTRAINT `platform_banners_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `platform_settings`
--
ALTER TABLE `platform_settings`
  ADD CONSTRAINT `platform_settings_ibfk_1` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `profiles`
--
ALTER TABLE `profiles`
  ADD CONSTRAINT `profiles_ibfk_1` FOREIGN KEY (`id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `sales_funnels`
--
ALTER TABLE `sales_funnels`
  ADD CONSTRAINT `fk_sales_funnels_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `sales_funnels_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `sales_funnels_ibfk_2` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `sales_funnels_ibfk_3` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `sales_stages`
--
ALTER TABLE `sales_stages`
  ADD CONSTRAINT `fk_sales_stages_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `sales_stages_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `sales_stages_ibfk_2` FOREIGN KEY (`funnel_id`) REFERENCES `sales_funnels` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `sales_stages_ibfk_3` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `sales_stages_ibfk_4` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `salvy_numbers`
--
ALTER TABLE `salvy_numbers`
  ADD CONSTRAINT `salvy_numbers_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `schema_backups`
--
ALTER TABLE `schema_backups`
  ADD CONSTRAINT `schema_backups_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `subscriptions`
--
ALTER TABLE `subscriptions`
  ADD CONSTRAINT `subscriptions_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `subscriptions_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `subscriptions_ibfk_3` FOREIGN KEY (`plan_id`) REFERENCES `billing_plans` (`id`) ON DELETE RESTRICT;

--
-- Restrições para tabelas `subscription_events`
--
ALTER TABLE `subscription_events`
  ADD CONSTRAINT `subscription_events_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `subscription_events_ibfk_2` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `tags`
--
ALTER TABLE `tags`
  ADD CONSTRAINT `fk_tags_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `tags_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `teams`
--
ALTER TABLE `teams`
  ADD CONSTRAINT `fk_teams_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `teams_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `team_members`
--
ALTER TABLE `team_members`
  ADD CONSTRAINT `team_members_ibfk_1` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `team_members_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `templates`
--
ALTER TABLE `templates`
  ADD CONSTRAINT `fk_templates_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `templates_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `user_roles`
--
ALTER TABLE `user_roles`
  ADD CONSTRAINT `user_roles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `webhook_events`
--
ALTER TABLE `webhook_events`
  ADD CONSTRAINT `webhook_events_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `webhook_field_mappings`
--
ALTER TABLE `webhook_field_mappings`
  ADD CONSTRAINT `webhook_field_mappings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `webhook_field_mappings_ibfk_2` FOREIGN KEY (`webhook_id`) REFERENCES `incoming_webhooks` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `webhook_field_mappings_ibfk_3` FOREIGN KEY (`custom_field_id`) REFERENCES `contact_custom_fields` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `whatsapp_business_profile_logs`
--
ALTER TABLE `whatsapp_business_profile_logs`
  ADD CONSTRAINT `fk_wab_logs_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `whatsapp_business_profile_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Restrições para tabelas `whatsapp_flows`
--
ALTER TABLE `whatsapp_flows`
  ADD CONSTRAINT `whatsapp_flows_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `whatsapp_flow_submissions`
--
ALTER TABLE `whatsapp_flow_submissions`
  ADD CONSTRAINT `whatsapp_flow_submissions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `whatsapp_groups`
--
ALTER TABLE `whatsapp_groups`
  ADD CONSTRAINT `whatsapp_groups_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Restrições para tabelas `whatsapp_group_participants`
--
ALTER TABLE `whatsapp_group_participants`
  ADD CONSTRAINT `whatsapp_group_participants_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
