import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import server from "./dist/server/server.js";
import { ensureDatabaseSchema } from "./scripts/ensure-schema.js";

// Run database init on startup
await ensureDatabaseSchema();

const app = new Hono();

// Serve static assets from dist/client
app.use("/assets/*", serveStatic({ root: "./dist/client" }));
app.use("/*", serveStatic({ root: "./dist/client" }));

// Pass all other requests to the TanStack Start SSR fetch handler
app.all("*", async (c) => {
  return server.fetch(c.req.raw);
});

const port = process.env.PORT || 3000;

console.log(`Starting Node server on port ${port}...`);

serve({
  fetch: app.fetch,
  port: Number(port),
});
