import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

export function isOggOpus(bytes: Uint8Array) {
  if (
    bytes.length < 32 ||
    bytes[0] !== 0x4f ||
    bytes[1] !== 0x67 ||
    bytes[2] !== 0x67 ||
    bytes[3] !== 0x53
  ) {
    return false;
  }
  return Buffer.from(bytes).includes(Buffer.from("OpusHead", "ascii"));
}

export async function transcodeAudioToOggOpus(bytes: Uint8Array): Promise<Uint8Array> {
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
      "libopus",
      "-ar",
      "48000",
      "-ac",
      "1",
      "-b:a",
      "32k",
      "-application",
      "voip",
      "-f",
      "ogg",
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
      if (!isOggOpus(converted)) {
        reject(new Error("A conversão não produziu um arquivo Ogg/Opus válido."));
        return;
      }
      resolve(converted);
    });
    child.stdin.end(Buffer.from(bytes));
  });
}
