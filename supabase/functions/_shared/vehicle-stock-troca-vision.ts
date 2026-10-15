/** Visão isolada para fotos da troca (vitrine cliente) — só uso interno no recado ao avaliador. */

export type TrocaVisionView =
  | "Frente"
  | "Lateral"
  | "Traseira"
  | "3/4"
  | "Interior"
  | "Painel"
  | "Hodômetro"
  | "Veículo";

const ALLOWED: TrocaVisionView[] = [
  "Frente",
  "Lateral",
  "Traseira",
  "3/4",
  "Interior",
  "Painel",
  "Hodômetro",
  "Veículo",
];

export type TrocaVisionClient = (
  imageUrl: string,
) => Promise<{ view: TrocaVisionView }>;

const TROCA_VISION_PROMPT =
  'Analise esta foto enviada num fluxo de avaliação de troca. Responda SOMENTE JSON: {"view":"Frente|Lateral|Traseira|3/4|Interior|Painel|Hodômetro|Veículo"}. Não descreva conservação, arranhões, valor, FIPE ou preço.';

export function parseTrocaVisionResponse(raw: string): TrocaVisionView {
  try {
    const cleaned = String(raw || "")
      .replace(/```(?:json)?|```/gi, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    const view = String(parsed?.view || "").trim();
    if (ALLOWED.includes(view as TrocaVisionView)) return view as TrocaVisionView;
  } catch {
    // fallback
  }
  return "Veículo";
}

export function createLovableTrocaVisionClient(input: {
  apiKey: string;
  fetchFn?: typeof fetch;
  model?: string;
}): TrocaVisionClient {
  const fetchFn = input.fetchFn ?? fetch;
  const model = input.model ?? "google/gemini-3-flash-preview";
  return async (imageUrl: string) => {
    try {
      const response = await fetchFn(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": input.apiKey,
          },
          body: JSON.stringify({
            model,
            temperature: 0,
            messages: [{
              role: "user",
              content: [
                { type: "text", text: TROCA_VISION_PROMPT },
                { type: "image_url", image_url: { url: imageUrl } },
              ],
            }],
          }),
          signal: AbortSignal.timeout(20_000),
        },
      );
      if (!response.ok) throw new Error(`visao_${response.status}`);
      const result = await response.json();
      const raw = String(result?.choices?.[0]?.message?.content || "");
      return { view: parseTrocaVisionResponse(raw) };
    } catch {
      return { view: "Veículo" };
    }
  };
}
