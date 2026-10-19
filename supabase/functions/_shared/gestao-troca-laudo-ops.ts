import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { hojeSaoPaulo } from "./gestao-date-br.ts";
import { insertTrocaEvento } from "./gestao-troca-ops.ts";
import {
  buildGestaoTrocaLaudoPdfSection,
  type GestaoTrocaLaudoPdfSection,
} from "./gestao-troca-laudo-pdf-section.ts";
import { loadLatestGestaoTrocaAnalise } from "./gestao-troca-ia-ops.ts";
import { buildGestaoTrocaProcedenciaLaudo } from "./gestao-troca-procedencia-display.ts";
import { buildGestaoTrocaLaudoDescricaoPdf } from "./gestao-troca-laudo-descricao-display.ts";

type Db = SupabaseClient;

export { assertGestaoTrocaLaudoNaoFinalizado } from "./gestao-troca-laudo-guard.ts";

async function hasAdminRole(sb: Db, userId: string): Promise<boolean> {
  const { data } = await sb.from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

export async function assertPodeReabrirLaudoTroca(
  sb: Db,
  actorId: string,
  troca: { user_id: string; laudo_status?: string | null },
): Promise<void> {
  if (String(troca.laudo_status ?? "rascunho") !== "finalizado") {
    throw new Error("O laudo não está finalizado.");
  }
  if (actorId === troca.user_id) return;
  if (await hasAdminRole(sb, actorId)) return;
  throw new Error("Sem permissão para reabrir laudo (somente dono ou gerente).");
}

export async function allocGestaoTrocaLaudoNumero(sb: Db, userId: string): Promise<string> {
  const ano = Number(hojeSaoPaulo().slice(0, 4));
  const { data: row } = await sb.from("gestao_troca_laudo_numero")
    .select("ultimo")
    .eq("user_id", userId)
    .eq("ano", ano)
    .maybeSingle();
  const next = (row?.ultimo != null ? Number(row.ultimo) : 0) + 1;
  const { error } = await sb.from("gestao_troca_laudo_numero").upsert({
    user_id: userId,
    ano,
    ultimo: next,
  });
  if (error) throw new Error("Não foi possível gerar número do laudo.");
  return `${ano}-${String(next).padStart(6, "0")}`;
}

function laudoItensConfirmados(itens: Record<string, unknown>[]): GestaoTrocaLaudoPdfSection["itensConfirmados"] {
  return itens
    .filter((i) => String(i.decisao) === "confirmado")
    .map((i) => ({
      area: String(i.area ?? ""),
      tipo: String(i.tipo ?? ""),
      descricao: String(i.descricao ?? ""),
      valor: i.valor_estimado != null ? Number(i.valor_estimado) : null,
    }));
}

function normalizeQualidade(raw: unknown): { etiqueta: string; usada: boolean; motivo_skip?: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === "object")
    .map((r) => {
      const o = r as Record<string, unknown>;
      return {
        etiqueta: String(o.etiqueta ?? ""),
        usada: o.usada === true,
        motivo_skip: o.motivo_skip ? String(o.motivo_skip) : undefined,
      };
    });
}

async function loadGestaoTrocaProcedenciaSnapshot(
  sb: Db,
  userId: string,
  troca: Record<string, unknown>,
) {
  const consultaId = troca.procedencia_consulta_id != null
    ? String(troca.procedencia_consulta_id)
    : "";
  if (!consultaId) return null;
  const { data } = await sb.from("veiculo_procedencia_consulta")
    .select("placa, status, resumo_json, erro_tipo, created_at, concluida_em")
    .eq("id", consultaId)
    .eq("user_id", userId)
    .maybeSingle();
  const row = data as Record<string, unknown> | null;
  return buildGestaoTrocaProcedenciaLaudo({
    consultaId,
    consulta: row
      ? {
        placa: row.placa != null ? String(row.placa) : null,
        status: row.status != null ? String(row.status) : null,
        resumo_json: row.resumo_json,
        erro_tipo: row.erro_tipo != null ? String(row.erro_tipo) : null,
        created_at: row.created_at != null ? String(row.created_at) : null,
        concluida_em: row.concluida_em != null ? String(row.concluida_em) : null,
      }
      : null,
    ficha: {
      marca: String(troca.marca ?? ""),
      modelo: String(troca.modelo ?? ""),
    },
  });
}

