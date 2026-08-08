import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import {
  createContactForUser,
  listContactsForUser,
  updateContactForUser,
  deleteContactForUser
} from "../src/lib/services/contacts.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env if present
const dotenvPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(dotenvPath)) {
  const envContent = fs.readFileSync(dotenvPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const parts = trimmed.split("=");
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function main() {
  console.log("=================================================");
  console.log("    EXECUTING APPLICATION SMOKE TEST             ");
  console.log("=================================================");

  const dbPassword = process.env.DB_PASSWORD;
  if (!dbPassword) {
    console.error("[App Smoke Test] ❌ CRITICAL: DB_PASSWORD environment variable is missing!");
    process.exit(1);
  }

  const adminEmail = (process.env.ADMIN_EMAIL || "adm@vw2digital.com.br").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error("[App Smoke Test] ❌ CRITICAL: ADMIN_PASSWORD environment variable is missing!");
    process.exit(1);
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error("[App Smoke Test] ❌ CRITICAL: JWT_SECRET environment variable is missing!");
    process.exit(1);
  }

  const targetUrl = process.env.TARGET_URL || "http://127.0.0.1:3000/api/auth/login";
  console.log(`[App Smoke Test] 1. Testing HTTP authentication against ${targetUrl}...`);

  let token = "";
  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[App Smoke Test] ❌ FAIL: HTTP Auth login failed with status ${res.status}: ${errText.substring(0, 150)}`);
      process.exit(1);
    }

    const data = await res.json();
    if (!data.access_token) {
      console.error("[App Smoke Test] ❌ FAIL: Login response did not contain access_token.");
      process.exit(1);
    }

    if (data.user?.role !== "admin_master") {
      console.error(`[App Smoke Test] ❌ FAIL: Authenticated user role is '${data.user?.role}', strictly required 'admin_master'.`);
      process.exit(1);
    }

    token = data.access_token;
    console.log("[App Smoke Test] ✅ 1. HTTP Auth login successful. Master admin role verified.");
  } catch (err) {
    console.error("[App Smoke Test] ❌ FAIL: Authentication HTTP request failed:", err.message);
    process.exit(1);
  }

  // 3. Obtain userId real do JWT
  let decoded;
  try {
    decoded = jwt.verify(token, jwtSecret);
  } catch (err) {
    console.error("[App Smoke Test] ❌ FAIL: JWT verification failed with JWT_SECRET:", err.message);
    process.exit(1);
  }

  const userId = decoded?.sub;
  if (!userId) {
    console.error("[App Smoke Test] ❌ FAIL: decoded JWT did not contain 'sub' (userId) claim.");
    process.exit(1);
  }

  console.log("[App Smoke Test] authenticated userId:", userId);

  const testPhone = "+5511977776666";
  const initialName = "App Smoke Test Contact";
  const updatedName = "App Smoke Test Contact Updated";
  let createdId = "";

  try {
    // 4. Executar as mesmas funções de serviço
    console.log("[App Smoke Test] 2. Creating contact via application service layer...");
    const created = await createContactForUser(userId, {
      phone: testPhone,
      name: initialName,
      email: "app_smoke@test.com",
      status: "lead",
      custom_fields: {},
    });

    if (!created || !created.id) {
      console.error("[App Smoke Test] ❌ FAIL: createContactForUser returned invalid object.");
      process.exit(1);
    }
    createdId = created.id;
    console.log(`[App Smoke Test] ✅ 2. Contact created via application service layer (ID: ${createdId}).`);

    // 5. List Contacts via Service Layer
    console.log("[App Smoke Test] 3. Listing contacts via application service layer...");
    const list = await listContactsForUser(userId);
    const foundInList = Array.isArray(list) && list.some((c) => c.id === createdId);
    if (!foundInList) {
      console.error("[App Smoke Test] ❌ FAIL: Created contact not found in listContactsForUser output.");
      process.exit(1);
    }
    console.log("[App Smoke Test] ✅ 3. Contact found in list.");

    // 6. Update Contact via Service Layer
    console.log("[App Smoke Test] 4. Updating contact via application service layer...");
    const updated = await updateContactForUser(userId, {
      id: createdId,
      phone: testPhone,
      name: updatedName,
      email: "app_smoke@test.com",
      status: "qualificado",
      custom_fields: {},
      metadata: {},
      opted_out: false,
      channel: "whatsapp",
      is_pinned: false,
      is_archived: false,
      chat_status: "aberto",
      is_unread: false,
      kanban_stage_id: null,
    });

    if (!updated || updated.name !== updatedName) {
      console.error("[App Smoke Test] ❌ FAIL: updateContactForUser did not update fields correctly.");
      process.exit(1);
    }
    console.log("[App Smoke Test] ✅ 4. Contact updated.");

    // 7. Delete Contact via Service Layer
    console.log("[App Smoke Test] 5. Deleting contact via application service layer...");
    const deleteRes = await deleteContactForUser(userId, createdId);
    if (!deleteRes || deleteRes.ok !== true) {
      console.error("[App Smoke Test] ❌ FAIL: deleteContactForUser did not return ok: true.");
      process.exit(1);
    }
    console.log("[App Smoke Test] ✅ 5. Contact deleted.");

    // 8. Confirm Contact Removed
    const afterDeleteList = await listContactsForUser(userId);
    const stillExists = Array.isArray(afterDeleteList) && afterDeleteList.some((c) => c.id === createdId);
    if (stillExists) {
      console.error("[App Smoke Test] ❌ FAIL: Contact still present in listContactsForUser after deletion.");
      process.exit(1);
    }
    console.log("[App Smoke Test] ✅ 6. Contact removal confirmed.");

    console.log("=================================================");
    console.log("  APPLICATION SMOKE TEST PASSED                  ");
    console.log("=================================================");
    process.exit(0);
  } catch (err) {
    console.error("[App Smoke Test] ❌ FAIL: Application Smoke Test failed:", err.message);

    // Attempt cleanup on failure
    if (createdId) {
      try {
        await deleteContactForUser(userId, createdId);
      } catch (_) {}
    }

    process.exit(1);
  }
}

main();
