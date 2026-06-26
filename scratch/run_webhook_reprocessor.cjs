const mysql = require("mysql2/promise");

const dbConfigLocal = {
  host: "localhost",
  port: 3306,
  user: "wapi_user",
  password: "S0xbxPfKazBVT8JFy1UEOjIsrjox",
  database: "wapi_weaver",
};

// We will replicate the logic of processInboundDirectMessages to see what happens
async function reprocess() {
  let conn;
  try {
    console.log("=== WEBHOOK REPROCESS TEST ===");
    conn = await mysql.createConnection(dbConfigLocal);

    // Fetch all webhook events
    const [events] = await conn.query("SELECT id, user_id, raw, processed FROM webhook_events");
    console.log(`Found ${events.length} events.`);

    for (const ev of events) {
      console.log(`\nProcessing Event ID: ${ev.id}, User ID: ${ev.user_id}`);
      const payload = ev.raw;
      const userId = ev.user_id;

      for (const entry of payload.entry ?? []) {
        for (const change of entry.changes ?? []) {
          if (change.field === "messages") {
            const value = change.value;
            const messages = value?.messages ?? [];
            const waContacts = value?.contacts ?? [];
            const waIdToName = new Map();
            for (const c of waContacts) {
              const waId = c?.wa_id ? String(c.wa_id) : null;
              const name = c?.profile?.name ? String(c.profile.name) : "";
              if (waId) waIdToName.set(waId, name);
            }

            const phoneNumberId = value?.metadata?.phone_number_id
              ? String(value.metadata.phone_number_id)
              : null;
            const displayPhoneNumber = value?.metadata?.display_phone_number
              ? String(value.metadata.display_phone_number)
              : null;

            console.log(`Found ${messages.length} messages in changes.`);
            for (const m of messages) {
              const from = m.from;
              if (!from) {
                console.log("Message has no 'from' field, skipping.");
                continue;
              }
              const waMessageId = m.id;
              const phoneDigits = from.replace(/\D+/g, "");
              console.log(
                `Message Details: id=${m.id}, from=${m.from}, phoneDigits=${phoneDigits}, type=${m.type}`,
              );

              // Let's check if contact exists
              const [contacts] = await conn.query(
                "SELECT id, name, custom_fields FROM contacts WHERE user_id = ? AND phone_e164 = ?",
                [userId, phoneDigits],
              );
              const existingContact = contacts[0];
              console.log(
                "Existing contact in db:",
                existingContact ? existingContact.name : "None",
              );

              const existingCustomFields = existingContact?.custom_fields
                ? typeof existingContact.custom_fields === "string"
                  ? JSON.parse(existingContact.custom_fields)
                  : existingContact.custom_fields
                : {};

              const contactName = waIdToName.get(phoneDigits) || "";

              // Let's try to upsert contact
              const customFieldsStr = JSON.stringify({
                ...existingCustomFields,
                wa_id: m.from,
                phone_number_id: phoneNumberId,
                display_phone_number: displayPhoneNumber,
              });

              console.log("Upserting contact...");
              await conn.query(
                `
                INSERT INTO contacts (id, user_id, phone_e164, name, source, custom_fields, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
                ON DUPLICATE KEY UPDATE 
                  name = COALESCE(?, name),
                  custom_fields = ?,
                  updated_at = NOW()
              `,
                [
                  existingContact?.id || require("crypto").randomUUID(),
                  userId,
                  phoneDigits,
                  contactName || existingContact?.name || "Sem nome",
                  "whatsapp_inbound",
                  customFieldsStr,
                  contactName || null,
                  customFieldsStr,
                ],
              );

              let type = m.type ?? "text";
              let body = "";
              if (m.type === "text") {
                body = m.text?.body ?? "";
              } else if (m.type === "reaction") {
                body = m.reaction?.emoji ?? "";
              } else if (m.type === "interactive") {
                body = "[Interactive Reply]";
                if (m.interactive?.type === "nfm_reply") {
                  body = m.interactive.nfm_reply.response_json || "[Flow Reply]";
                }
              } else {
                body = `[Mensagem de tipo ${m.type}]`;
              }

              console.log("Inserting direct_message...");
              const dmId = require("crypto").randomUUID();
              await conn.query(
                `
                INSERT INTO direct_messages (id, user_id, contact_phone, direction, type, body, wa_message_id, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE 
                  body = VALUES(body),
                  status = VALUES(status)
              `,
                [dmId, userId, phoneDigits, "incoming", type, body, waMessageId, "delivered"],
              );
              console.log("Successfully inserted direct_message.");
            }
          }
        }
      }
    }

    // Check direct_messages count now
    const [finalDm] = await conn.query("SELECT COUNT(*) as count FROM direct_messages");
    console.log(`\nFinal count in direct_messages: ${finalDm[0].count}`);
  } catch (err) {
    console.error("Error during reprocessing:", err);
  } finally {
    if (conn) await conn.end();
  }
}

reprocess().catch(console.error);
