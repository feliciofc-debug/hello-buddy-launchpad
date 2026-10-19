import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  normalizeGestaoTrocaChecklist,
  somaPreparacaoChecklist,
  type ChecklistReparoTipo,
  type GestaoTrocaChecklistJson,
} from "./gestao-troca-checklist.ts";
import {
  gestaoTrocaFotosParaIa,
  normalizeGestaoTrocaFotos,
} from "./gestao-troca-fotos.ts";
import { addDiasYmd, hojeSaoPaulo } from "./gestao-date-br.ts";
import { insertTrocaEvento } from "./gestao-troca-ops.ts";
import { listGestaoTrocaIaCustos } from "./gestao-troca-ia-custos.ts";
import {
  gestaoTrocaIaAlertaKm,
  gestaoTrocaIaAvisoCarroceria,
  gestaoTrocaIaBuildItemRows,
  gestaoTrocaIaFiltrarItensVision,
  gestaoTrocaIaLuzesPainelResumo,
} from "./gestao-troca-ia-rules.ts";
import type { GestaoTrocaIaGravidade, GestaoTrocaIaTipo } from "./gestao-troca-ia-schema.ts";
import {
  analyzeGestaoTrocaFotosVision,
  gestaoTrocaIaMaxFotoBytes,
  gestaoTrocaIaMaxFotos,
  type GestaoTrocaIaFotoInput,
  type GestaoTrocaIaQualidadeFoto,
} from "./gestao-troca-ia-vision.ts";

type Db = SupabaseClient;

export const GESTAO_TROCA_IA_LIMITE_DIARIO = 5;

function diaUtcBoundsSaoPaulo(diaYmd: string): { startIso: string; endExclusiveIso: string } {
  return {
    startIso: `${diaYmd}T03:00:00.000Z`,
    endExclusiveIso: `${addDiasYmd(diaYmd, 1)}T03:00:00.000Z`,
  };
}

export async function countGestaoTrocaAnalisesHoje(
  sb: Db,
  userId: string,
  now = new Date(),
): Promise<number> {
  const dia = hojeSaoPaulo();
  const { startIso, endExclusiveIso } = diaUtcBoundsSaoPaulo(dia);
  const { count } = await sb.from("gestao_troca_analise_ia")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startIso)
    .lt("created_at", endExclusiveIso)
    .neq("status", "erro");
  return count ?? 0;
}

export async function assertGestaoTrocaIaLimiteDiario(sb: Db, userId: string): Promise<void> {
  const used = await countGestaoTrocaAnalisesHoje(sb, userId);
  if (used >= GESTAO_TROCA_IA_LIMITE_DIARIO) {
    throw new Error(`Limite diário de ${GESTAO_TROCA_IA_LIMITE_DIARIO} laudos IA atingido.`);
  }
}

export async function assertNoGestaoTrocaAnaliseProcessando(
  sb: Db,
  userId: string,
  trocaId: string,
): Promise<void> {
  const { data } = await sb.from("gestao_troca_analise_ia")
    .select("id")
    .eq("user_id", userId)
    .eq("troca_id", trocaId)
    .eq("status", "processando")
    .limit(1);
  if (data?.length) {
    throw new Error("Já existe laudo IA em processamento para esta troca.");
  }
}

export async function loadGestaoTrocaAnaliseById(
  sb: Db,
  userId: string,
  analiseId: string,
): Promise<{ analise: Record<string, unknown>; itens: Record<string, unknown>[] } | null> {
  const { data: analise } = await sb.from("gestao_troca_analise_ia")
    .select("*")
    .eq("id", analiseId)
    .maybeSingle();
  if (!analise?.id) return null;
  if (String(analise.user_id) !== userId) return null;
  const { data: itens } = await sb.from("gestao_troca_ia_item")
    .select("*")
    .eq("analise_id", analise.id)
    .order("ordem", { ascending: true });
  return { analise, itens: itens ?? [] };
}

export type GestaoTrocaStatusAnaliseResult =
  | { ok: true; analise: Record<string, unknown> | null; itens: Record<string, unknown>[] }
  | { ok: false; status: 422 | 404; error: string };

export async function statusAnaliseGestaoTroca(
  sb: Db,
  userId: string,
  input: { analise_id?: string; troca_id?: string },
): Promise<GestaoTrocaStatusAnaliseResult> {
  const analiseId = String(input.analise_id ?? "").trim();
  const trocaId = String(input.troca_id ?? "").trim();
  if (!analiseId && !trocaId) {
    return { ok: false, status: 422, error: "Informe analise_id ou troca_id." };
  }
  if (analiseId) {
    const byId = await loadGestaoTrocaAnaliseById(sb, userId, analiseId);
    if (!byId) {
      return { ok: false, status: 404, error: "Análise não encontrada." };
    }
    return { ok: true, analise: byId.analise, itens: byId.itens };
  }
  const latest = await loadLatestGestaoTrocaAnalise(sb, userId, trocaId);
  return { ok: true, analise: latest.analise, itens: latest.itens };
}

