import db from "./src/lib/db.ts";

const saveSteps = await db.query(
  "SELECT id, tenant_id, message_content, buttons_config FROM bot_steps WHERE message_type = 'save_variable'"
);

const counts = { total: saveSteps.length, canonical: 0, system: 0, unknown: 0, details: [] };
const standardFields = new Set(["name", "email", "company", "notes"]);
const systemKeys = new Set(["flow_id", "step_id", "channel", "tenant_id", "provider"]);

const allDefs = await db.query("SELECT user_id, `key` FROM contact_custom_fields");
const defKeysByTenant = new Map();
for (const d of allDefs) {
  if (!defKeysByTenant.has(d.user_id)) defKeysByTenant.set(d.user_id, new Set());
  defKeysByTenant.get(d.user_id).add(d.key);
}

for (const s of saveSteps) {
  let content;
  try {
    content = typeof s.message_content === "string" ? JSON.parse(s.message_content) : s.message_content;
  } catch {
    content = s.message_content;
  }
  const key = content?.key || (typeof s.message_content === "string" ? s.message_content : null);
  const tenantId = s.tenant_id;
  const isCanonical = defKeysByTenant.get(tenantId)?.has(key);
  const isSystem = systemKeys.has(key);
  const isStandard = standardFields.has(key);
  const category = isStandard || isCanonical ? "canonical" : isSystem ? "system" : "unknown";
  if (category === "canonical") counts.canonical++;
  else if (category === "system") counts.system++;
  else counts.unknown++;
  counts.details.push({ id: s.id, tenant: tenantId, key, category });
}

console.log(JSON.stringify(counts, null, 2));
process.exit(0);
