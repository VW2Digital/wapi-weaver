import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { runWithStartContext } from "@tanstack/start-storage-context";
import { createContact, listContacts, updateContact, deleteContact } from "../src/lib/contacts.functions.js";

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

  // Helper to run server functions with auth context
  async function runAuthFn(fn, dataArg) {
    const mockRequest = new Request("http://127.0.0.1:3000/api/server-fn", {
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
    });

    return await runWithStartContext({ req: mockRequest }, async () => {
      return await fn({ data: dataArg });
    });
  }

  const testPhone = "+5511977776666";
  const initialName = "App Smoke Test Contact";
  const updatedName = "App Smoke Test Contact Updated";
  let createdId = "";

  try {
    // 2. Create Contact via Server Function
    console.log("[App Smoke Test] 2. Creating contact via application server function layer...");
    const created = await runAuthFn(createContact, {
      phone: testPhone,
      name: initialName,
      email: "app_smoke@test.com",
      status: "lead",
    });

    if (!created || !created.id) {
      console.error("[App Smoke Test] ❌ FAIL: createContact returned invalid object.");
      process.exit(1);
    }
    createdId = created.id;
    console.log(`[App Smoke Test] ✅ 2. Contact created via application layer (ID: ${createdId}).`);

    // 3. List Contacts via Server Function
    console.log("[App Smoke Test] 3. Listing contacts via application server function layer...");
    const list = await runAuthFn(listContacts, undefined);
    const foundInList = Array.isArray(list) && list.some((c) => c.id === createdId);
    if (!foundInList) {
      console.error("[App Smoke Test] ❌ FAIL: Created contact not found in listContacts output.");
      process.exit(1);
    }
    console.log("[App Smoke Test] ✅ 3. Verified created contact in listContacts.");

    // 4. Update Contact via Server Function
    console.log("[App Smoke Test] 4. Updating contact via application server function layer...");
    const updated = await runAuthFn(updateContact, {
      id: createdId,
      phone: testPhone,
      name: updatedName,
      status: "qualificado",
    });

    if (!updated || updated.name !== updatedName) {
      console.error("[App Smoke Test] ❌ FAIL: updateContact did not update fields correctly.");
      process.exit(1);
    }
    console.log("[App Smoke Test] ✅ 4. Contact updated and verified via application layer.");

    // 5. Delete Contact via Server Function
    console.log("[App Smoke Test] 5. Deleting contact via application server function layer...");
    const deleteRes = await runAuthFn(deleteContact, { id: createdId });
    if (!deleteRes || deleteRes.ok !== true) {
      console.error("[App Smoke Test] ❌ FAIL: deleteContact did not return ok: true.");
      process.exit(1);
    }
    console.log("[App Smoke Test] ✅ 5. Contact deleted via application layer.");

    // 6. Confirm Contact Removed
    const afterDeleteList = await runAuthFn(listContacts, undefined);
    const stillExists = Array.isArray(afterDeleteList) && afterDeleteList.some((c) => c.id === createdId);
    if (stillExists) {
      console.error("[App Smoke Test] ❌ FAIL: Contact still present in listContacts after deletion.");
      process.exit(1);
    }
    console.log("[App Smoke Test] ✅ 6. Confirmed contact removed from listContacts.");

    console.log("=================================================");
    console.log("  APPLICATION SMOKE TEST PASSED                  ");
    console.log("=================================================");
    process.exit(0);
  } catch (err) {
    console.error("[App Smoke Test] ❌ FAIL: Application Smoke Test failed:", err.message);

    // Attempt cleanup on failure
    if (createdId) {
      try {
        await runAuthFn(deleteContact, { id: createdId });
      } catch (_) {}
    }

    process.exit(1);
  }
}

main();
