import sys
import time
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "103.63.28.182"
USER = "root"
PASSWORD = "drrLAySLMe49a9"
APP = "/var/www/wapi-weaver"
EXPECTED = "9e66ba6"


def main() -> int:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print("Connecting...", flush=True)
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    print("Connected.", flush=True)

    def run(cmd: str, timeout: int = 120) -> str:
        stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
        stdin.close()
        return stdout.read().decode("utf-8", "replace") + stderr.read().decode(
            "utf-8", "replace"
        )

    # Ensure only one install; if none, start one
    procs = run("pgrep -af 'install.sh --update' || true")
    print("PROCS:", procs, flush=True)
    if "bash install.sh --update" not in procs:
        print("No install running; starting...", flush=True)
        transport = client.get_transport()
        assert transport is not None
        ch = transport.open_session()
        ch.exec_command(
            f"cd {APP} && nohup bash install.sh --update "
            f"> /tmp/wapi-update.log 2>&1 </dev/null &"
        )
        time.sleep(3)
        ch.close()

    deadline = time.time() + 50 * 60
    while time.time() < deadline:
        status = run(
            "pgrep -c -f 'bash install.sh --update' || echo 0; "
            f"cd {APP} && git rev-parse --short HEAD; "
            "tail -n 8 /tmp/wapi-update.log 2>/dev/null | tr -d '\\000' | sed 's/\\x1b\\[[0-9;]*m//g'"
        )
        print("---", flush=True)
        print(status[:2000], flush=True)
        lines = [ln.strip() for ln in status.splitlines() if ln.strip()]
        # first line should be process count
        try:
            count = int(lines[0])
        except Exception:
            count = 1 if "install.sh --update" in status else 0
        head = ""
        for ln in lines[1:]:
            if len(ln) == 7 and all(c in "0123456789abcdef" for c in ln):
                head = ln
                break
        log_blob = status
        done_ok = (
            "EXIT:0" in log_blob
            or "BLIV CRM INSTALADO E VALIDADO" in log_blob
            or ("Todos os serviços Docker" in log_blob and "HEALTHY" in log_blob)
        )
        if count == 0 and head.startswith(EXPECTED) and done_ok:
            break
        if count == 0 and head.startswith(EXPECTED):
            # check containers
            ps = run("docker ps --format '{{.Names}} {{.Status}}'")
            print("DOCKER:", ps, flush=True)
            if "wapi_weaver_app" in ps and ("healthy" in ps.lower() or "Up" in ps):
                # confirm log finished
                end = run("tail -n 40 /tmp/wapi-update.log 2>/dev/null | tr -d '\\000'")
                print("LOGEND:", end[-1500:], flush=True)
                if "EXIT:0" in end or "INSTALADO" in end or "HEALTHY" in end:
                    break
                # if install died mid-way, restart once
                if "error" in end.lower() or "failed" in end.lower():
                    print("Install looks failed; restarting once...", flush=True)
                    transport = client.get_transport()
                    assert transport is not None
                    ch = transport.open_session()
                    ch.exec_command(
                        f"cd {APP} && nohup bash install.sh --update "
                        f"> /tmp/wapi-update.log 2>&1 </dev/null &"
                    )
                    time.sleep(3)
                    ch.close()
        time.sleep(30)

    final = run(
        f"cd {APP} && echo HEAD=$(git rev-parse --short HEAD); "
        "docker ps --format '{{.Names}} {{.Status}}'; "
        "tail -n 15 /tmp/wapi-update.log 2>/dev/null | tr -d '\\000' | sed 's/\\x1b\\[[0-9;]*m//g'"
    )
    print("FINAL:", final, flush=True)

    sql = (
        "UPDATE calendar_events SET "
        "start_at = DATE_ADD(start_at, INTERVAL 3 YEAR), "
        "end_at = DATE_ADD(end_at, INTERVAL 3 YEAR) "
        "WHERE YEAR(start_at) = 2023; "
        "SELECT id, title, start_at, end_at, created_at FROM calendar_events "
        "WHERE title LIKE '%Agente IA%' OR YEAR(created_at)=2026 "
        "ORDER BY created_at DESC LIMIT 12;"
    )
    sql_out = run(
        "docker exec wapi_weaver_mysql mysql -uwapi_user "
        "-p'S0xbxPfKazBVT8JFy1UEOjIsrjox' wapi_weaver "
        f"-e \"{sql}\""
    )
    print("SQL:", sql_out, flush=True)

    head = run(f"cd {APP} && git rev-parse --short HEAD").strip()
    print(f"DONE head={head}", flush=True)
    client.close()
    return 0 if head.startswith(EXPECTED) else 1


if __name__ == "__main__":
    raise SystemExit(main())
