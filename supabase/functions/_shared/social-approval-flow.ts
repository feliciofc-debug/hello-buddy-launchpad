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
  | "schedule";

export function socialApprovalButtons(
  selected: unknown,
  isStory = false,
): SocialApprovalButton[] {
  if (!isExplicitSocialVariant(selected)) {
    return ["variant_A", "variant_B", "variant_C"];
  }
  return isStory ? ["publish"] : ["publish", "schedule"];
}
