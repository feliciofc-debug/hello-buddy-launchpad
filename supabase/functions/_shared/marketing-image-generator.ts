import {
  applyBrandLogo,
  buildBrandGenerationGuidance,
} from "./brand-image-engine.ts";
import { dataUrlToImageBytes } from "./brand-assets.ts";

export const MARKETING_IMAGE_MODELS = [
  "google/gemini-3.1-flash-image-preview",
  "google/gemini-3.1-flash-image",
  "google/gemini-3-pro-image",
  "google/gemini-3.1-flash-lite-image",
] as const;

export type MarketingImageMode = "text" | "base_photo" | "portrait" | "scene";
export type MarketingImageFormat = "feed" | "story";

export type MarketingImageRequest = {
  prompt: string;
  references?: string[];
  logoDataUrl?: string | null;
  brandColors?: string[];
  format?: MarketingImageFormat;
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  models?: readonly string[];
};

export type MarketingImageResult = {
  bytes: Uint8Array;
  mimeType: string;
  sourceDataUrl: string;
  model: string;
  mode: MarketingImageMode;
  format: MarketingImageFormat;
  logoRequested: boolean;
  logoApplied: boolean;
  logoApplicationFailed: boolean;
};

type GatewayFailure = {
  status?: number;
  detail: string;
};

const INVENTED_BRAND_RULES = `BRAND SAFETY — MANDATORY:
- Never invent or add a company name, brand, logo, logotype, slogan or watermark.
- Never place fictitious branding on screens, signs, packages, clothing, walls or products.
- Screens and panels must show generic, unnamed interfaces with no readable brand.
- A brand name may appear only when the user explicitly asks for that exact name.
- Do not redraw, imitate or render a logo. If a real logo is needed, it is applied after generation.`;

