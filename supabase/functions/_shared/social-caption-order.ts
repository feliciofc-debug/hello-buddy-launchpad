function compactLines(value: string): string {
  return value.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function appendWhatsappCtaInPublishingOrder(
  caption: string,
  phoneDigits: string,
): string {
  if (!caption || !phoneDigits) return caption;
  const withoutExistingCta = caption
    .replace(
      /(?:📱\s*)?(?:fale|chame|falar)\s+(?:comigo\s+)?(?:agora\s+)?(?:no|pelo)\s+whatsapp\s*:?\s*(?:https?:\/\/)?wa\.me\/\d+/gi,
      " ",
    )
    .replace(/(?:https?:\/\/)?wa\.me\/\d+/gi, " ");
  const hashtags = withoutExistingCta.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  const body = compactLines(
    withoutExistingCta.replace(/#[\p{L}\p{N}_]+/gu, " "),
  );
  return [
    body,
    "📱 Chame no WhatsApp",
    `https://wa.me/${phoneDigits}`,
    [...new Set(hashtags)].join(" "),
  ].filter(Boolean).join("\n\n");
}
