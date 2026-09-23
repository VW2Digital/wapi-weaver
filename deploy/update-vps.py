#!/usr/bin/env python3
"""Update production from GitHub origin/main — the wapi-weaver deploy process.

Source of truth is GitHub, not the local working tree.

1. Local repo must already be on origin/main (commit + push first).
2. SSH to the VPS and run `install.sh --update`, which:
   - git fetch / reset --hard origin/main
   - restores /etc/blivcrm/app.env → /var/www/wapi-weaver/.env
   - docker compose build + migrate + ensure-schema + recreate app
   - health-checks HTTP on 127.0.0.1:3003

This is the opposite of Cruz Watches `push-localhost.py` (SFTP of unsynced files).
Uncommitted local files are never uploaded.

Credentials: VPS_* or SSH_* env vars, or %%TEMP%%\\vps_wapi_weaver.py.
The script never prints the password.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = "/var/www/wapi-weaver"
DOMAIN = os.environ.get("VPS_DOMAIN", "app.blivcrm.com")


def load_creds():
    host = os.environ.get("VPS_HOST") or os.environ.get("SSH_HOST")
    user = os.environ.get("VPS_USER") or os.environ.get("SSH_USER") or "root"
    password = os.environ.get("VPS_PASSWORD") or os.environ.get("SSH_PASSWORD")
    if host and password:
        return host, user, password
    helper = Path(r"C:\Users\Lei Mendes\AppData\Local\Temp\vps_wapi_weaver.py")
    if helper.exists():
        ns = {}
        exec(helper.read_text(encoding="utf-8"), ns)
        return ns["HOST"], ns["USER"], ns["PASSWORD"]
    raise SystemExit(
        "Set VPS_HOST + VPS_PASSWORD (or SSH_HOST + SSH_PASSWORD), "
        "or keep the local helper at %%TEMP%%\\vps_wapi_weaver.py"
    )


def git(args: list[str]) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def require_origin_main():
    branch = git(["rev-parse", "--abbrev-ref", "HEAD"])
    head = git(["rev-parse", "HEAD"])
    subprocess.check_call(["git", "fetch", "origin", "main"], cwd=ROOT)
    origin = git(["rev-parse", "origin/main"])
    dirty = git(["status", "--porcelain", "--untracked-files=no"])
    print(f"BRANCH={branch}")
    print(f"HEAD={head}")
    print(f"ORIGIN_MAIN={origin}")
    if branch != "main":
        raise SystemExit("REFUSE: checkout main before VPS update.")
    if dirty:
        raise SystemExit("REFUSE: tracked files are dirty; commit and push first.")
    if head != origin:
        raise SystemExit("REFUSE: HEAD is not origin/main; git push first.")
    print("GIT_OK")
    return head


def ssh(host, user, password, cmd, timeout=1800):
    import paramiko

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        host,
        username=user,
        password=password,
        timeout=30,
        allow_agent=False,
        look_for_keys=False,
    )
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    client.close()
    sys.stdout.write(out)
    if err:
        sys.stdout.write(err)
    if code != 0:
        raise SystemExit(f"REMOTE_FAIL {code}: {cmd[:180]}")
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    os.chdir(ROOT)
    sha = require_origin_main()
    if "--local-only" in sys.argv:
        print("LOCAL_ONLY")
        raise SystemExit(0)
    host, user, password = load_creds()
    print(f"HOST={host}")
    print(f"REMOTE={APP}")
    print(f"DOMAIN={DOMAIN}")
    ssh(
        host,
        user,
        password,
        f"""set -e
cd {APP}
bash install.sh --update --domain={DOMAIN}
echo UPDATE_OK
""",
        timeout=1800,
    )
    ssh(
        host,
        user,
        password,
        f"""set -e
cd {APP}
echo VPS_HEAD=$(git rev-parse HEAD)
echo CONTAINER_SHA=$(docker compose -f docker-compose.production.yml exec -T app printenv APP_GIT_SHA | tr -d '\\r')
curl -sS -o /dev/null -w 'local3003 %{{http_code}}\\n' --max-time 10 http://127.0.0.1:3003/
curl -sk -o /dev/null -w '{DOMAIN} %{{http_code}}\\n' --max-time 15 -H 'Host: {DOMAIN}' https://127.0.0.1/
test "$(git rev-parse HEAD)" = "{sha}"
echo DEPLOY_OK
""",
        timeout=60,
    )
    print("DONE")


if __name__ == "__main__":
    main()
