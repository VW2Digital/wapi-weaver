/**
 * Script controlado de migração não destrutiva do WhatsApp Legacy para Meta V3.
 *
 * Suporta:
 *   node --import tsx/esm scripts/migrate-legacy-meta-v3.ts --dry-run
 *   node --import tsx/esm scripts/migrate-legacy-meta-v3.ts --apply
 */

import "dotenv/config";
import { query } from "../src/lib/db";
import {
  saveMetaAppConnection,
  saveChannelConnection,
  listMetaAppConnections,
  listChannelConnections,
} from "../src/lib/messaging/services/meta-app-connection.service";

async function main() {
  const isApply = process.argv.includes("--apply");
  const isDryRun = !isApply || process.argv.includes("--dry-run");

  console.log(`\n======================================================`);
  console.log(` META V3 — LEGACY WHATSAPP MIGRATION TOOL`);
  console.log(` MODE: ${isDryRun ? "DRY-RUN (No changes applied)" : "APPLY (Applying V3 records)"}`);
  console.log(`======================================================\n`);

  // 1. Encryption Key Verification (Fail-closed)
  const encryptionKey = process.env.META_CREDENTIALS_ENCRYPTION_KEY;
  if (!encryptionKey || encryptionKey.trim().length === 0) {
    console.error(`[ERROR] FAIL_CLOSED: META_CREDENTIALS_ENCRYPTION_KEY is not configured.`);
    process.exit(1);
  }
  console.log(`[PASS] META_CREDENTIALS_ENCRYPTION_KEY is configured.\n`);

  // 2. Scan legacy profiles with WhatsApp credentials
  const legacyProfiles = await query<Array<any>>(
    `SELECT
       p.id AS profile_id,
       p.whatsapp_app_id,
       p.whatsapp_app_secret,
       p.whatsapp_phone_number_id,
       p.whatsapp_waba_id,
       p.whatsapp_business_phone,
       p.whatsapp_access_token
     FROM profiles p
     WHERE p.whatsapp_app_id IS NOT NULL AND p.whatsapp_app_id <> ''
        OR p.whatsapp_phone_number_id IS NOT NULL AND p.whatsapp_phone_number_id <> ''`
  );

  console.log(`Found ${legacyProfiles.length} candidate legacy profile(s).\n`);

  for (const p of legacyProfiles) {
    const tenantId = p.profile_id;
    const appId = p.whatsapp_app_id?.trim();
    const appSecret = p.whatsapp_app_secret?.trim();
    const phoneNumberId = p.whatsapp_phone_number_id?.trim();
    const wabaId = p.whatsapp_waba_id?.trim();
    const hasSecret = Boolean(appSecret && appSecret.length > 0);
    const hasToken = Boolean(p.whatsapp_access_token && p.whatsapp_access_token.length > 0);

    let classification = "INVALID";
    if (appId && hasSecret && phoneNumberId) {
      classification = "SAFE_TO_MIGRATE";
    } else if (!hasSecret || !appId) {
      classification = "REQUIRES_REAUTH";
    } else {
      classification = "INCOMPLETE";
    }

    console.log(`--- Legacy Profile: ${tenantId} ---`);
    console.log(`  Provider:                whatsapp`);
    console.log(`  App ID:                  ${appId || "NONE"}`);
    console.log(`  App Secret Configured:   ${hasSecret ? "YES" : "NO"}`);
    console.log(`  Access Token Configured: ${hasToken ? "YES" : "NO"}`);
    console.log(`  Phone Number ID:         ${phoneNumberId || "NONE"}`);
    console.log(`  WABA ID:                 ${wabaId || "NONE"}`);
    console.log(`  Classification:          ${classification}`);

    if (classification !== "SAFE_TO_MIGRATE") {
      console.log(`  Action:                  SKIPPED (${classification})\n`);
      continue;
    }

    if (isDryRun) {
      console.log(`  Action:                  WOULD MIGRATE TO V3 (DRY-RUN)\n`);
      continue;
    }

    // APPLY MODE: Non-destructive creation / reuse
    try {
      // 1. Meta App Connection
      const metaConnResult = await saveMetaAppConnection({
        tenantId,
        userId: tenantId,
        appId: appId!,
        appSecret: appSecret!,
        appName: `WhatsApp Official App (${appId})`,
      });

      console.log(`  [V3 Meta App]            ID: ${metaConnResult.connectionId} | Public ID: ${metaConnResult.publicId} | isNew: ${metaConnResult.isNew}`);

      // 2. Channel Connection
      const channelResult = await saveChannelConnection({
        tenantId,
        metaAppConnectionId: metaConnResult.connectionId,
        provider: "whatsapp",
        externalAccountId: phoneNumberId!,
        displayName: p.whatsapp_business_phone || `WhatsApp (${phoneNumberId})`,
        accessToken: p.whatsapp_access_token?.trim() || null,
        metadata: {
          waba_id: wabaId || null,
          display_phone_number: p.whatsapp_business_phone || null,
        },
      });

      console.log(`  [V3 Channel]             ID: ${channelResult.id} | External ID: ${phoneNumberId} | isNew: ${channelResult.isNew}`);
      console.log(`  Result:                  MIGRATED SUCCESSFULLY\n`);
    } catch (err: any) {
      console.error(`  [ERROR] Migration failed for tenant ${tenantId}:`, err.message, "\n");
    }
  }

  // Summary counts
  console.log(`======================================================`);
  console.log(` MIGRATION SUMMARY`);
  console.log(`======================================================`);
  if (!isDryRun) {
    const metaConns = await query<Array<any>>(`SELECT COUNT(*) AS c FROM meta_app_connections`);
    const channelConns = await query<Array<any>>(`SELECT COUNT(*) AS c FROM channel_connections`);
    console.log(`Total meta_app_connections:  ${metaConns[0]?.c ?? 0}`);
    console.log(`Total channel_connections:   ${channelConns[0]?.c ?? 0}`);
  } else {
    console.log(`Dry-run complete. No database changes were executed.`);
  }
  console.log(`\n`);
}

main().catch((err) => {
  console.error("Migration fatal error:", err);
  process.exit(1);
});
