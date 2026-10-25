import type { GestaoOsFotoRefRow } from "./gestao-os-fotos.ts";

export type GestaoOsFotoOrigem = "troca" | "anuncio" | "os";

export type GestaoOsFotoRefCompleta = GestaoOsFotoRefRow & {
  origem?: GestaoOsFotoOrigem;
};

export function gestaoOsFotoRefBucket(
  ref: Pick<GestaoOsFotoRefCompleta, "origem" | "storage_path">,
): "trocas" | "produtos" | "gestao-os-documentos" | "url" {
  const origem = ref.origem ?? "troca";
  if (origem === "anuncio") {
    return ref.storage_path.startsWith("http") ? "url" : "produtos";
  }
  if (origem === "os") return "gestao-os-documentos";
  return "trocas";
}

export function gestaoOsFotoLegenda(
  ref: GestaoOsFotoRefCompleta,
  trocaEtiqueta?: string,
): string {
  const origem = ref.origem ?? "troca";
  if (origem === "anuncio") return "Anúncio";
  if (origem === "os") return "Foto da OS";
  return trocaEtiqueta || "Avaliação troca";
}

/** Extrai storage path do bucket produtos a partir de URL pública Supabase. */
export function gestaoOsAnuncioPathFromPublicUrl(url: string): string | null {
  const marker = "/storage/v1/object/public/produtos/";
  const idx = url.indexOf(marker);
  if (idx >= 0) return decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
  const alt = "/produtos/";
  const i2 = url.indexOf(alt);
  if (i2 >= 0 && url.startsWith("http")) {
    return decodeURIComponent(url.slice(i2 + alt.length).split("?")[0]);
  }
  return null;
}

export function gestaoOsFotoOrdemExibicao(a: GestaoOsFotoRefCompleta, b: GestaoOsFotoRefCompleta): number {
  const peso = (o?: GestaoOsFotoOrigem) =>
    o === "troca" ? 0 : o === "anuncio" ? 1 : 2;
  const pa = peso(a.origem);
  const pb = peso(b.origem);
  if (pa !== pb) return pa - pb;
  if (a.troca_ia_item_id && !b.troca_ia_item_id) return -1;
  if (!a.troca_ia_item_id && b.troca_ia_item_id) return 1;
  if (a.selecionada !== b.selecionada) return a.selecionada ? -1 : 1;
  return a.ordem - b.ordem || a.storage_path.localeCompare(b.storage_path);
}
