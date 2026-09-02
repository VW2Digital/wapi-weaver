import db from "./src/lib/db.ts";

const [{ total }] = await db.query("SELECT COUNT(*) AS total FROM contacts WHERE custom_fields IS NOT NULL");
console.log("Contacts with custom_fields:", total);

const rows = await db.query("SELECT custom_fields FROM contacts WHERE custom_fields IS NOT NULL");
const keyCounts = {};
for (const r of rows) {
  const obj = typeof r.custom_fields === "string" ? JSON.parse(r.custom_fields) : r.custom_fields;
  if (!obj || typeof obj !== "object") continue;
  for (const k of Object.keys(obj)) {
    keyCounts[k] = (keyCounts[k] || 0) + 1;
  }
}
console.log("\nLegacy JSON keys (sample):");
for (const [k, c] of Object.entries(keyCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${c}`);
}

const defRows = await db.query("SELECT DISTINCT `key` FROM contact_custom_fields");
console.log("\nCanonical custom field keys:");
for (const r of defRows) console.log(`  ${r.key}`);

const valueRows = await db.query("SELECT DISTINCT cf.`key` FROM contact_custom_field_values cfv JOIN contact_custom_fields cf ON cfv.custom_field_id = cf.id");
console.log("\nCanonical values present for keys:");
for (const r of valueRows) console.log(`  ${r.key}`);

process.exit(0);