export async function loadLatestGestaoTrocaAnalise(
  sb: Db,
  userId: string,
  trocaId: string,
): Promise<{ analise: Record<string, unknown> | null; itens: Record<string, unknown>[] }> {
  const { data: analise } = await sb.from("gestao_troca_analise_ia")
    .select("*")
    .eq("user_id", userId)
    .eq("troca_id", trocaId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!analise?.id) return { analise: null, itens: [] };
  const { data: itens } = await sb.from("gestao_troca_ia_item")
    .select("*")
    .eq("analise_id", analise.id)
    .order("ordem", { ascending: true });
  return { analise, itens: itens ?? [] };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function mimeFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

async function downloadFotosParaIa(
  sb: Db,
  fotosPaths: ReturnType<typeof gestaoTrocaFotosParaIa>,
): Promise<{ fotos: GestaoTrocaIaFotoInput[]; qualidade: GestaoTrocaIaQualidadeFoto[] }> {
  const maxBytes = gestaoTrocaIaMaxFotoBytes();
  const fotos: GestaoTrocaIaFotoInput[] = [];
  const qualidade: GestaoTrocaIaQualidadeFoto[] = [];

  for (const f of fotosPaths) {
    const { data, error } = await sb.storage.from("trocas").download(f.path);
    if (error || !data) {
      qualidade.push({
        path: f.path,
        etiqueta: f.etiqueta,
        bytes: 0,
        usada: false,
        motivo_skip: "download_falhou",
      });
      continue;
    }
    const buf = new Uint8Array(await data.arrayBuffer());
    const bytes = buf.byteLength;
    if (bytes > maxBytes) {
      qualidade.push({
        path: f.path,
        etiqueta: f.etiqueta,
        bytes,
        usada: false,
        motivo_skip: "arquivo_maior_4mb",
      });
      continue;
    }
    fotos.push({
      path: f.path,
      etiqueta: f.etiqueta,
      mime: mimeFromPath(f.path),
      base64: bytesToBase64(buf),
      bytes,
    });
    qualidade.push({ path: f.path, etiqueta: f.etiqueta, bytes, usada: true });
  }
  return { fotos, qualidade };
}

function reparoFromTipo(tipo: GestaoTrocaIaTipo): ChecklistReparoTipo {
  if (tipo === "amassado" || tipo === "risco") return "funilaria";
  if (tipo === "desgaste" || tipo === "peca_faltando") return "troca";
  if (tipo === "mancha" || tipo === "pintura_divergente" || tipo === "ferrugem") return "pintura";
  return "reparo";
}

function condicaoFromGravidade(g: GestaoTrocaIaGravidade): "regular" | "ruim" {
  return g === "grave" ? "ruim" : "regular";
}

export async function runGestaoTrocaIaAnaliseBackground(
  sb: Db,
  analiseId: string,
  userId: string,
  trocaId: string,
): Promise<void> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY") ?? "";
  try {
    const { data: troca, error: trocaErr } = await sb.from("gestao_troca")
      .select("id, km, fotos_json")
      .eq("id", trocaId)
      .eq("user_id", userId)
      .maybeSingle();
    if (trocaErr || !troca) throw new Error("Troca não encontrada.");

    const fotosNorm = normalizeGestaoTrocaFotos(troca.fotos_json);
    const elegiveis = gestaoTrocaFotosParaIa(fotosNorm, gestaoTrocaIaMaxFotos());
    const { fotos, qualidade } = await downloadFotosParaIa(sb, elegiveis);

    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");
    const vision = await analyzeGestaoTrocaFotosVision({ apiKey, fotos });
    if (!vision.ok) throw new Error(vision.error);

    const tabela = await listGestaoTrocaIaCustos(sb, userId);
    const kmFicha = troca.km != null ? Number(troca.km) : null;
    const kmPainel = vision.data.km_painel;
    const alerta_km = gestaoTrocaIaAlertaKm(kmFicha, kmPainel);
    const etiquetasUsadas = fotos.map((f) => f.etiqueta);
    const aviso_carroceria = gestaoTrocaIaAvisoCarroceria(
      vision.data.aviso_carroceria,
      etiquetasUsadas,
    );

    const itensFiltrados = gestaoTrocaIaFiltrarItensVision(vision.data.itens);
    const temFotoPainel = fotos.some((f) => /painel/i.test(f.etiqueta));
    const luzes_painel = gestaoTrocaIaLuzesPainelResumo(itensFiltrados, temFotoPainel);

    const { rows: itemRows, totalPreparacao: total } = gestaoTrocaIaBuildItemRows({
      itens: itensFiltrados,
      fotos,
      tabela,
      analiseId,
      userId,
      trocaId,
    });

    if (itemRows.length) {
      const { error: insErr } = await sb.from("gestao_troca_ia_item").insert(itemRows);
      if (insErr) throw new Error("Não foi possível salvar itens do laudo.");
    }

    await sb.from("gestao_troca_analise_ia").update({
      status: "concluida",
      km_painel_lido: kmPainel,
      km_ficha: kmFicha,
      alerta_km,
      aviso_carroceria,
      luzes_painel,
      resumo: vision.data.resumo || null,
      qualidade_json: qualidade,
      modelo_ia: "google/gemini-3.6-flash",
      total_preparacao: total,
      concluida_em: new Date().toISOString(),
    }).eq("id", analiseId);

    await insertTrocaEvento(sb, {
      troca_id: trocaId,
      user_id: userId,
      tipo: "laudo_ia",
      descricao: `Laudo IA concluído (${itemRows.length} itens).`,
    });
  } catch (e) {
    await sb.from("gestao_troca_analise_ia").update({
      status: "erro",
      erro: (e as Error).message.slice(0, 500),
      concluida_em: new Date().toISOString(),
    }).eq("id", analiseId);
  }
}

