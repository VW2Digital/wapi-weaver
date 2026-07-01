# Módulo de Licenças — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement módulo completo de gerenciamento de licenças com dashboard, CRUD, APIs públicas e administrativas.

**Architecture:** Server functions (`licenses.functions.ts`) com lógica de negócio; rotas TanStack para páginas admin (`_app/licenses/*`) e APIs (`api/licenses/*` público, `api/admin/licenses/*` admin); tabelas MySQL para licenses, license_activations, license_events.

**Tech Stack:** Node.js + TypeScript + MySQL + TanStack Router/Start + React 19 + shadcn/ui + jsonwebtoken

## Global Constraints

- Tabelas seguem padrão do projeto: UUIDs VARCHAR(36), utf8mb4_unicode_ci, timestamps created_at/updated_at
- Chave original da licença NUNCA salva no banco — apenas hash SHA-256
- Rotas admin exigem role `admin` (verificada via `getCurrentUserRoles`)
- Server functions usam `requireAuth` middleware para rotas admin
- APIs públicas (`/api/licenses/*`) NÃO usam auth — validam via license key hash
- Ícones lucide-react (importar no `_app.tsx`): KeyRound, FileKey, PlusCircle, BarChart3, ShieldAlert, RefreshCw, Ban, CheckCircle, Globe, Calendar, Activity

---

### Task 1: Schema MySQL — Criar tabelas de licenças

**Files:**
- Modify: `schema_mysql.sql` (adicionar ao final)

**Interfaces:**
- Consumes: N/A
- Produces: Tabelas `licenses`, `license_activations`, `license_events`

- [ ] **Step 1: Adicionar tabela `licenses` ao schema**

```sql
-- Licenses module
CREATE TABLE IF NOT EXISTS licenses (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50) NULL,
  license_key_hash VARCHAR(64) NOT NULL,
  license_key_prefix VARCHAR(20) NOT NULL,
  plan_name VARCHAR(100) NOT NULL,
  status ENUM('active', 'expired', 'cancelled', 'blocked') NOT NULL DEFAULT 'active',
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  allowed_domain VARCHAR(255) NULL,
  max_activations INT NOT NULL DEFAULT 1,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_licenses_status (status),
  INDEX idx_licenses_ends_at (ends_at),
  INDEX idx_licenses_customer_email (customer_email),
  INDEX idx_licenses_hash (license_key_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 2: Adicionar tabela `license_activations`**

```sql
CREATE TABLE IF NOT EXISTS license_activations (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  license_id VARCHAR(36) NOT NULL,
  activation_id VARCHAR(64) NOT NULL UNIQUE,
  installation_id VARCHAR(255) NULL,
  domain VARCHAR(255) NULL,
  server_ip VARCHAR(45) NULL,
  fingerprint_hash VARCHAR(64) NULL,
  status ENUM('active', 'inactive', 'blocked') NOT NULL DEFAULT 'active',
  activated_at DATETIME NULL,
  last_seen_at DATETIME NULL,
  deactivated_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
  INDEX idx_la_license_id (license_id),
  INDEX idx_la_status (status),
  INDEX idx_la_fingerprint (fingerprint_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 3: Adicionar tabela `license_events`**

```sql
CREATE TABLE IF NOT EXISTS license_events (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  license_id VARCHAR(36) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  description TEXT NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
  INDEX idx_le_license_id (license_id),
  INDEX idx_le_event_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 4: Verificar o arquivo**

Run: `Get-Content "C:\Users\Lei Mendes\Desktop\Aplicações\Disparador\wapi-weaver\schema_mysql.sql" | Select-Object -Last 15`
Expected: As 3 novas tabelas aparecem no final.

---

### Task 2: Server Functions — Lógica de negócio de licenças

**Files:**
- Create: `src/lib/licenses.functions.ts`

**Interfaces:**
- Consumes: `db` (raw mysql2), `crypto`, `jsonwebtoken`, `JWT_SECRET`, `requireAuth`
- Produces: Funções `createLicense`, `listLicenses`, `getLicense`, `renewLicense`, `blockLicense`, `cancelLicense`, `reactivateLicense`, `updateLicenseDomain`, `activateLicense`, `checkLicense`, `getLicenseDashboard`

- [ ] **Step 1: Criar `src/lib/licenses.functions.ts`**

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import db from "@/lib/db";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

function generateLicenseKey(): { full: string; hash: string; prefix: string } {
  const part1 = crypto.randomBytes(2).toString("hex").toUpperCase();
  const part2 = crypto.randomBytes(2).toString("hex").toUpperCase();
  const part3 = crypto.randomBytes(2).toString("hex").toUpperCase();
  const full = `VW2-PRO-${part1}-${part2}-${part3}`;
  const hash = crypto.createHash("sha256").update(full).digest("hex");
  const prefix = `VW2-PRO-${part1}`;
  return { full, hash, prefix };
}

function signLicenseToken(payload: {
  license_id: string;
  activation_id: string | null;
  plan_name: string;
  domain: string | null;
  fingerprint_hash: string | null;
  status: string;
  license_ends_at: string;
}): string {
  const jwt = require("jsonwebtoken");
  const secret = process.env.JWT_SECRET || "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";
  const tokenPayload = {
    license_id: payload.license_id,
    activation_id: payload.activation_id,
    plan_name: payload.plan_name,
    domain: payload.domain,
    fingerprint_hash: payload.fingerprint_hash,
    issued_at: Math.floor(Date.now() / 1000),
    token_expires_at: Math.floor(Date.now() / 1000) + 3600,
    license_ends_at: payload.license_ends_at,
    status: payload.status,
  };
  return jwt.sign(tokenPayload, secret, { algorithm: "HS256" });
}

async function recordEvent(licenseId: string, type: string, description: string, metadata?: Record<string, any>) {
  await db.query(
    "INSERT INTO license_events (id, license_id, event_type, description, metadata) VALUES (?, ?, ?, ?, ?)",
    [uuidv4(), licenseId, type, description, metadata ? JSON.stringify(metadata) : null]
  );
}

async function getLicenseActivationsCount(licenseId: string): Promise<number> {
  const rows = await db.query(
    "SELECT COUNT(*) as count FROM license_activations WHERE license_id = ? AND status = 'active'",
    [licenseId]
  );
  return (rows as any[])[0]?.count || 0;
}

// ─── Admin: Create License ────────────────────────────────────────────────
const createLicenseSchema = z.object({
  customer_name: z.string().min(1).max(255),
  customer_email: z.string().email().max(255),
  customer_phone: z.string().max(50).optional(),
  plan_name: z.string().min(1).max(100),
  duration_days: z.number().int().positive(),
  allowed_domain: z.string().max(255).optional(),
  max_activations: z.number().int().positive().default(1),
  notes: z.string().optional(),
});

export type CreateLicenseInput = z.infer<typeof createLicenseSchema>;
export type CreateLicenseResult = {
  id: string;
  license_key: string;
  license_key_prefix: string;
  customer_name: string;
  customer_email: string;
  plan_name: string;
  starts_at: string;
  ends_at: string;
};

export const adminCreateLicense = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => createLicenseSchema.parse(d))
  .handler(async ({ context, input }) => {
    // Verificar role admin
    if (context.claims?.role !== "admin") {
      throw new Error("Apenas administradores podem gerar licenças");
    }

    const id = uuidv4();
    const { full, hash, prefix } = generateLicenseKey();
    const now = new Date();
    const startsAt = now;
    const endsAt = new Date(now.getTime() + input.duration_days * 24 * 60 * 60 * 1000);

    await db.query(
      `INSERT INTO licenses (id, customer_name, customer_email, customer_phone, license_key_hash, license_key_prefix, plan_name, status, starts_at, ends_at, allowed_domain, max_activations, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
      [
        id,
        input.customer_name,
        input.customer_email,
        input.customer_phone || null,
        hash,
        prefix,
        input.plan_name,
        startsAt,
        endsAt,
        input.allowed_domain || null,
        input.max_activations,
        input.notes || null,
      ]
    );

    await recordEvent(id, "licença criada", `Licença criada para ${input.customer_name} - Plano: ${input.plan_name}`, {
      plan_name: input.plan_name,
      duration_days: input.duration_days,
    });

    return {
      id,
      license_key: full,
      license_key_prefix: prefix,
      customer_name: input.customer_name,
      customer_email: input.customer_email,
      plan_name: input.plan_name,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    };
  });

