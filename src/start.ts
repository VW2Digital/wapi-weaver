import { createStart, createMiddleware, createCsrfMiddleware } from "@tanstack/react-start";

import { attachAuth } from "@/integrations/mysql/auth-attacher";
import { renderErrorPage } from "./lib/error-page";

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    try {
      const fs = await import("fs");
      fs.writeFileSync("./ssr_error.log", "START MIDDLEWARE:\n" + (error instanceof Error ? error.stack : String(error)) + "\n");
    } catch (e) {}
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, errorMiddleware],
  functionMiddleware: [attachAuth],
}));
