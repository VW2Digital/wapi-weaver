#!/usr/bin/env python3
"""Read-only disk usage report for the Bliv VPS. Never prints credentials."""
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
set +e
echo '=== DF ==='
df -hT
echo
echo '=== LSBLK ==='
lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT
echo
echo '=== TOP / ==='
du -xh --max-depth=1 / 2>/dev/null | sort -hr | head -20
echo
echo '=== TOP /var ==='
du -xh --max-depth=1 /var 2>/dev/null | sort -hr | head -20
echo
echo '=== TOP /var/lib ==='
du -xh --max-depth=1 /var/lib 2>/dev/null | sort -hr | head -15
echo
echo '=== TOP /var/lib/docker ==='
du -xh --max-depth=1 /var/lib/docker 2>/dev/null | sort -hr | head -15
echo
echo '=== DOCKER SYSTEM DF ==='
docker system df
echo
echo '=== DOCKER IMAGES ==='
docker images --format '{{.Repository}}:{{.Tag}} {{.ID}} {{.Size}}'
echo
echo '=== DOCKER VOLUMES ==='
docker volume ls
docker system df -v 2>/dev/null | sed -n '/VOLUME NAME/,/Build cache/p'
echo
echo '=== APP TREE ==='
du -xh --max-depth=2 /var/www/wapi-weaver 2>/dev/null | sort -hr | head -25
echo
echo '=== BACKUPS ==='
du -sh /var/backups /var/backups/blivcrm 2>/dev/null
ls -lh /var/backups/blivcrm 2>/dev/null | tail -20
echo
echo '=== LOGS / CACHE / JOURNAL ==='
du -sh /var/log /var/cache /usr /home /tmp /root 2>/dev/null
journalctl --disk-usage 2>/dev/null
echo
echo '=== SWAP / SNAP ==='
swapon --show 2>/dev/null
du -sh /swapfile /swap.img 2>/dev/null
snap list 2>/dev/null | head
du -sh /snap /var/lib/snapd 2>/dev/null
echo DISK_REPORT_OK
""",
    timeout=180,
)
