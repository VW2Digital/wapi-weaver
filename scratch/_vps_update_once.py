import sys
import time
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "103.63.28.182"
USER = "root"
PASSWORD = "drrLAySLMe49a9"
APP = "/var/www/wapi-weaver"
EXPECTED = "339465b"


def main() -> int:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print("Connecting...", flush=True)
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    print("Connected.", flush=True)

    def run(cmd: str, timeout: int = 120) -> str:
        stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
        stdin.close()
        return (
            stdout.read().decode("utf-8", "replace")
            + stderr.read().decode("utf-8", "replace")
        ).replace("\x00", "")

    print("BEFORE:", run(f"cd {APP} && git rev-parse --short HEAD"), flush=True)
    procs = run("ps aux | grep '[b]ash install.sh --update' || echo none")
    print("PROCS:", procs, flush=True)

    if "install.sh --update" not in procs:
        transport = client.get_transport()
        assert transport is not None
        ch = transport.open_session()
        ch.exec_command(
            f"cd {APP} && nohup bash install.sh --update > /tmp/wapi-update.log 2>&1 </dev/null &"
        )
        time.sleep(3)
        ch.close()
        print("Started install.", flush=True)

    deadline = time.time() + 50 * 60
    while time.time() < deadline:
        head = run(f"cd {APP} && git rev-parse --short HEAD").strip()
        alive = run("ps aux | grep '[b]ash install.sh --update' || echo none")
        tail = run(
            "tail -n 12 /tmp/wapi-update.log 2>/dev/null | sed 's/\\x1b\\[[0-9;]*m//g'"
        )
        print(f"--- head={head} alive={'yes' if 'install.sh' in alive else 'no'} ---", flush=True)
        print(tail[-1200:], flush=True)
        if "install.sh" not in alive and head.startswith(EXPECTED):
            if "INSTALADO E VALIDADO" in tail or "HEALTHY" in tail or "EXIT:0" in tail:
                break
            ps = run("docker ps --format '{{.Names}} {{.Status}}'")
            print(ps, flush=True)
            if "wapi_weaver_app" in ps and "healthy" in ps.lower():
                end = run("tail -n 40 /tmp/wapi-update.log 2>/dev/null | sed 's/\\x1b\\[[0-9;]*m//g'")
                if "INSTALADO" in end or "HEALTHY" in end or head.startswith(EXPECTED):
                    break
        time.sleep(25)

    final = run(
        f"cd {APP} && echo HEAD=$(git rev-parse --short HEAD); "
        "cat .deploy-version 2>/dev/null; "
        "docker ps --format '{{.Names}} {{.Status}}'"
    )
    print("FINAL:", final, flush=True)
    client.close()
    return 0 if EXPECTED in final else 1


if __name__ == "__main__":
    raise SystemExit(main())
