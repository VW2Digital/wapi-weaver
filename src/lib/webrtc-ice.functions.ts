import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/integrations/mysql/auth-middleware";

export type CallIceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

const GOOGLE_STUN: CallIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

function turnUrlsFromEnv(): string[] {
  const explicit = String(process.env.TURN_URLS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (explicit.length) return explicit;
  try {
    const host = new URL(String(process.env.APP_URL || "")).hostname;
    if (!host) return [];
    return [`turn:${host}:3478?transport=udp`, `turn:${host}:3478?transport=tcp`];
  } catch {
    return [];
  }
}

export const getWebRtcIceServers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const username = String(process.env.TURN_USERNAME || "").trim();
    const credential = String(process.env.TURN_CREDENTIAL || "").trim();
    const turnUrls = turnUrlsFromEnv();
    const iceServers: CallIceServer[] = [...GOOGLE_STUN];
    const turnEnabled = Boolean(username && credential && turnUrls.length);
    if (turnEnabled) {
      iceServers.push({
        urls: turnUrls,
        username,
        credential,
      });
    }
    return { iceServers, turnEnabled };
  });
