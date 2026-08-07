import { execSync } from "child_process";

console.log("==================================================");
console.log("  RUNNING SYNTAX & BUILD VERIFICATION TESTS       ");
console.log("==================================================");

function runTest(name, cmd) {
  process.stdout.write(`Testing ${name}... `);
  try {
    const out = execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    console.log("✅ OK");
    return true;
  } catch (err) {
    console.log("❌ FAILED");
    console.error(`Error output for ${name}:`, err.message || err.stderr || err.stdout);
    return false;
  }
}

let passed = true;

// 1. Bash Syntax Tests
passed = runTest("Bash syntax: install.sh", "bash -n install.sh") && passed;
passed = runTest("Bash syntax: scripts/backup.sh", "bash -n scripts/backup.sh") && passed;
passed = runTest("Bash syntax: scripts/restore.sh", "bash -n scripts/restore.sh") && passed;
passed = runTest("Bash syntax: scripts/deploy-status.sh", "bash -n scripts/deploy-status.sh") && passed;
passed = runTest("Bash syntax: scripts/diagnose-deploy.sh", "bash -n scripts/diagnose-deploy.sh") && passed;

// 2. Docker Compose Config Validation
passed = runTest("Docker Compose production config", "docker compose -f docker-compose.production.yml config") && passed;
passed = runTest("Docker Compose dev config", "docker compose config") && passed;

// 3. TypeScript Type Check
passed = runTest("TypeScript type-check", "npm run type-check") && passed;

console.log("==================================================");
if (passed) {
  console.log("  ALL SYNTAX AND CONFIG TESTS PASSED!              ");
} else {
  console.log("  SOME SYNTAX OR CONFIG TESTS FAILED!              ");
}
console.log("==================================================");
