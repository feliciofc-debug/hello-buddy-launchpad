import type { ConsultarPlacaCallResult } from "./consultar-placa-client.ts";

export type ProcedenciaResumoJson = {
  leilao: { possui: boolean; classificacao: string | null; parecer: string | null };
  perda_total: { possui: boolean; registro: string | null };
  roubo_furto: { possui: boolean; qtd: number; ultima_data: string | null; uf: string | null };
  gravame: {
    possui: boolean;
    situacao: string | null;
    agente_financeiro_nome: string | null;
  };
  renajud: { possui: boolean; tipos_restricao: string[] };
  veiculo: {
    marca: string | null;
    modelo: string | null;
    ano_fabricacao: number | null;
    ano_modelo: number | null;
    cor: string | null;
  };
  saldo_apos: number | null;
};

const PII_KEYS = /\b(cpf|cnpj|nome_proprietario|proprietario|documento|pessoa)\b/i;

function deepOmitPii(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(deepOmitPii);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (PII_KEYS.test(k)) continue;
    out[k] = deepOmitPii(v);
  }
  return out;
}

function pickPayloadData(payload: Record<string, unknown> | null): Record<string, unknown> {
  if (!payload) return {};
  const cleaned = deepOmitPii(payload) as Record<string, unknown>;
  const inner = cleaned.dados ?? cleaned.data ?? cleaned.resultado ?? cleaned;
  return typeof inner === "object" && inner != null && !Array.isArray(inner)
    ? inner as Record<string, unknown>
    : cleaned;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function boolFrom(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (typeof v === "string") {
    const t = v.toLowerCase();
    if (t === "sim" || t === "true" || t === "s" || t === "1" || t === "consta") return true;
  }
  return false;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseEndpointErro(r: ConsultarPlacaCallResult): string | null {
  if (r.ok) return null;
  if (r.indisponivel || r.tipoErro === "servico_indisponivel") return "servico_indisponivel";
  if (r.httpStatus === 402 || r.tipoErro === "credito_insuficiente") return "credito_insuficiente";
  if (r.tipoErro === "placa_nao_encontrada") return "placa_nao_encontrada";
  return r.tipoErro ?? "erro";
}

export function buildProcedenciaResumo(
  results: Record<string, ConsultarPlacaCallResult>,
  saldoApos: number | null,
): ProcedenciaResumoJson {
  const leilaoD = pickPayloadData(results.consultarRegistroLeilaoPrime?.payload ?? null);
  const perdaD = pickPayloadData(results.consultarSinistroComPerdaTotal?.payload ?? null);
  const rouboD = pickPayloadData(results.consultarHistoricoRouboFurto?.payload ?? null);
  const gravD = pickPayloadData(results.consultarGravame?.payload ?? null);
  const renD = pickPayloadData(results.consultarRenajud?.payload ?? null);
  const placaD = pickPayloadData(results.consultarPlaca?.payload ?? null);

  const leilaoPossui = boolFrom(leilaoD.possui ?? leilaoD.registro ?? leilaoD.consta);
  const perdaPossui = boolFrom(perdaD.possui ?? perdaD.perda_total ?? perdaD.consta);
  const rouboPossui = boolFrom(rouboD.possui ?? rouboD.historico ?? rouboD.consta);
  const gravPossui = boolFrom(gravD.possui ?? gravD.gravame ?? gravD.ativo);
  const renPossui = boolFrom(renD.possui ?? renD.restricao ?? renD.consta);

  let tiposRen: string[] = [];
  const rawTipos = renD.tipos_restricao ?? renD.tipos ?? renD.restricoes;
  if (Array.isArray(rawTipos)) {
    tiposRen = rawTipos.map((x) => String(x)).filter(Boolean);
  } else if (str(rawTipos)) {
    tiposRen = [String(rawTipos)];
  }

  const qtdRoubo = num(rouboD.qtd ?? rouboD.quantidade) ?? (rouboPossui ? 1 : 0);

  return {
    leilao: {
      possui: leilaoPossui,
      classificacao: str(leilaoD.classificacao ?? leilaoD.classificacao_leilao),
      parecer: str(leilaoD.parecer ?? leilaoD.parecer_tecnico),
    },
    perda_total: {
      possui: perdaPossui,
      registro: str(perdaD.registro ?? perdaD.descricao),
    },
    roubo_furto: {
      possui: rouboPossui,
      qtd: qtdRoubo,
      ultima_data: str(rouboD.ultima_data ?? rouboD.data_ultima ?? rouboD.ultimo_registro),
      uf: str(rouboD.uf ?? rouboD.estado),
    },
    gravame: {
      possui: gravPossui,
      situacao: str(gravD.situacao ?? gravD.status),
      agente_financeiro_nome: str(
        gravD.agente_financeiro_nome ?? gravD.financeira ?? gravD.instituicao,
      ),
    },
    renajud: {
      possui: renPossui,
      tipos_restricao: tiposRen,
    },
    veiculo: {
      marca: str(placaD.marca ?? placaD.marca_modelo?.toString().split("/")[0]),
      modelo: str(placaD.modelo ?? placaD.marca_modelo?.toString().split("/")[1]),
      ano_fabricacao: num(placaD.ano_fabricacao ?? placaD.anoFabricacao),
      ano_modelo: num(placaD.ano_modelo ?? placaD.anoModelo),
      cor: str(placaD.cor),
    },
    saldo_apos: saldoApos,
  };
}

export function mergeVeiculoFromPlaca(
  resumo: ProcedenciaResumoJson,
  placaResult: ConsultarPlacaCallResult | undefined,
): ProcedenciaResumoJson {
  if (!placaResult?.payload) return resumo;
  const built = buildProcedenciaResumo({ consultarPlaca: placaResult }, resumo.saldo_apos);
  return {
    ...resumo,
    veiculo: {
      marca: built.veiculo.marca ?? resumo.veiculo.marca,
      modelo: built.veiculo.modelo ?? resumo.veiculo.modelo,
      ano_fabricacao: built.veiculo.ano_fabricacao ?? resumo.veiculo.ano_fabricacao,
      ano_modelo: built.veiculo.ano_modelo ?? resumo.veiculo.ano_modelo,
      cor: built.veiculo.cor ?? resumo.veiculo.cor,
    },
  };
}
