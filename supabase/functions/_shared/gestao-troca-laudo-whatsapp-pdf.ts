import { PDFDocument, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1?target=deno";

/** PDF textual mínimo para envio do laudo no WhatsApp (somente leitura). */
export async function buildGestaoTrocaLaudoWhatsappPdfBytes(
  lines: string[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage();
  const margin = 48;
  let y = page.getHeight() - margin;
  const lineHeight = 13;
  const maxChars = 92;

  const writeLine = (raw: string) => {
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
    page.drawText(text, { x: margin, y, size: 10, font });
    y -= lineHeight;
  };

  for (const line of lines) {
    if (!line.trim()) {
      y -= lineHeight / 2;
      continue;
    }
    writeLine(line);
  }

  return pdf.save();
}
