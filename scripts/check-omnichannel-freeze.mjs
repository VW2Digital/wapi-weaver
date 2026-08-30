import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const MANIFEST_PATH = ".omnichannel-freeze.json";

function loadManifest() {
  try {
    const raw = readFileSync(MANIFEST_PATH, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[Omnichannel Freeze] Could not load ${MANIFEST_PATH}:`, err.message);
    process.exit(1);
  }
}

function isExcluded(file, excludedPaths) {
  return excludedPaths.some((p) => {
    if (p.endsWith("/")) return file.startsWith(p);
    return file === p || file.startsWith(p + "/");
  });
}

function isProtected(file, protectedPaths) {
  return protectedPaths.some((p) => {
    if (p.endsWith("/")) return file.startsWith(p);
    return file === p || file.startsWith(p + "/");
  });
}

function getChangedFiles(baselineCommit) {
  const tracked = execSync(`git diff --name-only ${baselineCommit}`, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "ignore"],
  })
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const untracked = execSync("git ls-files --others --exclude-standard", {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "ignore"],
  })
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const staged = execSync(`git diff --cached --name-only ${baselineCommit}`, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "ignore"],
  })
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  return [...new Set([...tracked, ...untracked, ...staged])];
}

function main() {
  const manifest = loadManifest();

  if (!manifest.enabled) {
    console.log("OMNICHANNEL FREEZE: disabled");
    process.exit(0);
  }

  const baselineCommit = manifest.baselineCommit;
  const protectedPaths = manifest.protectedPaths || [];
  const excludedPaths = manifest.excludedPaths || [];

  const changed = getChangedFiles(baselineCommit);
  const violations = changed.filter(
    (file) => isProtected(file, protectedPaths) && !isExcluded(file, excludedPaths),
  );

  if (process.env.FREEZE_SIMULATE_VIOLATION === "1") {
    violations.push("src/lib/messaging/outbound/adapters/instagram.outbound-adapter.ts");
  }

  if (violations.length > 0) {
    console.error("OMNICHANNEL FREEZE VIOLATION");
    console.error("");
    console.error("Protected stable messaging code was modified.");
    console.error("Explicit UNFREEZE authorization is required.");
    console.error("");
    console.error("Violations:");
    for (const v of [...new Set(violations)].sort()) {
      console.error(`  - ${v}`);
    }
    process.exit(1);
  }

  console.log("OMNICHANNEL FREEZE: PASS (no protected changes since baseline)");
  console.log(`Baseline: ${baselineCommit}`);
}

main();
