export const BRAND_VERIFICATION_MODEL = "google/gemini-3.6-flash";

export type BrandVerificationPayload = {
  brand_visible: boolean;
  text_exact: boolean;
  text_found: string;
  logo_matches: boolean;
  invented_brands: string[];
  confidence: number;
};

export type BrandVerificationResult = BrandVerificationPayload & {
  approved: boolean;
  technical_error: boolean;
  error?: string;
};

const REJECTED_VERIFICATION: BrandVerificationPayload = {
  brand_visible: false,
  text_exact: false,
  text_found: "",
  logo_matches: false,
  invented_brands: [],
  confidence: 0,
};

const INSIGNIFICANT_BRAND_TERMS = new Set([
  "a",
  "as",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "empresa",
  "grupo",
  "marca",
  "o",
  "oficial",
  "os",
]);

export function normalizeBrandVerificationText(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isBrandNameCompatible(
  exactBrandName: string,
  textFound: string,
): boolean {
  const significantTerm = normalizeBrandVerificationText(exactBrandName)
    .split(/\s+/)
    .find((term) => term.length >= 2 && !INSIGNIFICANT_BRAND_TERMS.has(term));
  if (!significantTerm) return false;
  return normalizeBrandVerificationText(textFound).split(/\s+/).includes(significantTerm);
}

export function isBrandVerificationApproved(
  result: BrandVerificationPayload,
  exactBrandName = "",
): boolean {
  return result.brand_visible === true
    && result.logo_matches === true
    && Array.isArray(result.invented_brands)
    && result.invented_brands.length === 0
    && Number(result.confidence) >= 0.7
    && (
      result.text_exact === true
      || isBrandNameCompatible(exactBrandName, result.text_found)
    );
}

function parseVerificationJson(text: string): BrandVerificationPayload {
  const match = text
    .replace(/```json|```/gi, "")
    .match(/\{[\s\S]*\}/);
  if (!match) throw new Error("verification_json_missing");
  const parsed = JSON.parse(match[0]);
  if (
    typeof parsed?.brand_visible !== "boolean"
    || typeof parsed?.text_exact !== "boolean"
    || typeof parsed?.text_found !== "string"
    || typeof parsed?.logo_matches !== "boolean"
    || !Array.isArray(parsed?.invented_brands)
    || !Number.isFinite(Number(parsed?.confidence))
  ) {
    throw new Error("verification_json_invalid");
  }
  return {
    brand_visible: parsed.brand_visible,
    text_exact: parsed.text_exact,
    text_found: parsed.text_found.slice(0, 160),
    logo_matches: parsed.logo_matches,
    invented_brands: parsed.invented_brands
      .filter((value: unknown): value is string => typeof value === "string")
      .map((value: string) => value.slice(0, 100))
      .slice(0, 10),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence))),
  };
}

export async function verifyBrandInImage(input: {
  generatedImageDataUrl: string;
  logoDataUrl: string;
  exactBrandName: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  model?: string;
}): Promise<BrandVerificationResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model ?? BRAND_VERIFICATION_MODEL,
        temperature: 0,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Audite rigorosamente a primeira imagem gerada comparando-a com a segunda imagem, que é a logo oficial.

Nome cadastrado ou informado para checagem de compatibilidade: "${input.exactBrandName || "(não informado)"}".

Verifique:
1. A marca oficial está visível e legível em uma superfície física da cena.
2. O texto da marca na imagem gerada corresponde ao texto que realmente aparece na logo oficial de referência. A logo é a fonte da verdade; o nome informado acima é apenas uma pista de compatibilidade e não substitui a referência.
3. Cores, formas e símbolo correspondem à logo oficial, considerando apenas perspectiva, luz e material da superfície.
4. Não existe qualquer outra marca, empresa, logo ou slogan inventado.

Responda SOMENTE JSON válido:
{"brand_visible":boolean,"text_exact":boolean,"text_found":"texto lido","logo_matches":boolean,"invented_brands":[],"confidence":number}`,
            },
            { type: "image_url", image_url: { url: input.generatedImageDataUrl } },
            { type: "image_url", image_url: { url: input.logoDataUrl } },
          ],
        }],
      }),
      signal: AbortSignal.timeout(input.timeoutMs ?? 30_000),
    });
    if (!response.ok) {
      throw new Error(`verification_http_${response.status}`);
    }
    const body = await response.json();
    const payload = parseVerificationJson(String(body?.choices?.[0]?.message?.content || ""));
    return {
      ...payload,
      approved: isBrandVerificationApproved(payload, input.exactBrandName),
      technical_error: false,
    };
  } catch (error) {
    return {
      ...REJECTED_VERIFICATION,
      approved: false,
      technical_error: true,
      error: error instanceof Error ? error.message.slice(0, 160) : String(error).slice(0, 160),
    };
  }
}
