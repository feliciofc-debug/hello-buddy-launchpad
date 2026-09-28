export type WhatsAppBrandPreference = {
  mode: "site" | "none";
  siteUrl?: string;
  colors?: string[];
  updatedAt: string;
};

export type WhatsAppBrandDecision = {
  useLogo: boolean;
  askChoice: boolean;
  colors: string[];
  reason: "demo" | "explicit_none" | "explicit_logo" | "missing_logo" | "choose_per_request";
};

export const PENDING_BRAND_GENERATION_TTL_MS = 30 * 60 * 1000;

export type PendingBrandStage =
  | "awaiting_choice"
  | "awaiting_site_choice"
  | "awaiting_site_url"
  | "awaiting_logo_upload"
  | "awaiting_uploaded_logo_confirmation";

export type PendingBrandReply =
  | { action: "expired" }
  | { action: "continue_conversation" }
  | { action: "choose_logo" }
  | { action: "choose_site" }
  | { action: "choose_none" }
  | { action: "use_previous_site" }
  | { action: "use_other_site" }
  | { action: "site_url"; url: string }
  | { action: "save_uploaded_logo" }
  | { action: "use_uploaded_logo_once" };

export function detectWhatsAppBrandDirective(text: string): "use" | "none" | null {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (
    /\b(?:sem|nao (?:use|usar|coloque|colocar|aplique|aplicar|adicione|adicionar|inclua|incluir))\s+(?:a |minha |nossa )?(?:logo|logomarca|marca)\b/.test(normalized)
    || /\b(?:logo|logomarca|marca)\s+(?:desligada|desativada)\b/.test(normalized)
  ) return "none";
  if (
    /\b(?:use|usa|usar|coloque|coloca|colocar|aplique|aplica|aplicar|adicione|adiciona|adicionar|inclua|inclui|incluir|incluindo|com)\b.{0,40}\b(?:minha|nossa|a)?\s*(?:logo|logotipo|logomarca|marca)\b/.test(normalized)
    || /\b(?:minha|nossa)\s+(?:logo|logotipo|logomarca|marca)\b/.test(normalized)
  ) return "use";
  return null;
}

