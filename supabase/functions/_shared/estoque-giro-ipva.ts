import type { EstoqueGiroConfig } from "./estoque-giro-calc.ts";

export type GiroIpvaCategoria = "geral" | "hibrido" | "eletrico";
export type GiroIpvaAjusteTipo = "auto" | GiroIpvaCategoria | "isento" | "manual";

export type GiroIpvaClassificacaoAuto = {
  categoria: GiroIpvaCategoria;
  conferirDocumento: boolean;
};

export type GiroIpvaVeiculoAjuste = {
  ipvaTipo: GiroIpvaAjusteTipo;
  ipvaAliquotaManualPct: number | null;
};

export type GiroIpvaResolvido = {
  categoria: GiroIpvaCategoria | "isento" | "manual";
  aliquotaPct: number | null;
  rotulo: string;
  conferirDocumento: boolean;
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const HYBRID_VERSION_RE =
  /\b(hev|phev|mhev|hybrid|e-hybrid|hibrido)\b/;

export function classificarIpvaCombustivelAuto(input: {
  combustivel: string | null;
  versao: string | null;
  modelo: string | null;
}): GiroIpvaClassificacaoAuto {
  const comb = normalizeText(String(input.combustivel ?? ""));
  if (comb.includes("hibrid")) {
    return { categoria: "hibrido", conferirDocumento: false };
  }
  const combTemEletric = comb.includes("eletric");
  const combTemCombustivelConvencional =
    comb.includes("gasolina") ||
    comb.includes("alcool") ||
    comb.includes("etanol") ||
    comb.includes("flex") ||
    comb.includes("diesel");
  if (combTemEletric && combTemCombustivelConvencional) {
    return { categoria: "hibrido", conferirDocumento: false };
  }
  if (combTemEletric) {
    return { categoria: "eletrico", conferirDocumento: false };
  }

  const textoVersao = [input.versao, input.modelo].filter(Boolean).join(" ");
  const textoVersaoNorm = normalizeText(textoVersao);
  if (HYBRID_VERSION_RE.test(textoVersaoNorm)) {
    return { categoria: "hibrido", conferirDocumento: true };
  }

  return { categoria: "geral", conferirDocumento: false };
}

function aliquotaPorCategoria(
  categoria: GiroIpvaCategoria,
  config: Pick<
    EstoqueGiroConfig,
    "ipvaAliquotaPct" | "ipvaAliquotaHibridoPct" | "ipvaAliquotaEletricoPct"
  >,
): number | null {
  const geral = config.ipvaAliquotaPct;
  if (categoria === "geral") return geral;
  if (categoria === "hibrido") {
    return config.ipvaAliquotaHibridoPct ?? geral;
  }
  return config.ipvaAliquotaEletricoPct ?? geral;
}

function rotuloCategoria(categoria: GiroIpvaCategoria | "isento" | "manual"): string {
  switch (categoria) {
    case "geral":
      return "geral";
    case "hibrido":
      return "híbrido";
    case "eletrico":
      return "elétrico";
    case "isento":
      return "isento";
    case "manual":
      return "manual";
  }
}

export function resolverIpvaVeiculo(input: {
  ajuste: GiroIpvaVeiculoAjuste | null | undefined;
  combustivel: string | null;
  versao: string | null;
  modelo: string | null;
  config: Pick<
    EstoqueGiroConfig,
    "ipvaAliquotaPct" | "ipvaAliquotaHibridoPct" | "ipvaAliquotaEletricoPct"
  >;
}): GiroIpvaResolvido {
  const tipo = input.ajuste?.ipvaTipo ?? "auto";

  if (tipo === "isento") {
    return {
      categoria: "isento",
      aliquotaPct: 0,
      rotulo: rotuloCategoria("isento"),
      conferirDocumento: false,
    };
  }

  if (tipo === "manual") {
    const pct = input.ajuste?.ipvaAliquotaManualPct;
    return {
      categoria: "manual",
      aliquotaPct: pct == null ? null : pct,
      rotulo: rotuloCategoria("manual"),
      conferirDocumento: false,
    };
  }

  let categoria: GiroIpvaCategoria;
  let conferirDocumento = false;

  if (tipo === "auto") {
    const auto = classificarIpvaCombustivelAuto(input);
    categoria = auto.categoria;
    conferirDocumento = auto.conferirDocumento;
  } else {
    categoria = tipo;
  }

  return {
    categoria,
    aliquotaPct: aliquotaPorCategoria(categoria, input.config),
    rotulo: rotuloCategoria(categoria),
    conferirDocumento,
  };
}
