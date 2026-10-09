export type SocialVariantChoice = "A" | "B" | "C";

export function isExplicitSocialVariant(
  value: unknown,
): value is SocialVariantChoice {
  return value === "A" || value === "B" || value === "C";
}

export function canRunSocialPostAction(value: unknown): boolean {
  return isExplicitSocialVariant(value);
}

export function selectSocialVariantScripts(
  variants: Record<SocialVariantChoice, string>,
  choice: SocialVariantChoice,
): string {
  return variants[choice];
}

export type SocialApprovalButton =
  | "variant_A"
  | "variant_B"
  | "variant_C"
  | "publish"
  | "schedule"
  | "cancel";

export function socialApprovalButtons(
  selected: unknown,
  isStory = false,
): SocialApprovalButton[] {
  if (!isExplicitSocialVariant(selected)) {
    return ["variant_A", "variant_B", "variant_C"];
  }
  return isStory ? ["publish", "cancel"] : ["publish", "schedule", "cancel"];
}

export type SocialInteractiveButtons = {
  body: string;
  header?: string;
  footer?: string;
  buttons: Array<{ id: string; title: string }>;
};

export function socialInteractiveButtonsFromResult(
  raw: string,
): SocialInteractiveButtons | undefined {
  try {
    const data = JSON.parse(raw);
    const status = String(data?.status);
    if (
      ![
        "aguardando_escolha_variante",
        "escolha_variante_necessaria",
        "variante_selecionada",
      ].includes(status)
    ) {
      return undefined;
    }
    const token = String(data?.token || "").trim().toLowerCase();
    if (!/^[a-f0-9]{8}$/.test(token)) return undefined;

    const selected = status === "variante_selecionada"
      ? data?.opcao_ativa
      : undefined;
    const buttonKeys = socialApprovalButtons(
      selected,
      data?.formato === "story",
    );
    if (!selected) {
      return {
        header: "Escolha o texto",
        body: "Antes de publicar ou agendar, escolha uma opção.",
        buttons: buttonKeys.map((key) => {
          const option = key.slice(-1);
          return {
            id: `social_variant:${option}:${token}`,
            title: `Opção ${option}`,
          };
        }),
      };
    }

    return {
      header: "Aprovar criativo",
      body: data?.formato === "story"
        ? "Story pelo WhatsApp só pode ser publicado agora."
        : "Publique agora ou escolha agendar. Para informar a data por texto, responda: agendar sexta às 10h.",
      buttons: buttonKeys.map((key) =>
        key === "publish"
          ? { id: `social_publish:${token}`, title: "Publicar" }
          : key === "schedule"
          ? { id: `social_schedule:${token}`, title: "Agendar" }
          : { id: `social_cancel:${token}`, title: "Cancelar" }
      ),
    };
  } catch {
    return undefined;
  }
}
