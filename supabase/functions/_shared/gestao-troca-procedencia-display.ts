import { CONSULTAR_PLACA_TESTE } from "./consultar-placa-client.ts";
import type { ProcedenciaResumoJson } from "./consultar-placa-parse.ts";

export type GestaoTrocaProcedenciaLinha = {
  icon: "ok" | "warn";
  label: string;
  detail: string;
};

export type GestaoTrocaProcedenciaLaudo = {
  consultada: boolean;
  emProcessamento: boolean;
  indisponivel: boolean;
  placaTeste: boolean;
  consultadoEm: string | null;
  placa: string | null;
  linhas: GestaoTrocaProcedenciaLinha[];
  veiculoResumo: string | null;
  divergenciaFicha: string | null;
};

function normToken(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokensMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const ta = normToken(String(a ?? ""));
  const tb = normToken(String(b ?? ""));
  if (!ta || !tb) return true;
  return ta === tb || ta.includes(tb) || tb.includes(ta);
}

export function parseProcedenciaResumoJson(raw: unknown): ProcedenciaResumoJson | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const obj = (k: string) => (o[k] && typeof o[k] === "object" ? o[k] as Record<string, unknown> : {});
  const leilao = obj("leilao");
  const perda = obj("perda_total");
  const roubo = obj("roubo_furto");
  const grav = obj("gravame");
  const ren = obj("renajud");
  const veic = obj("veiculo");
  const tiposRaw = ren.tipos_restricao;
  const tipos = Array.isArray(tiposRaw) ? tiposRaw.map((x) => String(x)) : [];
  return {
    leilao: {
      possui: leilao.possui === true,
      classificacao: leilao.classificacao != null ? String(leilao.classificacao) : null,
      parecer: leilao.parecer != null ? String(leilao.parecer) : null,
    },
    perda_total: {
      possui: perda.possui === true,
      registro: perda.registro != null ? String(perda.registro) : null,
    },
    roubo_furto: {
      possui: roubo.possui === true,
      qtd: Number(roubo.qtd ?? 0) || 0,
      ultima_data: roubo.ultima_data != null ? String(roubo.ultima_data) : null,
      uf: roubo.uf != null ? String(roubo.uf) : null,
    },
    gravame: {
      possui: grav.possui === true,
      situacao: grav.situacao != null ? String(grav.situacao) : null,
      agente_financeiro_nome: grav.agente_financeiro_nome != null
        ? String(grav.agente_financeiro_nome)
        : null,
    },
    renajud: {
      possui: ren.possui === true,
      tipos_restricao: tipos,
    },
    veiculo: {
      marca: veic.marca != null ? String(veic.marca) : null,
      modelo: veic.modelo != null ? String(veic.modelo) : null,
      ano_fabricacao: veic.ano_fabricacao != null ? Number(veic.ano_fabricacao) : null,
      ano_modelo: veic.ano_modelo != null ? Number(veic.ano_modelo) : null,
      cor: veic.cor != null ? String(veic.cor) : null,
    },
    saldo_apos: o.saldo_apos != null ? Number(o.saldo_apos) : null,
  };
}

function line(possui: boolean, label: string, detail: string): GestaoTrocaProcedenciaLinha {
  return {
    icon: possui ? "warn" : "ok",
    label,
    detail: detail || (possui ? "consta" : "nada consta"),
  };
}

export function buildGestaoTrocaProcedenciaLinhas(
  resumo: ProcedenciaResumoJson,
): GestaoTrocaProcedenciaLinha[] {
  const leilaoDet = resumo.leilao.possui
    ? [
      resumo.leilao.classificacao ? `classificação ${resumo.leilao.classificacao}` : null,
      resumo.leilao.parecer ? `parecer ${resumo.leilao.parecer}` : null,
    ].filter(Boolean).join(" · ")
    : "";

  const rouboDet = resumo.roubo_furto.possui
    ? [
      `${resumo.roubo_furto.qtd} registro(s)`,
      resumo.roubo_furto.ultima_data ? `última ${resumo.roubo_furto.ultima_data}` : null,
      resumo.roubo_furto.uf ? `UF ${resumo.roubo_furto.uf}` : null,
    ].filter(Boolean).join(" · ")
    : "";

  const gravDet = resumo.gravame.possui
    ? [resumo.gravame.situacao, resumo.gravame.agente_financeiro_nome].filter(Boolean).join(" · ")
    : "";

  const renDet = resumo.renajud.possui
    ? (resumo.renajud.tipos_restricao.length
      ? resumo.renajud.tipos_restricao.join(", ")
      : "restrição")
    : "";

  return [
    line(resumo.leilao.possui, "Leilão", leilaoDet),
    line(resumo.perda_total.possui, "Perda total", resumo.perda_total.registro ?? ""),
    line(resumo.roubo_furto.possui, "Roubo/furto", rouboDet),
    line(resumo.gravame.possui, "Gravame", gravDet),
    line(resumo.renajud.possui, "Renajud", renDet),
  ];
}

