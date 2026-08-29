#!/usr/bin/env node
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const [_, __, provider, baseUrl, publicId, appSecret] = process.argv;

if (!provider || !baseUrl || !publicId || !appSecret) {
  console.error("Usage: node send-webhook.mjs <whatsapp|instagram|messenger> <baseUrl> <publicId> <appSecret>");
  console.error("  appSecret must be a test secret explicitly provided for this script.");
  process.exit(1);
}

const payloadFile = path.join(__dirname, `${provider}-text.json`);
if (!fs.existsSync(payloadFile)) {
  console.error(`Payload file not found: ${payloadFile}`);
  process.exit(1);
}

const rawBody = fs.readFileSync(payloadFile, "utf8");
const signature = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
console.log(`[send-webhook] Using X-Hub-Signature-256: ${signature}`);

const url = `${baseUrl.replace(/\/$/, "")}/api/public/meta-webhook/${publicId}`;

console.log(`[send-webhook] POST ${url}`);

const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Hub-Signature-256": signature,
  },
  body: rawBody,
});

const body = await res.text();
console.log(`[send-webhook] Response: ${res.status} ${body}`);
