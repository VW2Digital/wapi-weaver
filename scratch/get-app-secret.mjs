import { getMetaAppConnectionByPublicId } from "../src/lib/messaging/services/meta-app-connection.service.ts";

const conn = await getMetaAppConnectionByPublicId(process.argv[2]);
if (!conn) {
  console.error("Connection not found");
  process.exit(1);
}
console.log("APP_SECRET:", conn.appSecret);
