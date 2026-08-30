import { describe, expect, test } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";
import {
  AesGcmCredentialDecryptor,
  MySQLEncryptedCredentialRepository,
  SecureCredentialVault,
  WhatsAppCredentialResolver,
} from "@/lib/omnichannel-next/infrastructure/security";

describe("Security zero side effects", () => {
  test("security modules can be imported without DB or network side effects", () => {
    expect(typeof AesGcmCredentialDecryptor).toBe("function");
    expect(typeof MySQLEncryptedCredentialRepository).toBe("function");
    expect(typeof SecureCredentialVault).toBe("function");
    expect(typeof WhatsAppCredentialResolver).toBe("function");
  });

  test("omnichannel-next does not import current runtime encryption module", () => {
    const nextRoot = path.join(process.cwd(), "src/lib/omnichannel-next");
    const files = fs.readdirSync(nextRoot, { recursive: true }) as string[];
    const violations: string[] = [];

    for (const file of files) {
      if (typeof file !== "string") continue;
      const full = path.join(nextRoot, file);
      if (!full.endsWith(".ts") || full.includes(".test.ts")) continue;
      const content = fs.readFileSync(full, "utf8");
      if (/from\s+['"]@\/lib\/encryption/.test(content) || /from\s+['"]@\/lib\/token-crypto/.test(content)) {
        violations.push(path.relative(process.cwd(), full));
      }
    }

    expect(violations).toHaveLength(0);
  });
});
