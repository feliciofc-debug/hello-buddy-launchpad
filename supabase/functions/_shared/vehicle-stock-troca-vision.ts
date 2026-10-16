/** Visão isolada — troca vitrine. Mesmo gateway/modelo que classifyPhotoVertical. */


export const AI_GATEWAY_CHAT_COMPLETIONS_URL =
  "https://ai.gateway.lovable.dev/v1/chat/completions";

/** Alinhado a `MODEL_FAST` em whatsapp-cloud-inbound-processor. */
export const TROCA_VISION_MODEL_FAST = "google/gemini-3.6-flash";

export type TrocaVisionAnalysis = {
  ok: boolean;
  view: string | null;
  nitida: boolean | null;
  km_lido: number | null;
  luzes_alerta: boolean | null;
  avarias: string | null;
  raw?: string;
  unavailable?: boolean;
};

export function buildTrocaVisionPrompt(slotLabel: string): string {
  const label = slotLabel;
  return [
    `O cliente está enviando foto de: ${label}.`,
    "Analise a imagem e responda SOMENTE JSON válido:",
    '{"view":"Frente|Traseira|Lateral esquerda|Lateral direita|Lateral|Painel|Interior|Bancos|Pneus|Rodas|Motor|Veículo",',
    '"nitida":true|false,',
    '"km_lido":number|null,',
    '"luzes_alerta":true|false|null,',
    '"avarias":"texto curto"|null}',
    "view = ângulo principal visível. nitida=false se borrada/escura/cortada.",
    "km_lido só quando odômetro/painel legível. luzes_alerta se luz de advertência acesa.",
    "avarias: só danos visíveis (curto). Não cite FIPE, preço ou valor.",
  ].join("\n");
}

export function parseTrocaVisionAnalysis(raw: string): TrocaVisionAnalysis {
  try {
    const cleaned = String(raw || "")
      .replace(/```(?:json)?|```/gi, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    const kmRaw = parsed?.km_lido;
    let km_lido: number | null = null;
    if (typeof kmRaw === "number" && Number.isFinite(kmRaw)) km_lido = kmRaw;
    else if (typeof kmRaw === "string") {
      const digits = kmRaw.replace(/\D/g, "");
      if (digits) km_lido = Number.parseInt(digits, 10);
    }
    const nitida = typeof parsed?.nitida === "boolean" ? parsed.nitida : null;
    let luzes: boolean | null = null;
    if (typeof parsed?.luzes_alerta === "boolean") luzes = parsed.luzes_alerta;
    const avarias = parsed?.avarias != null && String(parsed.avarias).trim()
      ? String(parsed.avarias).trim().slice(0, 200)
      : null;
    const view = parsed?.view != null ? String(parsed.view).trim() : null;
    return {
      ok: true,
      view: view || null,
      nitida,
      km_lido,
      luzes_alerta: luzes,
      avarias,
      raw: cleaned.slice(0, 500),
    };
  } catch {
    return {
      ok: false,
      view: null,
      nitida: null,
      km_lido: null,
      luzes_alerta: null,
      avarias: null,
    };
  }
}

export async function analyzeTrocaPhotoVision(input: {
  apiKey: string;
  mime: string;
  base64: string;
  slotLabel: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}): Promise<TrocaVisionAnalysis> {
  const fetchFn = input.fetchFn ?? fetch;
  try {
    const response = await fetchFn(AI_GATEWAY_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: TROCA_VISION_MODEL_FAST,
        temperature: 0,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: buildTrocaVisionPrompt(input.slotLabel) },
            {
              type: "image_url",
              image_url: {
                url: `data:${input.mime};base64,${input.base64}`,
              },
            },
          ],
        }],
      }),
      signal: AbortSignal.timeout(input.timeoutMs ?? 30_000),
    });
    if (!response.ok) {
      return {
        ok: false,
        view: null,
        nitida: null,
        km_lido: null,
        luzes_alerta: null,
        avarias: null,
        unavailable: true,
      };
    }
    const body = await response.json();
    const raw = String(body?.choices?.[0]?.message?.content || "");
    return parseTrocaVisionAnalysis(raw);
  } catch {
    return {
      ok: false,
      view: null,
      nitida: null,
      km_lido: null,
      luzes_alerta: null,
      avarias: null,
      unavailable: true,
    };
  }
}

/** @deprecated use parseTrocaVisionAnalysis */
export function parseTrocaVisionResponse(raw: string): string {
  return parseTrocaVisionAnalysis(raw).view ?? "Veículo";
}
