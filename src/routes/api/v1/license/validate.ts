import { createFileRoute } from "@tanstack/react-router";
import db from "@/lib/db";
import {
  findLicenseByDomain,
  checkLicense,
  logPanelValidation,
  getClientIp,
  nowMysql
} from "@/lib/license-server";

export const Route = createFileRoute("/api/v1/license/validate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const domain = String(body.domain || "").trim().toLowerCase();
          const instanceId = String(body.instance_id || "").trim();
          const ipAddress = getClientIp(request);
          const userAgent = request.headers.get("user-agent") || null;

          if (!domain || !instanceId) {
            return new Response(
              JSON.stringify({
                valid: false,
                status: "bad_request",
                reason: "domain e instance_id são obrigatórios."
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" }
              }
            );
          }

          // Find license by authorized domain
          const license = await findLicenseByDomain(domain);
          const checked = checkLicense(license);

          if (!checked.ok) {
            await logPanelValidation({
              license_id: license?.id || null,
              domain,
              app_url: null,
              installation_id: instanceId,
              ip_address: ipAddress,
              app_id: null,
              result: checked.status,
              reason: checked.reason,
              payload: body
            });

            return new Response(
              JSON.stringify({
                valid: false,
                status: checked.status,
                reason: checked.reason
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" }
              }
            );
          }

          // Check if activation exists for this instance
          const activationRows = (await db.query(
            "SELECT * FROM license_activations WHERE license_id = ? AND domain = ? AND installation_id = ? LIMIT 1",
            [license!.id, domain, instanceId]
          )) as any[];

          if (!activationRows.length) {
            // Auto-create activation on first validate call
            await db.query(
              `INSERT INTO license_activations
               (license_id, domain, installation_id, status, activated_at, last_check_at, ip_address, user_agent)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [license!.id, domain, instanceId, "active", nowMysql(), nowMysql(), ipAddress, userAgent]
            );
          } else {
            // Update existing activation check time and info
            await db.query(
              "UPDATE license_activations SET status = 'active', last_check_at = ?, ip_address = ?, user_agent = ? WHERE id = ?",
              [nowMysql(), ipAddress, userAgent, activationRows[0].id]
            );
          }

          await logPanelValidation({
            license_id: license!.id,
            domain,
            app_url: null,
            installation_id: instanceId,
            ip_address: ipAddress,
            app_id: null,
            result: "active",
            reason: "Licença validada com sucesso.",
            payload: body
          });

          return new Response(
            JSON.stringify({
              valid: true,
              expires_at: license!.expires_at ? new Date(license!.expires_at).toISOString() : null,
              plan: license!.plan || "basic"
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" }
            }
          );
        } catch (error: any) {
          console.error("[License] Erro na validação:", error);
          return new Response(
            JSON.stringify({
              valid: false,
              status: "server_error",
              reason: "Erro interno no painel de licenças."
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" }
            }
          );
        }
      }
    }
  }
});
