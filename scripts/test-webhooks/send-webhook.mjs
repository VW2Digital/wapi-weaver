#!/usr/bin/env node
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const [_, __, provider, baseUrl] = process.argv;

if (!provider || !baseUrl) {
  console.error("Usage: node send-webhook.mjs <whatsapp|instagram|messenger> <baseUrl>");
  process.exit(1);
}

const payloadFile = path.join(__dirname, `${provider}-text.json`);
if (!fs.existsSync(payloadFile)) {
  console.error(`Payload file not found: ${payloadFile}`);
  process.exit(1);
}

const rawBody = fs.readFileSync(payloadFile, "utf8");
const appSecret = process.env.META_APP_SECRET;

let signature = "";
if (appSecret) {
  signature = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  console.log(`[send-webhook] Using X-Hub-Signature-256: ${signature}`);
} else {
  console.warn("[send-webhook] META_APP_SECRET not set. The server may reject this request if it requires signature validation.");
}

const routeMap = {
  whatsapp: "/api/public/whatsapp-webhook",
  instagram: "/api/public/instagram-webhook",
  messenger: "/api/public/facebook-webhook",
};

const url = `${baseUrl.replace(/\/$/, "")}${routeMap[provider]}`;

console.log(`[send-webhook] POST ${url}`);

const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(signature ? { "X-Hub-Signature-256": signature } : {}),
  },
  body: rawBody,
});

const body = await res.text();
console.log(`[send-webhook] Response: ${res.status} ${body}`);
