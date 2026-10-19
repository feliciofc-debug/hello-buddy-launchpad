export type GestaoTrocaEspessuraPainelId =
  | "capo"
  | "teto"
  | "tampa_traseira"
  | "paralama_de"
  | "paralama_dd"
  | "porta_de"
  | "porta_dd"
  | "porta_te"
  | "porta_td"
  | "lateral_te"
  | "lateral_td";

export const GESTAO_TROCA_ESPESSURA_PAINEIS: { id: GestaoTrocaEspessuraPainelId; label: string }[] = [
  { id: "capo", label: "Capô" },
  { id: "teto", label: "Teto" },
  { id: "tampa_traseira", label: "Tampa traseira" },
  { id: "paralama_de", label: "Paralama DE" },
  { id: "paralama_dd", label: "Paralama DD" },
  { id: "porta_de", label: "Porta DE" },
  { id: "porta_dd", label: "Porta DD" },
  { id: "porta_te", label: "Porta TE" },
  { id: "porta_td", label: "Porta TD" },
  { id: "lateral_te", label: "Lateral TE" },
  { id: "lateral_td", label: "Lateral TD" },
];

export type GestaoTrocaEspessuraFaixas = {
  original_max: number;
  repintura_max: number;
};

export const DEFAULT_GESTAO_TROCA_ESPESSURA_FAIXAS: GestaoTrocaEspessuraFaixas = {
  original_max: 180,
  repintura_max: 300,
};

export function gestaoTrocaEspessuraFaixasFromConfig(row: Record<string, unknown> | null): GestaoTrocaEspessuraFaixas {
  const o = row ?? {};
  const original_max = Number(o.espessura_original_max ?? DEFAULT_GESTAO_TROCA_ESPESSURA_FAIXAS.original_max);
  const repintura_max = Number(o.espessura_repintura_max ?? DEFAULT_GESTAO_TROCA_ESPESSURA_FAIXAS.repintura_max);
  return {
    original_max: Number.isFinite(original_max) ? original_max : 180,
    repintura_max: Number.isFinite(repintura_max) ? repintura_max : 300,
  };
}

export type GestaoTrocaEspessuraClassificacao =
  | "original"
  | "repintura"
  | "massa"
  | "nao_medido";

export function classificarEspessuraUm(
  microns: number | null | undefined,
  faixas: GestaoTrocaEspessuraFaixas = DEFAULT_GESTAO_TROCA_ESPESSURA_FAIXAS,
): GestaoTrocaEspessuraClassificacao {
  if (microns == null || !Number.isFinite(microns) || microns <= 0) return "nao_medido";
  const v = Math.round(microns);
  if (v <= faixas.original_max) return "original";
  if (v <= faixas.repintura_max) return "repintura";
  return "massa";
}

export function parseGestaoTrocaEspessuraJson(raw: unknown): Partial<
  Record<GestaoTrocaEspessuraPainelId, number>
> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<Record<GestaoTrocaEspessuraPainelId, number>> = {};
  for (const { id } of GESTAO_TROCA_ESPESSURA_PAINEIS) {
    const v = o[id];
    if (v == null || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) out[id] = Math.round(n);
  }
  return out;
}

export function gestaoTrocaEspessuraClassificacaoLabel(
  cls: GestaoTrocaEspessuraClassificacao,
): { rotulo: string; cor: "verde" | "amarelo" | "vermelho" | "muted" } {
  switch (cls) {
    case "original":
      return { rotulo: "Original", cor: "verde" };
    case "repintura":
      return { rotulo: "Repintura provável", cor: "amarelo" };
    case "massa":
      return { rotulo: "Massa provável", cor: "vermelho" };
    default:
      return { rotulo: "Não medido", cor: "muted" };
  }
}

export function classificarEspessuraMap(
  valores: Partial<Record<GestaoTrocaEspessuraPainelId, number>>,
  faixas?: GestaoTrocaEspessuraFaixas,
): Record<GestaoTrocaEspessuraPainelId, GestaoTrocaEspessuraClassificacao> {
  const out = {} as Record<GestaoTrocaEspessuraPainelId, GestaoTrocaEspessuraClassificacao>;
  for (const { id } of GESTAO_TROCA_ESPESSURA_PAINEIS) {
    out[id] = classificarEspessuraUm(valores[id], faixas);
  }
  return out;
}

/** Painéis com medição ≥ repintura (útil para indício de colisão). */
export function gestaoTrocaEspessuraPainelsMassaOuRepintura(
  valores: Partial<Record<GestaoTrocaEspessuraPainelId, number>>,
  faixas?: GestaoTrocaEspessuraFaixas,
): GestaoTrocaEspessuraPainelId[] {
  const cls = classificarEspessuraMap(valores, faixas);
  return GESTAO_TROCA_ESPESSURA_PAINEIS.map((p) => p.id).filter((id) =>
    cls[id] === "repintura" || cls[id] === "massa"
  );
}
