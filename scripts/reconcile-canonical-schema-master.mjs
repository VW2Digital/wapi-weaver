import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const canonicalPath = path.resolve(rootDir, "database/schema/canonical-schema.sql");
const contractPath = path.resolve(rootDir, "database/schema/schema-contract.json");
const reqTablesPath = path.resolve(rootDir, "database/schema/required-tables.json");
const reqColsPath = path.resolve(rootDir, "database/schema/required-columns.json");
const referencePath = path.resolve(rootDir, "database/schema/reference-schema.sql");

// Parse DDL from canonical-schema.sql and update missing columns
let canonicalSql = fs.readFileSync(canonicalPath, "utf8");

const updates = [
  {
    table: "subscriptions",
    colsToAdd: [
      "`current_period_start` datetime DEFAULT NULL,",
      "`current_period_end` datetime DEFAULT NULL,",
      "`trial_started_at` datetime DEFAULT NULL,",
      "`trial_ends_at` datetime DEFAULT NULL,",
      "`trial_consumed_at` datetime DEFAULT NULL,",
      "`activated_at` datetime DEFAULT NULL,"
    ]
  },
  {
    table: "subscription_events",
    colsToAdd: [
      "`source` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`gateway_event_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`payload_json` json DEFAULT NULL,",
      "`raw_payload` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,"
    ]
  },
  {
    table: "billing_payments",
    colsToAdd: [
      "`qr_code` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`qr_code_base64` longtext COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`ticket_url` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`payload_json` json DEFAULT NULL,"
    ]
  },
  {
    table: "billing_webhook_events",
    colsToAdd: [
      "`payload_json` json DEFAULT NULL,"
    ]
  },
  {
    table: "ds_agents",
    colsToAdd: [
      "`prompt` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`is_active` tinyint(1) NOT NULL DEFAULT '1',"
    ]
  },
  {
    table: "ds_agent_tools",
    colsToAdd: [
      "`enabled` tinyint(1) NOT NULL DEFAULT '1',",
      "`config` json DEFAULT NULL,"
    ]
  },
  {
    table: "webhook_events",
    colsToAdd: [
      "`tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`payload_json` json DEFAULT NULL,",
      "`error_message` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,"
    ]
  },
  {
    table: "billing_plans",
    colsToAdd: [
      "`billing_cycle` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'monthly',",
      "`price_cents` int NOT NULL DEFAULT '0',",
      "`currency` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'BRL',",
      "`trial_days` int NOT NULL DEFAULT '0',",
      "`is_active` tinyint(1) NOT NULL DEFAULT '1',",
      "`sort_order` int NOT NULL DEFAULT '0',",
      "`features_json` json DEFAULT NULL,"
    ]
  },
  {
    table: "payment_gateway_settings",
    colsToAdd: [
      "`payment_method_types_json` json DEFAULT NULL,",
      "`is_sandbox` tinyint(1) NOT NULL DEFAULT '1',",
      "`webhook_secret_enc` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`public_key_enc` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`access_token_enc` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`client_id_enc` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`client_secret_enc` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,"
    ]
  },
  {
    table: "licenses",
    colsToAdd: [
      "`product_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`app_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`max_activations` int NOT NULL DEFAULT '1',",
      "`max_users` int DEFAULT NULL,",
      "`features_json` json DEFAULT NULL,",
      "`notes` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`stripe_customer_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`stripe_subscription_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`ai_tokens_used` int NOT NULL DEFAULT '0',"
    ]
  },
  {
    table: "license_activations",
    colsToAdd: [
      "`app_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`user_agent` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`last_check_at` datetime DEFAULT NULL,"
    ]
  },
  {
    table: "license_validation_logs",
    colsToAdd: [
      "`app_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`installation_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`app_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`result` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`reason` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`payload_json` json DEFAULT NULL,"
    ]
  },
  {
    table: "templates",
    colsToAdd: [
      "`components` json DEFAULT NULL,",
      "`parameter_format` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`allow_category_change` tinyint(1) NOT NULL DEFAULT '1',",
      "`cta_url_link_tracking_opted_out` tinyint(1) NOT NULL DEFAULT '0',",
      "`message_send_ttl_seconds` int DEFAULT NULL,",
      "`sub_category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`display_format` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`is_primary_device_delivery_only` tinyint(1) NOT NULL DEFAULT '0',",
      "`meta_template_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`synced_at` datetime DEFAULT NULL,"
    ]
  },
  {
    table: "notifications",
    colsToAdd: [
      "`action_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`unique_key` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`read_at` datetime DEFAULT NULL,"
    ]
  },
  {
    table: "salvy_numbers",
    colsToAdd: [
      "`canceled_at` datetime DEFAULT NULL,",
      "`created_at_remote` datetime DEFAULT NULL,",
      "`cancel_reason` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,",
      "`raw` json DEFAULT NULL,"
    ]
  },
  {
    table: "ai_agent_settings",
    colsToAdd: [
      "`system_prompt` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,"
    ]
  }
];

for (const up of updates) {
  const tableRegex = new RegExp(`(CREATE TABLE IF NOT EXISTS \`${up.table}\` \\([\\s\\S]*?)(PRIMARY KEY|ENGINE=)`, "m");
  const match = canonicalSql.match(tableRegex);
  if (match) {
    const existingBlock = match[1];
    let newCols = "";
    for (const colDef of up.colsToAdd) {
      const colName = colDef.match(/`([^`]+)`/)[1];
      if (!existingBlock.includes(`\`${colName}\``)) {
        newCols += `  ${colDef}\n`;
      }
    }
    if (newCols) {
      canonicalSql = canonicalSql.replace(
        match[1],
        `${match[1]}${newCols}`
      );
    }
  }
}

fs.writeFileSync(canonicalPath, canonicalSql, "utf8");
console.log("Updated canonical-schema.sql master file.");
