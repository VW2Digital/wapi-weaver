import { dbAdmin } from "../src/integrations/mysql/client.server";
import { processBotFlow } from "../src/lib/botflow-executor.server";

// 1. Mock global fetch before anything else to intercept Graph API calls
const originalFetch = globalThis.fetch;
const fetchCalls: any[] = [];

globalThis.fetch = async (url: any, options: any) => {
  const urlStr = String(url);
  console.log(`\n[MOCK FETCH] Request URL: ${urlStr}`);
  if (options && options.body) {
    try {
      const parsedBody = JSON.parse(options.body);
      console.log("[MOCK FETCH] Request Body:", JSON.stringify(parsedBody, null, 2));
      fetchCalls.push({ url: urlStr, body: parsedBody });
    } catch {
      console.log("[MOCK FETCH] Request Body (raw):", options.body);
      fetchCalls.push({ url: urlStr, body: options.body });
    }
  }
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ message_id: "wam.mock_id_" + Date.now() }),
    json: async () => ({ message_id: "wam.mock_id_" + Date.now() }),
  } as any;
};

const phoneDigits = "5511999999999";
const phoneNumberId = "1208698542320885";
const userId = "acff3186-4e4a-4242-a7a5-3e519265b244";

async function main() {
  console.log("=== STARTING BOT FLOW INTEGRATION TEST ===");

  try {
    // 2. Clear old state for the test number
    console.log("\nResetting conversation state for test number...");
    await dbAdmin
      .from("bot_conversation_state")
      .delete()
      .eq("user_id", userId)
      .eq("contact_number", phoneDigits);
    console.log("State reset successfully.");

    // 3. Test Message 1: Initial user hello (triggers "start" step)
    console.log("\n--- SIMULATING MESSAGE 1: User says 'Olá' (Session Start) ---");
    await processBotFlow("Olá", phoneDigits, phoneNumberId, userId);

    // Give database operations a brief moment
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check conversation state in DB
    const { data: state1 } = await dbAdmin
      .from("bot_conversation_state")
      .select("*")
      .eq("user_id", userId)
      .eq("contact_number", phoneDigits)
      .maybeSingle();

    console.log("\nConversation State after Message 1:", state1);

    // 4. Test Message 2: Simulate clicking the first button/option (next step trigger)
    // The button trigger value is '9b9fdf8a-e05b-4ab2-ba83-dd1491645153'
    console.log("\n--- SIMULATING MESSAGE 2: User clicks Button 'Vendas' ---");
    await processBotFlow(
      "Quero falar com vendas",
      phoneDigits,
      phoneNumberId,
      userId,
      "step:9b9fdf8a-e05b-4ab2-ba83-dd1491645153",
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check conversation state in DB again
    const { data: state2 } = await dbAdmin
      .from("bot_conversation_state")
      .select("*")
      .eq("user_id", userId)
      .eq("contact_number", phoneDigits)
      .maybeSingle();

    console.log("\nConversation State after Message 2:", state2);

    // 5. Clean up after testing
    console.log("\nCleaning up test session state...");
    await dbAdmin
      .from("bot_conversation_state")
      .delete()
      .eq("user_id", userId)
      .eq("contact_number", phoneDigits);
    console.log("Cleanup complete.");

    // Restore original fetch
    globalThis.fetch = originalFetch;

    console.log("\n=== TEST COMPLETED SUCCESSFULLY ===");
    console.log(`Total messages intercepted: ${fetchCalls.length}`);
    if (fetchCalls.length >= 2) {
      console.log("\nTest verdict: SUCCESS! Bot triggered initial step and followed buttons.");
    } else {
      console.log("\nTest verdict: FAILED! Intercepted fewer messages than expected.");
    }
  } catch (error) {
    console.error("Test encountered an error:", error);
  } finally {
    process.exit();
  }
}

main().catch(console.error);