export function scheduleGestaoTrocaIaAnaliseBackground(
  sb: Db,
  analiseId: string,
  userId: string,
  trocaId: string,
): void {
  const work = runGestaoTrocaIaAnaliseBackground(sb, analiseId, userId, trocaId);
  const er = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
    .EdgeRuntime;
  if (er?.waitUntil) er.waitUntil(work);
  else void work;
}

export async function iniciarGestaoTrocaIaAnalise(
  sb: Db,
  userId: string,
  trocaId: string,
): Promise<{ analise_id: string }> {
  const { data: troca } = await sb.from("gestao_troca").select("id")
    .eq("id", trocaId).eq("user_id", userId).maybeSingle();
  if (!troca) throw new Error("Troca não encontrada.");

  await assertGestaoTrocaIaLimiteDiario(sb, userId);
  await assertNoGestaoTrocaAnaliseProcessando(sb, userId, trocaId);

  const { data: ins, error } = await sb.from("gestao_troca_analise_ia").insert({
    troca_id: trocaId,
    user_id: userId,
    status: "processando",
  }).select("id").single();
  if (error || !ins?.id) throw new Error("Não foi possível iniciar laudo IA.");

  scheduleGestaoTrocaIaAnaliseBackground(sb, String(ins.id), userId, trocaId);
  return { analise_id: String(ins.id) };
}

export async function confirmarKmPainelGestaoTroca(
  sb: Db,
  userId: string,
  trocaId: string,
): Promise<void> {
  const { data } = await sb.from("gestao_troca").update({
    km_painel_conferido: true,
    updated_at: new Date().toISOString(),
  })
    .eq("id", trocaId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (!data?.id) throw new Error("Troca não encontrada.");
}

export async function decidirItemIaGestaoTroca(
  sb: Db,
  userId: string,
  itemId: string,
  decisao: "confirmado" | "descartado",
): Promise<{ checklist_json: GestaoTrocaChecklistJson; preparacao_estimada: number }> {
  if (decisao !== "confirmado" && decisao !== "descartado") {
    throw new Error("Decisão inválida.");
  }

  const { data: item } = await sb.from("gestao_troca_ia_item")
    .select("*")
    .eq("id", itemId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!item) throw new Error("Item não encontrado.");
  if (String(item.decisao) !== "pendente") throw new Error("Item já decidido.");

  const trocaId = String(item.troca_id);
  const { data: troca } = await sb.from("gestao_troca")
    .select("checklist_json, preparacao_estimada")
    .eq("id", trocaId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!troca) throw new Error("Troca não encontrada.");

  const checklist = normalizeGestaoTrocaChecklist(troca.checklist_json);
  if (decisao === "confirmado") {
    const key = String(item.checklist_key || item.area);
    const gravidade = String(item.gravidade) as GestaoTrocaIaGravidade;
    const tipo = String(item.tipo) as GestaoTrocaIaTipo;
    const valor = tipo === "luz_alerta"
      ? null
      : item.valor_estimado != null
      ? Number(item.valor_estimado)
      : null;
    checklist[key] = {
      condicao: condicaoFromGravidade(gravidade),
      reparo: reparoFromTipo(tipo),
      valor_estimado: valor,
    };
  }

  const preparacao = somaPreparacaoChecklist(checklist);
  await sb.from("gestao_troca_ia_item").update({
    decisao,
    updated_at: new Date().toISOString(),
  }).eq("id", itemId);

  await sb.from("gestao_troca").update({
    checklist_json: checklist,
    preparacao_estimada: preparacao,
    updated_at: new Date().toISOString(),
  }).eq("id", trocaId);

  return { checklist_json: checklist, preparacao_estimada: preparacao };
}

export async function assertPodeSolicitarAprovacaoTroca(
  sb: Db,
  userId: string,
  trocaId: string,
  kmPainelConferido: boolean,
): Promise<void> {
  const { analise } = await loadLatestGestaoTrocaAnalise(sb, userId, trocaId);
  if (analise && analise.alerta_km === true && !kmPainelConferido) {
    throw new Error(
      "Confirme o KM do painel antes de solicitar aprovação (divergência detectada no laudo IA).",
    );
  }
}
