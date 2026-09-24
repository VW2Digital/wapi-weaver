#!/usr/bin/env python3
"""Safe disk reclaim on Bliv VPS: build cache, apt, journals, old SQL dumps.

Never prune Docker volumes (MySQL / uploads). Never print credentials.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("update_vps", HERE / "update-vps.py")
mod = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(mod)

host, user, password = mod.load_creds()
print(f"HOST={host}")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
mod.ssh(
    host,
    user,
    password,
    r"""
set -e
echo '=== BEFORE ==='
df -h /
docker system df

echo
echo '=== DOCKER BUILD CACHE ==='
docker builder prune -af

echo
echo '=== APT CACHE ==='
apt-get clean

echo
echo '=== JOURNAL ==='
journalctl --vacuum-size=80M || true

echo
echo '=== OLD SQL BACKUPS (keep 3 newest real dumps) ==='
BACKUP_DIR=/var/backups/blivcrm
if [ -d "$BACKUP_DIR" ]; then
  # Drop empty/corrupt 20-byte dumps first
  find "$BACKUP_DIR" -type f -name 'wapi_weaver-*.sql.gz' -size -1k -print -delete
  # Keep the 3 newest remaining dumps, delete the rest
  ls -1t "$BACKUP_DIR"/wapi_weaver-*.sql.gz 2>/dev/null | tail -n +4 | while read -r f; do
    echo "DELETE $f"
    rm -f "$f"
  done
  echo REMAINING
  ls -lh "$BACKUP_DIR" || true
  du -sh "$BACKUP_DIR" || true
fi

echo
echo '=== LOG ROTATE HINT ==='
du -sh /var/log /var/backups /var/cache 2>/dev/null
journalctl --disk-usage || true

echo
echo '=== AFTER ==='
df -h /
docker system df
docker ps --format '{{.Names}} {{.Status}}'
echo CLEAN_OK
""",
    timeout=300,
)
print("DONE")
