import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

export function isMp3(bytes: Uint8Array) {
  if (bytes.length < 4) return false;
  const hasId3Header = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
  const hasMpegFrameSync = bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
  return hasId3Header || hasMpegFrameSync;
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
