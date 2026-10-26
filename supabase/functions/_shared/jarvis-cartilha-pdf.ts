import {
  PDFDocument,
  rgb,
  StandardFonts,
} from "https://esm.sh/pdf-lib@1.17.1?target=deno";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import {
  JARVIS_AJUDA_CATALOGO,
  JARVIS_AJUDA_CATALOGO_VERSAO,
  JARVIS_AJUDA_SECOES,
} from "./jarvis-ajuda-catalogo.ts";
import { compositeImageOnWhiteBackground } from "./os-parceiro-cotacao-pdf.ts";
import {
  getTenantLogoForBackground,
  TENANT_LOGO_BUCKET,
} from "./tenant-logo.ts";

const DOCUMENTOS_BUCKET = "gestao-os-documentos";

function normalizarWinAnsi(
  raw: string,
  font: { encodeText: (value: string) => unknown },
): string {
  let out = "";
  for (
    const char of raw.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(
      /•/g,
      "-",
    )
  ) {
    try {
      font.encodeText(char);
      out += char;
    } catch {
      out += "?";
    }
  }
  return out;
}

export async function buildJarvisCartilhaPdfBytes(input: {
  lojaNome?: string | null;
  logoUrl?: string | null;
} = {}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 44;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const footer = () => {
    page.drawText(`Cartilha Jarvis · v${JARVIS_AJUDA_CATALOGO_VERSAO}`, {
      x: margin,
      y: 22,
      size: 8,
      font,
      color: rgb(0.42, 0.45, 0.5),
    });
  };
  const newPage = () => {
    footer();
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };
  const write = (
    raw: string,
    options: {
      size?: number;
      isBold?: boolean;
      color?: ReturnType<typeof rgb>;
      indent?: number;
      gap?: number;
    } = {},
  ) => {
    const size = options.size ?? 10;
    const used = options.isBold ? bold : font;
    const indent = options.indent ?? 0;
    const width = pageWidth - margin * 2 - indent;
    const words = normalizarWinAnsi(raw, used).split(/\s+/);
    let line = "";
    const lines: string[] = [];
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && used.widthOfTextAtSize(candidate, size) > width) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    if (line) lines.push(line);
    for (const value of lines) {
      if (y < 48) newPage();
      page.drawText(value, {
        x: margin + indent,
        y,
        size,
        font: used,
        color: options.color ?? rgb(0.12, 0.14, 0.18),
      });
      y -= size + 4;
    }
    y -= options.gap ?? 0;
  };

  if (input.logoUrl) {
    try {
      const response = await fetch(input.logoUrl);
      if (response.ok) {
        const decoded = await Image.decode(
          new Uint8Array(await response.arrayBuffer()),
        );
        const white = compositeImageOnWhiteBackground(decoded);
        const bytes = new Uint8Array(await white.encodeJPEG(82));
        const image = await pdf.embedJpg(bytes);
        const scale = Math.min(170 / white.width, 90 / white.height, 1);
        page.drawImage(image, {
          x: (pageWidth - white.width * scale) / 2,
          y: y - white.height * scale,
          width: white.width * scale,
          height: white.height * scale,
        });
        y -= white.height * scale + 44;
      }
    } catch (error) {
      console.warn(
        "[jarvis-cartilha-pdf] logo ignorada",
        (error as Error).message,
      );
    }
  } else y -= 80;

  write("COMO PEDIR AO JARVIS", {
    size: 25,
    isBold: true,
    color: rgb(0.08, 0.31, 0.45),
    gap: 14,
  });
  write(input.lojaNome?.trim() || "Guia de comandos da sua loja", {
    size: 15,
    isBold: true,
    gap: 18,
  });
  write(
    "Use estas frases pelo WhatsApp. O Jarvis confirma antes de salvar ações importantes.",
    { size: 12, color: rgb(0.34, 0.37, 0.42), gap: 18 },
  );
  write(
    "Esta cartilha é gerada pelo mesmo catálogo validado pelos comandos do Jarvis.",
    {
      size: 10,
      color: rgb(0.34, 0.37, 0.42),
    },
  );

  for (const secao of JARVIS_AJUDA_SECOES) {
    newPage();
    write(secao.toUpperCase(), {
      size: 18,
      isBold: true,
      color: rgb(0.08, 0.31, 0.45),
      gap: 14,
    });
    for (const item of JARVIS_AJUDA_CATALOGO.filter((x) => x.secao === secao)) {
      if (y < 130) {
        newPage();
        write(`${secao.toUpperCase()} (continuação)`, {
          size: 16,
          isBold: true,
          color: rgb(0.08, 0.31, 0.45),
          gap: 12,
        });
      }
      write(item.titulo, { size: 12, isBold: true, gap: 2 });
      for (const frase of item.comoPedir) {
        write(`"${frase}"`, {
          size: 10,
          isBold: true,
          color: rgb(0.08, 0.31, 0.45),
          indent: 10,
        });
      }
      write(item.oQueAcontece, {
        size: 9,
        color: rgb(0.34, 0.37, 0.42),
        indent: 10,
        gap: 10,
      });
    }
  }
  footer();
  return await pdf.save({ useObjectStreams: false });
}

export async function ensureJarvisCartilhaPdf(
  sb: any,
  userId: string,
): Promise<{ url: string; path: string; reused: boolean }> {
  const path = `${userId}/cartilha/v${JARVIS_AJUDA_CATALOGO_VERSAO}.pdf`;
  const storage = sb.storage.from(DOCUMENTOS_BUCKET);
  const existing = await storage.createSignedUrl(path, 600);
  if (!existing.error && existing.data?.signedUrl) {
    return { url: existing.data.signedUrl, path, reused: true };
  }

  const [{ data: empresa }, logo] = await Promise.all([
    sb.from("empresa_config").select("nome_empresa").eq("user_id", userId)
      .maybeSingle(),
    getTenantLogoForBackground(sb, userId, "light"),
  ]);
  let logoUrl: string | null = null;
  if (logo) {
    const signed = await sb.storage.from(TENANT_LOGO_BUCKET)
      .createSignedUrl(logo.storage_path, 600);
    logoUrl = signed.data?.signedUrl ?? null;
  }
  const bytes = await buildJarvisCartilhaPdfBytes({
    lojaNome: empresa?.nome_empresa,
    logoUrl,
  });
  const uploaded = await storage.upload(path, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (
    uploaded.error && !/already exists|duplicate/i.test(uploaded.error.message)
  ) {
    throw new Error(`Falha ao salvar cartilha: ${uploaded.error.message}`);
  }
  const signed = await storage.createSignedUrl(path, 600);
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(
      `Falha ao assinar cartilha: ${signed.error?.message ?? "URL ausente"}`,
    );
  }
  return { url: signed.data.signedUrl, path, reused: false };
}
