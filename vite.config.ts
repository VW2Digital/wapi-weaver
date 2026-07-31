import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { execSync } from "child_process";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  // Adicionar variáveis do build automáticas
  let commitHash = "unknown";
  try {
    commitHash = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch (e) {}

  envDefine["import.meta.env.VITE_COMMIT_HASH"] = JSON.stringify(commitHash);
  envDefine["import.meta.env.VITE_BUILD_TIME"] = JSON.stringify(new Date().toLocaleString("pt-BR"));
  envDefine["import.meta.env.VITE_APP_VERSION"] = JSON.stringify("1.0.0");

  return {
    define: envDefine,
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    plugins: [
      tailwindcss(),
      tsconfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        importProtection: {
          behavior: "error",
          client: {
            files: ["**/server/**"],
            specifiers: ["server-only"],
          },
        },
        server: { entry: "server" },
      }),
      react(),
    ],
    server: {
      host: "::",
      port: 8080,
    },
  };
});
