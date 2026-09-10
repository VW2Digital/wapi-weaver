import { describe, expect, it } from "@jest/globals";
import zlib from "zlib";
import { extractTextFromUpload } from "@/lib/ds-agent-knowledge.server";

describe("extractTextFromUpload", () => {
  it("indexes plain text files", () => {
    const buf = Buffer.from("Bliv CRM agenda reuniões na plataforma e qualifica leads via WhatsApp.", "utf8");
    const out = extractTextFromUpload("guia.txt", buf);
    expect(out.ok).toBe(true);
    expect(out.text).toMatch(/Bliv CRM/);
  });

  it("rejects empty pdf-like payload", () => {
    const out = extractTextFromUpload("vazio.pdf", Buffer.from("%PDF-1.4\n%%EOF"));
    expect(out.ok).toBe(false);
  });

  it("extracts text from flate-compressed PDF stream", () => {
    // Minimal PDF with one FlateDecode stream containing a BT...(Hello)...Tj ET block
    const streamContent = "BT /F1 12 Tf 100 700 Td (Reuniao Bliv CRM na Plataforma) Tj ET";
    const compressed = zlib.deflateSync(Buffer.from(streamContent, "latin1"));
    const pdf = Buffer.concat([
      Buffer.from(
        "%PDF-1.4\n1 0 obj<< /Length " +
          compressed.length +
          " /Filter /FlateDecode >>\nstream\n",
        "latin1",
      ),
      compressed,
      Buffer.from("\nendstream\nendobj\n%%EOF", "latin1"),
    ]);
    const out = extractTextFromUpload("doc.pdf", pdf);
    expect(out.ok).toBe(true);
    expect(out.text).toMatch(/Bliv CRM/);
  });
});
