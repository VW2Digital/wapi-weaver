import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const filesToDelete = [
  "src/routes/api/debug-gateway-row.ts",
  "src/routes/api/schema-audit.ts",
  "src/routes/api/schema-migration-tester.ts",
  "src/routes/api/schema-reconciliation-audit.ts",
  "src/routes/api/schema-reconciliation-execute.ts",
  "src/routes/api/schema-reconciliation-generator.ts",
  "src/routes/api/schema-validation-runner.ts",
  "src/routes/api/test-gateway-smoke-runner.ts",
  "src/routes/api/type-check-runner.ts",
  "src/routes/api/public/__tests__/whatsapp-webhook.test.ts"
];

let deletedCount = 0;

for (const relPath of filesToDelete) {
  const fullPath = path.resolve(rootDir, relPath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    console.log(`Deleted: ${relPath}`);
    deletedCount++;
  }
}

// Remove empty __tests__ dir if empty
const testDir = path.resolve(rootDir, "src/routes/api/public/__tests__");
if (fs.existsSync(testDir) && fs.readdirSync(testDir).length === 0) {
  fs.rmdirSync(testDir);
  console.log("Removed empty directory: src/routes/api/public/__tests__");
}

console.log(`Successfully cleaned up ${deletedCount} non-production route files.`);