export function extractWhatsAppBrandSiteUrl(text: string): string | null {
  return text.match(/https?:\/\/[^\s<>"']+/i)?.[0] ?? null;
}

export function extractExplicitWhatsAppBrandSiteUrl(text: string): string | null {
  const url = extractWhatsAppBrandSiteUrl(text);
  if (!url) return null;
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const explicitBrandContext =
    /\b(?:cores?|paleta|identidade(?: visual)?)\s+(?:do|da|de|desse|dessa|deste|desta)\s+(?:meu|minha|nosso|nossa|site|marca|empresa)\b/.test(normalized)
    || /\bsite\s+(?:do|da|de)\s+(?:minha|nossa|marca|empresa)\b/.test(normalized)
    || /\b(?:marca|empresa)\s+(?:do|da|de)\s+site\b/.test(normalized);
  return explicitBrandContext ? url : null;
}

export function whatsAppImageBrandResultMessage(
  result: Record<string, unknown>,
  explicitlyUnbranded = false,
): string {
  if (result.brand_source === "site") {
    if (result.logo_aplicada) {
      return result.brand_application_mode === "in_scene_verified"
          || result.brand_application_mode === "in_scene_retry_verified"
        ? "Apliquei a logo encontrada no site na cena."
        : "Apliquei a logo encontrada no site sobre a imagem.";
    }
    if (result.site_logo_requested) {
      return "Não consegui aplicar a logo do site desta vez; usei somente as cores encontradas.";
    }
    return "Usei somente as cores encontradas no site.";
  }
  if (result.logo_aplicada) {
    return result.brand_application_mode === "in_scene_verified"
        || result.brand_application_mode === "in_scene_retry_verified"
      ? "Apliquei sua logo na cena."
      : "Apliquei sua logo sobre a imagem.";
  }
  if (result.logo_aplicacao_falhou) return "Não consegui aplicar a logo desta vez.";
  if (explicitlyUnbranded) return "Gerei sem logo, como você pediu.";
  if (result.logo_solicitada_sem_cadastro) return "Gerei sem logo porque ainda não há uma cadastrada.";
  return "Gerei sem logo.";
}

export function whatsAppSiteBrandGenerationOptions(identity: {
  colors: string[];
  brand_name?: string | null;
  logo_data_url?: string | null;
  logo_confidence: "high" | "none";
}): {
  incluirLogo: boolean;
  logoDataUrl: string | null;
  brandColors: string[];
  brandName: string | null;
  brandSource: "site";
} {
  const trustedLogo = identity.logo_confidence === "high"
    ? identity.logo_data_url || null
    : null;
  return {
    incluirLogo: Boolean(trustedLogo),
    logoDataUrl: trustedLogo,
    brandColors: identity.colors,
    brandName: identity.brand_name || null,
    brandSource: "site",
  };
}

export function resolveWhatsAppGeneratorBrand(input: {
  brandSource?: "site";
  logoDataUrl?: string | null;
  brandColors?: string[];
  brandName?: string | null;
}, tenantAssets?: {
  logoDataUrl: string | null;
  colors: string[];
  brandName: string | null;
} | null): {
  logoDataUrl: string | null;
  brandColors: string[];
  brandName: string | null;
} {
  if (input.brandSource === "site") {
    return {
      logoDataUrl: input.logoDataUrl ?? null,
      brandColors: input.brandColors ?? [],
      brandName: input.brandName ?? null,
    };
  }
  return {
    logoDataUrl: input.logoDataUrl ?? tenantAssets?.logoDataUrl ?? null,
    brandColors: input.brandColors?.length ? input.brandColors : tenantAssets?.colors ?? [],
    brandName: input.brandName ?? tenantAssets?.brandName ?? null,
  };
}

export function whatsAppUploadedLogoConfirmationButtons(): Array<{
  id: string;
  title: string;
}> {
  return [
    { id: "brand_uploaded_logo_save", title: "Salvar minha logo" },
    { id: "brand_uploaded_logo_once", title: "Usar só nesta imagem" },
  ];
}

export function classifyPendingBrandReply(input: {
  stage: PendingBrandStage;
  text: string;
  interactiveId?: string;
  createdAt: string;
  now?: number;
}): PendingBrandReply {
  const interactiveId = String(input.interactiveId || "").toLowerCase();
  const createdAt = new Date(input.createdAt).getTime();
  const age = (input.now ?? Date.now()) - createdAt;
  if (!Number.isFinite(age) || age < 0 || age > PENDING_BRAND_GENERATION_TTL_MS) {
    return interactiveId.startsWith("brand_")
      ? { action: "expired" }
      : { action: "continue_conversation" };
  }
  const normalized = input.text
    .replace(/<<INTERACTIVE_ID:[^>]+>>/gi, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const directive = detectWhatsAppBrandDirective(input.text);

  if (interactiveId === "brand_image_none" || directive === "none") {
    return { action: "choose_none" };
  }
  if (
    input.stage === "awaiting_choice"
    && (
      interactiveId === "brand_image_logo"
      || directive === "use"
      || /^(?:com minha marca|com minha logo|minha marca|minha logo)$/.test(normalized)
    )
  ) {
    return { action: "choose_logo" };
  }
  if (
    input.stage === "awaiting_choice"
    && (
      interactiveId === "brand_image_site"
      || /^(?:site|cores? do site|usar cores? do site)$/.test(normalized)
    )
  ) {
    return { action: "choose_site" };
  }
  if (input.stage === "awaiting_site_choice") {
    if (interactiveId === "brand_site_previous") return { action: "use_previous_site" };
    if (interactiveId === "brand_site_other") return { action: "use_other_site" };
  }
  if (input.stage === "awaiting_site_url") {
    const url = extractWhatsAppBrandSiteUrl(input.text);
    return url ? { action: "site_url", url } : { action: "continue_conversation" };
  }
  if (input.stage === "awaiting_uploaded_logo_confirmation") {
    if (interactiveId === "brand_uploaded_logo_save") return { action: "save_uploaded_logo" };
    if (interactiveId === "brand_uploaded_logo_once") return { action: "use_uploaded_logo_once" };
  }
  return { action: "continue_conversation" };
}

export function previewableWhatsAppLogoUrl(
  logoUrl: string | null | undefined,
  logoDataUrl: string | null | undefined,
): string | null {
  if (!logoUrl) return null;
  return /^data:image\/(?:png|jpeg|webp);base64,/i.test(String(logoDataUrl || ""))
    ? logoUrl
    : null;
}

export function decideWhatsAppImageBrand(input: {
  demonstration: boolean;
  hasSavedLogo: boolean;
  directive?: "use" | "none" | null;
  preference?: WhatsAppBrandPreference | null;
}): WhatsAppBrandDecision {
  if (input.demonstration) {
    return { useLogo: false, askChoice: false, colors: [], reason: "demo" };
  }
  if (input.directive === "none") {
    return { useLogo: false, askChoice: false, colors: [], reason: "explicit_none" };
  }
  if (input.directive === "use") {
    return input.hasSavedLogo
      ? { useLogo: true, askChoice: false, colors: [], reason: "explicit_logo" }
      : { useLogo: false, askChoice: false, colors: [], reason: "missing_logo" };
  }
  return { useLogo: false, askChoice: true, colors: [], reason: "choose_per_request" };
}
