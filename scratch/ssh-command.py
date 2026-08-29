import os
import sys
import paramiko

host = os.environ.get("SSH_HOST", "103.63.28.182")
user = os.environ.get("SSH_USER", "root")
password = os.environ.get("SSH_PASSWORD")
port = int(os.environ.get("SSH_PORT", "22"))
command = os.environ.get("SSH_COMMAND", "echo 'SSH_OK'")

if not password:
    print("[ERROR] SSH_PASSWORD not set", file=sys.stderr)
    sys.exit(1)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    client.connect(hostname=host, port=port, username=user, password=password, timeout=30, allow_agent=False, look_for_keys=False)
    stdin, stdout, stderr = client.exec_command(command)
    out = stdout.read().decode("utf-8", "ignore").encode("utf-8").decode(sys.stdout.encoding or "utf-8", "ignore")
    err = stderr.read().decode("utf-8", "ignore").encode("utf-8").decode(sys.stderr.encoding or "utf-8", "ignore")
    if out:
        print(out, end="")
    if err:
        print(err, end="", file=sys.stderr)
    rc = stdout.channel.recv_exit_status()
    sys.exit(rc)
finally:
    client.close()
