import { defineConfig, loadEnv, type Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { execSync } from "child_process";

/**
 * Plugin que substitui módulos Node.js-only por stubs vazios no bundle do
 * browser (client-side). Isso evita que mysql2, bullmq, etc. sejam avaliados
 * no navegador e causem "Cannot read properties of undefined (reading 'prototype')".
 */
function nodeStubPlugin(): Plugin {
  const SERVER_ONLY_PACKAGES = [
    "mysql2",
    "mysql2/promise",
    "bullmq",
    "ioredis",
    "bcryptjs",
    "jsonwebtoken",
    "cheerio",
    "stripe",
    "nodemailer",
    "@hono/node-server",
  ];

  const STUB_ID_PREFIX = "\0node-stub:";

  return {
    name: "vite-plugin-node-stub",
    enforce: "pre",
    resolveId(id, _importer, options) {
      // Apenas para o bundle do cliente (ssr === false)
      if (options?.ssr) return null;
      if (SERVER_ONLY_PACKAGES.some((pkg) => id === pkg || id.startsWith(pkg + "/"))) {
        return STUB_ID_PREFIX + id;
      }
      return null;
    },
    load(id) {
      if (id.startsWith(STUB_ID_PREFIX)) {
        // Retorna um módulo vazio que nunca vai crashar
        return "export default {}; export const __esModule = true;";
      }
      return null;
    },
  };
}

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
    ssr: {
      // Esses módulos devem ser external no SSR (Node.js pode importá-los nativamente)
      external: [
        "mysql2",
        "mysql2/promise",
        "bullmq",
        "ioredis",
        "bcryptjs",
        "jsonwebtoken",
        "cheerio",
        "hono",
        "@hono/node-server",
        "stripe",
        "nodemailer",
      ],
    },
    plugins: [
      nodeStubPlugin(),
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
