import { dbAdmin } from "../src/integrations/mysql/client.server";
import { processBotFlow } from "../src/lib/botflow-executor.server";
import { createHmac } from "crypto";

const phoneDigits = "5511999999999";
const phoneNumberId = "1208698542320885";
const userId = "acff3186-4e4a-4242-a7a5-3e519265b244";
const testSecret = "test_secret";

// Intercept outbound Graph API calls
const originalFetch = globalThis.fetch;
const outboundCalls: any[] = [];

globalThis.fetch = async (url: any, options: any) => {
  const urlStr = String(url);
  if (urlStr.includes("graph.facebook.com")) {
    console.log(`\n[OUTBOUND MOCK] Facebook Graph API: ${urlStr}`);
    if (options && options.body) {
      try {
        const body = JSON.parse(options.body);
        console.log("[OUTBOUND MOCK] Body:", JSON.stringify(body, null, 2));
        outboundCalls.push(body);
      } catch {
        console.log("[OUTBOUND MOCK] Raw body:", options.body);
        outboundCalls.push(options.body);
      }
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ messages: [{ id: "wam.mock_out_" + Date.now() }] }),
      json: async () => ({ messages: [{ id: "wam.mock_out_" + Date.now() }] }),
    } as any;
  }
  // Let local webhook requests pass through normally
  return originalFetch(url, options);
};

