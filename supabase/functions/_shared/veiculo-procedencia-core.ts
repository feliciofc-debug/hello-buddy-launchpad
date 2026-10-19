import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  CONSULTAR_PLACA_TESTE,
  consultarPlacaPacoteCompleto,
  consultarPlacaSaldo,
  isValidBrazilPlaca,
  PROCEDENCIA_CUSTO_ESTIMADO_BRL,
  type ConsultarPlacaCredentials,
} from "./consultar-placa-client.ts";
import {
  buildProcedenciaResumo,
  mergeVeiculoFromPlaca,
  parseEndpointErro,
  type ProcedenciaResumoJson,
} from "./consultar-placa-parse.ts";
import {
  apiKeyUltimos4,
  decryptProcedenciaApiKey,
  encryptProcedenciaApiKey,
} from "./procedencia-enc-crypto.ts";
import { maskEmailForDisplay } from "./procedencia-http.ts";
import { formatGestaoMoney } from "./gestao-format.ts";
import {
  addDiasYmd,
  competenciaFromYmdSaoPaulo,
  intervaloCompetencia,
} from "./gestao-date-br.ts";

export type ProcedenciaConfigRow = {
  user_id: string;
  email: string;
  api_key_enc: string;
  api_key_ultimos4: string;
  ativo: boolean;
  limite_mensal: number;
};

type Db = SupabaseClient;

/** Limites UTC para competência em America/Sao_Paulo (UTC−3, sem horário de verão). */
export function procedenciaCompetenciaUtcBounds(competenciaYm: string): {
  startIso: string;
  endExclusiveIso: string;
} {
  const { start, end } = intervaloCompetencia(competenciaYm);
  return {
    startIso: `${start}T03:00:00.000Z`,
    endExclusiveIso: `${addDiasYmd(end, 1)}T03:00:00.000Z`,
  };
}

export function procedenciaCompetenciaAtual(now = new Date()): string {
  return competenciaFromYmdSaoPaulo(now);
}

export async function loadProcedenciaConfig(
  sb: Db,
  userId: string,
): Promise<ProcedenciaConfigRow | null> {
  const { data } = await sb.from("veiculo_procedencia_config")
    .select("user_id, email, api_key_enc, api_key_ultimos4, ativo, limite_mensal")
    .eq("user_id", userId)
    .maybeSingle();
  return data as ProcedenciaConfigRow | null;
}

export async function saveProcedenciaCredential(
  sb: Db,
  userId: string,
  email: string,
  apiKey: string,
  limiteMensal?: number,
): Promise<void> {
  const em = String(email || "").trim().toLowerCase();
  const key = String(apiKey || "").trim();
  if (!em.includes("@")) throw new Error("Informe o e-mail da Consultar Placa.");
  if (key.length < 8) throw new Error("Informe a API key.");
  const enc = await encryptProcedenciaApiKey(key);
  const row: Record<string, unknown> = {
    user_id: userId,
    provedor: "consultar_placa",
    email: em,
    api_key_enc: enc,
    api_key_ultimos4: apiKeyUltimos4(key),
    ativo: true,
    updated_at: new Date().toISOString(),
  };
  if (limiteMensal != null && Number.isFinite(Number(limiteMensal))) {
    row.limite_mensal = Math.max(0, Math.round(Number(limiteMensal)));
  }
  const { error } = await sb.from("veiculo_procedencia_config").upsert(row, {
    onConflict: "user_id",
  });
  if (error) throw new Error("Não foi possível salvar credenciais.");
}

export async function credsFromConfig(
  cfg: ProcedenciaConfigRow,
): Promise<ConsultarPlacaCredentials> {
  const apiKey = await decryptProcedenciaApiKey(cfg.api_key_enc);
  return { email: cfg.email, apiKey };
}

export function procedenciaConfigPublic(cfg: ProcedenciaConfigRow | null) {
  if (!cfg || !cfg.ativo) {
    return {
      ativo: false,
      email_masked: null as string | null,
      api_key_hint: null as string | null,
      limite_mensal: 30,
    };
  }
  return {
    ativo: true,
    email_masked: maskEmailForDisplay(cfg.email),
    api_key_hint: cfg.api_key_ultimos4 ? `•••• ${cfg.api_key_ultimos4}` : "••••",
    limite_mensal: cfg.limite_mensal ?? 30,
  };
}

