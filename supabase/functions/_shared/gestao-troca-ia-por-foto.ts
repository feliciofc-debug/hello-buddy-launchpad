import {
  GESTAO_TROCA_IA_ACHADO_CONFIANCAS,
  GESTAO_TROCA_IA_ACHADO_SEVERIDADES,
  GESTAO_TROCA_IA_ACHADO_TIPOS,
  GESTAO_TROCA_IA_FOTO_QUALIDADES,
  parseGestaoTrocaIaFotoAnaliseJson,
  type GestaoTrocaIaFotoAnaliseRow,
} from "./gestao-troca-ia-foto-schema.ts";
import { gestaoTrocaIaAchadoToVisionItem } from "./gestao-troca-ia-foto-map.ts";
import type { GestaoTrocaIaVisionItem } from "./gestao-troca-ia-schema.ts";
import {
  GESTAO_TROCA_ROTEIRO_OBRIGATORIOS_TOTAL,
  GESTAO_TROCA_ROTEIRO_SLOTS,
  type GestaoTrocaFotoSlotId,
} from "./gestao-troca-roteiro.ts";
import { gestaoTrocaRoteiroProgress } from "./gestao-troca-roteiro.ts";
import type { GestaoTrocaFotoEntry } from "./gestao-troca-fotos.ts";
import {
  AI_GATEWAY_CHAT_COMPLETIONS_URL,
  type GestaoTrocaIaFotoInput,
} from "./gestao-troca-ia-vision.ts";

export function gestaoTrocaIaModel(): string {
  return Deno.env.get("GESTAO_TROCA_IA_MODEL")?.trim() || "google/gemini-3.6-flash";
}

export type GestaoTrocaResumoAreaCondicao =
  | "sem_apontamento"
  | "leve"
  | "atencao"
  | "grave"
  | "nao_fotografado";

export type GestaoTrocaResumoAreaRow = {
  area: "externo" | "estrutura_cofre" | "pneus" | "interno";
  condicao: GestaoTrocaResumoAreaCondicao;
  texto: string;
  fotos: number[];
};

export type GestaoTrocaConsolidacaoLaudo = {
  resumo_por_area: GestaoTrocaResumoAreaRow[];
  conclusao_visual: string;
  km_painel: number | null;
  luzes_painel: boolean | null;
  mensagem_parcial: string | null;
};

function buildPerPhotoPrompt(indice: number, slot: string, slotLabel: string): string {
  return [
    "Você é perito de avaliação de veículos usados no Brasil.",
    `Analise UMA foto (índice global ${indice}, slot informado: ${slot} — ${slotLabel}).`,
    "Descreva objetivamente o que se vê (2–4 frases).",
    "Regras: preferir subnotificar; chuva/reflexo/sujeira/poeira são condição da foto, NÃO avaria;",
    "massa_suspeita só se reflexo reto quebra naquele painel e não nos vizinhos, nunca confiança alta só pela foto;",
    "imagem escura/borrada → qualidade insuficiente e achados=[];",
    "não ler documentos; não descrever pessoas; não inventar sulco em mm;",
    "pneu: marca/DOT só se legível; sulco só aparenta bom/meia-vida/próximo do limite.",
    `qualidade_imagem: ${GESTAO_TROCA_IA_FOTO_QUALIDADES.join("|")}`,
    `tipo achado: ${GESTAO_TROCA_IA_ACHADO_TIPOS.join("|")}`,
    `severidade: ${GESTAO_TROCA_IA_ACHADO_SEVERIDADES.join("|")}`,
    `confianca: ${GESTAO_TROCA_IA_ACHADO_CONFIANCAS.join("|")}`,
    "Responda SOMENTE JSON válido:",
    "{",
    `"indice": ${indice},`,
    `"slot_informado": "${slot}",`,
    '"slot_identificado": string|null,',
    '"qualidade_imagem": string,',
    '"motivo_qualidade": string,',
    '"descricao": string,',
    '"achados": [{ "tipo", "local", "severidade", "confianca", "evidencia" }],',
    '"nao_da_para_afirmar": string[]',
    "}",
  ].join("\n");
}

function parseJsonFromModel(raw: string): unknown {
  const t = raw.trim().replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(t);
}