export function gestaoTrocaProcedenciaVeiculoResumo(resumo: ProcedenciaResumoJson): string {
  const v = resumo.veiculo;
  const parts = [
    v.marca,
    v.modelo,
    v.ano_modelo ?? v.ano_fabricacao,
    v.cor,
  ].filter((x) => x != null && String(x).trim());
  return parts.length ? parts.map(String).join(" · ") : "—";
}

export function gestaoTrocaProcedenciaDivergenciaFicha(
  ficha: { marca: string; modelo: string },
  resumo: ProcedenciaResumoJson | null,
): string | null {
  if (!resumo) return null;
  const vm = resumo.veiculo.marca;
  const vmod = resumo.veiculo.modelo;
  if (!vm && !vmod) return null;
  const marcaOk = !vm || tokensMatch(ficha.marca, vm);
  const modeloOk = !vmod || tokensMatch(ficha.modelo, vmod);
  if (marcaOk && modeloOk) return null;
  const parts: string[] = [];
  if (!marcaOk) parts.push(`marca ficha “${ficha.marca}” × procedência “${vm}”`);
  if (!modeloOk) parts.push(`modelo ficha “${ficha.modelo}” × procedência “${vmod}”`);
  return parts.join("; ");
}

export function buildGestaoTrocaProcedenciaLaudo(input: {
  consultaId: string | null | undefined;
  consulta?: {
    placa?: string | null;
    status?: string | null;
    resumo_json?: unknown;
    erro_tipo?: string | null;
    created_at?: string | null;
    concluida_em?: string | null;
  } | null;
  ficha?: { marca: string; modelo: string };
}): GestaoTrocaProcedenciaLaudo | null {
  if (!input.consultaId) return null;
  const c = input.consulta;
  if (!c) {
    return {
      consultada: false,
      emProcessamento: false,
      indisponivel: false,
      placaTeste: false,
      consultadoEm: null,
      placa: null,
      linhas: [],
      veiculoResumo: null,
      divergenciaFicha: null,
    };
  }

  const placaNorm = String(c.placa ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const placaTeste = placaNorm === CONSULTAR_PLACA_TESTE;
  const indisponivel = c.erro_tipo === "servico_indisponivel" ||
    (c.status === "erro" && c.erro_tipo === "servico_indisponivel");
  const resumo = parseProcedenciaResumoJson(c.resumo_json);
  const consultadoEm = c.concluida_em ?? c.created_at ?? null;

  if (c.status !== "concluida" && c.status !== "erro") {
    return {
      consultada: true,
      emProcessamento: true,
      indisponivel: false,
      placaTeste,
      consultadoEm,
      placa: c.placa ?? null,
      linhas: [],
      veiculoResumo: null,
      divergenciaFicha: null,
    };
  }

  if (indisponivel || !resumo) {
    return {
      consultada: true,
      emProcessamento: false,
      indisponivel: true,
      placaTeste,
      consultadoEm,
      placa: c.placa ?? null,
      linhas: [],
      veiculoResumo: null,
      divergenciaFicha: null,
    };
  }

  return {
    consultada: true,
    emProcessamento: false,
    indisponivel: false,
    placaTeste,
    consultadoEm,
    placa: c.placa ?? null,
    linhas: buildGestaoTrocaProcedenciaLinhas(resumo),
    veiculoResumo: gestaoTrocaProcedenciaVeiculoResumo(resumo),
    divergenciaFicha: input.ficha
      ? gestaoTrocaProcedenciaDivergenciaFicha(input.ficha, resumo)
      : null,
  };
}

export function appendGestaoTrocaProcedenciaPdfLines(
  line: (t: string, bold?: boolean) => void,
  procedencia: GestaoTrocaProcedenciaLaudo | null,
): void {
  line("Procedência veicular", true);
  if (!procedencia) {
    line("Procedência não consultada.");
    return;
  }
  if (procedencia.emProcessamento) {
    line("Consulta em processamento.");
    return;
  }
  if (procedencia.indisponivel) {
    line("Serviço indisponível no momento da consulta.");
    if (procedencia.consultadoEm) {
      line(`Data da tentativa: ${procedencia.consultadoEm.slice(0, 16).replace("T", " ")}`);
    }
    return;
  }
  for (const l of procedencia.linhas) {
    const icon = l.icon === "warn" ? "⚠" : "✓";
    line(`${icon} ${l.label}: ${l.detail}`);
  }
  if (procedencia.veiculoResumo) {
    line(`Veículo (base nacional): ${procedencia.veiculoResumo}`);
  }
  if (procedencia.consultadoEm) {
    line(
      `Consulta: ${procedencia.consultadoEm.slice(0, 16).replace("T", " ")}${procedencia.placaTeste ? " (placa de teste)" : ""}`,
    );
  }
}
