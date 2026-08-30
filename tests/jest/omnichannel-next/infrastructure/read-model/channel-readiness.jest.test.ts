import { describe, expect, test } from "@jest/globals";
import {
  createWhatsAppReadinessResolver,
  createInstagramReadinessResolver,
} from "@/lib/omnichannel-next/infrastructure/mysql/read-model";
import { FakeSqlExecutor } from "../test-fixtures";

const WA_CONFIG_SQL = `SELECT id, tenant_id, provider, external_account_id, meta_app_connection_id, access_token_encrypted FROM channel_connections WHERE id = ? AND tenant_id = ? AND provider = 'whatsapp' LIMIT 1`;
const WA_CRED_SQL = `SELECT id, access_token_encrypted, tenant_id, provider FROM channel_connections WHERE id = ? AND tenant_id = ? AND provider = ? LIMIT 1`;
const IG_CONFIG_SQL = `SELECT id, tenant_id, provider, external_account_id, meta_app_connection_id, access_token_encrypted, JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.page_id')) AS page_id, JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.ig_user_id')) AS ig_user_id FROM channel_connections WHERE id = ? AND tenant_id = ? AND provider = 'instagram' LIMIT 1`;
const IG_CRED_SQL = `SELECT id, access_token_encrypted, tenant_id, provider FROM channel_connections WHERE id = ? AND tenant_id = ? AND provider = ? LIMIT 1`;

function buildSql() {
  const sql = new FakeSqlExecutor();
  sql.addResult(
    WA_CONFIG_SQL,
    [{
      id: "wa-1",
      tenant_id: "tenant-a",
      provider: "whatsapp",
      external_account_id: "PHONE_123",
      meta_app_connection_id: "meta-1",
      access_token_encrypted: "[ENCRYPTED]",
    }],
    ["wa-1", "tenant-a"],
  );
  sql.addResult(
    WA_CRED_SQL,
    [{
      id: "wa-1",
      access_token_encrypted: "[ENCRYPTED]",
      tenant_id: "tenant-a",
      provider: "whatsapp",
    }],
    ["wa-1", "tenant-a", "whatsapp"],
  );
  sql.addResult(
    IG_CONFIG_SQL,
    [{
      id: "ig-1",
      tenant_id: "tenant-a",
      provider: "instagram",
      external_account_id: "IG_123",
      meta_app_connection_id: "meta-1",
      access_token_encrypted: "[ENCRYPTED]",
      page_id: "PAGE_X",
      ig_user_id: "IG_USER_Y",
    }],
    ["ig-1", "tenant-a"],
  );
  sql.addResult(
    IG_CRED_SQL,
    [{
      id: "ig-1",
      access_token_encrypted: "[ENCRYPTED]",
      tenant_id: "tenant-a",
      provider: "instagram",
    }],
    ["ig-1", "tenant-a", "instagram"],
  );
  return sql;
}

describe("Channel readiness", () => {
  test("WhatsApp readiness is CONFIG_READY", async () => {
    const sql = buildSql();
    const resolve = createWhatsAppReadinessResolver(sql);
    const r = await resolve("tenant-a", "wa-1");

    expect(r.provider).toBe("whatsapp");
    expect(r.configResolvable).toBe(true);
    expect(r.credentialReferenceResolvable).toBe(true);
    expect(r.blockers).toHaveLength(0);
  });

  test("Instagram readiness remains BLOCKED", async () => {
    const sql = buildSql();
    const resolve = createInstagramReadinessResolver(sql);
    const r = await resolve("tenant-a", "ig-1");

    expect(r.provider).toBe("instagram");
    expect(r.configResolvable).toBe(true);
    expect(r.credentialReferenceResolvable).toBe(true);
    expect(r.blockers).toContain("INSTAGRAM_API_VARIANT_REQUIRED");
  });

  test("WhatsApp wrong tenant is not resolvable", async () => {
    const sql = buildSql();
    const resolve = createWhatsAppReadinessResolver(sql);
    const r = await resolve("tenant-b", "wa-1");

    expect(r.configResolvable).toBe(false);
    expect(r.credentialReferenceResolvable).toBe(false);
    expect(r.blockers).toContain("WHATSAPP_CHANNEL_NOT_FOUND");
  });

  test("Sequential WA then IG then WA does not leak", async () => {
    const sql = buildSql();
    const wa = createWhatsAppReadinessResolver(sql);
    const ig = createInstagramReadinessResolver(sql);

    const r1 = await wa("tenant-a", "wa-1");
    const r2 = await ig("tenant-a", "ig-1");
    const r3 = await wa("tenant-a", "wa-1");

    expect(r1.blockers).toHaveLength(0);
    expect(r2.blockers).toContain("INSTAGRAM_API_VARIANT_REQUIRED");
    expect(r3.blockers).toHaveLength(0);
  });

  test("Parallel WA and IG are isolated", async () => {
    const sql = buildSql();
    const wa = createWhatsAppReadinessResolver(sql);
    const ig = createInstagramReadinessResolver(sql);

    const [rWa, rIg] = await Promise.all([
      wa("tenant-a", "wa-1"),
      ig("tenant-a", "ig-1"),
    ]);

    expect(rWa.provider).toBe("whatsapp");
    expect(rIg.provider).toBe("instagram");
    expect(rWa.blockers).toHaveLength(0);
    expect(rIg.blockers).toContain("INSTAGRAM_API_VARIANT_REQUIRED");
  });
});
