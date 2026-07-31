import { execSync } from "child_process";

async function run() {
  console.log("=== STATUS DOS CONTAINERS DOCKER ===");
  try {
    console.log(execSync("docker ps", { encoding: "utf8" }));
  } catch (err: any) {
    console.error("Erro no docker ps:", err.message);
  }

  try {
    console.log("Docker Compose PS:");
    console.log(execSync("docker compose ps", { encoding: "utf8" }));
  } catch (err: any) {
    console.error("Erro no docker compose ps:", err.message);
  }

  process.exit(0);
}

run().catch(console.error);
