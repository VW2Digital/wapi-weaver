import { describe, expect, test } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";

const NEXT_ROOT = path.join(process.cwd(), "src/lib/omnichannel-next");

function getTsFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getTsFiles(full));
    } else if (entry.isFile() && full.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

const FORBIDDEN_PATTERNS = [
  /from\s+['"]@\/lib\/chat/,
  /from\s+['"]@\/lib\/messaging\/outbound\/adapters/,
  /from\s+['"]@\/lib\/messaging\/outbound\/provider-dispatcher/,
  /from\s+['"]@\/lib\/messaging\/outbound\/provider-registry/,
  /from\s+['"]@\/lib\/messaging\/webhook-handlers/,
  /from\s+['"]@\/lib\/messaging\/channel-connection\.service/,
  /from\s+['"]@\/lib\/messaging\/conversation-channel\.service/,
  /from\s+['"]@\/lib\/messaging\/services\/channel\.service/,
  /from\s+['"]@\/lib\/messaging\/services\/conversation\.service/,
  /from\s+['"]@\/lib\/messaging\/services\/message\.service/,
  /from\s+['"]@\/lib\/messaging\/services\/meta-app-connection\.service/,
  /from\s+['"]@\/lib\/messaging\/event-store\.server/,
  /from\s+['"]@\/lib\/messaging\/processor\.server/,
  /from\s+['"]mysql/,
  /from\s+['"]mysql2/,
  /from\s+['"]bullmq/,
  /from\s+['"]ioredis/,
  /from\s+['"]react/,
];

describe("omnichannel-next architecture import boundary", () => {
  test("no file imports protected runtime modules", () => {
    const files = getTsFiles(NEXT_ROOT);
    const violations: { file: string; line: number; text: string }[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");
      lines.forEach((line, index) => {
        if (FORBIDDEN_PATTERNS.some((pattern) => pattern.test(line))) {
          violations.push({
            file: path.relative(process.cwd(), file),
            line: index + 1,
            text: line.trim(),
          });
        }
      });
    }

    if (violations.length > 0) {
      const details = violations
        .map((v) => `${v.file}:${v.line} → ${v.text}`)
        .join("\n");
      throw new Error(`Forbidden imports found in omnichannel-next:\n${details}`);
    }

    expect(files.length).toBeGreaterThan(0);
  });

  test("whatsapp and instagram modules do not cross-import", () => {
    const waRoot = path.join(process.cwd(), "src/lib/omnichannel-next/providers/whatsapp");
    const igRoot = path.join(process.cwd(), "src/lib/omnichannel-next/providers/instagram");

    const waFiles = getTsFiles(waRoot);
    const igFiles = getTsFiles(igRoot);

    const violations: string[] = [];

    for (const file of waFiles) {
      const content = fs.readFileSync(file, "utf8");
      if (/from\s+['"]@\/lib\/omnichannel-next\/providers\/instagram/.test(content)) {
        violations.push(path.relative(process.cwd(), file));
      }
    }

    for (const file of igFiles) {
      const content = fs.readFileSync(file, "utf8");
      if (/from\s+['"]@\/lib\/omnichannel-next\/providers\/whatsapp/.test(content)) {
        violations.push(path.relative(process.cwd(), file));
      }
    }

    if (violations.length > 0) {
      throw new Error(`Cross-provider imports found:\n${violations.join("\n")}`);
    }

    expect(waFiles.length).toBeGreaterThan(0);
    expect(igFiles.length).toBeGreaterThan(0);
  });
});
