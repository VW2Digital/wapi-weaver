import { createFileRoute } from "@tanstack/react-router";
import db from "@/lib/db";
import {
  normalizeLicenseKey,
  findLicenseByKey,
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
          const licenseKey = normalizeLicenseKey(body.license_key);
          const domain = String(body.domain || "").trim().toLowerCase();
          const instanceId = String(body.instance_id || "").trim();
          const ipAddress = getClientIp(request);
          const userAgent = request.headers.get("user-agent") || null;

          if (!licenseKey || !domain || !instanceId) {
            return new Response(
              JSON.stringify({
                valid: false,
                status: "bad_request",
                reason: "license_key, domain e instance_id são obrigatórios."
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" }
              }
            );
          }

          const license = await findLicenseByKey(licenseKey);
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

          // Check if activation exists
          const activationRows = (await db.query(
            "SELECT * FROM license_activations WHERE license_id = ? AND domain = ? AND installation_id = ? AND status = ? LIMIT 1",
            [license!.id, domain, instanceId, "active"]
          )) as any[];

          if (!activationRows.length) {
            const reason = "Licença não ativada para este domínio/instalação.";

            await logPanelValidation({
              license_id: license!.id,
              domain,
              app_url: null,
              installation_id: instanceId,
              ip_address: ipAddress,
              app_id: null,
              result: "not_activated",
              reason,
              payload: body
            });

            return new Response(
              JSON.stringify({
                valid: false,
                status: "not_activated",
                reason
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" }
              }
            );
          }

          // Update check time
          await db.query(
            "UPDATE license_activations SET last_check_at = ?, ip_address = ?, user_agent = ? WHERE id = ?",
            [nowMysql(), ipAddress, userAgent, activationRows[0].id]
          );

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
