import fs from "fs";
import path from "path";
import { describe, expect, it } from "@jest/globals";

const root = path.resolve(__dirname, "../..");

describe("company member tenant association regression", () => {
  it("gives new members a valid team_members id and tenant-scoped team", () => {
    const source = fs.readFileSync(path.join(root, "src/lib/users-admin.functions.ts"), "utf8");

    expect(source).toContain("INSERT INTO team_members (id, team_id, user_id, role)");
    expect(source).toContain("[crypto.randomUUID(), teamId, userId]");
    expect(source).toMatch(/\[\s*teamId,\s*tenantId,\s*tenantId,?\s*\]/);
    expect(source).not.toContain("INSERT IGNORE INTO team_members (team_id, user_id)");
  });

  it("uses canonical tenant_id scope for agent and team management queries", () => {
    const source = fs.readFileSync(path.join(root, "src/lib/assignment.functions.ts"), "utf8");

    expect(source).toContain(
      "WHERE (? = TRUE AND ur.user_id IS NOT NULL) OR u.id = ? OR t.tenant_id = ?",
    );
    expect(source).toContain("SELECT id FROM teams WHERE id = ? AND tenant_id = ? LIMIT 1");
    expect(source).not.toContain("WHERE u.id = ? OR t.user_id = ?");
    expect(source).toContain("if (!actorIsMaster)");
    expect(source).toContain("[crypto.randomUUID(), data.teamId, data.agentId]");
    expect(source.match(/\(id, tenant_id, user_id, contact_phone/g)).toHaveLength(3);
    expect(source).not.toContain("WHERE user_id = ? AND contact_phone = ?");
  });

  it("lists all users for the platform master while keeping company admins tenant-scoped", () => {
    const source = fs.readFileSync(path.join(root, "src/lib/users-admin.functions.ts"), "utf8");

    expect(source).toContain("access.isMaster");
    expect(source).toContain('db.query("SELECT user_id FROM user_roles")');
    expect(source).toContain("platformMembers ?? (await listTenantUserIds(access.tenantId))");
  });

  it("repairs legacy empty membership ids during installation", () => {
    const migration = fs.readFileSync(
      path.join(root, "database/migrations/029_repair_team_member_ids.sql"),
      "utf8",
    );

    expect(migration).toContain("SET id = UUID()");
    expect(migration).toContain("WHERE id = ''");
  });
});
