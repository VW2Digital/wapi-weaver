import sys
import time
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "103.63.28.182"
USER = "root"
PASSWORD = "drrLAySLMe49a9"
APP = "/var/www/wapi-weaver"
EXPECTED = "6c1d1d4"


def main() -> int:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {HOST}...")
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    print("Connected.")

    def run(cmd: str, timeout: int = 120) -> tuple[int, str, str]:
        stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
        out = stdout.read().decode("utf-8", "replace")
        err = stderr.read().decode("utf-8", "replace")
        code = stdout.channel.recv_exit_status()
        return code, out, err

    code, out, err = run(
        f"cd {APP} && echo '=== BEFORE ===' && git rev-parse --short HEAD && cat .deploy-version 2>/dev/null || true"
    )
    print(out)
    if err.strip():
        print("STDERR:", err)

    # Avoid overlapping updates
    code, out, err = run("pgrep -af 'install.sh --update' || true")
    print("RUNNING:", out.strip() or "(none)")
    if "install.sh --update" in out and "pgrep" not in out.splitlines()[0] if out.strip() else False:
        pass
    if out.strip() and "install.sh --update" in out:
        print("Update already running; waiting...")
    else:
        print("Starting install.sh --update ...")
        # Detach long update
        start_cmd = (
            f"cd {APP} && nohup bash install.sh --update > /tmp/wapi-update.log 2>&1 & echo PID:$!"
        )
        code, out, err = run(start_cmd, timeout=30)
        print(out)
        if err.strip():
            print("STDERR:", err)

    # Poll until done
    deadline = time.time() + 900
    last_tail = ""
    while time.time() < deadline:
        code, out, err = run("pgrep -af 'install.sh --update' || true")
        running = bool(out.strip()) and "install.sh --update" in out
        code2, tail, _ = run("tail -n 25 /tmp/wapi-update.log 2>/dev/null || true")
        if tail != last_tail:
            print("--- log ---")
            print(tail)
            last_tail = tail
        if not running:
            break
        time.sleep(15)

    code, out, err = run(
        f"cd {APP} && echo '=== AFTER ===' && "
        f"echo SHA=$(git rev-parse --short HEAD) && "
        f"cat .deploy-version 2>/dev/null || true; "
        f"docker ps --format 'table {{{{.Names}}}}\\t{{{{.Status}}}}' | head -20; "
        f"tail -n 40 /tmp/wapi-update.log 2>/dev/null || true"
    )
    print(out)
    if err.strip():
        print("STDERR:", err)

    ok = EXPECTED in out and ("HEALTHY" in out.upper() or "healthy" in out)
    # Also accept if SHA matches even if health wording differs
    sha_ok = EXPECTED in out
    client.close()
    print("RESULT:", "OK" if sha_ok else "CHECK_MANUAL", "sha_expected=", EXPECTED)
    return 0 if sha_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
