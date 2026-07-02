import { createFileRoute } from "@tanstack/react-router";
import db from "@/lib/db";
import {
  normalizeLicenseKey,
  findLicenseByKey,
  checkLicense,
  logPanelValidation,
  publicLicenseResponse,
  getClientIp,
  nowMysql
} from "@/lib/license-server";

export const Route = createFileRoute("/api/licenses/activate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const licenseKey = normalizeLicenseKey(body.license_key);
          const appId = body.app_id || "meu-saas";
          const domain = String(body.domain || "").trim().toLowerCase();
          const installationId = String(body.installation_id || "").trim();
          const appUrl = body.app_url || null;
          const ipAddress = getClientIp(request);
          const userAgent = request.headers.get("user-agent") || null;

          if (!licenseKey || !domain || !installationId) {
            return new Response(
              JSON.stringify({
                valid: false,
                status: "bad_request",
                reason: "license_key, domain e installation_id são obrigatórios."
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" }
              }
            );
          }

          const license = await findLicenseByKey(licenseKey);
          const checked = checkLicense(license, appId);

          if (!checked.ok) {
            await logPanelValidation({
              license_id: license?.id || null,
              domain,
              app_url: appUrl,
              installation_id: installationId,
              ip_address: ipAddress,
              app_id: appId,
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

          // Check existing activations
          const existingRows = (await db.query(
            "SELECT * FROM license_activations WHERE license_id = ? AND domain = ? AND installation_id = ? LIMIT 1",
            [license!.id, domain, installationId]
          )) as any[];

          if (existingRows.length) {
            await db.query(
              "UPDATE license_activations SET last_check_at = ?, ip_address = ?, user_agent = ?, app_url = ?, status = ? WHERE id = ?",
              [nowMysql(), ipAddress, userAgent, appUrl, "active", existingRows[0].id]
            );
          } else {
            // Count active activations
            const countRows = (await db.query(
              "SELECT COUNT(*) AS total FROM license_activations WHERE license_id = ? AND status = ?",
              [license!.id, "active"]
            )) as any[];

            if (Number(countRows[0].total) >= Number(license!.max_activations || 1)) {
              const reason = "Limite de ativações excedido.";

              await logPanelValidation({
                license_id: license!.id,
                domain,
                app_url: appUrl,
                installation_id: installationId,
                ip_address: ipAddress,
                app_id: appId,
                result: "activation_limit",
                reason,
                payload: body
              });

              return new Response(
                JSON.stringify({
                  valid: false,
                  status: "activation_limit",
                  reason
                }),
                {
                  status: 200,
                  headers: { "Content-Type": "application/json" }
                }
              );
            }

            await db.query(
              `INSERT INTO license_activations
               (license_id, domain, app_url, installation_id, ip_address, user_agent, activated_at, last_check_at, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                license!.id,
                domain,
                appUrl,
                installationId,
                ipAddress,
                userAgent,
                nowMysql(),
                nowMysql(),
                "active"
              ]
            );
          }

          await logPanelValidation({
            license_id: license!.id,
            domain,
            app_url: appUrl,
            installation_id: installationId,
            ip_address: ipAddress,
            app_id: appId,
            result: "active",
            reason: "Licença ativada/validada com sucesso.",
            payload: body
          });

          return new Response(
            JSON.stringify(
              publicLicenseResponse(license!, {
                message: "Licença ativada com sucesso.",
                domain
              })
            ),
            {
              status: 200,
              headers: { "Content-Type": "application/json" }
            }
          );
        } catch (error: any) {
          console.error("[License] Erro na ativação:", error);
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
