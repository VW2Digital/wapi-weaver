import { startOmnichannelNextWhatsAppWorker } from "@/lib/omnichannel-next/bridges/start-whatsapp-next-worker";

process.on("SIGINT", async () => {
  await worker.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await worker.stop();
  process.exit(0);
});

const worker = startOmnichannelNextWhatsAppWorker();

console.log("[start-whatsapp-next-worker] running");
