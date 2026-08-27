#!/usr/bin/env node
import "dotenv/config";
import mysql from "mysql2/promise";

const mode = process.argv[2] || "--dry-run";
if (!["--dry-run", "--apply"].includes(mode)) {
  console.error("Uso: node scripts/backfill-contact-channels.mjs [--dry-run|--apply]");
  process.exit(1);
}

const connectionOptions = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "wapi_user",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "wapi_weaver",
};

async function determineChannelAndIds(phoneE164, identities) {
  // Preferencia por prefixo do phone_e164
  if (phoneE164?.startsWith("ig_")) {
    const ig = identities.find((i) => i.provider === "instagram") || {};
    return { channel: "instagram", instagramId: ig.external_id || phoneE164.slice(3), whatsappNumber: null };
  }
  if (phoneE164?.startsWith("fb_")) {
    const ms = identities.find((i) => i.provider === "messenger") || {};
    return { channel: "messenger", instagramId: null, whatsappNumber: null };
  }

  // Se existe identidade do Instagram vinculada, aplica canal instagram
  const ig = identities.find((i) => i.provider === "instagram");
  if (ig) {
    return { channel: "instagram", instagramId: ig.external_id || null, whatsappNumber: null };
  }

  // Se existe identidade do Messenger vinculada, aplica canal messenger
  const ms = identities.find((i) => i.provider === "messenger");
  if (ms) {
    return { channel: "messenger", instagramId: null, whatsappNumber: null };
  }

  // Fallback: whatsapp
  const wa = identities.find((i) => i.provider === "whatsapp");
  return {
    channel: "whatsapp",
    instagramId: null,
    whatsappNumber: wa?.phone_e164 || phoneE164 || null,
  };
}

async function main() {
  const db = await mysql.createConnection(connectionOptions);
  try {
    console.log(`[backfill] Modo: ${mode}`);
    console.log(`[backfill] Banco: ${connectionOptions.database} em ${connectionOptions.host}`);

    // Seleciona contatos sem canal preenchido ou com canal = 'whatsapp' porém identidade do Instagram
    const [contacts] = await db.execute(
      `SELECT id, phone_e164, channel, instagram_id, whatsapp_number, external_id
       FROM contacts
       WHERE id IN (SELECT DISTINCT contact_id FROM contact_identities)
       LIMIT 100000`,
    );

    let dryRunReport = [];
    let updated = 0;
    let unchanged = 0;

    await db.beginTransaction();
    try {
      for (const contact of contacts) {
        const [identityRows] = await db.execute(
          `SELECT provider, external_id, phone_e164
           FROM contact_identities
           WHERE contact_id = ?`,
          [contact.id],
        );

        const { channel, instagramId, whatsappNumber } = await determineChannelAndIds(
          contact.phone_e164,
          identityRows,
        );

        const needsUpdate =
          contact.channel !== channel ||
          contact.instagram_id !== instagramId ||
          contact.whatsapp_number !== whatsappNumber ||
          contact.external_id == null;

        if (!needsUpdate) {
          unchanged++;
          continue;
        }

        if (mode === "--dry-run") {
          dryRunReport.push({
            id: contact.id,
            phone_e164: contact.phone_e164,
            channel: { from: contact.channel, to: channel },
            instagram_id: { from: contact.instagram_id, to: instagramId },
            whatsapp_number: { from: contact.whatsapp_number, to: whatsappNumber },
            external_id: { from: contact.external_id, to: contact.external_id ?? instagramId ?? whatsappNumber },
          });
        } else {
          await db.execute(
            `UPDATE contacts
             SET channel = ?, instagram_id = ?, whatsapp_number = ?, external_id = COALESCE(?, external_id)
             WHERE id = ?`,
            [
              channel,
              instagramId,
              whatsappNumber,
              contact.external_id ?? instagramId ?? whatsappNumber,
              contact.id,
            ],
          );
          updated++;
        }
      }

      if (mode === "--dry-run") {
        await db.rollback();
        console.log(`[backfill] Dry-run concluído. ${dryRunReport.length} contatos seriam atualizados:`);
        console.log(JSON.stringify(dryRunReport.slice(0, 20), null, 2));
        if (dryRunReport.length > 20) {
          console.log(`[backfill] ...e mais ${dryRunReport.length - 20} registros.`);
        }
        console.log("[backfill] Execute com --apply para aplicar.");
      } else {
        await db.commit();
        console.log(`[backfill] Aplicado com sucesso. ${updated} contatos atualizados, ${unchanged} já corretos.`);
      }
    } catch (error) {
      await db.rollback();
      throw error;
    }
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("[backfill] FALHA:", error.message);
  process.exit(1);
});
