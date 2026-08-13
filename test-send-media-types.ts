import mysql from "mysql2/promise";
import { buildWhatsAppBotMessage } from "./src/lib/meta-whatsapp-message.js";

async function runTest() {
  const conn = await mysql.createConnection({
    host: "127.0.0.1",
    port: 3306,
    user: "wapi_user",
    password: "S0xbxPfKazBVT8JFy1UEOjIsrjox",
    database: "wapi_weaver",
  });

  const [profiles]: any = await conn.query(
    "SELECT id, whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version FROM profiles WHERE whatsapp_access_token IS NOT NULL AND whatsapp_phone_number_id IS NOT NULL LIMIT 1"
  );

  const targetPhone = "5591985646076";

  if (!profiles || profiles.length === 0) {
    console.error("Nenhum perfil com WhatsApp configurado foi encontrado no banco.");
    await conn.end();
    return;
  }

  const profile = profiles[0];
  const phoneNumberId = profile.whatsapp_phone_number_id;
  const accessToken = profile.whatsapp_access_token;
  const apiVersion = profile.meta_graph_version || "v26.0";

  console.log("Configurações do Perfil encontradas:");
  console.log({ phoneNumberId, apiVersion, targetPhone });

  const testSteps = [
    {
      name: "1. Imagem",
      step: {
        message_type: "image",
        media_url: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=600",
        message_content: "📸 *[Teste Bot Flow]* Envio de Imagem executado com sucesso!",
      },
    },
    {
      name: "2. Documento (PDF)",
      step: {
        message_type: "document",
        media_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        message_content: "📄 *[Teste Bot Flow]* Envio de Documento PDF (dummy.pdf) executado com sucesso!",
      },
    },
    {
      name: "3. Vídeo",
      step: {
        message_type: "video",
        media_url: "https://www.w3schools.com/html/mov_bbb.mp4",
        message_content: "🎥 *[Teste Bot Flow]* Envio de Vídeo executado com sucesso!",
      },
    },
    {
      name: "4. Áudio",
      step: {
        message_type: "audio",
        media_url: "https://www.w3schools.com/html/horse.mp3",
        message_content: "🎧 *[Teste Bot Flow]* Envio de Áudio executado com sucesso!",
      },
    },
    {
      name: "5. Localização",
      step: {
        message_type: "location",
        media_url: "-1.4558,-48.4814",
        message_content: "📍 Belém - Pará, Brasil",
      },
    },
  ];

  for (const item of testSteps) {
    const { payload } = buildWhatsAppBotMessage(targetPhone, item.step);
    console.log(`\n=== Enviando ${item.name} ===`);
    console.log("Payload:", JSON.stringify(payload, null, 2));

    const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const resJson = await response.json();
    if (response.ok) {
      console.log(`✅ ${item.name} enviado com Sucesso! Msg ID:`, resJson?.messages?.[0]?.id);
    } else {
      console.error(`❌ Falha ao enviar ${item.name}:`, JSON.stringify(resJson, null, 2));
    }
  }

  await conn.end();
}

runTest().catch(console.error);
