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
    print(f"Connecting to {HOST}...", flush=True)
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    print("Connected.", flush=True)

    def run(cmd: str, timeout: int = 180) -> tuple[int, str, str]:
        stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
        stdin.close()
        out = stdout.read().decode("utf-8", "replace")
        err = stderr.read().decode("utf-8", "replace")
        return stdout.channel.recv_exit_status(), out, err

    def fire_and_forget(cmd: str) -> None:
        transport = client.get_transport()
        assert transport is not None
        channel = transport.open_session()
        channel.exec_command(cmd)
        # Give the remote shell a moment to spawn nohup, then abandon the channel
        time.sleep(2)
        channel.close()

    code, out, err = run(
        f"cd {APP} && echo BEFORE=$(git rev-parse --short HEAD); "
        "pgrep -af 'install.sh --update' || echo NO_INSTALL"
    )
    print(out, flush=True)

    if "install.sh --update" in out and "NO_INSTALL" not in out:
        print("Install already running; will poll.", flush=True)
    else:
        print("Starting install.sh --update in background...", flush=True)
        fire_and_forget(
            f"cd {APP} && nohup bash install.sh --update "
            f"> /tmp/wapi-update.log 2>&1 </dev/null &"
        )
        time.sleep(3)
        code, out, err = run("pgrep -af 'install.sh --update' || echo NO_INSTALL")
        print("After start:", out, flush=True)

    deadline = time.time() + 45 * 60
    last_tail = ""
    while time.time() < deadline:
        code, out, err = run(
            "echo '---'; "
            "pgrep -af 'install.sh --update' || echo NO_INSTALL_PROC; "
            f"cd {APP} && echo HEAD=$(git rev-parse --short HEAD); "
            "tail -n 25 /tmp/wapi-update.log 2>/dev/null || true",
            timeout=90,
        )
        if out != last_tail:
            print("--- poll ---", flush=True)
            print(out, flush=True)
            last_tail = out

        finished = "NO_INSTALL_PROC" in out
        head_ok = EXPECTED in out
        success_markers = (
            "EXIT:0" in out
            or "BLIV CRM INSTALADO" in out
            or "Todos os serviços Docker" in out
        )
        if finished and head_ok and (success_markers or "HEALTHY" in out):
            break
        if finished and head_ok:
            # give log a moment; check full tail once more
            code2, out2, _ = run("tail -n 60 /tmp/wapi-update.log 2>/dev/null", timeout=60)
            print(out2, flush=True)
            if (
                "EXIT:0" in out2
                or "BLIV CRM INSTALADO" in out2
                or "HEALTHY" in out2
                or EXPECTED in out2
            ):
                break
            # head updated but log unclear — accept if containers healthy
            code3, out3, _ = run(
                "docker ps --format '{{.Names}} {{.Status}}' | head -15", timeout=60
            )
            print(out3, flush=True)
            if "wapi_weaver_app" in out3 and "Up" in out3:
                break
        time.sleep(20)

    code, out, err = run(
        f"cd {APP} && echo FINAL_HEAD=$(git rev-parse --short HEAD) && "
        "docker ps --format '{{.Names}} {{.Status}}' | head -15"
    )
    print(out, flush=True)

    # Repair events stored with year 2023 (LLM hallucination)
    sql = (
        "UPDATE calendar_events SET "
        "start_at = DATE_ADD(start_at, INTERVAL 3 YEAR), "
        "end_at = DATE_ADD(end_at, INTERVAL 3 YEAR) "
        "WHERE YEAR(start_at) = 2023; "
        "SELECT id, title, start_at, end_at, created_at FROM calendar_events "
        "WHERE title LIKE '%Agente IA%' OR title LIKE '%Reunião%' "
        "ORDER BY created_at DESC LIMIT 12;"
    )
    code, out, err = run(
        "docker exec wapi_weaver_mysql mysql -uwapi_user "
        "-p'S0xbxPfKazBVT8JFy1UEOjIsrjox' wapi_weaver "
        f"-e \"{sql}\"",
        timeout=60,
    )
    print("SQL OUT:", out, flush=True)
    if err:
        print("SQL ERR:", err, flush=True)

    code, out, err = run(f"cd {APP} && git rev-parse --short HEAD")
    head = (out or "").strip()
    print(f"DONE head={head} expected={EXPECTED}", flush=True)
    client.close()
    return 0 if head.startswith(EXPECTED) else 1


if __name__ == "__main__":
    raise SystemExit(main())
