import { createFileRoute } from "@tanstack/react-router";
import { subscribeToChatRealtimeEvents } from "@/lib/chat-realtime.server";

export const Route = createFileRoute("/api/chat/events")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();

            // Mensagem inicial de conexão
            controller.enqueue(encoder.encode("data: connected\n\n"));

            // Heartbeat a cada 15s para manter a conexão aberta
            const pingInterval = setInterval(() => {
              try {
                controller.enqueue(encoder.encode("data: ping\n\n"));
              } catch {
                clearInterval(pingInterval);
              }
            }, 15000);

            // Assinatura de eventos de chat em tempo real
            const unsubscribe = subscribeToChatRealtimeEvents((event) => {
              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
              } catch {
                unsubscribe();
                clearInterval(pingInterval);
              }
            });

            request.signal.addEventListener("abort", () => {
              clearInterval(pingInterval);
              unsubscribe();
              try {
                controller.close();
              } catch {}
            });
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
