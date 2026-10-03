import {
  applyBrandLogo,
  buildBrandGenerationGuidance,
  inspectLogoCardFromBytes,
} from "./brand-image-engine.ts";
import { dataUrlToImageBytes } from "./brand-assets.ts";
import {
  type BrandVerificationResult,
  isBrandNameCompatible,
  verifyBrandInImage,
} from "./brand-verification.ts";

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
  cardBackgroundHex?: string | null;
  brandName?: string | null;
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
  brandApplicationMode:
    | "none"
    | "in_scene_verified"
    | "in_scene_retry_verified"
    | "overlay"
    | "overlay_fallback";
  verificationAttempts: BrandVerificationResult[];
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

const IN_SCENE_BRAND_RULES = `BRAND SAFETY — MANDATORY:
- Use ONLY the official logo supplied as the LAST image reference.
- Integrate it into exactly ONE coherent physical surface in the scene: a wall sign, door sign, LED panel, monitor, uniform/badge, package, mug or storefront.
- Reproduce the logo EXACTLY as it appears in the reference image, engraved or physically applied to that surface. The logo reference is the sole source of truth.
- Preserve every letter, word, color, symbol and proportion from the official reference. Respect perspective, lighting and material without changing its content.
- Never invent another company name, brand, logo, slogan or promotional text anywhere.
- All other screens, panels, packages, clothing and walls must remain generic and unnamed.`;

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
  cardBackgroundHex?: string | null;
  inSceneBrand?: {
    logoDataUrl: string;
    exactName: string;
    retryFeedback?: string;
  } | null;
  format?: MarketingImageFormat;
}): { mode: MarketingImageMode; format: MarketingImageFormat; messages: unknown[]; prompt: string } {
  const references = input.references ?? [];
  const referenceImage = references[0];
  const supportImages = referenceImage ? references.slice(1) : [];
  const mode = detectMarketingImageMode(input.prompt, references.length);
  const format = input.format ?? detectMarketingImageFormat(input.prompt);
  const brandGuidance = input.inSceneBrand
    ? "Reproduza a logo exatamente como na ÚLTIMA imagem de referência, gravada ou aplicada em UMA superfície física realista da cena. Não escreva o nome da marca separadamente e não aplique como etiqueta flutuante ou overlay."
    : buildBrandGenerationGuidance(input.brandColors ?? [], {
      hasLogo: Boolean(input.hasLogo),
      hasBasePhoto: Boolean(referenceImage),
      cardBackgroundHex: input.cardBackgroundHex,
    });
  const brandRules = input.inSceneBrand ? IN_SCENE_BRAND_RULES : INVENTED_BRAND_RULES;
  const noTextRule = input.inSceneBrand
    ? "The only text allowed is the text that already exists inside the official logo reference. Do not write, complete, translate or infer any brand name separately."
    : "ABSOLUTELY NO NEW TEXT, captions, labels or watermarks.";
  const retryGuidance = input.inSceneBrand?.retryFeedback
    ? `\nCORRECTION REQUIRED AFTER VERIFICATION: ${input.inSceneBrand.retryFeedback}\n`
    : "";
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

${brandRules}
${retryGuidance}

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

${brandRules}
${retryGuidance}

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

${brandRules}
${retryGuidance}

${formatGuidance(format)}

${noTextRule}`;
  } else {
    prompt = `PRIMARY USER REQUEST (follow literally and faithfully):
"${input.prompt.trim()}"

Generate one ultra-realistic photographic image depicting exactly what the user requested. Every requested object, scenery, atmosphere and action must be clearly recognizable. Do not replace it with a generic marketing photo.

STYLE: photographic 8K quality, cinematic professional lighting, real materials and textures. No cartoon, illustration, vector or clip art unless explicitly requested.
Concept summary: ${conceptKeywords(input.prompt)}.

BRAND PREPARATION:
${brandGuidance}

${brandRules}
${retryGuidance}

${formatGuidance(format)}

${noTextRule}`;
  }

  const content: unknown[] = [];
  if (referenceImage) content.push({ type: "image_url", image_url: { url: referenceImage } });
  for (const image of supportImages) {
    content.push({ type: "image_url", image_url: { url: image } });
  }
  if (input.inSceneBrand) {
    content.push({ type: "image_url", image_url: { url: input.inSceneBrand.logoDataUrl } });
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

async function callImageGateway(input: {
  messages: unknown[];
  apiKey: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  models: readonly string[];
}): Promise<{ dataUrl: string; model: string }> {
  let lastFailure: GatewayFailure = { detail: "sem resposta" };
  for (const model of input.models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await input.fetchImpl("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${input.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: input.messages,
            modalities: ["image", "text"],
          }),
          signal: AbortSignal.timeout(input.timeoutMs),
        });
        if (response.ok) {
          const body = await response.json();
          const dataUrl = body?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          if (dataUrl) return { dataUrl, model };
          lastFailure = { status: response.status, detail: "resposta sem imagem" };
          continue;
        }
        const detail = (await response.text()).slice(0, 500);
        lastFailure = { status: response.status, detail };
        console.error(`[marketing-image-generator] gateway ${response.status} model=${model}`, detail);
        if ([401, 402, 403].includes(response.status)) {
          throw new Error(gatewayErrorMessage(lastFailure));
        }
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

function verificationFeedback(
  result: BrandVerificationResult,
  exactBrandName: string,
): string {
  if (result.technical_error) {
    return "A verificação anterior falhou tecnicamente. Reproduza a logo oficial com máxima fidelidade e sem qualquer outro texto ou marca.";
  }
  const issues: string[] = [];
  if (!result.brand_visible) issues.push("a marca não ficou visível e legível");
  if (!result.text_exact && !isBrandNameCompatible(exactBrandName, result.text_found)) {
    issues.push(`a grafia ficou incorreta${result.text_found ? ` (foi lido: "${result.text_found}")` : ""}`);
  }
  if (!result.logo_matches) issues.push("formas ou cores não corresponderam à referência");
  if (result.invented_brands.length) {
    issues.push(`apareceram marcas inventadas: ${result.invented_brands.join(", ")}`);
  }
  if (result.confidence < 0.7) issues.push("a confiança visual ficou abaixo do mínimo");
  return `Corrija estes problemas: ${issues.join("; ") || "a marca não passou na auditoria"}.`;
}

export async function generateMarketingImage(
  request: MarketingImageRequest,
): Promise<MarketingImageResult> {
  if (!request.apiKey) {
    throw new Error("O serviço de IA está temporariamente indisponível. Tente novamente em alguns minutos.");
  }
  const logoAsset = dataUrlToImageBytes(request.logoDataUrl);
  const card = logoAsset
    ? await inspectLogoCardFromBytes(logoAsset.bytes)
    : null;
  const baseline = buildMarketingImagePrompt({
    prompt: request.prompt,
    references: request.references,
    brandColors: request.brandColors,
    hasLogo: Boolean(request.logoDataUrl),
    cardBackgroundHex: card?.hex,
    format: request.format,
  });
  const fetchImpl = request.fetchImpl ?? fetch;
  const models = request.models?.length ? request.models : MARKETING_IMAGE_MODELS;
  const timeoutMs = request.timeoutMs ?? 100_000;
  const startedAt = Date.now();
  const verificationAttempts: BrandVerificationResult[] = [];
  const exactBrandName = String(request.brandName || "").trim().slice(0, 120);
  const useInSceneBrand = Boolean(
    logoAsset
    && request.logoDataUrl
    && baseline.mode === "text",
  );

  if (useInSceneBrand) {
    let feedback: string | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      const brandedPrompt = buildMarketingImagePrompt({
        prompt: request.prompt,
        references: request.references,
        brandColors: request.brandColors,
        hasLogo: true,
        cardBackgroundHex: card?.hex,
        format: request.format,
        inSceneBrand: {
          logoDataUrl: request.logoDataUrl!,
          exactName: exactBrandName,
          retryFeedback: feedback,
        },
      });
      const generated = await callImageGateway({
        messages: brandedPrompt.messages,
        apiKey: request.apiKey,
        fetchImpl,
        timeoutMs,
        models,
      });
      const verification = await verifyBrandInImage({
        generatedImageDataUrl: generated.dataUrl,
        logoDataUrl: request.logoDataUrl!,
        exactBrandName,
        apiKey: request.apiKey,
        fetchImpl,
        timeoutMs: Math.min(timeoutMs, 30_000),
      });
      verificationAttempts.push(verification);
      console.log("[marketing-image-generator][verification]", {
        attempt: attempt + 1,
        text_found: verification.text_found,
        brand_visible: verification.brand_visible,
        text_exact: verification.text_exact,
        logo_matches: verification.logo_matches,
        invented_brands: verification.invented_brands,
        confidence: verification.confidence,
        technical_error: verification.technical_error,
      });
      if (verification.approved) {
        const decoded = decodeGeneratedImage(generated.dataUrl);
        const brandApplicationMode = attempt === 0
          ? "in_scene_verified"
          : "in_scene_retry_verified";
        console.log("[marketing-image-generator][complete]", {
          mode: brandApplicationMode,
          elapsed_ms: Date.now() - startedAt,
        });
        return {
          bytes: decoded.bytes,
          mimeType: decoded.mimeType,
          sourceDataUrl: generated.dataUrl,
          model: generated.model,
          mode: baseline.mode,
          format: baseline.format,
          logoRequested: true,
          logoApplied: true,
          logoApplicationFailed: false,
          brandApplicationMode,
          verificationAttempts,
        };
      }
      feedback = verificationFeedback(verification, exactBrandName);
    }
  }

  // Third and final generation for rejected in-scene attempts, or the only
  // generation for unbranded/base-photo/portrait/scene requests.
  const generated = await callImageGateway({
    messages: baseline.messages,
    apiKey: request.apiKey,
    fetchImpl,
    timeoutMs,
    models,
  });
  const decoded = decodeGeneratedImage(generated.dataUrl);
  let bytes = decoded.bytes;
  let mimeType = decoded.mimeType;
  let logoApplied = false;
  let logoApplicationFailed = false;
  if (logoAsset) {
    try {
      const branded = await applyBrandLogo(bytes, logoAsset.bytes, { format: baseline.format });
      bytes = branded.bytes;
      mimeType = "image/png";
      logoApplied = true;
    } catch (error) {
      logoApplicationFailed = true;
      console.error("[marketing-image-generator][brand]", error instanceof Error ? error.message : String(error));
    }
  }
  const brandApplicationMode = logoAsset
    ? useInSceneBrand ? "overlay_fallback" : "overlay"
    : "none";
  console.log("[marketing-image-generator][complete]", {
    mode: brandApplicationMode,
    verification_count: verificationAttempts.length,
    elapsed_ms: Date.now() - startedAt,
  });
  return {
    bytes,
    mimeType,
    sourceDataUrl: generated.dataUrl,
    model: generated.model,
    mode: baseline.mode,
    format: baseline.format,
    logoRequested: Boolean(request.logoDataUrl),
    logoApplied,
    logoApplicationFailed,
    brandApplicationMode,
    verificationAttempts,
  };
}
