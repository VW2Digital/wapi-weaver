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

for (const f of filesToDelete) {
  const full = path.resolve(rootDir, f);
  if (fs.existsSync(full)) {
    fs.unlinkSync(full);
    console.log(`Deleted file: ${f}`);
  }
}

// Remove empty test dir
const testDir = path.resolve(rootDir, "src/routes/api/public/__tests__");
if (fs.existsSync(testDir)) {
  fs.rmdirSync(testDir);
  console.log("Removed empty dir: src/routes/api/public/__tests__");
}

// Clean routeTree.gen.ts references
const routeTreePath = path.resolve(rootDir, "src/routeTree.gen.ts");
let routeTreeContent = fs.readFileSync(routeTreePath, "utf8");

routeTreeContent = routeTreeContent
  .split("\n")
  .filter(line => !line.includes("schema-validation-runner") && !line.includes("schema-reconciliation-audit"))
  .join("\n");

fs.writeFileSync(routeTreePath, routeTreeContent, "utf8");
console.log("Cleaned routeTree.gen.ts");
