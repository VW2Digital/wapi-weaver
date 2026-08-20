/**
 * webm-to-ogg.ts
 * Pure TypeScript transmuxer from WebM (Opus) to standard Ogg Opus (RFC 7845 / RFC 3533).
 * WhatsApp / Meta Cloud API requires audio voice notes to be in a valid Ogg Opus container.
 */

// Ogg CRC32 Lookup Table (Polynomial 0x04C11DB7)
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let r = i << 24;
  for (let j = 0; j < 8; j++) {
    r = (r & 0x80000000) ? ((r << 1) ^ 0x04c11db7) : (r << 1);
  }
  CRC_TABLE[i] = r >>> 0;
}

function oggCrc(buf: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < buf.length; i++) {
    crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ buf[i]) & 0xff]) >>> 0;
  }
  return crc >>> 0;
}

function createOggPage(
  headerType: number,
  granulePos: number,
  serialNo: number,
  pageSeq: number,
  packets: Uint8Array[]
): Uint8Array {
  const segmentTable: number[] = [];
  let payloadLength = 0;

  for (const pkt of packets) {
    let len = pkt.length;
    while (len >= 255) {
      segmentTable.push(255);
      len -= 255;
    }
    segmentTable.push(len);
    payloadLength += pkt.length;
  }

  const headerLength = 27 + segmentTable.length;
  const page = new Uint8Array(headerLength + payloadLength);
  const view = new DataView(page.buffer);

  // Capture pattern: 'OggS'
  page[0] = 0x4f; // 'O'
  page[1] = 0x67; // 'g'
  page[2] = 0x67; // 'g'
  page[3] = 0x53; // 'S'

  // Version: 0
  page[4] = 0;

  // Header type: 0x02 = BOS (beginning of stream), 0x04 = EOS (end of stream), 0x00 = standard
  page[5] = headerType;

  // Granule position (64-bit little endian)
  view.setBigUint64(6, BigInt(Math.max(0, Math.floor(granulePos))), true);

  // Serial number (32-bit little endian)
  view.setUint32(14, serialNo >>> 0, true);

  // Page sequence number (32-bit little endian)
  view.setUint32(18, pageSeq >>> 0, true);

  // CRC32 checksum at offset 22 (initialized to 0)
  view.setUint32(22, 0, true);

  // Page segments
  page[26] = segmentTable.length;
  for (let i = 0; i < segmentTable.length; i++) {
    page[27 + i] = segmentTable[i];
  }

  // Copy packet data
  let offset = headerLength;
  for (const pkt of packets) {
    page.set(pkt, offset);
    offset += pkt.length;
  }

  // Compute CRC32 over the entire page and write at offset 22
  const crc = oggCrc(page);
  view.setUint32(22, crc, true);

  return page;
}

/**
 * Creates standard 19-byte OpusHead packet (RFC 7845 Section 5.1)
 */
function createOpusHead(channels = 1, sampleRate = 48000): Uint8Array {
  const head = new Uint8Array(19);
  const view = new DataView(head.buffer);

  // Magic 'OpusHead'
  const magic = [0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64];
  head.set(magic, 0);

  head[8] = 1; // Version
  head[9] = channels; // Channel count
  view.setUint16(10, 0, true); // Pre-skip (0)
  view.setUint32(12, sampleRate, true); // Original sample rate (48000)
  view.setUint16(16, 0, true); // Output gain (0 dB)
  head[18] = 0; // Channel mapping family (0 = mono/stereo)

  return head;
}

/**
 * Creates standard OpusTags packet (RFC 7845 Section 5.2)
 */
function createOpusTags(): Uint8Array {
  const vendor = "WapiWeaver";
  const vendorBytes = new TextEncoder().encode(vendor);
  const totalLen = 8 + 4 + vendorBytes.length + 4; // Magic + vendor_length + vendor + user_comment_list_length
  const tags = new Uint8Array(totalLen);
  const view = new DataView(tags.buffer);

  // Magic 'OpusTags'
  const magic = [0x4f, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73];
  tags.set(magic, 0);

  view.setUint32(8, vendorBytes.length, true);
  tags.set(vendorBytes, 12);
  view.setUint32(12 + vendorBytes.length, 0, true); // 0 user comments

  return tags;
}

/**
 * Parses EBML Variable-Length Integer (VINT)
 */
function readVint(buf: Uint8Array, offset: number): { value: number; length: number } | null {
  if (offset >= buf.length) return null;
  const firstByte = buf[offset];
  if (firstByte === 0) return null;

  let mask = 0x80;
  let length = 1;
  while ((firstByte & mask) === 0 && length <= 8) {
    mask >>= 1;
    length++;
  }

  let value = firstByte & (mask - 1);
  for (let i = 1; i < length; i++) {
    if (offset + i >= buf.length) return null;
    value = (value * 256) + buf[offset + i];
  }

  return { value, length };
}

/**
 * Extracts raw Opus audio frames from a WebM ArrayBuffer
 */
