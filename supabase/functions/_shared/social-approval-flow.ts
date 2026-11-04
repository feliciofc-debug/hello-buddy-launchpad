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
  _isStory = false,
): SocialApprovalButton[] {
  if (!isExplicitSocialVariant(selected)) {
    return ["variant_A", "variant_B", "variant_C"];
  }
  return [];
}

export type SocialInteractiveButtons = {
  body: string;
  header?: string;
  footer?: string;
  buttons: Array<{ id: string; title: string }>;
};

export function friendlySocialToolResultFallback(raw: string): string {
  try {
    const data = JSON.parse(raw);
    if (typeof data?.mensagem === "string" && data.mensagem.trim()) {
      return data.mensagem.trim();
    }
    return "Não consegui concluir essa etapa agora. Tente novamente em instantes.";
  } catch {
    return raw;
  }
}

export function socialInteractiveButtonsFromResult(
  raw: string,
): SocialInteractiveButtons | undefined {
  try {
    const data = JSON.parse(raw);
    const status = String(data?.status);
    if (status === "vehicle_social_copy_gate") {
      const buttons = Array.isArray(data?.botoes)
        ? data.botoes
          .filter((button: unknown) =>
            button && typeof button === "object" &&
            typeof (button as { id?: unknown }).id === "string" &&
            typeof (button as { title?: unknown }).title === "string"
          )
          .map((button: { id: string; title: string }) => ({
            id: button.id,
            title: button.title,
          }))
        : [];
      if (!buttons.length) return undefined;
      return {
        body: typeof data?.mensagem === "string" && data.mensagem.trim()
          ? data.mensagem.trim()
          : "Você pode informar os dados que tiver ou continuar sem eles.",
        buttons,
      };
    }
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
    if (selected) return undefined;
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

    return undefined;
  } catch {
    return undefined;
  }
}
