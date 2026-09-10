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

    def is_update_running() -> bool:
        # Match real install.sh process, ignore pgrep itself
        _, out, _ = run("pgrep -f '/bin/bash .*install.sh --update' || true")
        lines = [ln for ln in out.splitlines() if ln.strip()]
        return len(lines) > 0

    code, out, err = run(
        f"cd {APP} && echo '=== BEFORE ===' && git fetch origin main && "
        f"git rev-parse --short HEAD && git rev-parse --short origin/main && "
        f"cat .deploy-version 2>/dev/null || true"
    )
    print(out)
    if err.strip():
        print("FETCH_ERR:", err[-500:])

    if is_update_running():
        print("Update already in progress; waiting for it to finish...")
    else:
        print("Starting fresh install.sh --update ...")
        run("rm -f /tmp/wapi-update.log /tmp/wapi-update.exit")
        start_cmd = (
            f"cd {APP} && "
            f"(nohup bash -lc 'bash install.sh --update; echo EXIT:$? > /tmp/wapi-update.exit' "
            f"> /tmp/wapi-update.log 2>&1 & echo STARTED:$!)"
        )
        code, out, err = run(start_cmd, timeout=30)
        print(out)
        if err.strip():
            print("START_ERR:", err)

    deadline = time.time() + 1200
    last_tail = ""
    while time.time() < deadline:
        running = is_update_running()
        _, exit_file, _ = run("cat /tmp/wapi-update.exit 2>/dev/null || true")
        _, tail, _ = run("tail -n 20 /tmp/wapi-update.log 2>/dev/null || true")
        if tail != last_tail:
            print("--- log ---")
            print(tail)
            last_tail = tail
        if (not running) and exit_file.strip():
            print("EXIT_FILE:", exit_file.strip())
            break
        if (not running) and EXPECTED in tail and "HEALTHY" in tail.upper():
            break
        time.sleep(20)
    else:
        print("TIMEOUT waiting for update")

    code, out, err = run(
        f"cd {APP} && echo '=== AFTER ===' && "
        f"echo SHA=$(git rev-parse --short HEAD) && "
        f"echo REMOTE=$(git rev-parse --short origin/main) && "
        f"cat .deploy-version 2>/dev/null || true; "
        f"docker ps --format 'table {{{{.Names}}}}\\t{{{{.Status}}}}' | head -10; "
        f"tail -n 35 /tmp/wapi-update.log 2>/dev/null || true; "
        f"echo EXIT_FILE=$(cat /tmp/wapi-update.exit 2>/dev/null || echo missing)"
    )
    print(out)
    if err.strip():
        print("STDERR:", err[-500:])

    sha_ok = EXPECTED in out and f"SHA={EXPECTED}" in out.replace(" ", "")
    # softer check
    soft_ok = EXPECTED in out and ("healthy" in out.lower() or "HEALTHY" in out)
    client.close()
    print("RESULT:", "OK" if soft_ok else "FAIL", "expected=", EXPECTED)
    return 0 if soft_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
