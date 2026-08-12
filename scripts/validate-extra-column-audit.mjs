#!/usr/bin/env node
/**
 * validate-extra-column-audit.mjs
 *
 * Validates strict set equality between:
 *   database/schema/original-vps-extra-columns.json  (immutable historical source)
 *   database/schema/schema-extra-columns-audit.json   (enriched audit)
 *
 * Assertions:
 *   - originalCount  == 79
 *   - auditCount     == 79
 *   - duplicates     == 0   (in both files)
 *   - original - audit == ∅  (no pair in original that is missing from audit)
 *   - audit - original == ∅  (no pair in audit that is absent from original)
 *   - UNKNOWN count  == 0
 *   - AUDIT_INVALID  == 0   (classification must be ACTIVE_REQUIRED or LEGACY_UNUSED)
 *
 * Usage:
 *   node scripts/validate-extra-column-audit.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadJson(relPath) {
  const abs = resolve(root, relPath);
  try {
    return JSON.parse(readFileSync(abs, "utf8"));
  } catch (e) {
    console.error(`[ERROR] Cannot read ${abs}: ${e.message}`);
    process.exit(1);
  }
}

function pairKey(obj) {
  return `${obj.table}.${obj.column}`;
}

const EXPECTED_COUNT = 79;
const VALID_CLASSIFICATIONS = new Set(["ACTIVE_REQUIRED", "LEGACY_UNUSED"]);

// ─── Load files ───────────────────────────────────────────────────────────────
const original = loadJson("database/schema/original-vps-extra-columns.json");
const audit    = loadJson("database/schema/schema-extra-columns-audit.json");

let pass = true;
const errors = [];
const warnings = [];

// ─── 1. Count assertions ──────────────────────────────────────────────────────
const originalCount = original.length;
const auditCount    = audit.length;

console.log("\n══════════════════════════════════════════════════");
console.log("  EXTRA COLUMN AUDIT VALIDATOR");
console.log("══════════════════════════════════════════════════\n");

console.log(`ORIGINAL VPS EXTRA COUNT : ${originalCount}`);
console.log(`AUDITED COUNT            : ${auditCount}`);

if (originalCount !== EXPECTED_COUNT) {
  errors.push(`original count = ${originalCount}, expected ${EXPECTED_COUNT}`);
}
if (auditCount !== EXPECTED_COUNT) {
  errors.push(`audit count = ${auditCount}, expected ${EXPECTED_COUNT}`);
}

// ─── 2. Duplicate detection ───────────────────────────────────────────────────
const originalKeys = original.map(pairKey);
const auditKeys    = audit.map(pairKey);

const originalSet = new Set(originalKeys);
const auditSet    = new Set(auditKeys);

const originalDupes = originalKeys.filter((k, i) => originalKeys.indexOf(k) !== i);
const auditDupes    = auditKeys.filter((k, i) => auditKeys.indexOf(k) !== i);

console.log(`ORIGINAL DUPLICATES      : ${originalDupes.length}`);
console.log(`AUDIT DUPLICATES         : ${auditDupes.length}`);

if (originalDupes.length > 0) {
  errors.push(`Duplicates in original: ${originalDupes.join(", ")}`);
}
if (auditDupes.length > 0) {
  errors.push(`Duplicates in audit: ${auditDupes.join(", ")}`);
}

// ─── 3. Set difference ────────────────────────────────────────────────────────
const missingFromAudit    = [...originalSet].filter(k => !auditSet.has(k));
const extraInAudit        = [...auditSet].filter(k => !originalSet.has(k));
const pairDifference      = missingFromAudit.length + extraInAudit.length;

console.log(`\nMISSING FROM AUDIT       : ${missingFromAudit.length}`);
if (missingFromAudit.length > 0) {
  missingFromAudit.forEach(k => console.log(`  - ${k}`));
  errors.push(`Pairs in original but missing from audit: ${missingFromAudit.join(", ")}`);
}

console.log(`EXTRA IN AUDIT           : ${extraInAudit.length}`);
if (extraInAudit.length > 0) {
  extraInAudit.forEach(k => console.log(`  + ${k}`));
  errors.push(`Pairs in audit not found in original: ${extraInAudit.join(", ")}`);
}

console.log(`PAIR DIFFERENCE          : ${pairDifference}`);
if (pairDifference !== 0) {
  errors.push(`PAIR DIFFERENCE = ${pairDifference}, expected 0`);
}

// ─── 4. Classification assertions ────────────────────────────────────────────
const classificationCounts = {};
const auditInvalid = [];
const unknownItems = [];

for (const item of audit) {
  const cls = item.classification;
  classificationCounts[cls] = (classificationCounts[cls] || 0) + 1;
  if (cls === "UNKNOWN") {
    unknownItems.push(pairKey(item));
  }
  if (!VALID_CLASSIFICATIONS.has(cls) && cls !== "UNKNOWN") {
    auditInvalid.push(`${pairKey(item)} → "${cls}"`);
  }
}

console.log("\nCLASSIFICATION BREAKDOWN :");
for (const [cls, count] of Object.entries(classificationCounts)) {
  console.log(`  ${cls.padEnd(20)} : ${count}`);
}

console.log(`\nUNKNOWN                  : ${unknownItems.length}`);
if (unknownItems.length > 0) {
  unknownItems.forEach(k => console.log(`  ? ${k}`));
  errors.push(`UNKNOWN items (must be 0): ${unknownItems.join(", ")}`);
}

console.log(`AUDIT_INVALID            : ${auditInvalid.length}`);
if (auditInvalid.length > 0) {
  auditInvalid.forEach(k => console.log(`  ! ${k}`));
  errors.push(`Invalid classification values: ${auditInvalid.join(", ")}`);
}

// ─── 5. Mandatory pair checks ─────────────────────────────────────────────────
const mandatoryPresent = [
  "billing_webhook_events.payload_json",
  "billing_webhook_events.created_at",
];
console.log("\nMANDATORY PAIR CHECKS    :");
for (const k of mandatoryPresent) {
  const inOriginal = originalSet.has(k);
  const inAudit    = auditSet.has(k);
  const auditItem  = audit.find(a => pairKey(a) === k);
  const cls        = auditItem?.classification ?? "MISSING";
  const status     = inOriginal && inAudit ? "OK" : "FAIL";
  console.log(`  ${k.padEnd(45)} : ${status} | ${cls}`);
  if (!inOriginal || !inAudit) {
    errors.push(`Mandatory pair missing: ${k}`);
  }
}

// ─── 6. Forbidden fake items check ────────────────────────────────────────────
const forbidden = [
  "payment_gateway_settings.payment_method_types_json",
  "payment_gateway_settings.is_sandbox",
  "payment_gateway_settings.webhook_secret_enc",
  "payment_gateway_settings.public_key_enc",
  "payment_gateway_settings.access_token_enc",
  "payment_gateway_settings.client_id_enc",
  "payment_gateway_settings.client_secret_enc",
];
const fakeFound = forbidden.filter(k => originalSet.has(k) || auditSet.has(k));
console.log(`\nFAKE PAYMENT_GATEWAY_SETTINGS ITEMS : ${fakeFound.length}`);
if (fakeFound.length > 0) {
  fakeFound.forEach(k => console.log(`  FORBIDDEN: ${k}`));
  errors.push(`Forbidden fabricated items found: ${fakeFound.join(", ")}`);
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════");

if (errors.length === 0) {
  console.log("FILE-ONLY GATE 5 (AUDIT) : PASS ✅");
} else {
  console.log(`FILE-ONLY GATE 5 (AUDIT) : FAIL ❌  (${errors.length} error(s))`);
  console.log("\nERRORS:");
  errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  process.exit(1);
}

if (warnings.length > 0) {
  console.log("\nWARNINGS:");
  warnings.forEach(w => console.log(`  ⚠ ${w}`));
}

console.log("══════════════════════════════════════════════════\n");
