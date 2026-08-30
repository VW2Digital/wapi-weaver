import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

export function isMp3(bytes: Uint8Array) {
  if (bytes.length < 4) return false;
  const hasId3Header = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
  const hasMpegFrameSync = bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
  return hasId3Header || hasMpegFrameSync;
}

export function isOggOpus(bytes: Uint8Array): boolean {
  if (bytes.length < 36) return false;
  const isOgg = bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53;
  if (!isOgg) return false;
  // Procura pelo header mágico 'OpusHead' nos primeiros 100 bytes
  const limit = Math.min(bytes.length - 8, 100);
  for (let i = 0; i < limit; i++) {
    if (
      bytes[i] === 0x4f &&
      bytes[i + 1] === 0x70 &&
      bytes[i + 2] === 0x75 &&
      bytes[i + 3] === 0x73 &&
      bytes[i + 4] === 0x48 &&
      bytes[i + 5] === 0x65 &&
      bytes[i + 6] === 0x61 &&
      bytes[i + 7] === 0x64
    ) {
      return true;
    }
  }
  return false;
}

function isM4a(bytes: Uint8Array) {
  if (bytes.length < 8) return false;
  // ftyp box at offset 4
  return (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  );
}

export async function transcodeAudioToM4a(bytes: Uint8Array): Promise<Uint8Array> {
  const executable = ffmpegPath;
  if (!executable) throw new Error("FFmpeg não está disponível para converter o áudio em M4A.");

  return new Promise((resolve, reject) => {
    const child = spawn(executable, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      "pipe:0",
      "-map",
      "0:a:0",
      "-vn",
      "-c:a",
      "aac",
      "-b:a",
      "64k",
      "-ar",
      "44100",
      "-ac",
      "1",
      "-f",
      "mp4",
      "pipe:1",
    ]);
    const output: Buffer[] = [];
    const errors: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => output.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
    child.on("error", reject);
    child.on("close", (code: number | null) => {
      if (code !== 0) {
        reject(
          new Error(
            `Falha ao converter áudio: ${Buffer.concat(errors).toString("utf8").trim()}`,
          ),
        );
        return;
      }
      const converted = new Uint8Array(Buffer.concat(output));
      if (!isM4a(converted)) {
        reject(new Error("A conversão não produziu um arquivo M4A válido."));
        return;
      }
      resolve(converted);
    });
    child.stdin.end(Buffer.from(bytes));
  });
}

export async function transcodeAudioToOggOpus(bytes: Uint8Array): Promise<Uint8Array> {
  const executable = ffmpegPath;
  if (!executable) {
    throw new Error("[VOICE] FFmpeg não está disponível para converter o áudio em Ogg/Opus.");
  }

  return new Promise((resolve, reject) => {
    const child = spawn(
      executable,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        "pipe:0",
        "-map",
        "0:a:0",
        "-vn",
        "-c:a",
        "libopus",
        "-b:a",
        "64k",
        "-ar",
        "48000",
        "-ac",
        "1",
        "-application",
        "voip",
        "-map_metadata",
        "-1",
        "-f",
        "ogg",
        "pipe:1",
      ],
      {
        timeout: 60000,
      },
    );

    const output: Buffer[] = [];
    const errors: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => output.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code: number | null) => {
      if (code !== 0) {
        const errorMsg = Buffer.concat(errors).toString("utf8").trim();
        reject(new Error(`[VOICE] Falha ao converter áudio em Ogg/Opus: ${errorMsg || "código " + code}`));
        return;
      }

      const converted = new Uint8Array(Buffer.concat(output));
      if (!isOggOpus(converted)) {
        reject(new Error("[VOICE] A conversão não produziu um container OGG/Opus válido."));
        return;
      }

      resolve(converted);
    });

    child.stdin.end(Buffer.from(bytes));
  });
}

export async function transcodeAudioToMp3(bytes: Uint8Array): Promise<Uint8Array> {
  const executable = ffmpegPath;
  if (!executable) throw new Error("FFmpeg não está disponível para converter o áudio.");

  return new Promise((resolve, reject) => {
    const child = spawn(executable, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      "pipe:0",
      "-map",
      "0:a:0",
      "-vn",
      "-acodec",
      "libmp3lame",
      "-ar",
      "44100",
      "-ac",
      "1",
      "-b:a",
      "64k",
      "-f",
      "mp3",
      "pipe:1",
    ]);
    const output: Buffer[] = [];
    const errors: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => output.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
    child.on("error", reject);
    child.on("close", (code: number | null) => {
      if (code !== 0) {
        reject(
          new Error(
            `Falha ao converter áudio: ${Buffer.concat(errors).toString("utf8").trim()}`,
          ),
        );
        return;
      }
      const converted = new Uint8Array(Buffer.concat(output));
      if (!isMp3(converted)) {
        reject(new Error("A conversão não produziu um arquivo MP3 válido."));
        return;
      }
      resolve(converted);
    });
    child.stdin.end(Buffer.from(bytes));
  });
}
