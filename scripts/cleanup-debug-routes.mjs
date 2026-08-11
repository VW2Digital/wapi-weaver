#!/usr/bin/env node
/**
 * cleanup-debug-routes.mjs
 * Deletes temporary/debug API route files from src/routes/api/.
 * Run manually: node scripts/cleanup-debug-routes.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routesDir = path.resolve(__dirname, "../src/routes/api");

const DEBUG_ROUTES = [
  "debug-gateway-row.ts",
  "schema-audit.ts",
  "schema-migration-tester.ts",
  "schema-reconciliation-audit.ts",
  "schema-reconciliation-execute.ts",
  "schema-reconciliation-generator.ts",
  "schema-validation-runner.ts",
  "test-gateway-smoke-runner.ts",
  "type-check-runner.ts",
];

let deleted = 0;
let missing = 0;

for (const file of DEBUG_ROUTES) {
  const fullPath = path.join(routesDir, file);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    console.log(`[cleanup] ✅ DELETED: ${file}`);
    deleted++;
  } else {
    console.log(`[cleanup] ⚠️  NOT FOUND (already removed?): ${file}`);
    missing++;
  }
}

console.log(`\n[cleanup] SUMMARY: ${deleted} deleted, ${missing} not found.`);
console.log(`[cleanup] ✅ Done. Now run your TanStack Router build/vite-dev to regenerate routeTree.gen.ts.`);
console.log(`[cleanup] Expected: none of the debug routes remain in the regenerated routeTree.gen.ts.`);
