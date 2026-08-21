import { serve, upgradeWebSocket } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { WebSocketServer } from "ws";
import server from "./dist/server/server.js";

import dsAgentApi from "./src/lib/ds-agent.api.js";
import { verifyApiUser } from "./src/lib/subscription-helpers.ts";
import { subscribeToChatRealtimeEvents } from "./src/lib/chat-realtime.server.ts";

const app = new Hono();

// Montar rotas REST do DS Agente
app.route("/api/ds-agents", dsAgentApi);

app.use("/api/chat/ws", async (c, next) => {
  try {
    const origin = c.req.header("origin");
    const forwardedHost = c.req.header("x-forwarded-host") || c.req.header("host");
    if (origin && forwardedHost && new URL(origin).host !== forwardedHost) {
      return c.text("Forbidden", 403);
    }
    c.set("chatUser", await verifyApiUser(c.req.raw));
    await next();
  } catch (error) {
    console.warn("[Chat WebSocket] Conexão rejeitada.", error?.message || error);
    return c.text("Unauthorized", 401);
  }
});

app.get(
  "/api/chat/ws",
  upgradeWebSocket((c) => {
    const user = c.get("chatUser");
    let unsubscribe = () => {};
    let keepAlive;

    return {
      onOpen(_event, ws) {
        unsubscribe = subscribeToChatRealtimeEvents((event) => {
          if (event.tenant_id !== user.tenantId) return;
          try {
            ws.send(JSON.stringify(event));
          } catch {
            // O fechamento do socket remove o listener logo em seguida.
          }
        });
        ws.send(
          JSON.stringify({
            type: "connection.ready",
            occurred_at: new Date().toISOString(),
          }),
        );
        keepAlive = setInterval(() => {
          try {
            ws.send(JSON.stringify({ type: "connection.keepalive" }));
          } catch {
            clearInterval(keepAlive);
          }
        }, 25_000);
      },
      onMessage(event, ws) {
        if (event.data === "ping") ws.send("pong");
      },
      onClose() {
        unsubscribe();
        if (keepAlive) clearInterval(keepAlive);
      },
      onError() {
        unsubscribe();
        if (keepAlive) clearInterval(keepAlive);
      },
    };
  }),
);

// Serve static assets from dist/client
app.use("/assets/*", serveStatic({ root: "./dist/client" }));
app.use("/*", serveStatic({ root: "./dist/client" }));

// Pass all other requests to the TanStack Start SSR fetch handler
app.all("*", async (c) => {
  return server.fetch(c.req.raw);
});

const port = process.env.PORT || 3000;
const wss = new WebSocketServer({ noServer: true });

console.log(`Starting Node server on port ${port}...`);

serve({
  fetch: app.fetch,
  port: Number(port),
  websocket: { server: wss },
});
