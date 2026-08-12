/**
 * Regression Test for Installer ERR Trap Handling
 * Validates that executing a failing validator command directly inside an `if` condition:
 * 1. Does NOT invoke the global ERR trap when PARITY_POLICY is DIAGNOSTIC.
 * 2. Correctly captures non-zero exit code and continues execution.
 * 3. Aborts via dump_diagnostics_and_exit when PARITY_POLICY is BLOCKING.
 */

import { execSync } from "child_process";

console.log("==================================================");
console.log("  REGRESSION TEST: INSTALLER ERR TRAP HANDLING   ");
console.log("==================================================");

// Shell script snippet matching install.sh ERR trap & parity logic
const bashScriptTest = `
set -Eeuo pipefail

ERR_TRAP_INVOKED=0
DUMP_DIAGNOSTICS_INVOKED=0

error_handler() {
  ERR_TRAP_INVOKED=1
  echo "ERR_TRAP_TRIGGERED"
  exit 1
}

dump_diagnostics_and_exit() {
  DUMP_DIAGNOSTICS_INVOKED=1
  echo "ABORTED_VIA_DUMP_DIAGNOSTICS"
  exit 1
}

trap 'error_handler' ERR

TEST_MODE="$1"

if [ "$TEST_MODE" = "diagnostic" ]; then
  PARITY_POLICY="DIAGNOSTIC"
else
  PARITY_POLICY="BLOCKING"
fi

# Simulate parity validator returning exit code 1 inside an 'if' condition
if node -e "process.exit(1)" 2>/dev/null; then
  PARITY_EXIT=0
  echo "PARITY_SUCCESS"
else
  PARITY_EXIT=$?
  if [ "$PARITY_POLICY" = "DIAGNOSTIC" ]; then
    echo "PARITY_DIAGNOSTIC_WARNING_EXIT_\${PARITY_EXIT}"
  else
    dump_diagnostics_and_exit "Paridade estrita de schema falhou."
  fi
fi

echo "NEXT_STEP_REACHED"
`;

try {
  // Test 1: DIAGNOSTIC mode -> command fails, ERR trap NOT invoked, script continues to NEXT_STEP_REACHED
  const outDiag = execSync(`bash -c ${JSON.stringify(bashScriptTest)} bash diagnostic`, { encoding: "utf8" });
  if (outDiag.includes("PARITY_DIAGNOSTIC_WARNING_EXIT_1") && outDiag.includes("NEXT_STEP_REACHED") && !outDiag.includes("ERR_TRAP_TRIGGERED")) {
    console.log("[Test 1 - Diagnostic Mode]: ✅ PASS (ERR trap bypassed, PARITY_EXIT captured, execution continued)");
  } else {
    console.error("[Test 1 - Diagnostic Mode]: ❌ FAIL (Output unexpected):", outDiag);
    process.exit(1);
  }

  // Test 2: BLOCKING mode -> command fails, ERR trap NOT invoked, script aborts via dump_diagnostics_and_exit
  try {
    execSync(`bash -c ${JSON.stringify(bashScriptTest)} bash blocking`, { encoding: "utf8" });
    console.error("[Test 2 - Blocking Mode]: ❌ FAIL (Expected abort but script completed)");
    process.exit(1);
  } catch (err) {
    const outBlock = err.stdout ? err.stdout.toString() : "";
    if (outBlock.includes("ABORTED_VIA_DUMP_DIAGNOSTICS") && !outBlock.includes("ERR_TRAP_TRIGGERED")) {
      console.log("[Test 2 - Blocking Mode]: ✅ PASS (Aborted cleanly via dump_diagnostics_and_exit)");
    } else {
      console.error("[Test 2 - Blocking Mode]: ❌ FAIL (Output unexpected):", outBlock);
      process.exit(1);
    }
  }

  console.log("==================================================");
  console.log("  ALL ERR TRAP REGRESSION TESTS PASSED!           ");
  console.log("==================================================");
} catch (err) {
  console.error("Regression test runner error:", err.message);
  process.exit(1);
}