function extractOpusFramesFromWebM(buffer: ArrayBuffer): { frames: Uint8Array[]; channels: number } {
  const bytes = new Uint8Array(buffer);
  const frames: Uint8Array[] = [];
  let channels = 1;

  let pos = 0;
  while (pos < bytes.length - 4) {
    // Check for SimpleBlock (0xA3) or Block (0xA1)
    if (bytes[pos] === 0xa3 || bytes[pos] === 0xa1) {
      const vint = readVint(bytes, pos + 1);
      if (vint && vint.value > 3 && pos + 1 + vint.length + vint.value <= bytes.length) {
        const blockStart = pos + 1 + vint.length;
        const blockEnd = blockStart + vint.value;

        // In SimpleBlock / Block:
        // Track number (VINT) + Timecode (2 bytes) + Flags (1 byte)
        const trackVint = readVint(bytes, blockStart);
        if (trackVint) {
          const headerSize = trackVint.length + 2 + 1; // track + timecode + flags
          const flags = bytes[blockStart + trackVint.length + 2];
          const payloadStart = blockStart + headerSize;

          if (payloadStart < blockEnd) {
            const lacing = (flags & 0x06) >> 1;
            if (lacing === 0) {
              // No lacing: single Opus frame
              frames.push(bytes.subarray(payloadStart, blockEnd));
            } else if (lacing === 1) {
              // Xiph lacing
              let ptr = payloadStart;
              if (ptr < blockEnd) {
                const numFrames = bytes[ptr++] + 1;
                const frameSizes: number[] = [];
                for (let f = 0; f < numFrames - 1; f++) {
                  let size = 0;
                  while (ptr < blockEnd && bytes[ptr] === 255) {
                    size += 255;
                    ptr++;
                  }
                  if (ptr < blockEnd) {
                    size += bytes[ptr++];
                  }
                  frameSizes.push(size);
                }
                for (let f = 0; f < frameSizes.length; f++) {
                  const sz = frameSizes[f];
                  if (ptr + sz <= blockEnd) {
                    frames.push(bytes.subarray(ptr, ptr + sz));
                    ptr += sz;
                  }
                }
                if (ptr < blockEnd) {
                  frames.push(bytes.subarray(ptr, blockEnd));
                }
              }
            } else {
              // Fixed / EBML lacing fallback
              frames.push(bytes.subarray(payloadStart, blockEnd));
            }
          }
        }
        pos = blockEnd;
        continue;
      }
    }

    // Check for Channels element ID (0x9F) inside TrackEntry
    if (bytes[pos] === 0x9f && pos + 2 < bytes.length) {
      const chLen = bytes[pos + 1];
      if (chLen === 1 && pos + 2 < bytes.length) {
        channels = bytes[pos + 2];
      }
    }

    pos++;
  }

  return { frames, channels: channels || 1 };
}

/**
 * Converts a WebM (Opus) Blob or ArrayBuffer to a true RFC 7845 compliant Ogg Opus Blob.
 * If the input is already an Ogg file, it returns it unchanged.
 */
export async function convertWebMToOggOpus(audioBlob: Blob): Promise<Blob> {
  const buffer = await audioBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // If already starts with 'OggS', it's already an Ogg file!
  if (bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return new Blob([buffer], { type: "audio/ogg; codecs=opus" });
  }

  const { frames, channels } = extractOpusFramesFromWebM(buffer);
  if (frames.length === 0) {
    // If no Opus frames could be extracted from WebM, fallback to original blob
    return audioBlob;
  }

  const serialNo = Math.floor(Math.random() * 0xffffffff);
  const oggPages: Uint8Array[] = [];

  // Page 0: OpusHead (BOS)
  const opusHead = createOpusHead(channels, 48000);
  oggPages.push(createOggPage(0x02, 0, serialNo, 0, [opusHead]));

  // Page 1: OpusTags
  const opusTags = createOpusTags();
  oggPages.push(createOggPage(0x00, 0, serialNo, 1, [opusTags]));

  // Consecutive Audio Pages: Group frames into pages with max 50 frames and max 200 segments
  let pageSeq = 2;
  let granulePos = 0;
  const SAMPLES_PER_FRAME = 960; // 20ms @ 48kHz is standard Opus default

  let currentBatch: Uint8Array[] = [];
  let currentBatchSegments = 0;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const frameSegments = Math.ceil(frame.length / 255) || 1;

    // Check if adding this frame would exceed page limit (200 segments or 40 frames)
    if (currentBatch.length >= 40 || (currentBatchSegments + frameSegments) > 200) {
      if (currentBatch.length > 0) {
        granulePos += currentBatch.length * SAMPLES_PER_FRAME;
        oggPages.push(createOggPage(0x00, granulePos, serialNo, pageSeq++, currentBatch));
        currentBatch = [];
        currentBatchSegments = 0;
      }
    }

    currentBatch.push(frame);
    currentBatchSegments += frameSegments;
  }

  // Final Page (EOS)
  if (currentBatch.length > 0) {
    granulePos += currentBatch.length * SAMPLES_PER_FRAME;
    oggPages.push(createOggPage(0x04, granulePos, serialNo, pageSeq++, currentBatch));
  }

  return new Blob(oggPages as BlobPart[], { type: "audio/ogg; codecs=opus" });
}
