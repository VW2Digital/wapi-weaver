import db from "../src/lib/db";
import { triggerWebhookBotFlow } from "../src/lib/botflow-executor.server";
import crypto from "crypto";

async function runValidation() {
  console.log("Starting Webhook Trigger Validation Test...");

  // 1. Get two existing users (tenants) from the database
  const users = (await db.query("SELECT id, email FROM users LIMIT 2")) as any[];
  if (!users || users.length < 2) {
    console.error("Test requires at least 2 users in the database to validate multi-tenant isolation.");
    process.exit(1);
  }

  const tenantA = users[0].id;
  const tenantB = users[1].id;
  console.log(`Tenant A: ${users[0].email} (${tenantA})`);
  console.log(`Tenant B: ${users[1].email} (${tenantB})`);

  // Ensure profiles have dummy whatsapp_phone_number_id for tests
  await db.query("INSERT IGNORE INTO profiles (id, email) VALUES (?, ?)", [tenantA, users[0].email]);
  await db.query("INSERT IGNORE INTO profiles (id, email) VALUES (?, ?)", [tenantB, users[1].email]);
  await db.query("UPDATE profiles SET whatsapp_phone_number_id = 'test_number_a' WHERE id = ?", [tenantA]);
  await db.query("UPDATE profiles SET whatsapp_phone_number_id = 'test_number_b' WHERE id = ?", [tenantB]);

  // 2. Create test contacts
  const contactIdA = crypto.randomUUID();
  const contactIdB = crypto.randomUUID();

  await db.query(
    "INSERT INTO contacts (id, user_id, phone_e164, name) VALUES (?, ?, '+5511999999991', 'Contato A')",
    [contactIdA, tenantA]
  );
  await db.query(
    "INSERT INTO contacts (id, user_id, phone_e164, name) VALUES (?, ?, '+5511999999992', 'Contato B')",
    [contactIdB, tenantB]
  );

  // 3. Create test bot settings and steps (flows)
  const flowIdA = crypto.randomUUID();
  const flowIdB = crypto.randomUUID();

  // Create Bot Settings
  await db.query(
    "INSERT INTO bot_settings (id, user_id, name, channel, is_active) VALUES (?, ?, 'Flow Tenant A', 'whatsapp', true)",
    [flowIdA, tenantA]
  );
  await db.query(
    "INSERT INTO bot_settings (id, user_id, name, channel, is_active) VALUES (?, ?, 'Flow Tenant B', 'whatsapp', true)",
    [flowIdB, tenantB]
  );

  // Create Webhook Trigger Step for Tenant A
  const conditions = [{ field: "origem", operator: "equals", value: "teste-A" }];
  await db.query(
    `INSERT INTO bot_steps (id, user_id, bot_settings_id, step_order, trigger_type, trigger_value, message_type, message_content)
     VALUES (?, ?, ?, 1, 'webhook', ?, 'text', 'Mensagem de boas-vindas do Webhook para Tenant A')`,
    [crypto.randomUUID(), tenantA, flowIdA, JSON.stringify(conditions)]
  );

  // Create Webhook Trigger Step for Tenant B (same condition but different tenant)
  await db.query(
    `INSERT INTO bot_steps (id, user_id, bot_settings_id, step_order, trigger_type, trigger_value, message_type, message_content)
     VALUES (?, ?, ?, 1, 'webhook', ?, 'text', 'Mensagem de boas-vindas do Webhook para Tenant B')`,
    [crypto.randomUUID(), tenantB, flowIdB, JSON.stringify(conditions)]
  );

  // 4. Simulate receiving Webhook Event for Tenant A
  console.log("\n--- Simulation 1: Webhook received for Tenant A ---");
  const payload = { origem: "teste-A", form_id: "lead-capture" };
  await triggerWebhookBotFlow(tenantA, contactIdA, payload);

  // 5. Query Audit Logs for verification
  console.log("\n--- Querying Audit Logs (webhook_bot_logs) ---");
  const logs = (await db.query("SELECT * FROM webhook_bot_logs ORDER BY created_at DESC LIMIT 5")) as any[];

  console.log(`Found ${logs.length} audit log entries.`);
  for (const log of logs) {
    console.log(`- Log ID: ${log.id}`);
    console.log(`  Tenant: ${log.tenant_id}`);
    console.log(`  Flow Name: ${log.flow_name}`);
    console.log(`  Contact ID: ${log.contact_id}`);
    console.log(`  Is Match: ${log.is_match === 1 ? "TRUE" : "FALSE"}`);
    console.log(`  Payload: ${JSON.stringify(log.raw_payload)}`);
    console.log("-----------------------------------------");
  }

  // 6. Verification assertions
  const matchA = logs.find(l => l.tenant_id === tenantA && l.contact_id === contactIdA);
  const matchB = logs.find(l => l.tenant_id === tenantB);

  console.log("--- RESULTS ---");
  if (matchA && matchA.is_match === 1) {
    console.log("✔ SUCCESS: Flow for Tenant A matched and was triggered.");
  } else {
    console.error("❌ FAILED: Flow for Tenant A was not triggered.");
  }

  if (!matchB) {
    console.log("✔ SUCCESS: Tenant B flow was NOT triggered by Tenant A webhook (Multi-tenant Isolation Verified!).");
  } else {
    console.error("❌ FAILED: Tenant B flow was triggered or evaluated by Tenant A webhook!");
  }

  // Clean up test data
  console.log("\nCleaning up test data...");
  await db.query("DELETE FROM webhook_bot_logs WHERE contact_id IN (?, ?)", [contactIdA, contactIdB]);
  await db.query("DELETE FROM bot_steps WHERE bot_settings_id IN (?, ?)", [flowIdA, flowIdB]);
  await db.query("DELETE FROM bot_settings WHERE id IN (?, ?)", [flowIdA, flowIdB]);
  await db.query("DELETE FROM contacts WHERE id IN (?, ?)", [contactIdA, contactIdB]);

  console.log("Done.");
  process.exit(0);
}

runValidation().catch(console.error);