// ─── Admin: List Licenses ──────────────────────────────────────────────────
export const adminListLicenses = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    if (context.claims?.role !== "admin") {
      throw new Error("Apenas administradores podem listar licenças");
    }

    const rows = await db.query(
      `SELECT l.*,
        (SELECT COUNT(*) FROM license_activations la WHERE la.license_id = l.id AND la.status = 'active') as activations_used
       FROM licenses l
       ORDER BY l.created_at DESC`
    );

    return rows;
  });

// ─── Admin: Get License Details ────────────────────────────────────────────
export const adminGetLicense = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ context, input }) => {
    if (context.claims?.role !== "admin") {
      throw new Error("Apenas administradores podem ver detalhes de licenças");
    }

    const rows = await db.query("SELECT * FROM licenses WHERE id = ?", [input.id]);
    if (!(rows as any[]).length) throw new Error("Licença não encontrada");

    const license = (rows as any[])[0];
    const activations = await db.query(
      "SELECT * FROM license_activations WHERE license_id = ? ORDER BY created_at DESC",
      [input.id]
    );
    const events = await db.query(
      "SELECT * FROM license_events WHERE license_id = ? ORDER BY created_at DESC LIMIT 50",
      [input.id]
    );
    const activationsUsed = await getLicenseActivationsCount(input.id);

    return { ...license, activations, events, activations_used: activationsUsed };
  });

// ─── Admin: Renew License ──────────────────────────────────────────────────
const renewSchema = z.object({
  license_id: z.string().min(1),
  new_ends_at: z.string().optional(),
  extra_days: z.number().int().positive().optional(),
});

export const adminRenewLicense = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => renewSchema.parse(d))
  .handler(async ({ context, input }) => {
    if (context.claims?.role !== "admin") {
      throw new Error("Apenas administradores podem renovar licenças");
    }

    const rows = await db.query("SELECT * FROM licenses WHERE id = ?", [input.license_id]);
    if (!(rows as any[]).length) throw new Error("Licença não encontrada");
    const license = (rows as any[])[0];

    let newEndsAt: Date;
    if (input.new_ends_at) {
      newEndsAt = new Date(input.new_ends_at);
    } else if (input.extra_days) {
      newEndsAt = new Date(license.ends_at.getTime() + input.extra_days * 24 * 60 * 60 * 1000);
    } else {
      throw new Error("Informe new_ends_at ou extra_days");
    }

    await db.query("UPDATE licenses SET ends_at = ?, status = 'active' WHERE id = ?", [newEndsAt, input.license_id]);

    await recordEvent(input.license_id, "licença renovada", `Licença renovada até ${newEndsAt.toISOString().split("T")[0]}`, {
      old_ends_at: license.ends_at,
      new_ends_at: newEndsAt,
    });

    return { success: true, ends_at: newEndsAt.toISOString() };
  });

// ─── Admin: Block License ──────────────────────────────────────────────────
export const adminBlockLicense = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ license_id: z.string().min(1) }).parse(d))
  .handler(async ({ context, input }) => {
    if (context.claims?.role !== "admin") {
      throw new Error("Apenas administradores podem bloquear licenças");
    }

    await db.query("UPDATE licenses SET status = 'blocked' WHERE id = ?", [input.license_id]);
    await db.query("UPDATE license_activations SET status = 'blocked' WHERE license_id = ? AND status = 'active'", [input.license_id]);

    await recordEvent(input.license_id, "licença bloqueada", "Licença bloqueada pelo administrador");

    return { success: true };
  });

// ─── Admin: Cancel License ─────────────────────────────────────────────────
export const adminCancelLicense = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ license_id: z.string().min(1) }).parse(d))
  .handler(async ({ context, input }) => {
    if (context.claims?.role !== "admin") {
      throw new Error("Apenas administradores podem cancelar licenças");
    }

    await db.query("UPDATE licenses SET status = 'cancelled' WHERE id = ?", [input.license_id]);
    await db.query("UPDATE license_activations SET status = 'inactive' WHERE license_id = ? AND status = 'active'", [input.license_id]);

    await recordEvent(input.license_id, "licença cancelada", "Licença cancelada pelo administrador");

    return { success: true };
  });

// ─── Admin: Reactivate License ─────────────────────────────────────────────
export const adminReactivateLicense = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ license_id: z.string().min(1) }).parse(d))
  .handler(async ({ context, input }) => {
    if (context.claims?.role !== "admin") {
      throw new Error("Apenas administradores podem reativar licenças");
    }

    const rows = await db.query("SELECT * FROM licenses WHERE id = ?", [input.license_id]);
    if (!(rows as any[]).length) throw new Error("Licença não encontrada");
    const license = (rows as any[])[0];

    if (license.status !== "blocked") {
      throw new Error("Apenas licenças bloqueadas podem ser reativadas");
    }

    await db.query("UPDATE licenses SET status = 'active' WHERE id = ?", [input.license_id]);

    await recordEvent(input.license_id, "licença reativada", "Licença reativada pelo administrador");

    return { success: true };
  });

// ─── Admin: Update Domain ──────────────────────────────────────────────────
const updateDomainSchema = z.object({
  license_id: z.string().min(1),
  allowed_domain: z.string().max(255),
});

export const adminUpdateLicenseDomain = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => updateDomainSchema.parse(d))
  .handler(async ({ context, input }) => {
    if (context.claims?.role !== "admin") {
      throw new Error("Apenas administradores podem alterar domínio");
    }

    const rows = await db.query("SELECT allowed_domain FROM licenses WHERE id = ?", [input.license_id]);
    if (!(rows as any[]).length) throw new Error("Licença não encontrada");
    const oldDomain = (rows as any[])[0].allowed_domain;

    await db.query("UPDATE licenses SET allowed_domain = ? WHERE id = ?", [input.allowed_domain, input.license_id]);

    await recordEvent(input.license_id, "domínio alterado", `Domínio alterado de ${oldDomain || "vazio"} para ${input.allowed_domain}`, {
      old_domain: oldDomain,
      new_domain: input.allowed_domain,
    });

    return { success: true, allowed_domain: input.allowed_domain };
  });

// ─── Admin: Dashboard Stats ────────────────────────────────────────────────
export const adminGetDashboard = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    if (context.claims?.role !== "admin") {
      throw new Error("Apenas administradores podem acessar o dashboard");
    }

    const activeCount = (await db.query("SELECT COUNT(*) as count FROM licenses WHERE status = 'active'")) as any[];
    const expiredCount = (await db.query("SELECT COUNT(*) as count FROM licenses WHERE status = 'expired'")) as any[];
    const blockedCount = (await db.query("SELECT COUNT(*) as count FROM licenses WHERE status = 'blocked'")) as any[];
    const cancelledCount = (await db.query("SELECT COUNT(*) as count FROM licenses WHERE status = 'cancelled'")) as any[];

    const expiringSoon = await db.query(
      "SELECT * FROM licenses WHERE status = 'active' AND ends_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY) ORDER BY ends_at ASC"
    );

    const recentActivations = await db.query(
      `SELECT la.*, l.customer_name, l.plan_name, l.license_key_prefix
       FROM license_activations la
       JOIN licenses l ON l.id = la.license_id
       WHERE la.status = 'active'
       ORDER BY la.last_seen_at DESC
       LIMIT 10`
    );

    return {
      active: (activeCount[0] as any).count,
      expired: (expiredCount[0] as any).count,
      blocked: (blockedCount[0] as any).count,
      cancelled: (cancelledCount[0] as any).count,
      expiringSoon,
      recentActivations,
    };
  });

