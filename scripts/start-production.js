import { spawn } from "node:child_process";

const steps = [
  ["bootstrap da referência local", "scripts/create-all-tables.js", []],
  ["migrations incrementais", "scripts/migrate.js", []],
  ["reconciliação idempotente", "scripts/sync-schema.js", ["--allow-manual"]],
  ["validação de paridade", "scripts/validate-schema-parity.js", []],
];

function runNode(script, label, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`[Startup] Executando ${label}: ${script}`);
    const child = spawn(process.execPath, [script, ...args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `[Startup] ${label} falhou (${signal ? `sinal ${signal}` : `código ${code}`}).`,
        ),
      );
    });
  });
}

async function main() {
  console.log("[Startup] Preparando o banco de dados antes de iniciar a aplicação...");

  for (const [label, script, args] of steps) {
    await runNode(script, label, args);
  }

  console.log("[Startup] Banco validado. Iniciando o servidor...");
  const server = spawn(process.execPath, ["--import", "tsx/esm", "start.js"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  const forwardSignal = (signal) => {
    if (!server.killed) server.kill(signal);
  };

  process.once("SIGTERM", () => forwardSignal("SIGTERM"));
  process.once("SIGINT", () => forwardSignal("SIGINT"));

  server.once("error", (error) => {
    console.error("[Startup] Falha ao iniciar o servidor:", error);
    process.exitCode = 1;
  });
  server.once("exit", (code, signal) => {
    if (signal) {
      console.error(`[Startup] Servidor encerrado pelo sinal ${signal}.`);
      process.exitCode = 1;
      return;
    }
    process.exitCode = code ?? 1;
  });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
