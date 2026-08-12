import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const oldTestPath = path.resolve(__dirname, "../src/routes/api/public/__tests__/whatsapp-webhook.test.ts");
if (fs.existsSync(oldTestPath)) {
  fs.unlinkSync(oldTestPath);
  console.log("✅ Removed old unprefixed test file:", oldTestPath);
}