export async function analyzeOneGestaoTrocaFoto(input: {
  apiKey: string;
  foto: GestaoTrocaIaFotoInput & { indice: number; slot: GestaoTrocaFotoSlotId | string };
  fetchFn?: typeof fetch;
}): Promise<{ ok: true; row: GestaoTrocaIaFotoAnaliseRow } | { ok: false; error: string }> {
  const slotDef = GESTAO_TROCA_ROTEIRO_SLOTS.find((s) => s.id === input.foto.slot);
  const slotLabel = slotDef?.label ?? String(input.foto.slot);
  const fetchFn = input.fetchFn ?? fetch;
  const content: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
  > = [
    { type: "text", text: buildPerPhotoPrompt(input.foto.indice, String(input.foto.slot), slotLabel) },
    { type: "image_url", image_url: { url: `data:${input.foto.mime};base64,${input.foto.base64}` } },
  ];
  try {
    const response = await fetchFn(AI_GATEWAY_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: gestaoTrocaIaModel(),
        temperature: 0,
        messages: [{ role: "user", content }],
      }),
      signal: AbortSignal.timeout(55_000),
    });
    if (!response.ok) return { ok: false, error: "visão indisponível" };
    const body = await response.json();
    const raw = String(body?.choices?.[0]?.message?.content || "");
    const parsed = parseJsonFromModel(raw);
    const row = parseGestaoTrocaIaFotoAnaliseJson(parsed, input.foto.indice);
    if (!row) return { ok: false, error: "JSON inválido" };
    return {
      ok: true,
      row: { ...row, path: input.foto.path, indice: input.foto.indice, slot_informado: input.foto.slot },
    };
  } catch {
    return { ok: false, error: "falha visão" };
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function analyzeGestaoTrocaFotosPorFoto(input: {
  apiKey: string;
  fotos: (GestaoTrocaIaFotoInput & { indice: number; slot: GestaoTrocaFotoSlotId | string })[];
  onProgress?: (done: number, total: number) => void | Promise<void>;
  fetchFn?: typeof fetch;
}): Promise<
  | { ok: true; rows: GestaoTrocaIaFotoAnaliseRow[] }
  | { ok: false; error: string }
> {
  if (!input.fotos.length) return { ok: false, error: "Nenhuma foto para analisar." };
  const total = input.fotos.length;
  let done = 0;
  const rows = await mapPool(input.fotos, 4, async (foto) => {
    let last = await analyzeOneGestaoTrocaFoto({ apiKey: input.apiKey, foto, fetchFn: input.fetchFn });
    if (!last.ok) {
      last = await analyzeOneGestaoTrocaFoto({ apiKey: input.apiKey, foto, fetchFn: input.fetchFn });
    }
    done++;
    await input.onProgress?.(done, total);
    if (!last.ok) {
      return {
        indice: foto.indice,
        slot_informado: foto.slot,
        slot_identificado: null,
        qualidade_imagem: "insuficiente" as const,
        motivo_qualidade: last.error,
        descricao: "Análise não concluída para esta foto.",
        achados: [],
        nao_da_para_afirmar: [],
        path: foto.path,
      };
    }
    return last.row;
  });
  rows.sort((a, b) => a.indice - b.indice);
  return { ok: true, rows };
}

export function visionItemsFromFotoRows(
  rows: GestaoTrocaIaFotoAnaliseRow[],
): GestaoTrocaIaVisionItem[] {
  const out: GestaoTrocaIaVisionItem[] = [];
  for (const row of rows) {
    for (const achado of row.achados) {
      out.push(
        gestaoTrocaIaAchadoToVisionItem({
          achado,
          fotoIndice: row.indice,
          slot: String(row.slot_informado),
        }),
      );
    }
  }
  return out;
}

function kmFromPainelRow(rows: GestaoTrocaIaFotoAnaliseRow[]): number | null {
  const painel = rows.find((r) => String(r.slot_informado) === "painel_ligado");
  if (!painel) return null;
  const m = painel.descricao.replace(/\./g, "").match(/(\d{1,3}[\d.]?\d*)\s*km/i);
  if (!m) return null;
  const digits = m[1].replace(/\D/g, "");
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

export async function consolidateGestaoTrocaLaudoText(input: {
  apiKey: string;
  fotoRows: GestaoTrocaIaFotoAnaliseRow[];
  fotosNorm: GestaoTrocaFotoEntry[];
  fetchFn?: typeof fetch;
}): Promise<GestaoTrocaConsolidacaoLaudo> {
  const prog = gestaoTrocaRoteiroProgress(input.fotosNorm);
  const faltando = prog.faltando.length;
  const mensagem_parcial = faltando > 0
    ? `Avaliação parcial: ${faltando} ângulos obrigatórios não fotografados.`
    : null;

  const payload = {
    fotos: input.fotoRows.map((r) => ({
      indice: r.indice,
      slot: r.slot_informado,
      descricao: r.descricao,
      achados: r.achados,
      qualidade: r.qualidade_imagem,
    })),
    slots_obrigatorios_faltando: prog.faltando,
  };

  const fetchFn = input.fetchFn ?? fetch;
  const prompt = [
    "Consolide o laudo de vistoria em português (Brasil) a partir do JSON.",
    "Produza resumo_por_area para: externo, estrutura_cofre, pneus, interno.",
    "condicao: sem_apontamento|leve|atencao|grave|nao_fotografado — cite fotos (#n) no texto.",
    faltando > 0
      ? `OBRIGATÓRIO incluir conclusao_visual mencionando: "${mensagem_parcial}"`
      : "Proibido usar 'excelente estado' se faltar slot obrigatório.",
    "km_painel e luzes_painel só se evidenciados na foto painel_ligado.",
    "Sem preços. JSON only:",
    '{ "resumo_por_area": [...], "conclusao_visual": string, "km_painel": number|null, "luzes_painel": true|false|null }',
    JSON.stringify(payload),
  ].join("\n");

  try {
    const response = await fetchFn(AI_GATEWAY_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: gestaoTrocaIaModel(),
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (response.ok) {
      const body = await response.json();
      const raw = String(body?.choices?.[0]?.message?.content || "");
      const parsed = parseJsonFromModel(raw) as Record<string, unknown>;
      const areas = Array.isArray(parsed.resumo_por_area) ? parsed.resumo_por_area : [];
      const resumo: GestaoTrocaResumoAreaRow[] = [];
      for (const a of areas) {
        if (!a || typeof a !== "object") continue;
        const o = a as Record<string, unknown>;
        const area = String(o.area ?? "");
        if (!["externo", "estrutura_cofre", "pneus", "interno"].includes(area)) continue;
        resumo.push({
          area: area as GestaoTrocaResumoAreaRow["area"],
          condicao: String(o.condicao ?? "sem_apontamento") as GestaoTrocaResumoAreaCondicao,
          texto: String(o.texto ?? "").slice(0, 600),
          fotos: Array.isArray(o.fotos) ? o.fotos.map((n) => Number(n)).filter((n) => n >= 1) : [],
        });
      }
      if (resumo.length) {
        return {
          resumo_por_area: resumo,
          conclusao_visual: String(parsed.conclusao_visual ?? "").slice(0, 800) ||
            (mensagem_parcial ?? "Laudo consolidado."),
          km_painel: parsed.km_painel != null ? Number(parsed.km_painel) : kmFromPainelRow(input.fotoRows),
          luzes_painel: typeof parsed.luzes_painel === "boolean" ? parsed.luzes_painel : null,
          mensagem_parcial,
        };
      }
    }
  } catch {
    /* fallback below */
  }

  return {
    resumo_por_area: fallbackResumo(input.fotoRows, prog.faltando),
    conclusao_visual: mensagem_parcial ??
      "Laudo foto a foto concluído; revisar achados pendentes.",
    km_painel: kmFromPainelRow(input.fotoRows),
    luzes_painel: null,
    mensagem_parcial,
  };
}

function fallbackResumo(
  rows: GestaoTrocaIaFotoAnaliseRow[],
  faltando: GestaoTrocaFotoSlotId[],
): GestaoTrocaResumoAreaRow[] {
  const grupos: GestaoTrocaResumoAreaRow["area"][] = [
    "externo",
    "estrutura_cofre",
    "pneus",
    "interno",
  ];
  return grupos.map((area) => {
    const slots = GESTAO_TROCA_ROTEIRO_SLOTS.filter((s) => {
      if (area === "externo") return s.grupo === "externo";
      if (area === "estrutura_cofre") return s.grupo === "estrutura";
      if (area === "pneus") return s.grupo === "pneus";
      return s.grupo === "interno";
    }).map((s) => s.id);
    const missing = slots.filter((id) => faltando.includes(id));
    if (missing.length === slots.filter((id) =>
      GESTAO_TROCA_ROTEIRO_SLOTS.find((s) => s.id === id)?.obrigatorio
    ).length) {
      return {
        area,
        condicao: "nao_fotografado",
        texto: "⚪ não fotografado — não avaliado",
        fotos: [],
      };
    }
    const idxs = rows.filter((r) => slots.includes(String(r.slot_informado) as GestaoTrocaFotoSlotId))
      .map((r) => r.indice);
    const achados = rows.flatMap((r) => r.achados);
    const cond = achados.some((a) => a.severidade === "grave")
      ? "grave"
      : achados.some((a) => a.severidade === "moderada")
      ? "atencao"
      : achados.length
      ? "leve"
      : "sem_apontamento";
    return {
      area,
      condicao: cond as GestaoTrocaResumoAreaCondicao,
      texto: rows.filter((r) => idxs.includes(r.indice)).map((r) => r.descricao).join(" ").slice(0, 400),
      fotos: idxs,
    };
  });
}

export { GESTAO_TROCA_ROTEIRO_OBRIGATORIOS_TOTAL };
