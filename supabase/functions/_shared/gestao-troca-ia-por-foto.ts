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
  gestaoTrocaIaMaxFotoBytes,
  type GestaoTrocaIaFotoInput,
} from "./gestao-troca-ia-vision.ts";
import { buildGestaoTrocaIaFotoPrompt } from "./gestao-troca-ia-foto-prompt.ts";
import {
  calcResumoPorAreaRegra,
  mergeResumoTextoIa,
} from "./gestao-troca-consolidacao-regra.ts";

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

export type GestaoTrocaFotoManifest = {
  indice: number;
  path: string;
  etiqueta: string;
  slot: string;
};

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
    { type: "text", text: buildGestaoTrocaIaFotoPrompt(input.foto.indice, String(input.foto.slot), slotLabel) },
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
  manifests: GestaoTrocaFotoManifest[];
  downloadBase64: (
    path: string,
  ) => Promise<
    | { ok: true; mime: string; base64: string; bytes: number }
    | { ok: false; reason: string }
  >;
  onProgress?: (done: number, total: number) => void | Promise<void>;
  fetchFn?: typeof fetch;
}): Promise<
  | { ok: true; rows: GestaoTrocaIaFotoAnaliseRow[]; qualidade: import("./gestao-troca-ia-vision.ts").GestaoTrocaIaQualidadeFoto[] }
  | { ok: false; error: string }
> {
  if (!input.manifests.length) return { ok: false, error: "Nenhuma foto para analisar." };
  const total = input.manifests.length;
  const maxBytes = gestaoTrocaIaMaxFotoBytes();
  let done = 0;
  const qualidade: import("./gestao-troca-ia-vision.ts").GestaoTrocaIaQualidadeFoto[] = [];
  const rows = await mapPool(input.manifests, 4, async (manifest) => {
    const dl = await input.downloadBase64(manifest.path);
    if (!dl.ok) {
      qualidade.push({
        path: manifest.path,
        etiqueta: manifest.etiqueta,
        bytes: 0,
        usada: false,
        motivo_skip: dl.reason,
      });
      done++;
      await input.onProgress?.(done, total);
      return {
        indice: manifest.indice,
        slot_informado: manifest.slot,
        slot_identificado: null,
        qualidade_imagem: "insuficiente" as const,
        motivo_qualidade: dl.reason,
        descricao: "Foto não disponível para análise.",
        achados: [],
        nao_da_para_afirmar: [],
        path: manifest.path,
      };
    }
    if (dl.bytes > maxBytes) {
      qualidade.push({
        path: manifest.path,
        etiqueta: manifest.etiqueta,
        bytes: dl.bytes,
        usada: false,
        motivo_skip: "arquivo_maior_4mb",
      });
      done++;
      await input.onProgress?.(done, total);
      return {
        indice: manifest.indice,
        slot_informado: manifest.slot,
        slot_identificado: null,
        qualidade_imagem: "insuficiente" as const,
        motivo_qualidade: "arquivo maior que 4MB",
        descricao: "Arquivo excede limite para IA.",
        achados: [],
        nao_da_para_afirmar: [],
        path: manifest.path,
      };
    }
    const foto: GestaoTrocaIaFotoInput & { indice: number; slot: string } = {
      path: manifest.path,
      etiqueta: manifest.etiqueta,
      mime: dl.mime,
      base64: dl.base64,
      bytes: dl.bytes,
      indice: manifest.indice,
      slot: manifest.slot,
    };
    let last = await analyzeOneGestaoTrocaFoto({ apiKey: input.apiKey, foto, fetchFn: input.fetchFn });
    if (!last.ok) {
      last = await analyzeOneGestaoTrocaFoto({ apiKey: input.apiKey, foto, fetchFn: input.fetchFn });
    }
    qualidade.push({
      path: manifest.path,
      etiqueta: manifest.etiqueta,
      bytes: dl.bytes,
      usada: last.ok,
      motivo_skip: last.ok ? undefined : last.error,
    });
    done++;
    await input.onProgress?.(done, total);
    if (!last.ok) {
      return {
        indice: manifest.indice,
        slot_informado: manifest.slot,
        slot_identificado: null,
        qualidade_imagem: "insuficiente" as const,
        motivo_qualidade: last.error,
        descricao: "Análise não concluída para esta foto.",
        achados: [],
        nao_da_para_afirmar: [],
        path: manifest.path,
      };
    }
    return last.row;
  });
  rows.sort((a, b) => a.indice - b.indice);
  return { ok: true, rows, qualidade };
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
  if (painel.km_painel != null && Number.isFinite(painel.km_painel)) return painel.km_painel;
  return null;
}

function luzesFromPainelRow(rows: GestaoTrocaIaFotoAnaliseRow[]): boolean | null {
  const painel = rows.find((r) => String(r.slot_informado) === "painel_ligado");
  if (!painel) return null;
  if (painel.luzes_alerta?.length) return true;
  return false;
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

  const regra = calcResumoPorAreaRegra({
    fotoRows: input.fotoRows,
    fotosNorm: input.fotosNorm,
  });

  const fetchFn = input.fetchFn ?? fetch;
  const prompt = [
    "Escreva textos descritivos em português (Brasil) para cada área do laudo.",
    "NÃO altere condicao (já definida por regra). Retorne JSON:",
    '{ "textos": { "externo": string, "estrutura_cofre": string, "pneus": string, "interno": string },',
    '"conclusao_visual": string }',
    "Cite fotos (#n). Sem preços.",
    faltando > 0 ? `Mencione: ${mensagem_parcial}` : "",
    JSON.stringify({ condicoes: regra, fotos: input.fotoRows }),
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
      const textos = parsed.textos && typeof parsed.textos === "object"
        ? parsed.textos as Record<string, string>
        : {};
      const resumo = mergeResumoTextoIa(regra, textos);
      return {
        resumo_por_area: resumo,
        conclusao_visual: String(parsed.conclusao_visual ?? "").slice(0, 800) ||
          (mensagem_parcial ?? "Laudo consolidado."),
        km_painel: kmFromPainelRow(input.fotoRows),
        luzes_painel: luzesFromPainelRow(input.fotoRows),
        mensagem_parcial,
      };
    }
  } catch {
    /* fallback below */
  }

  const regraFb = calcResumoPorAreaRegra({
    fotoRows: input.fotoRows,
    fotosNorm: input.fotosNorm,
  });
  return {
    resumo_por_area: regraFb.map((r) => ({
      ...r,
      texto: r.texto || input.fotoRows.filter((fr) => r.fotos.includes(fr.indice)).map((x) => x.descricao).join(" ").slice(0, 400),
    })),
    conclusao_visual: mensagem_parcial ??
      "Laudo foto a foto concluído; revisar achados pendentes.",
    km_painel: kmFromPainelRow(input.fotoRows),
    luzes_painel: luzesFromPainelRow(input.fotoRows),
    mensagem_parcial,
  };
}

export { GESTAO_TROCA_ROTEIRO_OBRIGATORIOS_TOTAL };
