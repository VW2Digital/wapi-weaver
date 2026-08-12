import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

try {
  const output = execSync("node scripts/build-nullability-audit-and-migration.mjs", {
    cwd: rootDir,
    encoding: "utf8",
  });
  console.log(output);
} catch (err) {
  console.error("Execution error:", err.stdout || err.stderr || err.message);
}
