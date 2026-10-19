import {
  GESTAO_TROCA_IA_DESCRICAO_AREAS,
  GESTAO_TROCA_IA_DESCRICAO_CONDICOES,
  GESTAO_TROCA_IA_DESCRICAO_SECOES,
} from "./gestao-troca-ia-descricao-schema.ts";
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
    "Liste avarias ou problemas VISÍVEIS com confiança razoável em itens.",
    "",
    "LAUDO DESCRITIVO (descricao_areas): descreva TODAS as áreas abaixo, inclusive as em bom estado aparente.",
    "Cada texto factual (1–2 frases) DEVE citar números das fotos entre parênteses, ex.: (1, 3).",
    "Área sem evidência em foto → condicao 'nao_fotografado', fotos=[] e texto 'não fotografado' — NUNCA diga bom/sem alteração sem foto.",
    "Gotas de chuva, reflexo, sujeira ou limitação da foto: descreva como condição da foto, não como defeito do veículo.",
    "Sem preços. Não conclua batida/acidente; descreva tom diferente, desalinhamento, etc.",
    `secao: ${GESTAO_TROCA_IA_DESCRICAO_SECOES.join("|")}`,
    `area (uma linha por área, todas obrigatórias): ${GESTAO_TROCA_IA_DESCRICAO_AREAS.join(", ")}`,
    `condicao: ${GESTAO_TROCA_IA_DESCRICAO_CONDICOES.join("|")}`,
    "conclusao_visual: 2–3 frases sobre estado aparente e pendências de foto, sem preço.",
    "Não cite FIPE, preço de mercado ou valor de compra/venda.",
    "km_painel: leia odômetro apenas se houver foto de painel ligado legível; senão null.",
    "LUZES DE PAINEL — registre SOMENTE luzes de FALHA (tipo luz_alerta, area painel): injeção/motor (check engine), airbag, ABS, óleo, bateria/carga, temperatura, falha de freio, direção, TPMS/pressão dos pneus, tração/ESP.",
    "NUNCA registre como item de alerta: cinto de segurança, freio de estacionamento acionado, porta aberta, farol/lanterna/seta/farol alto ou outros indicadores informativos normais com o carro parado.",
    "luzes_painel: true se houver luz de FALHA acesa; false se foto de painel legível sem luzes de falha; null se não houver foto de painel.",
    "aviso_carroceria: true se faltar visão externa clara (frente, traseira ou laterais) para avaliar carroceria.",
    `Fotos enviadas:\n${labels}`,
    "Responda SOMENTE JSON válido, sem markdown, exatamente neste formato:",
    "{",
    '"km_painel": number|null,',
    '"luzes_painel": true|false|null,',
    '"aviso_carroceria": true|false,',
    '"resumo": string,',
    '"conclusao_visual": string,',
    '"descricao_areas": [',
    "{",
    `"secao": ${GESTAO_TROCA_IA_DESCRICAO_SECOES.join("|")},`,
    `"area": ${GESTAO_TROCA_IA_DESCRICAO_AREAS.join("|")},`,
    `"condicao": ${GESTAO_TROCA_IA_DESCRICAO_CONDICOES.join("|")},`,
    '"texto": string,',
    '"fotos": number[] (índices 1-based das fotos listadas; vazio se nao_fotografado)',
    "}",
    "],",
    '"itens": [',
    "{",
    `"area": ${GESTAO_TROCA_IA_AREAS.join("|")},`,
    `"tipo": ${GESTAO_TROCA_IA_TIPOS.join("|")},`,
    `"gravidade": ${GESTAO_TROCA_IA_GRAVIDADES.join("|")},`,
    `"confianca": ${GESTAO_TROCA_IA_CONFIANCAS.join("|")},`,
    '"descricao": string,',
    '"foto_indice": number|null (1 = primeira foto listada acima, indica onde a avaria/luz aparece)',
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
    const parsed = parseGestaoTrocaIaVisionJson(raw, input.fotos.length);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    return { ok: true, data: parsed.data, raw: raw.slice(0, 2000) };
  } catch {
    return { ok: false, error: "Falha ao chamar visão.", unavailable: true };
  }
}
