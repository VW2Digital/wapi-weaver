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

  it("extracts paragraph text from a DOCX zip", () => {
    const xml = Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?>
       <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
         <w:body><w:p><w:r><w:t>O plano Aurora-77 custa 890 reais por ano.</w:t></w:r></w:p></w:body>
       </w:document>`,
      "utf8",
    );
    const name = Buffer.from("word/document.xml", "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(xml.length, 18);
    local.writeUInt32LE(xml.length, 22);
    local.writeUInt16LE(name.length, 26);
    const docx = Buffer.concat([local, name, xml]);
    const out = extractTextFromUpload("contrato.docx", docx);
    expect(out.ok).toBe(true);
    expect(out.text).toMatch(/Aurora-77/);
    expect(out.text).toMatch(/890 reais/);
  });

  it("rejects a corrupt DOCX", () => {
    const out = extractTextFromUpload("quebrado.docx", Buffer.from("nao e um zip"));
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/DOCX/i);
  });
});
