import { execSync } from "child_process";
import fs from "fs";

try {
  const tracked = execSync("git ls-files .env", { encoding: "utf8" }).trim();
  if (tracked === ".env") {
    console.log("[Git Audit] .env IS currently tracked in git index! Removing from git index...");
    // Backup .env content first
    if (fs.existsSync(".env")) {
      fs.copyFileSync(".env", "/tmp/env_backup_before_git_rm");
    }
    execSync("git rm --cached .env", { stdio: "inherit" });
    console.log("[Git Audit] .env removed from git index successfully.");
  } else {
    console.log("[Git Audit] .env is NOT tracked in git index. Excellent.");
  }
} catch (err) {
  console.error("[Git Audit] Error checking git index:", err.message);
}
