import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  normalizeGestaoTrocaChecklist,
  somaPreparacaoChecklist,
  type ChecklistReparoTipo,
  type GestaoTrocaChecklistJson,
} from "./gestao-troca-checklist.ts";
import {
  normalizeGestaoTrocaFotos,
  type GestaoTrocaFotoEntry,
} from "./gestao-troca-fotos.ts";
import {
  applyGestaoTrocaIaSlotMergeToFotosJson,
  mergeGestaoTrocaIaSlotsIntoFotos,
  gestaoTrocaFotosListaParaIa,
} from "./gestao-troca-foto-slot.ts";
import { gestaoTrocaRoteiroProgress } from "./gestao-troca-roteiro.ts";
import {
  analyzeGestaoTrocaFotosPorFoto,
  consolidateGestaoTrocaLaudoText,
  gestaoTrocaIaModel,
  type GestaoTrocaFotoManifest,
} from "./gestao-troca-ia-por-foto.ts";
import { recalcIndicioColisaoGestaoTroca } from "./gestao-troca-indicio-recalc.ts";
import {
  gestaoTrocaEspessuraFaixasFromConfig,
  parseGestaoTrocaEspessuraJson,
} from "./gestao-troca-espessura.ts";
import { gestaoTrocaIaItemRowsFromFotoAnalise } from "./gestao-troca-ia-foto-items.ts";
import { addDiasYmd, hojeSaoPaulo } from "./gestao-date-br.ts";
import { insertTrocaEvento } from "./gestao-troca-ops.ts";
import { assertGestaoTrocaLaudoNaoFinalizado } from "./gestao-troca-laudo-guard.ts";
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
  gestaoTrocaIaMaxFotoBytes,
  gestaoTrocaIaMaxFotos,
  type GestaoTrocaIaFotoInput,
  type GestaoTrocaIaQualidadeFoto,
} from "./gestao-troca-ia-vision.ts";

type Db = SupabaseClient;

export type GestaoTrocaIaUsoDiario = {
  analises: number;
  fotos: number;
};

function diaUtcBoundsSaoPaulo(diaYmd: string): { startIso: string; endExclusiveIso: string } {
  return {
    startIso: `${diaYmd}T03:00:00.000Z`,
    endExclusiveIso: `${addDiasYmd(diaYmd, 1)}T03:00:00.000Z`,
  };
}

function fotosAnalisadasNaAnalise(row: {
  progresso_total?: unknown;
  qualidade_json?: unknown;
}): number {
  const total = Number(row.progresso_total);
  if (Number.isFinite(total) && total > 0) return total;
  const q = row.qualidade_json;
  if (!Array.isArray(q)) return 0;
  return q.filter((x) => x && typeof x === "object" && (x as { usada?: boolean }).usada === true)
    .length;
}

