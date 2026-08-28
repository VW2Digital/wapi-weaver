import "dotenv/config";
import db from "../src/lib/db";

const userId = "6da65e93-4864-43c5-b17b-4c3864a49cfc";

const [rows] = await db.query("SELECT id FROM instagram_accounts WHERE user_id = ? LIMIT 1", [userId]);

if (rows?.[0]?.id) {
  await db.query(
    `UPDATE instagram_accounts SET
       page_id = ?,
       instagram_business_account_id = ?,
       ig_user_id = ?,
       username = ?,
       instagram_username = ?,
       access_token = ?,
       app_secret = COALESCE(?, app_secret),
       status = 'active',
       is_active = 1,
       webhook_subscribed = 1,
       updated_at = NOW()
     WHERE id = ?`,
    [
      "349476715907213",
      "17841402223701464",
      "17841402223701464",
      "vanderlei.mendes.ss",
      "vanderlei.mendes.ss",
      process.env.INSTAGRAM_TEMP_TOKEN,
      process.env.META_APP_SECRET,
      rows[0].id,
    ],
  );
  console.log("Conta vanderlei.mendes.ss atualizada.", rows[0].id);
} else {
  console.log("Nenhuma conta encontrada para atualizar.");
}

await db.end?.();