// ─── API válidação para filtros de listagem ────────────────────────────────
const listLicensesFilterSchema = z.object({
  status: z.string().optional(),
  plan_name: z.string().optional(),
  search: z.string().optional(),
  ends_before: z.string().optional(),
  ends_after: z.string().optional(),
});

export const adminListLicensesFiltered = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => listLicensesFilterSchema.parse(d))
  .handler(async ({ context, input }) => {
    if (context.claims?.role !== "admin") {
      throw new Error("Apenas administradores podem listar licenças");
    }

    let sql = `SELECT l.*,
      (SELECT COUNT(*) FROM license_activations la WHERE la.license_id = l.id AND la.status = 'active') as activations_used
      FROM licenses l WHERE 1=1`;
    const params: any[] = [];

    if (input.status) {
      sql += " AND l.status = ?";
      params.push(input.status);
    }
    if (input.plan_name) {
      sql += " AND l.plan_name = ?";
      params.push(input.plan_name);
    }
    if (input.search) {
      sql += " AND (l.customer_name LIKE ? OR l.customer_email LIKE ? OR l.license_key_prefix LIKE ? OR l.allowed_domain LIKE ?)";
      const s = `%${input.search}%`;
      params.push(s, s, s, s);
    }
    if (input.ends_before) {
      sql += " AND l.ends_at <= ?";
      params.push(input.ends_before);
    }
    if (input.ends_after) {
      sql += " AND l.ends_at >= ?";
      params.push(input.ends_after);
    }

    sql += " ORDER BY l.created_at DESC";

    const rows = await db.query(sql, params);
    return rows;
  });

