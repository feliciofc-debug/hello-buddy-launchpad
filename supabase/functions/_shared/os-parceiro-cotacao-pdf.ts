import { PDFDocument, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1?target=deno";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import {
  buildGestaoOsCotacaoPdfLines,
  type GestaoOsCotacaoPdfInput,
} from "./gestao-os-cotacao-pdf.ts";
import { toMetaSafeImageUrl } from "./meta-media.ts";

export type GestaoOsPdfFoto = { url: string; legenda: string };

export function normalizeTextoPdfPortugues(raw: string): string {
  return raw
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/•/g, "-")
    .trim();
}

export async function buildGestaoOsCotacaoWhatsappPdfBytes(
  input: GestaoOsCotacaoPdfInput,
  assets: {
    logoUrl?: string | null;
    fotos?: GestaoOsPdfFoto[];
    log?: (message: string) => void;
  } = {},
): Promise<Uint8Array> {
  const lines = buildGestaoOsCotacaoPdfLines(input);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage();
  const margin = 42;
  const lineHeight = 14;
  const pageWidth = page.getWidth();
  let y = page.getHeight() - margin;
  const log = assets.log ?? console.warn;

  const winAnsi = (raw: string) => {
    const normalized = normalizeTextoPdfPortugues(raw);
    let result = "";
    for (const char of normalized) {
      try {
        font.encodeText(char);
        result += char;
      } catch {
        result += "?";
      }
    }
    return result || " ";
  };

  const nextPage = () => {
    page = pdf.addPage();
    y = page.getHeight() - margin;
  };

  const writeLine = (raw: string, bold = false, size = 10) => {
    const usedFont = bold ? boldFont : font;
    const words = winAnsi(raw).split(" ");
    const wrapped: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (
        current &&
        usedFont.widthOfTextAtSize(candidate, size) > pageWidth - margin * 2
      ) {
        wrapped.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) wrapped.push(current);
    for (const text of wrapped) {
      if (y < margin + lineHeight) nextPage();
      page.drawText(text, { x: margin, y, size, font: usedFont });
      y -= lineHeight;
    }
  };

  async function normalizedJpeg(url: string, label: string): Promise<{
    bytes: Uint8Array;
    width: number;
    height: number;
  } | null> {
    try {
      const safeUrl = toMetaSafeImageUrl(url) ?? url;
      const response = await fetch(safeUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const decoded = await Image.decode(new Uint8Array(await response.arrayBuffer()));
      const ratio = Math.min(1, 1600 / Math.max(decoded.width, decoded.height));
      if (ratio < 1) {
        decoded.resize(
          Math.max(1, Math.round(decoded.width * ratio)),
          Math.max(1, Math.round(decoded.height * ratio)),
        );
      }
      let jpeg = new Uint8Array(await decoded.encodeJPEG(76));
      // Orçamento por foto para manter até 12 imagens e PDF abaixo de 8 MB.
      if (jpeg.byteLength > 550_000) {
        const secondRatio = Math.min(1, 1100 / Math.max(decoded.width, decoded.height));
        if (secondRatio < 1) {
          decoded.resize(
            Math.max(1, Math.round(decoded.width * secondRatio)),
            Math.max(1, Math.round(decoded.height * secondRatio)),
          );
        }
        jpeg = new Uint8Array(await decoded.encodeJPEG(60));
      }
      return {
        bytes: jpeg,
        width: decoded.width,
        height: decoded.height,
      };
    } catch (error) {
      log(`${label}: foto ignorada (${(error as Error).message})`);
      return null;
    }
  }

  if (assets.logoUrl) {
    const logo = await normalizedJpeg(assets.logoUrl, "logo");
    if (logo) {
      const embedded = await pdf.embedJpg(logo.bytes);
      const scale = Math.min(110 / logo.width, 55 / logo.height, 1);
      page.drawImage(embedded, {
        x: margin,
        y: y - logo.height * scale,
        width: logo.width * scale,
        height: logo.height * scale,
      });
      y -= Math.max(logo.height * scale, 45) + 8;
    }
  }

  writeLine(`Pedido de cotação — OS #${input.osNumero}`, true, 15);
  y -= 4;
  for (const line of lines.slice(1)) {
    if (!line.trim()) {
      y -= lineHeight / 2;
      continue;
    }
    writeLine(line);
  }

  const fotos = (assets.fotos ?? []).slice(0, 12);
  if (fotos.length) {
    if (y < 160) nextPage();
    writeLine("Referência visual", true, 12);
    const cellWidth = (pageWidth - margin * 2 - 12) / 2;
    const cellHeight = 145;
    for (let index = 0; index < fotos.length; index += 2) {
      if (y < margin + cellHeight) nextPage();
      const row = fotos.slice(index, index + 2);
      await Promise.all(row.map(async (foto, col) => {
        const normalized = await normalizedJpeg(foto.url, foto.legenda);
        if (!normalized) return;
        const embedded = await pdf.embedJpg(normalized.bytes);
        const maxH = 112;
        const scale = Math.min(
          cellWidth / normalized.width,
          maxH / normalized.height,
        );
        const width = normalized.width * scale;
        const height = normalized.height * scale;
        const x = margin + col * (cellWidth + 12);
        page.drawImage(embedded, { x, y: y - height, width, height });
        page.drawText(winAnsi(foto.legenda).slice(0, 55), {
          x,
          y: y - maxH - 13,
          size: 8,
          font,
        });
      }));
      y -= cellHeight;
    }
  }

  const bytes = await pdf.save({ useObjectStreams: false });
  if (bytes.byteLength >= 8 * 1024 * 1024) {
    log(`PDF acima de 8 MB (${bytes.byteLength} bytes)`);
  }
  return bytes;
}
