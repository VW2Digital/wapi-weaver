import fs from "fs";
import path from "path";

async function unifyDatabaseArchitecture() {
  console.log("=================================================");
  console.log("   UNIFICAÇÃO E PADRONIZAÇÃO DO BANCO DE DADOS   ");
  console.log("=================================================\n");

  // 1. Removendo diretórios e arquivos de bancos legados (ex: PostgreSQL)
  const legacyItems = [
    path.resolve("postgres_legacy/setup_crm_postgres.sql"),
    path.resolve("postgres_legacy"),
    path.resolve("db_check_results.txt"),
    path.resolve("db_schema_temp.json"),
    path.resolve("audit_temp.json"),
    path.resolve("ensure_schema_plan_id.json"),
    path.resolve("saas_license_fields_temp.json"),
    path.resolve("saas_license_plan_temp.json"),
    path.resolve("saas_logic_temp.json"),
    path.resolve("saas_migration_refs.json"),
    path.resolve("saas_validation_temp.json"),
    path.resolve("saas_webhook_logic_temp.json"),
    path.resolve("webhook_ensure_schema_temp.json"),
    path.resolve("webhook_events_refs.json"),
    path.resolve("webhook_events_schema.json"),
  ];

  console.log("1. LIMPANDO RESQUÍCIOS DE BANCOS E SCHEMAS DIVERGENTES:");
  for (const item of legacyItems) {
    if (fs.existsSync(item)) {
      const stat = fs.statSync(item);
      if (stat.isDirectory()) {
        fs.rmSync(item, { recursive: true, force: true });
        console.log(` - [Pasta Removida] ${item}`);
      } else {
        fs.unlinkSync(item);
        console.log(` - [Arquivo Removido] ${item}`);
      }
    }
  }

  console.log("\n2. BANCO DE DADOS ÚNICO E OFICIAL ESTABELECIDO:");
  console.log(" - Motor de Banco de Dados: MySQL 8.0");
  console.log(" - Nome do Banco: wapi_weaver");
  console.log(" - Pool Único de Conexão: src/lib/db.ts");
  console.log(" - Schema da Verdade: scripts/ensure-schema.js & schema_mysql.sql");
  console.log("=================================================\n");
}

unifyDatabaseArchitecture().catch(console.error);
