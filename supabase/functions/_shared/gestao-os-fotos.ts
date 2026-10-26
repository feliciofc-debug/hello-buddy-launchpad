import {
  gestaoTrocaFotoIsCrlv,
  type GestaoTrocaFotoEntry,
} from "./gestao-troca-fotos.ts";

export type GestaoOsFotoOrigem = "troca" | "anuncio" | "os";

export type GestaoOsFotoRefRow = {
  id: string;
  storage_path: string;
  selecionada: boolean;
  ordem: number;
  troca_ia_item_id: string | null;
  origem?: GestaoOsFotoOrigem;
  legenda?: string | null;
};

export function gestaoOsFotosVisiveis(
  refs: GestaoOsFotoRefRow[],
  trocaFotos: GestaoTrocaFotoEntry[],
): GestaoOsFotoRefRow[] {
  const etiquetaPorPath = new Map(
    trocaFotos.map((f) => [f.path, f.etiqueta] as const),
  );
  return refs.filter((ref) => {
    if ((ref.origem ?? "troca") !== "troca") return true;
    return !gestaoTrocaFotoIsCrlv({
      etiqueta: etiquetaPorPath.get(ref.storage_path) ?? "",
    });
  });
}

/** Defeitos do laudo (com item IA) primeiro; depois selecionadas. */
/** Fotos selecionadas para PDF, sem CRLV/documento. */
export function gestaoOsFotosParaPdf(
  refs: GestaoOsFotoRefRow[],
  trocaFotos: GestaoTrocaFotoEntry[],
): GestaoOsFotoRefRow[] {
  return gestaoOsFotosVisiveis(
    refs.filter((r) => r.selecionada),
    trocaFotos,
  );
}

export function gestaoOsOrdenarFotosDefeitoPrimeiro(
  refs: GestaoOsFotoRefRow[],
): GestaoOsFotoRefRow[] {
  return [...refs].sort((a, b) => {
    const peso = (o?: GestaoOsFotoOrigem) =>
      (o ?? "troca") === "troca" ? 0 : o === "anuncio" ? 1 : 2;
    const po = peso(a.origem) - peso(b.origem);
    if (po !== 0) return po;
    const aDef = a.troca_ia_item_id ? 0 : 1;
    const bDef = b.troca_ia_item_id ? 0 : 1;
    if (aDef !== bDef) return aDef - bDef;
    if (a.selecionada !== b.selecionada) return a.selecionada ? -1 : 1;
    return a.ordem - b.ordem || a.storage_path.localeCompare(b.storage_path);
  });
}