/** Contagem informativa (sem bloqueio) — dia civil America/Sao_Paulo, por loja (user_id). */
export async function loadGestaoTrocaIaUsoDiario(sb: Db, userId: string): Promise<GestaoTrocaIaUsoDiario> {
  const dia = hojeSaoPaulo();
  const { startIso, endExclusiveIso } = diaUtcBoundsSaoPaulo(dia);
  const { data } = await sb.from("gestao_troca_analise_ia")
    .select("status, progresso_total, qualidade_json")
    .eq("user_id", userId)
    .gte("created_at", startIso)
    .lt("created_at", endExclusiveIso)
    .neq("status", "erro");
  let fotos = 0;
  for (const row of data ?? []) {
    fotos += fotosAnalisadasNaAnalise(row);
  }
  return { analises: data?.length ?? 0, fotos };
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
    throw new Error("Já existe uma análise em andamento nesta troca.");
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
  fotosPaths: { path: string; etiqueta: string }[],
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
      .select("id, km, fotos_json, espessura_json")
      .eq("id", trocaId)
      .eq("user_id", userId)
      .maybeSingle();
    if (trocaErr || !troca) throw new Error("Troca não encontrada.");

    const { data: cfgRow } = await sb.from("gestao_troca_config").select("*").eq("user_id", userId)
      .maybeSingle();
    const faixasEsp = gestaoTrocaEspessuraFaixasFromConfig(cfgRow ?? null);

    const fotosNorm = normalizeGestaoTrocaFotos(troca.fotos_json);
    const ordenadas = gestaoTrocaFotosListaParaIa(fotosNorm, gestaoTrocaIaMaxFotos());
    const manifests: GestaoTrocaFotoManifest[] = ordenadas.map((x, i) => ({
      indice: i + 1,
      path: x.path,
      etiqueta: x.etiqueta,
      slot: String(x.slot),
    }));

    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");

    await sb.from("gestao_troca_analise_ia").update({
      progresso_total: manifests.length,
      progresso_foto: 0,
      fotos_json: ordenadas.map((x) => ({ path: x.path, etiqueta: x.etiqueta, slot: x.slot ?? null })),
    }).eq("id", analiseId);

    const porFoto = await analyzeGestaoTrocaFotosPorFoto({
      apiKey,
      manifests,
      downloadBase64: async (path) => {
        const { data, error } = await sb.storage.from("trocas").download(path);
        if (error || !data) return { ok: false as const, reason: "download_falhou" };
        const buf = new Uint8Array(await data.arrayBuffer());
        const bytes = buf.byteLength;
        return {
          ok: true as const,
          mime: mimeFromPath(path),
          base64: bytesToBase64(buf),
          bytes,
        };
      },
      onProgress: async (done, total) => {
        await sb.from("gestao_troca_analise_ia").update({
          progresso_foto: done,
          progresso_total: total,
        }).eq("id", analiseId);
      },
    });
    if (!porFoto.ok) {
      await sb.from("gestao_troca_analise_ia").update({
        status: "rejeitada",
        erro: porFoto.error.slice(0, 500),
        concluida_em: new Date().toISOString(),
      }).eq("id", analiseId);
      return;
    }

    const fotosPosIa = mergeGestaoTrocaIaSlotsIntoFotos(fotosNorm, porFoto.rows);
    const { data: trocaFresh } = await sb.from("gestao_troca").select("fotos_json")
      .eq("id", trocaId)
      .eq("user_id", userId)
      .maybeSingle();
    const fotosAtualDb = normalizeGestaoTrocaFotos(trocaFresh?.fotos_json ?? troca.fotos_json);
    const fotosToSave = applyGestaoTrocaIaSlotMergeToFotosJson(fotosAtualDb, fotosPosIa);
    await sb.from("gestao_troca").update({
      fotos_json: fotosToSave,
      updated_at: new Date().toISOString(),
    }).eq("id", trocaId).eq("user_id", userId);

    const consolidado = await consolidateGestaoTrocaLaudoText({
      apiKey,
      fotoRows: porFoto.rows,
      fotosNorm: fotosToSave,
    });

    const indicio_colisao = recalcIndicioColisaoGestaoTroca({
      fotos_json: porFoto.rows,
      espessura_json: troca.espessura_json,
      faixas: faixasEsp,
      itens: [],
    });

    const tabela = await listGestaoTrocaIaCustos(sb, userId);
    const kmFicha = troca.km != null ? Number(troca.km) : null;
    const kmPainel = consolidado.km_painel;
    const alerta_km = gestaoTrocaIaAlertaKm(kmFicha, kmPainel);
    const etiquetasUsadas = manifests.map((f) => f.etiqueta);
    const roteiroProg = gestaoTrocaRoteiroProgress(fotosToSave);
    const aviso_carroceria = roteiroProg.faltando.some((id) =>
      ["frente", "traseira", "lateral_esq", "lateral_dir"].includes(id)
    ) || gestaoTrocaIaAvisoCarroceria(false, etiquetasUsadas);

    const temFotoPainel = manifests.some((f) => f.slot === "painel_ligado");
    const luzes_painel = consolidado.luzes_painel ??
      (temFotoPainel ? false : null);

    const fotosRef = manifests.map((m) => ({ path: m.path, etiqueta: m.etiqueta }));
    const { rows: itemRows, totalPreparacao: total } = gestaoTrocaIaItemRowsFromFotoAnalise({
      rows: porFoto.rows,
      fotos: fotosRef,
      tabela,
      analiseId,
      userId,
      trocaId,
    });

    if (itemRows.length) {
      const { error: insErr } = await sb.from("gestao_troca_ia_item").insert(itemRows);
      if (insErr) throw new Error("Não foi possível salvar itens do laudo.");
    }

    const estrutura_json = {
      resumo_por_area: consolidado.resumo_por_area,
      mensagem_parcial: consolidado.mensagem_parcial,
      indicio_colisao,
    };

    await sb.from("gestao_troca_analise_ia").update({
      status: "concluida",
      km_painel_lido: kmPainel,
      km_ficha: kmFicha,
      alerta_km,
      aviso_carroceria,
      luzes_painel,
      resumo: consolidado.conclusao_visual.slice(0, 500),
      conclusao_visual: consolidado.conclusao_visual,
      descricao_areas_json: [],
      fotos_json: porFoto.rows,
      estrutura_json,
      qualidade_json: porFoto.qualidade,
      modelo_ia: gestaoTrocaIaModel(),
      total_preparacao: total,
      progresso_foto: manifests.length,
      progresso_total: manifests.length,
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
  opts?: { scheduleBackground?: boolean },
): Promise<{ analise_id: string }> {
  const { data: troca } = await sb.from("gestao_troca").select("id, laudo_status")
    .eq("id", trocaId).eq("user_id", userId).maybeSingle();
  if (!troca) throw new Error("Troca não encontrada.");
  assertGestaoTrocaLaudoNaoFinalizado(troca);

  await assertNoGestaoTrocaAnaliseProcessando(sb, userId, trocaId);

  const { data: ins, error } = await sb.from("gestao_troca_analise_ia").insert({
    troca_id: trocaId,
    user_id: userId,
    status: "processando",
  }).select("id").single();
  if (error || !ins?.id) throw new Error("Não foi possível iniciar laudo IA.");

  if (opts?.scheduleBackground !== false) {
    scheduleGestaoTrocaIaAnaliseBackground(sb, String(ins.id), userId, trocaId);
  }
  return { analise_id: String(ins.id) };
}

export async function confirmarKmPainelGestaoTroca(
  sb: Db,
  userId: string,
  trocaId: string,
): Promise<void> {
  const { data: troca } = await sb.from("gestao_troca").select("id, laudo_status")
    .eq("id", trocaId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!troca?.id) throw new Error("Troca não encontrada.");
  assertGestaoTrocaLaudoNaoFinalizado(troca);

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
    .select("checklist_json, preparacao_estimada, laudo_status")
    .eq("id", trocaId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!troca) throw new Error("Troca não encontrada.");
  assertGestaoTrocaLaudoNaoFinalizado(troca);

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
