import { PDFDocument, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1?target=deno";
import {
  buildGestaoOsCotacaoPdfLines,
  type GestaoOsCotacaoPdfInput,
} from "./gestao-os-cotacao-pdf.ts";

export async function buildGestaoOsCotacaoWhatsappPdfBytes(
  input: GestaoOsCotacaoPdfInput,
): Promise<Uint8Array> {
  const lines = buildGestaoOsCotacaoPdfLines(input);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage();
  const margin = 48;
  let y = page.getHeight() - margin;
  const lineHeight = 13;
  const maxChars = 92;

  const writeLine = (raw: string, bold = false) => {
    const text = raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxChars) || " ";
    if (y < margin + lineHeight) {
      page = pdf.addPage();
      y = page.getHeight() - margin;
    }
    page.drawText(text, { x: margin, y, size: bold ? 11 : 10, font });
    y -= lineHeight;
  };

  for (const [i, line] of lines.entries()) {
    if (!line.trim()) {
      y -= lineHeight / 2;
      continue;
    }
    writeLine(line, i === 0);
  }
  return pdf.save();
}
