const fs = require("fs");
let content = fs.readFileSync("src/lib/profile.functions.ts", "utf-8");
const newFunc = `
export const listQRCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: p } = await context.supabase
      .from("profiles")
      .select("whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();
    if (!p?.whatsapp_phone_number_id || !p?.whatsapp_access_token) {
      return { ok: false, error: "Credenciais não configuradas" };
    }
    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(
      \`https://graph.facebook.com/\${apiVersion}/\${p.whatsapp_phone_number_id}/message_qrdls\`,
      {
        headers: { Authorization: \`Bearer \${p.whatsapp_access_token}\` },
      }
    );
    const body = await r.json();
    if (!r.ok) return { ok: false, error: body?.error?.message ?? "Falha ao listar QR Codes" };
    return { ok: true, data: body.data || [] };
  });
`;
content += newFunc;
fs.writeFileSync("src/lib/profile.functions.ts", content);
