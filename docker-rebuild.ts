import { execSync } from "child_process";

async function run() {
  console.log("=== RECONSTRUINDO E REINICIANDO O CONTAINER APP ===");
  try {
    console.log("Construindo a imagem sem cache para 'app'...");
    const buildLog = execSync("docker compose build --no-cache app", { encoding: "utf8" });
    console.log(buildLog);
  } catch (err: any) {
    console.error("Erro no build do container:", err.stdout || err.message);
    process.exit(1);
  }

  try {
    console.log("Reiniciando o serviço 'app'...");
    const upLog = execSync("docker compose up -d --force-recreate app", { encoding: "utf8" });
    console.log(upLog);
  } catch (err: any) {
    console.error("Erro no docker compose up:", err.stdout || err.message);
    process.exit(1);
  }

  try {
    console.log("Status final do Docker Compose:");
    console.log(execSync("docker compose ps", { encoding: "utf8" }));
  } catch (err: any) {
    console.error("Erro no ps final:", err.message);
  }

  process.exit(0);
}

run().catch(console.error);
