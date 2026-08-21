import { describe, expect, test } from "@jest/globals";
import {
  isOggOpus,
  transcodeAudioToOggOpus,
} from "../../src/lib/audio-transcode.server";

function createPcmWav() {
  const sampleRate = 8000;
  const sampleCount = 800;
  const dataSize = sampleCount * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write("RIFF", 0, "ascii");
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVEfmt ", 8, "ascii");
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36, "ascii");
  wav.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = Math.round(Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 8000);
    wav.writeInt16LE(sample, 44 + index * 2);
  }
  return new Uint8Array(wav);
}

describe("transcodeAudioToOggOpus", () => {
  test("não aceita um arquivo apenas com assinatura OggS", () => {
    expect(isOggOpus(new Uint8Array([0x4f, 0x67, 0x67, 0x53, ...new Array(40).fill(0)]))).toBe(
      false,
    );
  });

  test("gera contêiner Ogg com stream Opus verificável", async () => {
    const converted = await transcodeAudioToOggOpus(createPcmWav());
    expect(isOggOpus(converted)).toBe(true);
    expect(Buffer.from(converted).includes(Buffer.from("OpusHead", "ascii"))).toBe(true);
  });
});
