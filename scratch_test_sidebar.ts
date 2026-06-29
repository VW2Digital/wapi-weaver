import { executeQuery } from "./src/lib/query-compiler";

async function main() {
  try {
    const res = await executeQuery({
      table: "platform_settings",
      action: "insert",
      data: {
        id: 1,
        sidebar_order: JSON.stringify(["/dashboard", "/chat"]),
      },
      upsertConflict: true
    }, "acff3186-4e4a-4242-a7a5-3e519265b244", "admin");
    console.log("RESULT:", res);
  } catch (e) {
    console.error("ERROR running upsert:", e);
  }
  process.exit(0);
}
main();
