import fs from "node:fs";
import { Readable } from "node:stream";
import { resolveMediaContentType } from "@/lib/media-content-type";

function peekFileBytes(fullPath: string, size: number) {
  if (size <= 0) return new Uint8Array();
  const length = Math.min(16, size);
  const buf = Buffer.alloc(length);
  const fd = fs.openSync(fullPath, "r");
  try {
    const read = fs.readSync(fd, buf, 0, length, 0);
    return buf.subarray(0, read);
  } finally {
    fs.closeSync(fd);
  }
}

function webStream(fullPath: string, start?: number, end?: number) {
  const stream = fs.createReadStream(fullPath, {
    start,
    end,
  });
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}

export function createUploadFileResponse(
  fullPath: string,
  request: Request,
  extraHeaders: Record<string, string> = {},
) {
  const stat = fs.statSync(fullPath);
  if (!stat.isFile()) {
    return new Response("File not found", { status: 404 });
  }

  const contentType = resolveMediaContentType({
    fileName: fullPath,
    bytes: peekFileBytes(fullPath, stat.size),
  });
  const commonHeaders: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...extraHeaders,
  };

  if (request.method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: {
        ...commonHeaders,
        "Content-Length": String(stat.size),
      },
    });
  }

  const range = request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match) {
      return new Response(null, {
        status: 416,
        headers: {
          ...commonHeaders,
          "Content-Range": `bytes */${stat.size}`,
        },
      });
    }

    const requestedStart = match[1] ? Number(match[1]) : undefined;
    const requestedEnd = match[2] ? Number(match[2]) : undefined;
    const start = requestedStart ?? Math.max(stat.size - (requestedEnd ?? 0), 0);
    const end =
      requestedStart === undefined
        ? stat.size - 1
        : Math.min(requestedEnd ?? stat.size - 1, stat.size - 1);

    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      start > end ||
      start >= stat.size
    ) {
      return new Response(null, {
        status: 416,
        headers: {
          ...commonHeaders,
          "Content-Range": `bytes */${stat.size}`,
        },
      });
    }

    const chunkSize = end - start + 1;
    return new Response(webStream(fullPath, start, end), {
      status: 206,
      headers: {
        ...commonHeaders,
        "Content-Length": String(chunkSize),
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      },
    });
  }

  return new Response(webStream(fullPath), {
    status: 200,
    headers: {
      ...commonHeaders,
      "Content-Length": String(stat.size),
    },
  });
}
