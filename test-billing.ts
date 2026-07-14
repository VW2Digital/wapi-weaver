import { encrypt, decrypt } from "./src/lib/encryption";

async function testBilling() {
  console.log("=== RUNNING BILLING INTEGRATION TESTS ===");

  // 1. Test Encryption / Decryption
  try {
    const originalText = "TEST-TOKEN-123456789";
    const encrypted = encrypt(originalText);
    const decrypted = decrypt(encrypted);

    if (decrypted === originalText) {
      console.log("✅ Encryption & Decryption test passed!");
    } else {
      console.error("❌ Encryption/Decryption test failed. Decrypted text does not match original.");
    }
  } catch (e: any) {
    console.error("❌ Encryption/Decryption test failed with error:", e.message);
  }

  // 2. Test mock database connection
  try {
    const db = (await import("./src/lib/db")).default;
    const res = await db.query("SELECT 1 + 1 as val");
    if (res && (res as any)[0]?.val === 2) {
      console.log("✅ Database connectivity test passed!");
    } else {
      console.error("❌ Database connectivity test returned invalid result.");
    }
  } catch (e: any) {
    console.error("❌ Database connectivity test failed:", e.message);
  }

  console.log("=== TESTS COMPLETED ===");
}

testBilling();