// ─── Public: Activate License ──────────────────────────────────────────────
export const publicActivateLicense = createServerFn({ method: "POST" })
  .handler(async ({ input }: { input: { license_key: string; domain: string; fingerprint_hash: string; installation_id: string } }) => {
    const hash = crypto.createHash("sha256").update(input.license_key).digest("hex");

    const rows = await db.query("SELECT * FROM licenses WHERE license_key_hash = ?", [hash]);
    if (!(rows as any[]).length) {
      throw new Error("Chave de licença inválida");
    }
    const license = (rows as any[])[0];

    if (license.status !== "active") {
      await recordEvent(license.id, "tentativa de ativação inválida", `Tentativa de ativação com licença ${license.status}`, {
        domain: input.domain,
        fingerprint: input.fingerprint_hash,
      });
      throw new Error(`Licença ${license.status}. Não é possível ativar.`);
    }

    if (new Date(license.ends_at) < new Date()) {
      await db.query("UPDATE licenses SET status = 'expired' WHERE id = ?", [license.id]);
      await recordEvent(license.id, "tentativa de ativação inválida", "Tentativa de ativação com licença vencida");
      throw new Error("Licença vencida. Renove para continuar usando.");
    }

    if (license.allowed_domain && license.allowed_domain !== input.domain) {
      await recordEvent(license.id, "tentativa em domínio diferente", `Tentativa de ativação no domínio ${input.domain} (esperado: ${license.allowed_domain})`, {
        attempted_domain: input.domain,
        expected_domain: license.allowed_domain,
      });
      throw new Error(`Domínio não autorizado. Domínio esperado: ${license.allowed_domain}`);
    }

    // Check if already activated on this installation
    const existingRows = await db.query(
      "SELECT * FROM license_activations WHERE license_id = ? AND (fingerprint_hash = ? OR installation_id = ?) AND status = 'active'",
      [license.id, input.fingerprint_hash, input.installation_id]
    );

    let activationId: string;
    let activation: any;

    if ((existingRows as any[]).length > 0) {
      activation = (existingRows as any[])[0];
      activationId = activation.id;
      await db.query(
        "UPDATE license_activations SET last_seen_at = NOW(), domain = ?, server_ip = ? WHERE id = ?",
        [input.domain, input.fingerprint_hash, activation.id]
      );
    } else {
      const activationsUsed = await getLicenseActivationsCount(license.id);
      if (activationsUsed >= license.max_activations) {
        await recordEvent(license.id, "tentativa em VPS diferente", `Máximo de ativações excedido (${license.max_activations})`, {
          max_activations: license.max_activations,
          current: activationsUsed,
        });
        throw new Error(`Máximo de ativações (${license.max_activations}) excedido.`);
      }

      activationId = uuidv4();
      await db.query(
        `INSERT INTO license_activations (id, license_id, activation_id, installation_id, domain, server_ip, fingerprint_hash, status, activated_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
        [activationId, license.id, activationId, input.installation_id, input.domain, input.fingerprint_hash, input.fingerprint_hash]
      );

      await recordEvent(license.id, "licença ativada", `Nova ativação em ${input.domain}`, {
        installation_id: input.installation_id,
        domain: input.domain,
        fingerprint: input.fingerprint_hash,
      });
    }

    const token = signLicenseToken({
      license_id: license.id,
      activation_id: activationId,
      plan_name: license.plan_name,
      domain: input.domain,
      fingerprint_hash: input.fingerprint_hash,
      status: "active",
      license_ends_at: license.ends_at instanceof Date ? license.ends_at.toISOString() : new Date(license.ends_at).toISOString(),
    });

    return {
      token,
      license: {
        id: license.id,
        plan_name: license.plan_name,
        status: license.status,
        ends_at: license.ends_at,
        max_activations: license.max_activations,
      },
    };
  });

// ─── Public: Check License ─────────────────────────────────────────────────
export const publicCheckLicense = createServerFn({ method: "POST" })
  .handler(async ({ input }: { input: { license_key: string; domain: string; fingerprint_hash: string; installation_id: string } }) => {
    const hash = crypto.createHash("sha256").update(input.license_key).digest("hex");

    const rows = await db.query("SELECT * FROM licenses WHERE license_key_hash = ?", [hash]);
    if (!(rows as any[]).length) {
      return { valid: false, error: "Chave de licença inválida" };
    }
    const license = (rows as any[])[0];

    if (license.status !== "active") {
      return { valid: false, error: `Licença ${license.status}` };
    }

    if (new Date(license.ends_at) < new Date()) {
      await db.query("UPDATE licenses SET status = 'expired' WHERE id = ?", [license.id]);
      return { valid: false, error: "Licença vencida" };
    }

    if (license.allowed_domain && license.allowed_domain !== input.domain) {
      return { valid: false, error: "Domínio não autorizado" };
    }

    // Update last_seen
    await db.query(
      "UPDATE license_activations SET last_seen_at = NOW() WHERE license_id = ? AND fingerprint_hash = ? AND status = 'active'",
      [license.id, input.fingerprint_hash]
    );

    const token = signLicenseToken({
      license_id: license.id,
      activation_id: null,
      plan_name: license.plan_name,
      domain: input.domain,
      fingerprint_hash: input.fingerprint_hash,
      status: "active",
      license_ends_at: license.ends_at instanceof Date ? license.ends_at.toISOString() : new Date(license.ends_at).toISOString(),
    });

    return {
      valid: true,
      token,
      license: {
        id: license.id,
        plan_name: license.plan_name,
        ends_at: license.ends_at,
      },
    };
  });
```

- [ ] **Step 2: Verificar se o arquivo foi criado**

Run: `Test-Path "C:\Users\Lei Mendes\Desktop\Aplicações\Disparador\wapi-weaver\src\lib\licenses.functions.ts"`
Expected: `True`

---

### Task 3: Layout de rotas — Páginas do módulo de licenças

**Files:**
- Create: `src/routes/_app/licenses.tsx`
- Create: `src/routes/_app/licenses/index.tsx`
- Create: `src/routes/_app/licenses/dashboard.tsx`
- Create: `src/routes/_app/licenses/create.tsx`
- Create: `src/routes/_app/licenses/$id.tsx`

**Interfaces:**
- Consumes: Funções de `licenses.functions.ts`
- Produces: Páginas protegidas por role admin

- [ ] **Step 1: Criar diretório `src/routes/_app/licenses/`**

Run: `New-Item -ItemType Directory -Path "C:\Users\Lei Mendes\Desktop\Aplicações\Disparador\wapi-weaver\src\routes\_app\licenses" -Force`

- [ ] **Step 2: Criar `src/routes/_app/licenses.tsx` (layout pai com Outlet)**

```typescript
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUserRoles } from "@/lib/admin.functions";
import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/licenses")({
  component: LicensesLayout,
});

function LicensesLayout() {
  const fetchRoles = useServerFn(getCurrentUserRoles);
  const router = useRouter();

  const { data: roles, isLoading } = useQuery({
    queryKey: ["current-roles"],
    queryFn: () => fetchRoles(),
  });

  useEffect(() => {
    if (!isLoading && (!roles?.isAdmin)) {
      router.navigate({ to: "/dashboard", replace: true });
    }
  }, [roles, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!roles?.isAdmin) {
    return null;
  }

  return <Outlet />;
}
```

- [ ] **Step 3: Criar `src/routes/_app/licenses/index.tsx` (listagem)**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, Ban, XCircle, RefreshCw, FileKey, Search } from "lucide-react";
import {
  adminListLicensesFiltered,
  adminBlockLicense,
  adminCancelLicense,
  adminRenewLicense,
} from "@/lib/licenses.functions";

export const Route = createFileRoute("/_app/licenses/")({
  component: LicensesListPage,
});

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "warning" }> = {
  active: { label: "Ativa", variant: "default" },
  expired: { label: "Vencida", variant: "secondary" },
  blocked: { label: "Bloqueada", variant: "destructive" },
  cancelled: { label: "Cancelada", variant: "outline" },
};

function LicensesListPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [search, setSearch] = useState("");
  const [renewDialog, setRenewDialog] = useState<{ open: boolean; licenseId: string; currentEndsAt: string }>({
    open: false,
    licenseId: "",
    currentEndsAt: "",
  });
  const [extraDays, setExtraDays] = useState(30);

  const fetchLicenses = useServerFn(adminListLicensesFiltered);
  const doBlock = useServerFn(adminBlockLicense);
  const doCancel = useServerFn(adminCancelLicense);
  const doRenew = useServerFn(adminRenewLicense);

  const queryParams = { status: status || undefined, plan_name: plan || undefined, search: search || undefined };

  const { data: licenses, isLoading, refetch } = useQuery({
    queryKey: ["admin-licenses", queryParams],
    queryFn: () => fetchLicenses({ data: queryParams }),
  });

  const handleBlock = async (licenseId: string) => {
    try {
      await doBlock({ data: { license_id: licenseId } });
      toast.success("Licença bloqueada com sucesso");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Erro ao bloquear licença");
    }
  };

  const handleCancel = async (licenseId: string) => {
    try {
      await doCancel({ data: { license_id: licenseId } });
      toast.success("Licença cancelada com sucesso");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Erro ao cancelar licença");
    }
  };

  const handleRenew = async () => {
    try {
      await doRenew({ data: { license_id: renewDialog.licenseId, extra_days: extraDays } });
      toast.success(`Licença renovada por +${extraDays} dias`);
      setRenewDialog({ open: false, licenseId: "", currentEndsAt: "" });
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Erro ao renovar licença");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Licenças"
        description="Gerencie todas as licenças do sistema"
        actions={
          <Link to="/licenses/create">
            <Button>
              <FileKey className="mr-2 h-4 w-4" />
              Nova Licença
            </Button>
          </Link>
        }
      />

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Buscar</label>
            <Input
              placeholder="Nome, email, chave, domínio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-[180px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                <SelectItem value="active">Ativa</SelectItem>
                <SelectItem value="expired">Vencida</SelectItem>
                <SelectItem value="blocked">Bloqueada</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-[180px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Plano</label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                <SelectItem value="PRO">PRO</SelectItem>
                <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Domínio</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Ativações</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : !licenses?.length ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Nenhuma licença encontrada
                </TableCell>
              </TableRow>
            ) : (
              (licenses as any[]).map((lic: any) => (
                <TableRow key={lic.id}>
                  <TableCell className="font-medium">{lic.customer_name}</TableCell>
                  <TableCell>{lic.customer_email}</TableCell>
                  <TableCell>{lic.plan_name}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_MAP[lic.status]?.variant || "outline"}>
                      {STATUS_MAP[lic.status]?.label || lic.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate">{lic.allowed_domain || "-"}</TableCell>
                  <TableCell>{new Date(lic.starts_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>{new Date(lic.ends_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>{lic.activations_used}/{lic.max_activations}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate({ to: `/licenses/${lic.id}` })}
                        title="Ver detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setRenewDialog({ open: true, licenseId: lic.id, currentEndsAt: lic.ends_at })}
                        title="Renovar"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      {lic.status === "active" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleBlock(lic.id)}
                          title="Bloquear"
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      )}
                      {(lic.status === "active" || lic.status === "blocked") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCancel(lic.id)}
                          title="Cancelar"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={renewDialog.open} onOpenChange={(open) => setRenewDialog({ ...renewDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renovar Licença</DialogTitle>
            <DialogDescription>
              Adicione dias à licença. Vencimento atual: {renewDialog.currentEndsAt ? new Date(renewDialog.currentEndsAt).toLocaleDateString("pt-BR") : "-"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Adicionar dias</label>
              <Select value={String(extraDays)} onValueChange={(v) => setExtraDays(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                  <SelectItem value="180">180 dias</SelectItem>
                  <SelectItem value="365">365 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewDialog({ open: false, licenseId: "", currentEndsAt: "" })}>
              Cancelar
            </Button>
            <Button onClick={handleRenew}>Renovar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 4: Criar `src/routes/_app/licenses/dashboard.tsx`**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KeyRound, AlertTriangle, Ban, XCircle, Activity, CalendarClock } from "lucide-react";
import { adminGetDashboard } from "@/lib/licenses.functions";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/licenses/dashboard")({
  component: LicensesDashboardPage,
});

function LicensesDashboardPage() {
  const fetchDashboard = useServerFn(adminGetDashboard);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["licenses-dashboard"],
    queryFn: () => fetchDashboard(),
  });

  const cards = [
    { label: "Ativas", value: stats?.active ?? 0, icon: KeyRound, color: "text-green-600" },
    { label: "Vencidas", value: stats?.expired ?? 0, icon: AlertTriangle, color: "text-yellow-600" },
    { label: "Bloqueadas", value: stats?.blocked ?? 0, icon: Ban, color: "text-red-600" },
    { label: "Canceladas", value: stats?.cancelled ?? 0, icon: XCircle, color: "text-gray-500" },
  ] as const;

  const formatDate = (d: string | Date) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("pt-BR");
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Dashboard de Licenças"
        description="Visão geral do sistema de licenciamento"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{isLoading ? "..." : card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Vencendo nos próximos 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Carregando...</p>
            ) : !stats?.expiringSoon?.length ? (
              <p className="text-muted-foreground text-sm">Nenhuma licença vence nos próximos 7 dias.</p>
            ) : (
              <div className="space-y-2">
                {(stats.expiringSoon as any[]).map((lic: any) => (
                  <div key={lic.id} className="flex items-center justify-between py-1 border-b last:border-0">
                    <div>
                      <Link to={`/licenses/${lic.id}`} className="font-medium text-sm hover:underline">
                        {lic.customer_name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{lic.plan_name}</p>
                    </div>
                    <Badge variant="warning">{formatDate(lic.ends_at)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Últimas ativações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Carregando...</p>
            ) : !stats?.recentActivations?.length ? (
              <p className="text-muted-foreground text-sm">Nenhuma ativação recente.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Última verificação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(stats.recentActivations as any[]).map((act: any) => (
                    <TableRow key={act.id}>
                      <TableCell className="text-sm">{act.customer_name}</TableCell>
                      <TableCell>{act.plan_name}</TableCell>
                      <TableCell>{formatDate(act.last_seen_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Criar `src/routes/_app/licenses/create.tsx`**

```typescript
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Copy, FileKey, CheckCircle2 } from "lucide-react";
import { adminCreateLicense } from "@/lib/licenses.functions";
import type { CreateLicenseInput, CreateLicenseResult } from "@/lib/licenses.functions";

export const Route = createFileRoute("/_app/licenses/create")({
  component: CreateLicensePage,
});

const DURATIONS = [
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
  { value: 180, label: "6 meses" },
  { value: 365, label: "1 ano" },
];

function CreateLicensePage() {
  const navigate = useNavigate();
  const doCreate = useServerFn(adminCreateLicense);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CreateLicenseResult | null>(null);
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    plan_name: "PRO",
    duration_type: "90",
    duration_custom: "",
    allowed_domain: "",
    max_activations: "1",
    notes: "",
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const duration = form.duration_type === "custom"
        ? parseInt(form.duration_custom, 10)
        : parseInt(form.duration_type, 10);

      if (!duration || duration <= 0) {
        toast.error("Duração inválida");
        setLoading(false);
        return;
      }

      const input: CreateLicenseInput = {
        customer_name: form.customer_name,
        customer_email: form.customer_email,
        customer_phone: form.customer_phone || undefined,
        plan_name: form.plan_name,
        duration_days: duration,
        allowed_domain: form.allowed_domain || undefined,
        max_activations: parseInt(form.max_activations, 10) || 1,
        notes: form.notes || undefined,
      };

      const res = await doCreate({ data: input });
      setResult(res);

      if (typeof window !== "undefined") {
        const clipboardItems = [
          { label: "Chave", value: res.license_key },
          { label: "Cliente", value: res.customer_name },
          { label: "Plano", value: res.plan_name },
          { label: "Início", value: new Date(res.starts_at).toLocaleDateString("pt-BR") },
          { label: "Vencimento", value: new Date(res.ends_at).toLocaleDateString("pt-BR") },
        ];
        localStorage.setItem("last_generated_license", JSON.stringify(clipboardItems));
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar licença");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!result) return;
    try {
      const text = `Chave: ${result.license_key}\nCliente: ${result.customer_name}\nPlano: ${result.plan_name}\nInício: ${new Date(result.starts_at).toLocaleDateString("pt-BR")}\nVencimento: ${new Date(result.ends_at).toLocaleDateString("pt-BR")}`;
      await navigator.clipboard.writeText(text);
      toast.success("Informações copiadas!");
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  if (result) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title="Licença Gerada" description="Salve a chave abaixo. Ela não será exibida novamente." />
        <Card className="max-w-2xl mx-auto">
          <CardContent className="pt-6 space-y-6">
            <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
              <CheckCircle2 className="h-5 w-5 text-yellow-600" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-200 font-medium">
                Copie a chave abaixo agora. Esta é a única vez que ela será exibida!
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Chave da Licença</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={result.license_key}
                  className="font-mono text-lg text-center tracking-widest"
                />
                <Button variant="outline" size="icon" onClick={copyToClipboard}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Cliente:</span> <span className="font-medium">{result.customer_name}</span></div>
              <div><span className="text-muted-foreground">E-mail:</span> <span className="font-medium">{result.customer_email}</span></div>
              <div><span className="text-muted-foreground">Plano:</span> <span className="font-medium">{result.plan_name}</span></div>
              <div><span className="text-muted-foreground">Prefixo:</span> <span className="font-mono font-medium">{result.license_key_prefix}</span></div>
              <div><span className="text-muted-foreground">Início:</span> <span className="font-medium">{new Date(result.starts_at).toLocaleDateString("pt-BR")}</span></div>
              <div><span className="text-muted-foreground">Vencimento:</span> <span className="font-medium">{new Date(result.ends_at).toLocaleDateString("pt-BR")}</span></div>
            </div>

            <div className="flex gap-3">
              <Button onClick={() => navigate({ to: "/licenses" })}>
                Ir para Listagem
              </Button>
              <Button variant="outline" onClick={() => setResult(null)}>
                Gerar Outra
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Gerar Nova Licença" description="Crie uma nova chave de licença para um cliente" />

      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer_name">Nome do Cliente *</Label>
                <Input
                  id="customer_name"
                  required
                  value={form.customer_name}
                  onChange={(e) => updateField("customer_name", e.target.value)}
                  placeholder="Nome completo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_email">E-mail *</Label>
                <Input
                  id="customer_email"
                  type="email"
                  required
                  value={form.customer_email}
                  onChange={(e) => updateField("customer_email", e.target.value)}
                  placeholder="cliente@exemplo.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_phone">Telefone</Label>
                <Input
                  id="customer_phone"
                  value={form.customer_phone}
                  onChange={(e) => updateField("customer_phone", e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan_name">Plano *</Label>
                <Select value={form.plan_name} onValueChange={(v) => updateField("plan_name", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRO">PRO</SelectItem>
                    <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                    <SelectItem value="STARTER">Starter</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration_type">Duração *</Label>
                <Select value={form.duration_type} onValueChange={(v) => updateField("duration_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map((d) => (
                      <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                    ))}
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.duration_type === "custom" && (
                <div className="space-y-2">
                  <Label htmlFor="duration_custom">Dias *</Label>
                  <Input
                    id="duration_custom"
                    type="number"
                    min={1}
                    required
                    value={form.duration_custom}
                    onChange={(e) => updateField("duration_custom", e.target.value)}
                    placeholder="180"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="allowed_domain">Domínio Autorizado</Label>
                <Input
                  id="allowed_domain"
                  value={form.allowed_domain}
                  onChange={(e) => updateField("allowed_domain", e.target.value)}
                  placeholder="cliente.com.br"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_activations">Máximo de Ativações *</Label>
                <Input
                  id="max_activations"
                  type="number"
                  min={1}
                  required
                  value={form.max_activations}
                  onChange={(e) => updateField("max_activations", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Observações internas..."
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading} className="w-full md:w-auto">
                {loading ? "Gerando..." : "Gerar Licença"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/licenses" })}>
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Criar `src/routes/_app/licenses/$id.tsx` (detalhes)**

```typescript
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  RefreshCw,
  Ban,
  XCircle,
  CheckCircle,
  Globe,
  Activity,
  ChevronLeft,
} from "lucide-react";
import {
  adminGetLicense,
  adminBlockLicense,
  adminCancelLicense,
  adminReactivateLicense,
  adminRenewLicense,
  adminUpdateLicenseDomain,
} from "@/lib/licenses.functions";

export const Route = createFileRoute("/_app/licenses/$id")({
  component: LicenseDetailPage,
});

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativa", variant: "default" },
  expired: { label: "Vencida", variant: "secondary" },
  blocked: { label: "Bloqueada", variant: "destructive" },
  cancelled: { label: "Cancelada", variant: "outline" },
};

function LicenseDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const fetchLicense = useServerFn(adminGetLicense);
  const doBlock = useServerFn(adminBlockLicense);
  const doCancel = useServerFn(adminCancelLicense);
  const doReactivate = useServerFn(adminReactivateLicense);
  const doRenew = useServerFn(adminRenewLicense);
  const doUpdateDomain = useServerFn(adminUpdateLicenseDomain);

  const [renewOpen, setRenewOpen] = useState(false);
  const [extraDays, setExtraDays] = useState(30);
  const [domainOpen, setDomainOpen] = useState(false);
  const [newDomain, setNewDomain] = useState("");

  const { data: license, isLoading } = useQuery({
    queryKey: ["license-detail", id],
    queryFn: () => fetchLicense({ data: { id } }),
  });

  const handleAction = async (action: () => Promise<any>, successMsg: string) => {
    try {
      await action();
      toast.success(successMsg);
      queryClient.invalidateQueries({ queryKey: ["license-detail", id] });
    } catch (err: any) {
      toast.error(err.message || "Erro na operação");
    }
  };

  const formatDate = (d: string | Date | null | undefined) => {
    if (!d) return "-";
    return new Date(d).toLocaleString("pt-BR");
  };

  const EVENT_LABELS: Record<string, string> = {
    "licença criada": "Licença Criada",
    "licença ativada": "Ativação Realizada",
    "licença renovada": "Licença Renovada",
    "licença bloqueada": "Licença Bloqueada",
    "licença cancelada": "Licença Cancelada",
    "licença reativada": "Licença Reativada",
    "tentativa de ativação inválida": "Tentativa Inválida",
    "tentativa em domínio diferente": "Domínio Diferente",
    "tentativa em VPS diferente": "VPS Diferente",
    "domínio alterado": "Domínio Alterado",
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px] text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!license) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px] text-muted-foreground">
        Licença não encontrada
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={license.customer_name}
        description={`Licença • ${license.plan_name}`}
        actions={
          <Button variant="ghost" onClick={() => navigate({ to: "/licenses" })}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        }
      />

      {/* Status & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant={STATUS_MAP[license.status]?.variant || "outline"} className="text-sm px-3 py-1">
            {STATUS_MAP[license.status]?.label || license.status}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Prefixo: <span className="font-mono font-medium">{license.license_key_prefix}</span>
          </span>
        </div>
        <div className="flex gap-2">
          {(license.status === "active" || license.status === "expired") && (
            <Button variant="outline" size="sm" onClick={() => setRenewOpen(true)}>
              <RefreshCw className="mr-2 h-4 w-4" /> Renovar
            </Button>
          )}
          {license.status === "active" && (
            <Button variant="outline" size="sm" onClick={() => handleAction(() => doBlock({ data: { license_id: id } }), "Licença bloqueada")}>
              <Ban className="mr-2 h-4 w-4" /> Bloquear
            </Button>
          )}
          {license.status === "active" && (
            <Button variant="destructive" size="sm" onClick={() => handleAction(() => doCancel({ data: { license_id: id } }), "Licença cancelada")}>
              <XCircle className="mr-2 h-4 w-4" /> Cancelar
            </Button>
          )}
          {license.status === "blocked" && (
            <Button variant="outline" size="sm" onClick={() => handleAction(() => doReactivate({ data: { license_id: id } }), "Licença reativada")}>
              <CheckCircle className="mr-2 h-4 w-4" /> Reativar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => { setNewDomain(license.allowed_domain || ""); setDomainOpen(true); }}>
            <Globe className="mr-2 h-4 w-4" /> Alterar Domínio
          </Button>
        </div>
      </div>

      {/* License Data */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Dados do Cliente</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{license.customer_name}</span></div>
            <div><span className="text-muted-foreground">E-mail:</span> <span className="font-medium">{license.customer_email}</span></div>
            <div><span className="text-muted-foreground">Telefone:</span> <span className="font-medium">{license.customer_phone || "-"}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Plano & Período</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Plano:</span> <span className="font-medium">{license.plan_name}</span></div>
            <div><span className="text-muted-foreground">Início:</span> <span className="font-medium">{formatDate(license.starts_at)}</span></div>
            <div><span className="text-muted-foreground">Vencimento:</span> <span className="font-medium">{formatDate(license.ends_at)}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Ativações</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Máximo:</span> <span className="font-medium">{license.max_activations}</span></div>
            <div><span className="text-muted-foreground">Utilizadas:</span> <span className="font-medium">{license.activations_used || 0}</span></div>
            <div><span className="text-muted-foreground">Domínio:</span> <span className="font-medium">{license.allowed_domain || "Livre"}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Activations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Ativações ({license.activations?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!license.activations?.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma ativação registrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID da Ativação</TableHead>
                  <TableHead>Domínio</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Fingerprint</TableHead>
                  <TableHead>Instalação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ativada em</TableHead>
                  <TableHead>Última verificação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(license.activations as any[]).map((act: any) => (
                  <TableRow key={act.id}>
                    <TableCell className="font-mono text-xs">{act.activation_id?.substring(0, 8)}...</TableCell>
                    <TableCell>{act.domain || "-"}</TableCell>
                    <TableCell>{act.server_ip || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{act.fingerprint_hash?.substring(0, 12)}...</TableCell>
                    <TableCell className="font-mono text-xs">{act.installation_id?.substring(0, 8)}...</TableCell>
                    <TableCell>
                      <Badge variant={act.status === "active" ? "default" : "secondary"}>
                        {act.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(act.activated_at)}</TableCell>
                    <TableCell>{formatDate(act.last_seen_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Events History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Eventos</CardTitle>
        </CardHeader>
        <CardContent>
          {!license.events?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
          ) : (
            <div className="space-y-2">
              {(license.events as any[]).map((evt: any) => (
                <div key={evt.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {EVENT_LABELS[evt.event_type] || evt.event_type}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{evt.description}</p>
                    {evt.metadata && (
                      <pre className="text-xs text-muted-foreground mt-1 overflow-x-auto">
                        {typeof evt.metadata === "string" ? evt.metadata : JSON.stringify(evt.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{formatDate(evt.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Renew Dialog */}
      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renovar Licença</DialogTitle>
            <DialogDescription>
              Adicione dias à licença. Vencimento atual: {formatDate(license.ends_at)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Adicionar dias</Label>
              <Select value={String(extraDays)} onValueChange={(v) => setExtraDays(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                  <SelectItem value="180">180 dias</SelectItem>
                  <SelectItem value="365">365 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewOpen(false)}>Cancelar</Button>
            <Button onClick={() => handleAction(
              () => doRenew({ data: { license_id: id, extra_days: extraDays } }).then(() => setRenewOpen(false)),
              `Renovada por +${extraDays} dias`
            )}>Renovar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Domain Dialog */}
      <Dialog open={domainOpen} onOpenChange={setDomainOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Domínio Autorizado</DialogTitle>
            <DialogDescription>
              Domínio atual: {license.allowed_domain || "Nenhum (livre)"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Novo domínio</Label>
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="novo-dominio.com.br"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDomainOpen(false)}>Cancelar</Button>
            <Button onClick={() => handleAction(
              () => doUpdateDomain({ data: { license_id: id, allowed_domain: newDomain } }).then(() => setDomainOpen(false)),
              "Domínio alterado"
            )}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 7: Verificar arquivos criados**

Run: `Get-ChildItem -LiteralPath "C:\Users\Lei Mendes\Desktop\Aplicações\Disparador\wapi-weaver\src\routes\_app\licenses" -Name`
Expected: `dashboard.tsx`, `index.tsx`, `create.tsx`, `$id.tsx`

---

### Task 4: APIs — Rotas públicas e administrativas

**Files:**
- Create: `src/routes/api/licenses/activate.ts`
- Create: `src/routes/api/licenses/check.ts`
- Create: `src/routes/api/admin/licenses/index.ts`
- Create: `src/routes/api/admin/licenses/detail.ts`
- Create: `src/routes/api/admin/licenses/create.ts`
- Create: `src/routes/api/admin/licenses/renew.ts`
- Create: `src/routes/api/admin/licenses/block.ts`
- Create: `src/routes/api/admin/licenses/cancel.ts`
- Create: `src/routes/api/admin/licenses/reactivate.ts`
- Create: `src/routes/api/admin/licenses/update-domain.ts`

**Interfaces:**
- Consumes: `licenses.functions.ts`, `requireAuth`
- Produces: Endpoints REST públicos e admin

- [ ] **Step 1: Criar diretórios**

Run: `New-Item -ItemType Directory -Path "C:\Users\Lei Mendes\Desktop\Aplicações\Disparador\wapi-weaver\src\routes\api\licenses" -Force`
Run: `New-Item -ItemType Directory -Path "C:\Users\Lei Mendes\Desktop\Aplicações\Disparador\wapi-weaver\src\routes\api\admin\licenses" -Force`

- [ ] **Step 2: Criar `src/routes/api/licenses/activate.ts`**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { publicActivateLicense } from "@/lib/licenses.functions";

export const Route = createFileRoute("/api/licenses/activate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = await request.json();
          const result = await publicActivateLicense({ input });
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
```

- [ ] **Step 3: Criar `src/routes/api/licenses/check.ts`**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { publicCheckLicense } from "@/lib/licenses.functions";

export const Route = createFileRoute("/api/licenses/check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = await request.json();
          const result = await publicCheckLicense({ input });
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
```

- [ ] **Step 4: Criar `src/routes/api/admin/licenses/index.ts`**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import db from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";

async function verifyAdmin(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) throw new Error("Não autorizado");
  const decoded = jwt.verify(auth.replace("Bearer ", ""), JWT_SECRET) as any;
  if (decoded.role !== "admin") throw new Error("Apenas administradores");
  return decoded;
}

export const Route = createFileRoute("/api/admin/licenses")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await verifyAdmin(request);
          const rows = await db.query(
            `SELECT l.*,
              (SELECT COUNT(*) FROM license_activations la WHERE la.license_id = l.id AND la.status = 'active') as activations_used
             FROM licenses l ORDER BY l.created_at DESC`
          );
          return new Response(JSON.stringify(rows), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
```

- [ ] **Step 5: Criar `src/routes/api/admin/licenses/detail.ts`**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import db from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";

async function verifyAdmin(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) throw new Error("Não autorizado");
  const decoded = jwt.verify(auth.replace("Bearer ", ""), JWT_SECRET) as any;
  if (decoded.role !== "admin") throw new Error("Apenas administradores");
  return decoded;
}

export const Route = createFileRoute("/api/admin/licenses/detail")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await verifyAdmin(request);
          const { id } = await request.json();

          const rows = await db.query("SELECT * FROM licenses WHERE id = ?", [id]);
          if (!(rows as any[]).length) {
            return new Response(JSON.stringify({ error: "Licença não encontrada" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          const license = (rows as any[])[0];
          const activations = await db.query(
            "SELECT * FROM license_activations WHERE license_id = ? ORDER BY created_at DESC", [id]
          );
          const events = await db.query(
            "SELECT * FROM license_events WHERE license_id = ? ORDER BY created_at DESC LIMIT 50", [id]
          );

          return new Response(JSON.stringify({ ...license, activations, events }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
```

- [ ] **Step 6: Criar `src/routes/api/admin/licenses/create.ts`**

```typescript
import { createFileRoute } from "@tanstack/react-router";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import db from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";

async function verifyAdmin(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) throw new Error("Não autorizado");
  const decoded = jwt.verify(auth.replace("Bearer ", ""), JWT_SECRET) as any;
  if (decoded.role !== "admin") throw new Error("Apenas administradores");
  return decoded;
}

function generateLicenseKey() {
  const part1 = crypto.randomBytes(2).toString("hex").toUpperCase();
  const part2 = crypto.randomBytes(2).toString("hex").toUpperCase();
  const part3 = crypto.randomBytes(2).toString("hex").toUpperCase();
  const full = `VW2-PRO-${part1}-${part2}-${part3}`;
  const hash = crypto.createHash("sha256").update(full).digest("hex");
  const prefix = `VW2-PRO-${part1}`;
  return { full, hash, prefix };
}

export const Route = createFileRoute("/api/admin/licenses/create")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await verifyAdmin(request);
          const { customer_name, customer_email, customer_phone, plan_name, duration_days, allowed_domain, max_activations, notes } = await request.json();

          if (!customer_name || !customer_email || !plan_name || !duration_days) {
            return new Response(JSON.stringify({ error: "Campos obrigatórios: customer_name, customer_email, plan_name, duration_days" }), {
              status: 400, headers: { "Content-Type": "application/json" },
            });
          }

          const id = uuidv4();
          const { full, hash, prefix } = generateLicenseKey();
          const now = new Date();
          const endsAt = new Date(now.getTime() + duration_days * 86400000);

          await db.query(
            `INSERT INTO licenses (id, customer_name, customer_email, customer_phone, license_key_hash, license_key_prefix, plan_name, status, starts_at, ends_at, allowed_domain, max_activations, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
            [id, customer_name, customer_email, customer_phone || null, hash, prefix, plan_name, now, endsAt, allowed_domain || null, max_activations || 1, notes || null]
          );

          await db.query(
            "INSERT INTO license_events (id, license_id, event_type, description) VALUES (?, ?, 'licença criada', ?)",
            [uuidv4(), id, `Licença criada para ${customer_name} - Plano: ${plan_name}`]
          );

          return new Response(JSON.stringify({
            id, license_key: full, license_key_prefix: prefix,
            customer_name, customer_email, plan_name,
            starts_at: now.toISOString(), ends_at: endsAt.toISOString(),
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: err.message.includes("autorizado") ? 401 : 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
```

- [ ] **Step 7: Criar os demais arquivos de API admin**

Criar sequencialmente: `renew.ts`, `block.ts`, `cancel.ts`, `reactivate.ts`, `update-domain.ts`

Padrão para cada um (exemplo com `renew.ts`):

```typescript
import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import db from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";

async function verifyAdmin(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) throw new Error("Não autorizado");
  const decoded = jwt.verify(auth.replace("Bearer ", ""), JWT_SECRET) as any;
  if (decoded.role !== "admin") throw new Error("Apenas administradores");
  return decoded;
}

export const Route = createFileRoute("/api/admin/licenses/renew")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await verifyAdmin(request);
          const { license_id, new_ends_at, extra_days } = await request.json();

          const rows = await db.query("SELECT * FROM licenses WHERE id = ?", [license_id]);
          if (!(rows as any[]).length) throw new Error("Licença não encontrada");
          const license = (rows as any[])[0];

          let newEndsAt: Date;
          if (new_ends_at) {
            newEndsAt = new Date(new_ends_at);
          } else if (extra_days) {
            newEndsAt = new Date(license.ends_at.getTime() + extra_days * 86400000);
          } else {
            throw new Error("Informe new_ends_at ou extra_days");
          }

          await db.query("UPDATE licenses SET ends_at = ?, status = 'active' WHERE id = ?", [newEndsAt, license_id]);
          await db.query(
            "INSERT INTO license_events (id, license_id, event_type, description) VALUES (?, ?, 'licença renovada', ?)",
            [uuidv4(), license_id, `Licença renovada até ${newEndsAt.toISOString().split("T")[0]}`]
          );

          return new Response(JSON.stringify({ success: true, ends_at: newEndsAt.toISOString() }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: err.message.includes("autorizado") ? 401 : 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
```

`block.ts`:
```typescript
import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import db from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";

async function verifyAdmin(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) throw new Error("Não autorizado");
  const decoded = jwt.verify(auth.replace("Bearer ", ""), JWT_SECRET) as any;
  if (decoded.role !== "admin") throw new Error("Apenas administradores");
  return decoded;
}

export const Route = createFileRoute("/api/admin/licenses/block")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await verifyAdmin(request);
          const { license_id } = await request.json();
          await db.query("UPDATE licenses SET status = 'blocked' WHERE id = ?", [license_id]);
          await db.query("UPDATE license_activations SET status = 'blocked' WHERE license_id = ? AND status = 'active'", [license_id]);
          await db.query("INSERT INTO license_events (id, license_id, event_type, description) VALUES (?, ?, 'licença bloqueada', 'Licença bloqueada pelo administrador')", [uuidv4(), license_id]);
          return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), { status: 401, headers: { "Content-Type": "application/json" } });
        }
      },
    },
  },
});
```

`cancel.ts` (mesmo padrão, status='cancelled', activations='inactive'):
```typescript
import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import db from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";

async function verifyAdmin(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) throw new Error("Não autorizado");
  const decoded = jwt.verify(auth.replace("Bearer ", ""), JWT_SECRET) as any;
  if (decoded.role !== "admin") throw new Error("Apenas administradores");
  return decoded;
}

export const Route = createFileRoute("/api/admin/licenses/cancel")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await verifyAdmin(request);
          const { license_id } = await request.json();
          await db.query("UPDATE licenses SET status = 'cancelled' WHERE id = ?", [license_id]);
          await db.query("UPDATE license_activations SET status = 'inactive' WHERE license_id = ? AND status = 'active'", [license_id]);
          await db.query("INSERT INTO license_events (id, license_id, event_type, description) VALUES (?, ?, 'licença cancelada', 'Licença cancelada pelo administrador')", [uuidv4(), license_id]);
          return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), { status: 401, headers: { "Content-Type": "application/json" } });
        }
      },
    },
  },
});
```

`reactivate.ts`:
```typescript
import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import db from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";

async function verifyAdmin(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) throw new Error("Não autorizado");
  const decoded = jwt.verify(auth.replace("Bearer ", ""), JWT_SECRET) as any;
  if (decoded.role !== "admin") throw new Error("Apenas administradores");
  return decoded;
}

export const Route = createFileRoute("/api/admin/licenses/reactivate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await verifyAdmin(request);
          const { license_id } = await request.json();
          const rows = await db.query("SELECT * FROM licenses WHERE id = ?", [license_id]);
          if (!(rows as any[]).length) throw new Error("Licença não encontrada");
          if ((rows as any[])[0].status !== "blocked") throw new Error("Apenas licenças bloqueadas podem ser reativadas");
          await db.query("UPDATE licenses SET status = 'active' WHERE id = ?", [license_id]);
          await db.query("INSERT INTO license_events (id, license_id, event_type, description) VALUES (?, ?, 'licença reativada', 'Licença reativada pelo administrador')", [uuidv4(), license_id]);
          return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
      },
    },
  },
});
```

`update-domain.ts`:
```typescript
import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import db from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";

async function verifyAdmin(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) throw new Error("Não autorizado");
  const decoded = jwt.verify(auth.replace("Bearer ", ""), JWT_SECRET) as any;
  if (decoded.role !== "admin") throw new Error("Apenas administradores");
  return decoded;
}

export const Route = createFileRoute("/api/admin/licenses/update-domain")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await verifyAdmin(request);
          const { license_id, allowed_domain } = await request.json();
          const rows = await db.query("SELECT allowed_domain FROM licenses WHERE id = ?", [license_id]);
          if (!(rows as any[]).length) throw new Error("Licença não encontrada");
          const oldDomain = (rows as any[])[0].allowed_domain;
          await db.query("UPDATE licenses SET allowed_domain = ? WHERE id = ?", [allowed_domain, license_id]);
          await db.query("INSERT INTO license_events (id, license_id, event_type, description, metadata) VALUES (?, ?, 'domínio alterado', ?, ?)",
            [uuidv4(), license_id, `Domínio alterado de ${oldDomain || "vazio"} para ${allowed_domain}`, JSON.stringify({ old_domain: oldDomain, new_domain: allowed_domain })]);
          return new Response(JSON.stringify({ success: true, allowed_domain }), { status: 200, headers: { "Content-Type": "application/json" } });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
      },
    },
  },
});
```

- [ ] **Step 8: Verificar arquivos criados**

Run: `Get-ChildItem -LiteralPath "C:\Users\Lei Mendes\Desktop\Aplicações\Disparador\wapi-weaver\src\routes\api\licenses" -Name`
Expected: `activate.ts`, `check.ts`

Run: `Get-ChildItem -LiteralPath "C:\Users\Lei Mendes\Desktop\Aplicações\Disparador\wapi-weaver\src\routes\api\admin\licenses" -Name`
Expected: `index.ts`, `detail.ts`, `create.ts`, `renew.ts`, `block.ts`, `cancel.ts`, `reactivate.ts`, `update-domain.ts`

---

### Task 5: Sidebar — Adicionar seção Licenças ao menu

**Files:**
- Modify: `src/routes/_app.tsx`

**Interfaces:**
- Consumes: NAV array existente
- Produces: Nova seção Licenças no menu lateral

- [ ] **Step 1: Adicionar imports dos novos ícones lucide-react**

No topo do arquivo `_app.tsx`, adicionar ao import de `lucide-react`:
```typescript
import {
  // ... existing icons ...,
  KeyRound,
  FileKey,
  PlusCircle,
  BarChart3,
} from "lucide-react";
```

- [ ] **Step 2: Adicionar seção Licenças ao NAV array**

Inserir entre o item "Agente de IA" e "Faturamento" no array `NAV`:
```typescript
  { to: "/ai-agent", label: "Agente de IA", icon: BrainCircuit },
  // ↓ Novo
  {
    to: "/licenses",
    label: "Licenças",
    icon: KeyRound,
    children: [
      { to: "/licenses/dashboard", label: "Dashboard", icon: BarChart3 },
      { to: "/licenses", label: "Listagem", icon: FileKey },
      { to: "/licenses/create", label: "Gerar Licença", icon: PlusCircle },
    ],
  },
  // ↑ Novo
  { to: "/billing", label: "Faturamento", icon: Receipt },
```

- [ ] **Step 3: Atualizar filtro admin-only para incluir rotas de licenças**

Localizar a linha que filtra itens admin-only:
```typescript
const isAdminOnly = ["/users", "/audit", "/webhook-events", "/billing"].includes(to);
```
Adicionar `"/licenses"` ao array:
```typescript
const isAdminOnly = ["/users", "/audit", "/webhook-events", "/billing", "/licenses"].includes(to);
```

Também no filtro de children:
```typescript
const isChildAdminOnly = ["/users", "/audit", "/webhook-events"].includes(child.to);
```
Adicionar:
```typescript
const isChildAdminOnly = ["/users", "/audit", "/webhook-events", "/licenses", "/licenses/dashboard", "/licenses/create"].includes(child.to);
```

- [ ] **Step 4: Atualizar useEffect para abrir menu Licenças**

Adicionar ao useEffect que detecta pathname para abrir menus:
```typescript
if (
  path.startsWith("/settings") ||
  path.startsWith("/whatsapp-business-profile") ||
  path.startsWith("/users") ||
  path.startsWith("/audit") ||
  path.startsWith("/webhook-events")
) {
  setOpenMenus((prev) => ({ ...prev, "/settings": true }));
}
```
Adicionar:
```typescript
if (path.startsWith("/licenses")) {
  setOpenMenus((prev) => ({ ...prev, "/licenses": true }));
}
```

---

### Task 6: Regenerar route tree e verificar compilação

**Files:**
- Auto-generated: `src/routeTree.gen.ts`

**Interfaces:**
- Consumes: Todas as novas rotas criadas
- Produces: Árvore de rotas atualizada

- [ ] **Step 1: Regenerar rota**

Run: `cd "C:\Users\Lei Mendes\Desktop\Aplicações\Disparador\wapi-weaver" && npx @tanstack/react-router route-manifest`

Se não funcionar, tentar:
Run: `cd "C:\Users\Lei Mendes\Desktop\Aplicações\Disparador\wapi-weaver" && npx tsr generate`

- [ ] **Step 2: Verificar se o arquivo routeTree.gen.ts foi atualizado**

Run: `Select-String -Path "C:\Users\Lei Mendes\Desktop\Aplicações\Disparador\wapi-weaver\src\routeTree.gen.ts" -Pattern "licenses" | Select-Object -First 20`
Expected: Múltiplas linhas referenciando as novas rotas de licenças.

- [ ] **Step 3: Verificar compilação TypeScript**

Run: `cd "C:\Users\Lei Mendes\Desktop\Aplicações\Disparador\wapi-weaver" && npx tsc --noEmit 2>&1`
Expected: Sem erros de tipo (ou apenas erros pré-existentes não relacionados a licenças).