export async function countConsultasMes(
  sb: Db,
  userId: string,
  competenciaYm: string,
): Promise<number> {
  const { startIso, endExclusiveIso } = procedenciaCompetenciaUtcBounds(competenciaYm);
  const { count } = await sb.from("veiculo_procedencia_consulta")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("placa", CONSULTAR_PLACA_TESTE)
    .in("status", ["processando", "concluida"])
    .gte("created_at", startIso)
    .lt("created_at", endExclusiveIso);
  return count ?? 0;
}

export async function assertProcedenciaLimiteMensal(
  sb: Db,
  userId: string,
  placa: string,
  limite: number,
  now = new Date(),
): Promise<void> {
  if (placa.toUpperCase() === CONSULTAR_PLACA_TESTE) return;
  const ym = procedenciaCompetenciaAtual(now);
  const used = await countConsultasMes(sb, userId, ym);
  if (used >= limite) {
    throw new Error(`Limite mensal de ${limite} consultas atingido.`);
  }
}

export async function assertNoProcedenciaProcessandoRecente(
  sb: Db,
  userId: string,
  placa: string,
  windowMinutes = 10,
): Promise<void> {
  const p = normalizePlacaInput(placa);
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const { data } = await sb.from("veiculo_procedencia_consulta")
    .select("id")
    .eq("user_id", userId)
    .eq("placa", p)
    .eq("status", "processando")
    .gte("created_at", since)
    .limit(1);
  if (data?.length) {
    throw new Error(
      "Já existe consulta em andamento para esta placa. Aguarde ou consulte o status.",
    );
  }
}

