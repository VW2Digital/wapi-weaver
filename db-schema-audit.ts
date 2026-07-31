import db from "./src/lib/db";
import { writeFileSync } from "fs";

async function run() {
  console.log("=== EXTRAINDO ESTRUTURA DO BANCO DE DADOS ===");

  const tables = [
    "billing_plans",
    "subscription_plans",
    "subscriptions",
    "billing_invoices",
    "billing_payments",
    "payment_gateway_settings",
    "licenses",
    "license_activations",
  ];

  const results: Record<string, any> = {};

  for (const t of tables) {
    try {
      const describe = await db.query(`DESCRIBE \`${t}\``) as any[];
      const indexes = await db.query(`SHOW INDEX FROM \`${t}\``) as any[];
      const createTable = await db.query(`SHOW CREATE TABLE \`${t}\``) as any[];
      
      results[t] = {
        describe: describe.map(r => ({
          field: r.Field,
          type: r.Type,
          null: r.Null,
          key: r.Key,
          default: r.Default,
          extra: r.Extra
        })),
        indexes: indexes.map(r => ({
          table: r.Table,
          non_unique: r.Non_unique,
          key_name: r.Key_name,
          seq_in_index: r.Seq_in_index,
          column_name: r.Column_name,
          collation: r.Collation,
          cardinality: r.Cardinality,
          sub_part: r.Sub_part,
          packed: r.Packed,
          null: r.Null,
          index_type: r.Index_type,
          comment: r.Comment,
          index_comment: r.Index_comment,
          visible: r.Visible,
          expression: r.Expression
        })),
        createTable: createTable[0]?.["Create Table"]
      };
    } catch (e: any) {
      results[t] = { error: e.message };
    }
  }

  writeFileSync("c:/Users/Lei Mendes/Desktop/Aplicações/Bliv/wapi-weaver/db_schema_temp.json", JSON.stringify(results, null, 2));
  console.log("Salvo com sucesso em db_schema_temp.json.");

  process.exit(0);
}

run().catch(console.error);
