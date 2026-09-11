// ============================================================
// IDENTIDADE DE SITE PARA O JARVIS (prospecção pelo WhatsApp)
// ------------------------------------------------------------
// Roda a MESMA Camada A da plataforma (HTML/CSS, sem IA, sem VPS):
// lê nome, tom de voz, cores e logo do site do prospect e devolve
// pronto para virar um vídeo naquela marca.
//
// Regras duras:
//  - nunca inventa cor: extração pobre = falha explícita, para o
//    agente perguntar as cores em vez de usar a paleta da AMZ;
//  - a identidade vale só para o pedido atual (nada é salvo no
//    cadastro do tenant, nada é reaproveitado no pedido seguinte);
//  - a logo do prospect é gravada como arquivo temporário dentro da
//    pasta do próprio usuário, sem virar a logo oficial da conta.
// ============================================================

import { lerIdentidadeDoSite } from "./site-identidade.ts";
import type { MotionProps } from "./video-motion.ts";

export type IdentidadeVideo = {
  url: string;
  marca: string;
  tomDeVoz: string;
  cores: MotionProps["cores"] | null;
  logoPath?: string;
  logoEncontrada: boolean;
  /** linha curta para o roteiro de aprovação */
  resumo: string;
  avisos: string[];
};

const SEM_MARCA = new Set([
  "instagram.com",
  "facebook.com",
  "tiktok.com",
  "linkedin.com",
  "youtube.com",
  "wa.me",
  "whatsapp.com",
  "google.com",
  "amzofertas.com.br",
  "lovable.app",
]);

/** Encontra a primeira URL/domínio de empresa citado na mensagem. */
export function extrairUrlDoTexto(texto: string): string | null {
  const t = String(texto ?? "");
  const re =
    /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9-]{1,62}(?:\.[a-z0-9-]{2,})*\.(?:com|com\.br|net|br|org|org\.br|io|app|shop|store|me|co)(?:\/[^\s,;]*)?)/gi;
  for (const m of t.matchAll(re)) {
    const bruto = m[1].replace(/[.,;)]+$/, "");
    let host = "";
    try {
      host = new URL(bruto.startsWith("http") ? bruto : `https://${bruto}`).hostname.replace(/^www\./, "")
        .toLowerCase();
    } catch {
      continue;
    }
    if (SEM_MARCA.has(host)) continue;
    if (/\.(png|jpe?g|webp|mp4|pdf)$/i.test(bruto)) continue;
    return bruto.startsWith("http") ? bruto : `https://${bruto}`;
  }
  return null;
}

const resumoPaleta = (c: MotionProps["cores"]) => `destaque ${c.destaque}, fundo ${c.bg}`;

/** Guarda a logo do prospect na pasta do usuário, só para esta peça. */
async function salvarLogoDoProspect(
  sb: any,
  userId: string,
  dataUrl: string,
): Promise<string | undefined> {
  try {
    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return undefined;
    const tipo = m[1];
    const ext = (tipo.split("/")[1] ?? "png").replace("svg+xml", "svg").replace(
      /^(x-icon|vnd\.microsoft\.icon)$/,
      "ico",
    );
    const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
    if (!bin.length || bin.length > 4_000_000) return undefined;
    // Namespace separado: uma logo temporária jamais pode ser confundida com
    // a logo oficial da conta apenas por estar dentro da pasta do usuário.
    const path = `${userId}/prospect/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from("tenant-logos").upload(path, bin, { contentType: tipo });
    if (error) throw error;
    return path;
  } catch (e) {
    console.warn("[identidade-jarvis][logo]", (e as Error)?.message);
    return undefined;
  }
}

/**
 * Lê o site e devolve a identidade pronta para o vídeo.
 * `cores: null` significa que o site NÃO entregou cor confiável —
 * quem chama deve perguntar as cores, nunca seguir com a paleta padrão.
 */
export async function identidadeDoSiteParaVideo(
  sb: any,
  userId: string,
  url: string,
): Promise<IdentidadeVideo> {
  const id = await lerIdentidadeDoSite(url);
  const coresOk = (id.cores_detectadas?.length ?? 0) >= 2 ? id.paleta : null;

  let logoPath: string | undefined;
  if (id.logo_data_url) logoPath = await salvarLogoDoProspect(sb, userId, id.logo_data_url);

  const marca = String(id.nome_empresa ?? "").trim();
  const partes = [
    marca ? `Marca: ${marca}` : "Marca: não identificada no site",
    coresOk ? `Paleta: ${resumoPaleta(coresOk)}` : "Paleta: não identificada",
    logoPath ? "Logo encontrada" : "Logo não encontrada",
  ];

  return {
    url: id.url,
    marca,
    tomDeVoz: String(id.tom_de_voz ?? "").trim(),
    cores: coresOk,
    logoPath,
    logoEncontrada: Boolean(logoPath),
    resumo: partes.join(" · "),
    avisos: id.avisos ?? [],
  };
}