async function main() {
  console.log("=== STARTING WHATSAPP FLOWS INTEGRATION TEST ===");

  try {
    // 1. Get user's bot settings singleton
    const { data: settings } = await dbAdmin.from("bot_settings").select("*").eq("user_id", userId);
    if (!settings || settings.length === 0) {
      console.error("Bot settings not found for test user!");
      return;
    }
    const botSettingsId = settings[0].id;

    // 2. Set up test profile secret in the database to allow webhook signature verification
    console.log("\nSetting up test secret in profile...");
    await dbAdmin.from("profiles").update({ whatsapp_app_secret: testSecret }).eq("id", userId);
    console.log("Profile updated.");

    // 3. Setup test steps
    console.log("\nInserting test flow steps...");
    // Clear old test steps if any
    await dbAdmin.from("bot_steps").delete().eq("id", "flow_test_step_1");
    await dbAdmin.from("bot_steps").delete().eq("id", "flow_test_step_success");

    // Step 1: Flow triggering step
    await dbAdmin.from("bot_steps").insert({
      id: "flow_test_step_1",
      user_id: userId,
      bot_settings_id: botSettingsId,
      step_order: 1,
      trigger_type: "keyword",
      trigger_value: "test_flow",
      message_type: "whatsapp_flow",
      message_content: "Por favor, preencha o formulário de orçamento:",
      buttons_config: JSON.stringify({
        flow_id: "789123456",
        flow_cta: "Preencher Formulário",
        next_step_on_success: "flow_test_step_success",
      }),
    });

    // Step 2: Success step
    await dbAdmin.from("bot_steps").insert({
      id: "flow_test_step_success",
      user_id: userId,
      bot_settings_id: botSettingsId,
      step_order: 2,
      trigger_type: "keyword",
      trigger_value: "flow_test_step_success",
      message_type: "text",
      message_content:
        "Muito obrigado! Recebemos sua resposta do Flow e prosseguimos com o atendimento.",
    });
    console.log("Steps inserted successfully.");

    // 4. Reset session state
    console.log("\nResetting session state for test contact...");
    await dbAdmin
      .from("bot_conversation_state")
      .delete()
      .eq("user_id", userId)
      .eq("contact_number", phoneDigits);
    console.log("Session reset.");

    // 5. Test outbound message (Simulate contact says "test_flow")
    console.log("\n--- STEP 1: Simulating initial contact message ---");
    await processBotFlow("test_flow", phoneDigits, phoneNumberId, userId);
    await new Promise((r) => setTimeout(r, 1000));

    // Verify session state is saved pointing to flow_test_step_1
    const { data: state1 } = await dbAdmin
      .from("bot_conversation_state")
      .select("*")
      .eq("user_id", userId)
      .eq("contact_number", phoneDigits)
      .maybeSingle();

    console.log("\nSession State after initial trigger:", state1);
    if (state1?.current_step_id === "flow_test_step_1") {
      console.log("PASSED: Bot state preserved on whatsapp_flow step.");
    } else {
      console.error("FAILED: Bot state did not stay on whatsapp_flow step!");
    }

    // 6. Test inbound webhook (Simulate user submitting the WhatsApp Flow)
    console.log("\n--- STEP 2: Simulating incoming Flow submission (interactive nfm_reply) ---");
    const webhookPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "12345",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "5511999999999",
                  phone_number_id: "1208698542320885",
                },
                messages: [
                  {
                    from: phoneDigits,
                    id: "wam.flow_reply_id_123",
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: "interactive",
                    interactive: {
                      type: "nfm_reply",
                      nfm_reply: {
                        name: "flow",
                        body: "Sent",
                        response_json: JSON.stringify({
                          tipo_servico: "Residencial",
                          orcamento_estimado: "R$ 450,00",
                          wa_flow_response_params: {
                            flow_id: "789123456",
                            flow_name: "Orçamento de Serviços",
                          },
                          flow_token: `session:${phoneDigits}:flow_test_step_1`,
                        }),
                      },
                    },
                  },
                ],
              },
              field: "messages",
            },
          ],
        },
      ],
    };

    const rawBody = JSON.stringify(webhookPayload);
    const signature = "sha256=" + createHmac("sha256", testSecret).update(rawBody).digest("hex");

    console.log("Sending POST to local webhook...");
    const response = await fetch("http://localhost:8080/api/public/whatsapp-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": signature,
      },
      body: rawBody,
    });

    console.log(`Webhook HTTP status response: ${response.status}`);
    await new Promise((r) => setTimeout(r, 1500));

    // Verify submission was recorded
    const { data: submissions } = await dbAdmin
      .from("whatsapp_flow_submissions")
      .select("*")
      .eq("user_id", userId)
      .eq("contact_phone", phoneDigits);

    console.log("\nFlow Submissions in DB:", submissions);
    if (submissions && submissions.length > 0) {
      console.log("PASSED: Submission saved to whatsapp_flow_submissions.");
    } else {
      console.error("FAILED: Submission was not recorded!");
    }

    // Verify conversation moved to success step
    const { data: state2 } = await dbAdmin
      .from("bot_conversation_state")
      .select("*")
      .eq("user_id", userId)
      .eq("contact_number", phoneDigits)
      .maybeSingle();

    console.log("\nSession State after Webhook reply:", state2);

    console.log("\nOutbound messages history during test:");
    console.log(JSON.stringify(outboundCalls, null, 2));

    // Cleanup
    console.log("\nCleaning up database...");
    await dbAdmin.from("bot_steps").delete().eq("id", "flow_test_step_1");
    await dbAdmin.from("bot_steps").delete().eq("id", "flow_test_step_success");
    await dbAdmin
      .from("whatsapp_flow_submissions")
      .delete()
      .eq("user_id", userId)
      .eq("contact_phone", phoneDigits);
    await dbAdmin
      .from("bot_conversation_state")
      .delete()
      .eq("user_id", userId)
      .eq("contact_number", phoneDigits);
    await dbAdmin
      .from("direct_messages")
      .delete()
      .eq("user_id", userId)
      .eq("contact_phone", phoneDigits);

    // Restore profile secret
    await dbAdmin.from("profiles").update({ whatsapp_app_secret: null }).eq("id", userId);
    console.log("Cleanup complete.");

    // Restore fetch
    globalThis.fetch = originalFetch;

    console.log("\n=== TEST COMPLETED ===");
  } catch (error) {
    console.error("Test execution failed:", error);
  } finally {
    process.exit();
  }
}

main().catch(console.error);
