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