export async function buildGestaoTrocaLaudoSnapshot(
  sb: Db,
  userId: string,
  troca: Record<string, unknown>,
  eventos: { descricao: string; created_at: string }[],
): Promise<Record<string, unknown>> {
  const procedencia = await loadGestaoTrocaProcedenciaSnapshot(sb, userId, troca);
  const { analise, itens } = await loadLatestGestaoTrocaAnalise(sb, userId, String(troca.id));
  let laudo: GestaoTrocaLaudoPdfSection | null = null;
  if (analise?.id) {
    laudo = buildGestaoTrocaLaudoPdfSection({
      analiseStatus: String(analise.status),
      km_painel_lido: analise.km_painel_lido != null ? Number(analise.km_painel_lido) : null,
      km_ficha: analise.km_ficha != null ? Number(analise.km_ficha) : null,
      km_informado: troca.km != null ? Number(troca.km) : null,
      alerta_km: analise.alerta_km === true,
      km_painel_conferido: troca.km_painel_conferido === true,
      luzes_painel: typeof analise.luzes_painel === "boolean" ? analise.luzes_painel : null,
      aviso_carroceria: analise.aviso_carroceria === true,
      qualidade_json: normalizeQualidade(analise.qualidade_json),
      resumo: analise.resumo != null ? String(analise.resumo) : null,
      modelo_ia: analise.modelo_ia != null ? String(analise.modelo_ia) : null,
      concluida_em: analise.concluida_em != null ? String(analise.concluida_em) : null,
      itensConfirmados: laudoItensConfirmados(itens),
    });
  }
  const descricao = buildGestaoTrocaLaudoDescricaoPdf(
    analise?.descricao_areas_json,
    analise?.conclusao_visual != null ? String(analise.conclusao_visual) : null,
  );

  return {
    troca,
    eventos: eventos.slice(0, 12),
    laudo,
    procedencia,
    descricao,
    parecer: troca.parecer_json ?? null,
    gerado_em: new Date().toISOString(),
  };
}

export async function finalizarLaudoGestaoTroca(
  sb: Db,
  actorId: string,
  actorLabel: string,
  trocaId: string,
): Promise<{ numero: string; versao: number }> {
  const { data: troca } = await sb.from("gestao_troca").select("*")
    .eq("id", trocaId)
    .eq("user_id", actorId)
    .maybeSingle();
  if (!troca) throw new Error("Troca não encontrada.");
  if (String(troca.laudo_status ?? "rascunho") === "finalizado") {
    throw new Error("Laudo já finalizado.");
  }

  const { data: ev } = await sb.from("gestao_troca_evento")
    .select("descricao, created_at")
    .eq("troca_id", trocaId)
    .order("created_at", { ascending: true });
  const snapshot = await buildGestaoTrocaLaudoSnapshot(
    sb,
    actorId,
    troca as Record<string, unknown>,
    (ev ?? []) as { descricao: string; created_at: string }[],
  );

  let numero = troca.laudo_numero ? String(troca.laudo_numero) : null;
  if (!numero) {
    numero = await allocGestaoTrocaLaudoNumero(sb, actorId);
  }
  const versao = Number(troca.laudo_versao ?? 0) + 1;
  const now = new Date().toISOString();

  const { error: insErr } = await sb.from("gestao_troca_laudo_versao").insert({
    troca_id: trocaId,
    user_id: actorId,
    numero,
    versao,
    snapshot_json: snapshot,
    finalizado_por: actorId,
    finalizado_em: now,
  });
  if (insErr) throw new Error("Não foi possível gravar versão do laudo.");

  await sb.from("gestao_troca").update({
    laudo_status: "finalizado",
    laudo_numero: numero,
    laudo_versao: versao,
    laudo_finalizado_por: actorId,
    laudo_finalizado_em: now,
    laudo_reaberto_motivo: null,
    updated_at: now,
  }).eq("id", trocaId);

  await insertTrocaEvento(sb, {
    troca_id: trocaId,
    user_id: actorId,
    tipo: "laudo_finalizado",
    descricao: `Laudo nº ${numero} · versão ${versao} finalizado por ${actorLabel}.`,
    autor: actorLabel,
  });

  return { numero, versao };
}

export async function reabrirLaudoGestaoTroca(
  sb: Db,
  actorId: string,
  actorLabel: string,
  trocaId: string,
  motivo: string,
): Promise<void> {
  const trimmed = String(motivo ?? "").trim();
  if (trimmed.length < 10) {
    throw new Error("Informe o motivo da reabertura (mínimo 10 caracteres).");
  }
  const { data: troca } = await sb.from("gestao_troca").select("id, user_id, laudo_status")
    .eq("id", trocaId)
    .maybeSingle();
  if (!troca) throw new Error("Troca não encontrada.");
  await assertPodeReabrirLaudoTroca(sb, actorId, troca);

  const now = new Date().toISOString();
  await sb.from("gestao_troca").update({
    laudo_status: "rascunho",
    laudo_reaberto_motivo: trimmed,
    updated_at: now,
  }).eq("id", trocaId);

  await insertTrocaEvento(sb, {
    troca_id: trocaId,
    user_id: troca.user_id,
    tipo: "laudo_reaberto",
    descricao: `Laudo reaberto por ${actorLabel}: ${trimmed}`,
    autor: actorLabel,
  });
}
