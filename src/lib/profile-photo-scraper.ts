import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const REQUEST_TIMEOUT_MS = 8_000;

const CDN_DOMAIN = "pps.whatsapp.net";

/**
 * Cache LRU simples para evitar re-buscar fotos já consultadas.
 * Chave: número E164 (string), Valor: URL da foto ou null, TTL 1 hora.
 */
const cache = new Map<string, { url: string | null; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_SIZE = 500;

function setCache(key: string, url: string | null) {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, { url, expiresAt: Date.now() + CACHE_TTL_MS });
}

function getCache(key: string): string | null | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.url;
}

/**
 * Busca a URL da foto de perfil pública de um número WhatsApp.
 *
 * Faz uma requisição GET para https://wa.me/<numero> com headers de navegador real,
 * extrai a meta tag <meta property="og:image" content="..."> e valida se a URL
 * pertence ao CDN oficial do WhatsApp (pps.whatsapp.net).
 *
 * @param phone - Número internacional limpo (apenas dígitos, ex: 5511999999999)
 * @returns URL absoluta da foto ou null se não encontrada / restrição de privacidade
 */
export async function capturarFotoPerfilLead(phone: string): Promise<string | null> {
  if (!phone || !/^\d{10,15}$/.test(phone)) {
    return null;
  }

  const cached = getCache(phone);
  if (cached !== undefined) return cached;

  const url = `https://wa.me/${phone}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        DNT: "1",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!response.ok) {
      setCache(phone, null);
      return null;
    }

    const html = await response.text();
    if (!html || html.length < 100) {
      setCache(phone, null);
      return null;
    }

    const $ = cheerio.load(html);
    const ogImage = $('meta[property="og:image"]').attr("content") || null;

    if (!ogImage) {
      setCache(phone, null);
      return null;
    }

    try {
      const parsed = new URL(ogImage);
      if (!parsed.hostname.endsWith(CDN_DOMAIN)) {
        setCache(phone, null);
        return null;
      }
    } catch {
      setCache(phone, null);
      return null;
    }

    setCache(phone, ogImage);
    return ogImage;
  } catch {
    setCache(phone, null);
    return null;
  }
}
