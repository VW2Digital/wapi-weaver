const http = require("http");
const fs = require("fs");
const path = require("path");

const session = "lead-chat-messages";
const outdir = path.resolve(__dirname);
const envPath = path.join(outdir, `${session}.env`);
const logPath = path.join(outdir, `trae-debug-log-${session}.ndjson`);
const port = 7777;

fs.mkdirSync(outdir, { recursive: true });
fs.writeFileSync(logPath, "");
fs.writeFileSync(
  envPath,
  `DEBUG_SERVER_URL=http://127.0.0.1:${port}/event\nDEBUG_SESSION_ID=${session}\n`,
);

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/event") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        payload.ts = payload.ts || Date.now();
        fs.appendFileSync(logPath, `${JSON.stringify(payload)}\n`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400);
        res.end("bad");
      }
    });
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, session, logPath }));
    return;
  }

  if (req.method === "GET" && req.url?.startsWith("/logs")) {
    const text = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "";
    res.writeHead(200, { "Content-Type": "application/x-ndjson" });
    res.end(text);
    return;
  }

  if (req.method === "DELETE" && req.url === "/logs") {
    fs.writeFileSync(logPath, "");
    res.writeHead(200);
    res.end("ok");
    return;
  }

  res.writeHead(404);
  res.end("nf");
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`debug-server ${port} ${logPath}\n`);
});

setInterval(() => {}, 1000);
