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
  reason: "demo" | "explicit_none" | "saved_logo" | "site" | "remembered_none" | "unconfigured";
};

export const PENDING_BRAND_GENERATION_TTL_MS = 30 * 60 * 1000;

export type PendingBrandStage =
  | "awaiting_choice"
  | "awaiting_site_url"
  | "awaiting_logo_confirmation";

export type PendingBrandReply =
  | { action: "expired" }
  | { action: "continue_conversation" }
  | { action: "choose_site" }
  | { action: "choose_none" }
  | { action: "site_url"; url: string }
  | { action: "save_logo" }
  | { action: "skip_logo" }
  | { action: "repeat_choice" };

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

export function classifyPendingBrandReply(input: {
  stage: PendingBrandStage;
  text: string;
  interactiveId?: string;
  createdAt: string;
  now?: number;
}): PendingBrandReply {
  const createdAt = new Date(input.createdAt).getTime();
  const age = (input.now ?? Date.now()) - createdAt;
  if (!Number.isFinite(age) || age < 0 || age > PENDING_BRAND_GENERATION_TTL_MS) {
    return { action: "expired" };
  }
  const interactiveId = String(input.interactiveId || "").toLowerCase();
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
      interactiveId === "brand_image_site"
      || /^(?:site|cores? do site|usar cores? do site)$/.test(normalized)
    )
  ) {
    return { action: "choose_site" };
  }
  if (directive === "use") {
    return { action: "repeat_choice" };
  }
  if (input.stage === "awaiting_site_url") {
    const url = input.text.match(/https?:\/\/[^\s<>"']+/i)?.[0];
    return url ? { action: "site_url", url } : { action: "continue_conversation" };
  }
  if (input.stage === "awaiting_logo_confirmation") {
    if (interactiveId === "brand_logo_save") return { action: "save_logo" };
    if (interactiveId === "brand_logo_skip") return { action: "skip_logo" };
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
  if (input.directive === "use" && input.hasSavedLogo) {
    return { useLogo: true, askChoice: false, colors: [], reason: "saved_logo" };
  }
  if (input.preference?.mode === "none" && input.directive !== "use") {
    return { useLogo: false, askChoice: false, colors: [], reason: "remembered_none" };
  }
  if (input.hasSavedLogo) {
    return { useLogo: true, askChoice: false, colors: [], reason: "saved_logo" };
  }
  if (input.preference?.mode === "site") {
    return {
      useLogo: false,
      askChoice: false,
      colors: input.preference.colors ?? [],
      reason: "site",
    };
  }
  return { useLogo: false, askChoice: true, colors: [], reason: "unconfigured" };
}