function hasMatch(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function detectMarketingImageMode(
  text: string,
  imageCount: number,
): MarketingImageMode {
  if (imageCount === 0) return "text";
  const normalized = text.toLowerCase();
  const identityPatterns = [
    /use minha pr[oó]pria foto/i,
    /minha foto/i,
    /meu rosto/i,
    /minha identidade/i,
    /meus tra[çc]os/i,
    /n[aã]o crie outra pessoa/i,
    /preserve (?:meu rosto|minha identidade)/i,
    /\bsou eu\b/i,
    /\bme (?:coloque|deixa|deixe)\b/i,
    /retrato executivo/i,
  ];
  const appearancePatterns = [
    /cabelo/i,
    /[oó]culos/i,
    /camisa/i,
    /terno/i,
    /escrit[oó]rio/i,
    /executivo/i,
    /jovial/i,
    /magro|magra/i,
    /dentes|sorriso/i,
    /ultrarrealista|fotogr[aá]fic/i,
  ];
  const firstPerson = [" meu ", " minha ", " comigo ", " mim ", " me "]
    .some((token) => ` ${normalized} `.includes(token));
  if (hasMatch(text, identityPatterns) || (firstPerson && hasMatch(text, appearancePatterns))) {
    return "portrait";
  }
  const scenePatterns = [
    /manter (?:a |o )?(?:foto|imagem|cen[aá]rio|ambiente|local|lugar|fachada|original)/i,
    /preserv[ae] (?:a |o )?(?:foto|imagem|cen[aá]rio|ambiente|local|lugar|fachada|original)/i,
    /mesm[ao] (?:foto|imagem|cena|fachada|loja|ambiente|local|lugar|cen[aá]rio)/i,
    /(?:esta|essa) (?:foto|imagem|fachada|loja)/i,
    /originalidade|fiel ao original|sem mudar (?:o )?(?:local|cen[aá]rio|ambiente)/i,
    /melhorar (?:as )?cores|melhorar (?:a )?(?:qualidade|ilumina[çc][aã]o|design)/i,
    /(?:deixar|deixe|deixa) (?:mais )?(?:bonita|bonito|profissional)/i,
    /minha (?:loja|fachada|empresa|f[aá]brica|oficina|cl[ií]nica|escrit[oó]rio)/i,
    /fachada|loja|estabelecimento|com[eé]rcio|pet ?shop|mercearia|padaria|restaurante|barbearia|sal[aã]o/i,
  ];
  return hasMatch(text, scenePatterns) ? "scene" : "base_photo";
}

export function detectMarketingImageFormat(text: string): MarketingImageFormat {
  return /\bstor(?:y|ies)\b|\breels?\b|\bvertical\b|9:16|tela cheia/i.test(text)
    ? "story"
    : "feed";
}

function formatGuidance(format: MarketingImageFormat): string {
  return format === "story"
    ? `FORMAT: exact 9:16 vertical composition for Story/Reels. Fill the frame; no bars or borders. Keep important content away from the top and bottom 15%.`
    : `FORMAT: exact 1:1 square composition for Instagram/Facebook feed. Fill the frame; no bars, borders or transparent background.`;
}

function conceptKeywords(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "marketing digital, automação, redes sociais";
  if (!/[\n,;|]/.test(compact)) return compact.slice(0, 600);
  return compact.split(/[\n,;|]+/)
    .map((part) => part.replace(/^[-–•\d.()\s]+/, "").replace(/\betc\.?$/i, "").trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((part) => part.slice(0, 240))
    .join(", ");
}

export function buildMarketingImagePrompt(input: {
  prompt: string;
  references?: string[];
  brandColors?: string[];
  hasLogo?: boolean;
  format?: MarketingImageFormat;
}): { mode: MarketingImageMode; format: MarketingImageFormat; messages: unknown[]; prompt: string } {
  const references = input.references ?? [];
  const referenceImage = references[0];
  const supportImages = referenceImage ? references.slice(1) : [];
  const mode = detectMarketingImageMode(input.prompt, references.length);
  const format = input.format ?? detectMarketingImageFormat(input.prompt);
  const brandGuidance = buildBrandGenerationGuidance(input.brandColors ?? [], {
    hasLogo: Boolean(input.hasLogo),
    hasBasePhoto: Boolean(referenceImage),
  });
  const support = supportImages.length
    ? `\nSUPPORT REFERENCES: The ${supportImages.length} additional image(s) are secondary references only and never replace the main subject or scene from the first image.\n`
    : "";
  let prompt: string;
  let system: string | null = null;

  if (mode === "portrait") {
    system = "Você é um editor fotográfico especializado em retratos executivos ultrarrealistas. Sua prioridade máxima é preservar a identidade real da pessoa da primeira foto.";
    prompt = `Edite a PRIMEIRA imagem usando-a como base principal. A pessoa deve continuar claramente sendo a MESMA pessoa. Preserve rosto, identidade, traços naturais, expressão e reconhecibilidade.

REGRAS INEGOCIÁVEIS:
- Não crie outra pessoa, não troque o rosto e não altere traços essenciais.
- Não rejuvenesça ou emagreça de forma exagerada; não plastifique a pele.
- Ajustes de cabelo, dentes, óculos, roupa, postura, luz e cenário devem ser sutis, elegantes e realistas.
- Priorize fotografia corporativa premium, natural, 8K, com anatomia correta.
${support}
IDENTIDADE VISUAL:
${brandGuidance}

${INVENTED_BRAND_RULES}

${formatGuidance(format)}

INSTRUÇÕES DO USUÁRIO:
${input.prompt}`;
  } else if (mode === "scene") {
    system = "Você é um retocador fotográfico profissional. Preserve a cena real da primeira foto: mesmo local, arquitetura, elementos e composição.";
    prompt = `Edite a PRIMEIRA imagem mantendo-a como BASE FIEL e RECONHECÍVEL. O local deve continuar sendo o mesmo, com arquitetura, enquadramento e elementos estruturais preservados.

REGRAS INEGOCIÁVEIS:
- Não troque o local, não invente outro ambiente e não altere a arquitetura.
- Não remova nem mova elementos importantes e não adicione pessoas, animais ou veículos ausentes.
- Preserve textos e letreiros existentes com a mesma grafia; apenas faça retoque fotográfico, nunca redesenhe.
- Permitido: corrigir cor, contraste, luz, ruído, nitidez e pequenos elementos visualmente poluentes.
- Resultado ultrarrealista com acabamento de fotografia comercial.
${support}
IDENTIDADE VISUAL:
${brandGuidance}

${INVENTED_BRAND_RULES}

${formatGuidance(format)}

INSTRUÇÕES DO USUÁRIO:
${input.prompt}`;
  } else if (mode === "base_photo") {
    prompt = `PRIMARY USER REQUEST (follow literally and faithfully):
"${input.prompt.trim()}"

Generate one ultra-realistic photographic image. Preserve the real product, person or place from the FIRST reference faithfully and recognizably. Build or refine the environment, background, light and finish around it. Supporting references never replace the main subject.
${support}
STYLE: photographic 8K quality, professional lighting, real materials and textures. No cartoon, illustration, vector or clip art.

BRAND PREPARATION:
${brandGuidance}

${INVENTED_BRAND_RULES}

${formatGuidance(format)}

ABSOLUTELY NO NEW TEXT, captions, labels or watermarks.`;
  } else {
    prompt = `PRIMARY USER REQUEST (follow literally and faithfully):
"${input.prompt.trim()}"

Generate one ultra-realistic photographic image depicting exactly what the user requested. Every requested object, scenery, atmosphere and action must be clearly recognizable. Do not replace it with a generic marketing photo.

STYLE: photographic 8K quality, cinematic professional lighting, real materials and textures. No cartoon, illustration, vector or clip art unless explicitly requested.
Concept summary: ${conceptKeywords(input.prompt)}.

BRAND PREPARATION:
${brandGuidance}

${INVENTED_BRAND_RULES}

${formatGuidance(format)}

ABSOLUTELY NO NEW TEXT, captions, labels or watermarks.`;
  }

  const content: unknown[] = [];
  if (referenceImage) content.push({ type: "image_url", image_url: { url: referenceImage } });
  for (const image of supportImages) {
    content.push({ type: "image_url", image_url: { url: image } });
  }
  content.push({ type: "text", text: prompt });
  const messages = [
    ...(system ? [{ role: "system", content: system }] : []),
    { role: "user", content: content.length === 1 ? prompt : content },
  ];
  return { mode, format, messages, prompt };
}

function decodeGeneratedImage(dataUrl: string): { bytes: Uint8Array; mimeType: string } {
  const decoded = dataUrlToImageBytes(dataUrl);
  if (!decoded) throw new Error("A IA respondeu com uma imagem inválida. Tente novamente.");
  return { bytes: decoded.bytes, mimeType: decoded.mime };
}

function gatewayErrorMessage(failure: GatewayFailure): string {
  if (failure.status === 402) {
    return "O saldo disponível para o serviço de IA acabou. Tente novamente mais tarde ou fale com o suporte.";
  }
  if (failure.status === 429) {
    return "A IA atingiu um limite temporário de solicitações. Aguarde alguns instantes e tente novamente.";
  }
  if (failure.status && failure.status >= 500) {
    return "O modelo de imagem não respondeu agora. Tente novamente em alguns minutos.";
  }
  if (failure.status === 401 || failure.status === 403) {
    return "O serviço de IA está temporariamente indisponível. Tente novamente em alguns minutos.";
  }
  return "Não consegui gerar a imagem agora. Revise o pedido e tente novamente.";
}

export async function generateMarketingImage(
  request: MarketingImageRequest,
): Promise<MarketingImageResult> {
  if (!request.apiKey) {
    throw new Error("O serviço de IA está temporariamente indisponível. Tente novamente em alguns minutos.");
  }
  const built = buildMarketingImagePrompt({
    prompt: request.prompt,
    references: request.references,
    brandColors: request.brandColors,
    hasLogo: Boolean(request.logoDataUrl),
    format: request.format,
  });
  const fetchImpl = request.fetchImpl ?? fetch;
  const models = request.models?.length ? request.models : MARKETING_IMAGE_MODELS;
  const timeoutMs = request.timeoutMs ?? 100_000;
  let lastFailure: GatewayFailure = { detail: "sem resposta" };

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetchImpl("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${request.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: built.messages,
            modalities: ["image", "text"],
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (response.ok) {
          const body = await response.json();
          const dataUrl = body?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          if (!dataUrl) {
            lastFailure = { status: response.status, detail: "resposta sem imagem" };
            continue;
          }
          const decoded = decodeGeneratedImage(dataUrl);
          let bytes = decoded.bytes;
          let mimeType = decoded.mimeType;
          let logoApplied = false;
          let logoApplicationFailed = false;
          const logo = dataUrlToImageBytes(request.logoDataUrl);
          if (logo) {
            try {
              const branded = await applyBrandLogo(bytes, logo.bytes, { format: built.format });
              bytes = branded.bytes;
              mimeType = "image/png";
              logoApplied = true;
            } catch (error) {
              logoApplicationFailed = true;
              console.error("[marketing-image-generator][brand]", error instanceof Error ? error.message : String(error));
            }
          }
          return {
            bytes,
            mimeType,
            sourceDataUrl: dataUrl,
            model,
            mode: built.mode,
            format: built.format,
            logoRequested: Boolean(request.logoDataUrl),
            logoApplied,
            logoApplicationFailed,
          };
        }
        const detail = (await response.text()).slice(0, 500);
        lastFailure = { status: response.status, detail };
        console.error(`[marketing-image-generator] gateway ${response.status} model=${model}`, detail);
        if ([401, 402, 403].includes(response.status)) throw new Error(gatewayErrorMessage(lastFailure));
        if (response.status === 400) break;
        if (response.status !== 429 && response.status < 500) break;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
      } catch (error) {
        if (
          error instanceof Error
          && (error.message.includes("saldo disponível") || error.message.includes("temporariamente indisponível"))
        ) throw error;
        lastFailure = { detail: error instanceof Error ? error.message : String(error) };
        console.error(`[marketing-image-generator] rede/timeout model=${model}`, lastFailure.detail);
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }
  throw new Error(gatewayErrorMessage(lastFailure));
}
