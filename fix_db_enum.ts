import { query } from "./src/lib/db";

async function main() {
  console.log("Fixing invalid ENUM values...");

  try {
    const contacts = await query("SELECT DISTINCT channel FROM contacts");
    console.log("Distinct channels in contacts:", contacts);
    
    // Update any empty or invalid values to 'whatsapp' or 'messenger'
    await query("UPDATE contacts SET channel = 'whatsapp' WHERE channel NOT IN ('whatsapp', 'instagram', 'messenger') OR channel IS NULL OR channel = ''");
    
    const dms = await query("SELECT DISTINCT channel FROM direct_messages");
    console.log("Distinct channels in direct_messages:", dms);
    
    await query("UPDATE direct_messages SET channel = 'whatsapp' WHERE channel NOT IN ('whatsapp', 'instagram', 'messenger') OR channel IS NULL OR channel = ''");

  } catch (e: any) {
    console.error("Error updating invalid values:", e.message);
  }

  console.log("Starting DB migration for channel ENUM...");

  try {
    await query("ALTER TABLE contacts MODIFY COLUMN channel ENUM('whatsapp', 'instagram', 'messenger') NOT NULL DEFAULT 'whatsapp'");
    console.log("Updated contacts table.");
  } catch (e: any) {
    console.error("Error updating contacts:", e.message);
  }

  try {
    await query("ALTER TABLE direct_messages MODIFY COLUMN channel ENUM('whatsapp', 'instagram', 'messenger') NOT NULL DEFAULT 'whatsapp'");
    console.log("Updated direct_messages table.");
  } catch (e: any) {
    console.error("Error updating direct_messages:", e.message);
  }

  console.log("Done.");
  process.exit(0);
}

main();
