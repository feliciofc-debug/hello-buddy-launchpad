import {
  GESTAO_TROCA_IA_AREAS,
  GESTAO_TROCA_IA_CONFIANCAS,
  GESTAO_TROCA_IA_GRAVIDADES,
  GESTAO_TROCA_IA_TIPOS,
  parseGestaoTrocaIaVisionJson,
  type GestaoTrocaIaVisionResponse,
} from "./gestao-troca-ia-schema.ts";

export const GESTAO_TROCA_IA_VISION_MODEL = "google/gemini-3.6-flash";

export const AI_GATEWAY_CHAT_COMPLETIONS_URL =
  "https://ai.gateway.lovable.dev/v1/chat/completions";

const MAX_FOTOS = 16;
const MAX_BYTES_FOTO = 4 * 1024 * 1024;

export type GestaoTrocaIaFotoInput = {
  path: string;
  etiqueta: string;
  mime: string;
  base64: string;
  bytes: number;
};

export type GestaoTrocaIaQualidadeFoto = {
  path: string;
  etiqueta: string;
  bytes: number;
  usada: boolean;
  motivo_skip?: string;
};

export function buildGestaoTrocaIaVisionPrompt(fotos: { etiqueta: string }[]): string {
  const labels = fotos.map((f, i) => `${i + 1}. ${f.etiqueta}`).join("\n");
  return [
    "Você é perito de avaliação de veículos usados no Brasil.",
    "Analise TODAS as imagens anexas (cada uma tem etiqueta indicando o ângulo).",
    "Liste apenas avarias ou problemas VISÍVEIS com confiança razoável.",
    "Não cite FIPE, preço de mercado ou valor de compra/venda.",
    "km_painel: leia odômetro apenas se houver foto de painel ligado legível; senão null.",
    "luzes_painel: true se houver luz de advertência acesa visível no painel; false se painel visível sem luzes; null se não houver foto de painel.",
    "aviso_carroceria: true se faltar visão externa clara (frente, traseira ou laterais) para avaliar carroceria.",
    `Fotos enviadas:\n${labels}`,
    "Responda SOMENTE JSON válido, sem markdown, exatamente neste formato:",
    "{",
    '"km_painel": number|null,',
    '"luzes_painel": true|false|null,',
    '"aviso_carroceria": true|false,',
    '"resumo": string,',
    '"itens": [',
    "{",
    `"area": ${GESTAO_TROCA_IA_AREAS.join("|")},`,
    `"tipo": ${GESTAO_TROCA_IA_TIPOS.join("|")},`,
    `"gravidade": ${GESTAO_TROCA_IA_GRAVIDADES.join("|")},`,
    `"confianca": ${GESTAO_TROCA_IA_CONFIANCAS.join("|")},`,
    '"descricao": string',
    "}",
    "]",
    "}",
  ].join("\n");
}

export function gestaoTrocaIaMaxFotoBytes(): number {
  return MAX_BYTES_FOTO;
}

export function gestaoTrocaIaMaxFotos(): number {
  return MAX_FOTOS;
}

export async function analyzeGestaoTrocaFotosVision(input: {
  apiKey: string;
  fotos: GestaoTrocaIaFotoInput[];
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}): Promise<
  | { ok: true; data: GestaoTrocaIaVisionResponse; raw: string }
  | { ok: false; error: string; unavailable?: boolean }
> {
  if (!input.fotos.length) {
    return { ok: false, error: "Nenhuma foto elegível para análise." };
  }
  const fetchFn = input.fetchFn ?? fetch;
  const content: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: buildGestaoTrocaIaVisionPrompt(input.fotos) }];
  for (const f of input.fotos) {
    content.push({
      type: "image_url",
      image_url: { url: `data:${f.mime};base64,${f.base64}` },
    });
  }

  try {
    const response = await fetchFn(AI_GATEWAY_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: GESTAO_TROCA_IA_VISION_MODEL,
        temperature: 0,
        messages: [{ role: "user", content }],
      }),
      signal: AbortSignal.timeout(input.timeoutMs ?? 90_000),
    });
    if (!response.ok) {
      return { ok: false, error: "Serviço de visão indisponível.", unavailable: true };
    }
    const body = await response.json();
    const raw = String(body?.choices?.[0]?.message?.content || "");
    const parsed = parseGestaoTrocaIaVisionJson(raw);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    return { ok: true, data: parsed.data, raw: raw.slice(0, 2000) };
  } catch {
    return { ok: false, error: "Falha ao chamar visão.", unavailable: true };
  }
}
