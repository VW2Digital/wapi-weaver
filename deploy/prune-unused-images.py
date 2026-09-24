#!/usr/bin/env python3
"""Prune unused Docker images on the Bliv VPS. Never prune volumes."""
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
mod.ssh(
    host,
    user,
    password,
    r"""set -e
echo BEFORE
df -m / | tail -3
docker image prune -af
echo AFTER
df -m / | tail -3
docker system df
echo PS
docker ps -a --format '{{.Names}} {{.Status}}'
echo PRUNE_OK
""",
    timeout=300,
)
print("DONE")
