import os
import sys
import paramiko

host = os.environ.get("SSH_HOST", "103.63.28.182")
user = os.environ.get("SSH_USER", "root")
password = os.environ.get("SSH_PASSWORD")
local_path = os.environ.get("SFTP_LOCAL")
remote_path = os.environ.get("SFTP_REMOTE")

if not password or not local_path or not remote_path:
    print("[ERROR] Missing env", file=sys.stderr)
    sys.exit(1)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    client.connect(hostname=host, username=user, password=password, timeout=30, allow_agent=False, look_for_keys=False)
    sftp = client.open_sftp()
    sftp.put(local_path, remote_path)
    sftp.close()
    print("UPLOADED", remote_path)
finally:
    client.close()