export function normalizePlacaInput(placa: string): string {
  return String(placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function createProcedenciaConsultaProcessando(
  sb: Db,
  userId: string,
  placaRaw: string,
  opts: {
    canal: "painel" | "whatsapp";
    solicitadoPor: string;
    veiculoId?: string | null;
  },
): Promise<string> {
  const placa = normalizePlacaInput(placaRaw);
  if (!isValidBrazilPlaca(placa)) throw new Error("Placa inválida.");
  const cfg = await loadProcedenciaConfig(sb, userId);
  if (!cfg?.ativo) throw new Error("Procedência não configurada para esta loja.");
  await assertProcedenciaLimiteMensal(sb, userId, placa, cfg.limite_mensal ?? 30);
  await assertNoProcedenciaProcessandoRecente(sb, userId, placa);

  const creds = await credsFromConfig(cfg);
  const saldoAntes = await consultarPlacaSaldo(creds);
  if (placa !== CONSULTAR_PLACA_TESTE && saldoAntes.saldo != null &&
    saldoAntes.saldo < PROCEDENCIA_CUSTO_ESTIMADO_BRL) {
    throw new Error("Saldo insuficiente na Consultar Placa.");
  }

  const { data: ins, error } = await sb.from("veiculo_procedencia_consulta").insert({
    user_id: userId,
    placa,
    veiculo_id: opts.veiculoId ?? null,
    solicitado_por: opts.solicitadoPor,
    canal: opts.canal,
    status: "processando",
    custo_estimado: placa === CONSULTAR_PLACA_TESTE ? 0 : PROCEDENCIA_CUSTO_ESTIMADO_BRL,
  }).select("id").single();
  if (error || !ins?.id) throw new Error("Não foi possível registrar a consulta.");
  return String(ins.id);
}

export async function runProcedenciaConsulta(
  sb: Db,
  userId: string,
  placaRaw: string,
  opts: {
    canal: "painel" | "whatsapp";
    solicitadoPor: string;
    veiculoId?: string | null;
    consultaId?: string;
  },
): Promise<{ resumo: ProcedenciaResumoJson; consultaId: string; erroTipo: string | null }> {
  const placa = normalizePlacaInput(placaRaw);
  if (!isValidBrazilPlaca(placa)) throw new Error("Placa inválida.");

  const cfg = await loadProcedenciaConfig(sb, userId);
  if (!cfg?.ativo) throw new Error("Procedência não configurada para esta loja.");

  let consultaId = opts.consultaId;
  if (!consultaId) {
    consultaId = await createProcedenciaConsultaProcessando(sb, userId, placa, opts);
  }

  const creds = await credsFromConfig(cfg);
  const results = await consultarPlacaPacoteCompleto(creds, placa);
  const erros = Object.values(results).map(parseEndpointErro).filter(Boolean);
  const creditoInsuf = erros.includes("credito_insuficiente") ||
    Object.values(results).some((r) => r.httpStatus === 402);

  if (creditoInsuf) {
    await sb.from("veiculo_procedencia_consulta").update({
      status: "erro",
      erro_tipo: "credito_insuficiente",
      concluida_em: new Date().toISOString(),
    }).eq("id", consultaId);
    throw new Error("Saldo insuficiente na Consultar Placa.");
  }

  const saldoDepois = await consultarPlacaSaldo(creds);
  let resumo = buildProcedenciaResumo(results, saldoDepois.saldo);
  resumo = mergeVeiculoFromPlaca(resumo, results.consultarPlaca);

  const allIndisp = Object.values(results).every((r) =>
    !r.ok && (r.indisponivel || parseEndpointErro(r) === "servico_indisponivel")
  );
  const status = allIndisp ? "erro" : "concluida";
  const erroTipo = allIndisp ? "servico_indisponivel" : null;

  await sb.from("veiculo_procedencia_consulta").update({
    status,
    resumo_json: resumo,
    erro_tipo: erroTipo,
    concluida_em: new Date().toISOString(),
  }).eq("id", consultaId);

  return { resumo, consultaId, erroTipo };
}

export function scheduleProcedenciaPainelBackground(
  sb: Db,
  userId: string,
  consultaId: string,
  placa: string,
  opts: { solicitadoPor: string; veiculoId?: string | null },
): void {
  const work = runProcedenciaConsulta(sb, userId, placa, {
    canal: "painel",
    solicitadoPor: opts.solicitadoPor,
    veiculoId: opts.veiculoId,
    consultaId,
  }).catch(async (e) => {
    await sb.from("veiculo_procedencia_consulta").update({
      status: "erro",
      erro_tipo: "erro",
      concluida_em: new Date().toISOString(),
    }).eq("id", consultaId);
    console.error("[procedencia][painel-bg]", (e as Error).message);
  });
  const er = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
    .EdgeRuntime;
  if (er?.waitUntil) er.waitUntil(work);
  else void work;
}

export function formatProcedenciaWhatsApp(
  placa: string,
  resumo: ProcedenciaResumoJson,
  opts?: { teste?: boolean },
): string {
  const v = resumo.veiculo;
  const titulo = [v.marca, v.modelo, v.ano_modelo ?? v.ano_fabricacao].filter(Boolean).join(" ");
  const head = titulo
    ? `🔎 *Procedência — ${titulo} (${placa})*`
    : `🔎 *Procedência — ${placa}*`;
  const testeSuf = opts?.teste ? " _(placa de teste)_" : "";

  const line = (ok: boolean, label: string, detail: string) => {
    const icon = ok ? "⚠️" : "✅";
    const suffix = detail ? `: ${detail}` : ok ? ": consta" : ": nada consta";
    return `${icon} ${label}${suffix}`;
  };

  const leilaoDet = resumo.leilao.possui
    ? [
      resumo.leilao.classificacao ? `classificação ${resumo.leilao.classificacao}` : null,
      resumo.leilao.parecer ? `parecer: ${resumo.leilao.parecer}` : null,
    ].filter(Boolean).join(" — ")
    : "";

  const rouboDet = resumo.roubo_furto.possui
    ? `${resumo.roubo_furto.qtd} registro(s)${resumo.roubo_furto.ultima_data ? ` · ${resumo.roubo_furto.ultima_data}` : ""}${resumo.roubo_furto.uf ? ` · ${resumo.roubo_furto.uf}` : ""}`
    : "";

  const gravDet = resumo.gravame.possui
    ? [resumo.gravame.situacao, resumo.gravame.agente_financeiro_nome].filter(Boolean).join(" · ")
    : "";

  const renDet = resumo.renajud.possui
    ? (resumo.renajud.tipos_restricao.length
      ? resumo.renajud.tipos_restricao.join(", ")
      : "restrição")
    : "";

  const lines = [
    `${head}${testeSuf}`,
    line(resumo.leilao.possui, "Leilão", leilaoDet),
    line(resumo.perda_total.possui, "Perda total", resumo.perda_total.registro ?? ""),
    line(resumo.roubo_furto.possui, "Roubo-furto", rouboDet),
    line(resumo.gravame.possui, "Gravame", gravDet),
    line(resumo.renajud.possui, "Renajud", renDet),
  ];
  if (resumo.saldo_apos != null) {
    lines.push(`💳 Saldo restante: ${formatGestaoMoney(resumo.saldo_apos)}`);
  }
  return lines.join("\n");
}

export async function sendProcedenciaWhatsAppReply(
  sb: Db,
  userId: string,
  to: string,
  message: string,
): Promise<void> {
  await sb.functions.invoke("whatsapp-send-message", {
    body: { user_id: userId, to, message },
  });
}
