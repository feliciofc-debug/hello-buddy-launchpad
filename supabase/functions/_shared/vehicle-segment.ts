export type VeiculoSegmento = "carro" | "moto";

export const VEICULO_SEGMENTO_CARRO: VeiculoSegmento = "carro";
export const VEICULO_SEGMENTO_MOTO: VeiculoSegmento = "moto";

export const MOTO_ESTILO_VALUES = [
  "naked",
  "esportiva",
  "custom",
  "trail",
  "scooter",
  "touring",
  "street",
  "off_road",
] as const;

export type MotoEstilo = (typeof MOTO_ESTILO_VALUES)[number];

export function motoEstiloLabel(estilo: string): string {
  const map: Record<string, string> = {
    naked: "Naked",
    esportiva: "Esportiva",
    custom: "Custom",
    trail: "Trail / Big trail",
    scooter: "Scooter",
    touring: "Touring",
    street: "Street",
    off_road: "Off-road",
  };
  return map[estilo] ?? estilo;
}

export function partidaMotoLabel(v: string | null | undefined): string | null {
  if (v === "eletrica") return "Elétrica";
  if (v === "pedal") return "Pedal";
  return null;
}

export function refrigeracaoMotoLabel(v: string | null | undefined): string | null {
  if (v === "ar") return "Ar";
  if (v === "liquida") return "Líquida";
  return null;
}

/** Faixas de preço para vitrine de motos (R$). */
export type FaixaPrecoMotoId = "ate_50" | "50_120" | "acima_120";

const FAIXA_MOTO_ORDER: FaixaPrecoMotoId[] = ["ate_50", "50_120", "acima_120"];

export function faixaPrecoMotoLabel(faixa: FaixaPrecoMotoId): string {
  switch (faixa) {
    case "ate_50":
      return "Até R$ 50 mil";
    case "50_120":
      return "R$ 50–120 mil";
    case "acima_120":
      return "Acima de R$ 120 mil";
  }
}

export function classifyMotoPrecoFaixa(preco: number | null | undefined): FaixaPrecoMotoId | null {
  if (preco == null || !Number.isFinite(Number(preco))) return null;
  const p = Number(preco);
  if (p <= 50_000) return "ate_50";
  if (p <= 120_000) return "50_120";
  return "acima_120";
}

export function countMotosByFaixa(
  precos: Array<number | null | undefined>,
): Record<FaixaPrecoMotoId, number> {
  const out: Record<FaixaPrecoMotoId, number> = {
    ate_50: 0,
    "50_120": 0,
    acima_120: 0,
  };
  for (const preco of precos) {
    const faixa = classifyMotoPrecoFaixa(preco);
    if (faixa) out[faixa] += 1;
  }
  return out;
}

export function activeFaixasMotoFromCounts(
  counts: Record<FaixaPrecoMotoId, number>,
): FaixaPrecoMotoId[] {
  return FAIXA_MOTO_ORDER.filter((f) => counts[f] > 0);
}

export function normalizeVehicleSegment(raw: unknown): VeiculoSegmento {
  return raw === "moto" ? "moto" : "carro";
}

/** Linha curta para card/ficha de vitrine (sem portas/câmbio de carro). */
export function motoCardExtras(v: {
  cilindrada_cc?: number | null;
  estilo_moto?: string | null;
  partida?: string | null;
  refrigeracao?: string | null;
}): string[] {
  const out: string[] = [];
  if (v.cilindrada_cc != null && v.cilindrada_cc > 0) {
    out.push(`${v.cilindrada_cc} cc`);
  }
  if (v.estilo_moto) out.push(motoEstiloLabel(v.estilo_moto));
  const part = partidaMotoLabel(v.partida);
  if (part) out.push(part);
  const ref = refrigeracaoMotoLabel(v.refrigeracao);
  if (ref) out.push(ref);
  return out;
}
