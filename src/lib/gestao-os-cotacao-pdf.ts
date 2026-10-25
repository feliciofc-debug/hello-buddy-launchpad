import { jsPDF } from "jspdf";
import {
  buildGestaoOsCotacaoPdfLines,
  type GestaoOsCotacaoPdfInput,
} from "../../supabase/functions/_shared/gestao-os-cotacao-pdf.ts";

export type { GestaoOsCotacaoPdfInput };
export {
  buildGestaoOsCotacaoPdfLines,
  gestaoOsPdfContemCustosInternos,
  podeEscolherCotacaoOs,
} from "../../supabase/functions/_shared/gestao-os-cotacao-pdf.ts";

async function loadImageDataUrl(url: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = dataUrl;
    });
    return { dataUrl, w: img.width, h: img.height };
  } catch {
    return null;
  }
}

export async function buildGestaoOsCotacaoPdfBlob(
  input: GestaoOsCotacaoPdfInput,
  opts?: { logoDataUrl?: string | null; fotoUrls?: string[] },
): Promise<Blob> {
  const doc = new jsPDF();
  let y = 16;
  const line = (t: string, bold = false) => {
    if (y > 270) {
      doc.addPage();
      y = 16;
    }
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(10);
    const wrapped = doc.splitTextToSize(t, 180);
    doc.text(wrapped, 14, y);
    y += wrapped.length * 5 + 2;
  };

  if (opts?.logoDataUrl) {
    try {
      doc.addImage(opts.logoDataUrl, "PNG", 14, 8, 28, 14);
      y = 26;
    } catch {
      /* ignore logo */
    }
  }

  const linhas = buildGestaoOsCotacaoPdfLines(input);
  for (const [i, txt] of linhas.entries()) {
    line(txt, i === 0);
  }

  if (opts?.fotoUrls?.length) {
    line("Referência visual:", true);
    for (const url of opts.fotoUrls.slice(0, 6)) {
      const img = await loadImageDataUrl(url);
      if (!img) continue;
      if (y > 200) {
        doc.addPage();
        y = 16;
      }
      const maxW = 85;
      const maxH = 55;
      const ratio = Math.min(maxW / img.w, maxH / img.h, 1);
      const w = img.w * ratio;
      const h = img.h * ratio;
      doc.addImage(img.dataUrl, "JPEG", 14, y, w, h);
      y += h + 8;
    }
  }

  return doc.output("blob");
}
