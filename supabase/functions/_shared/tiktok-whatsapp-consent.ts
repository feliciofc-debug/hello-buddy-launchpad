const INTERACTIVE_ID_RE = /<<INTERACTIVE_ID:([^>]+)>>/i;

export type TikTokDisclosure = "non_commercial" | "brand_organic" | "branded_content";

export function tiktokInteractiveId(text: string): string | null {
  const id = String(text || "").match(INTERACTIVE_ID_RE)?.[1] || "";
  return /^tiktok_(?:privacy|disclosure):/i.test(id) ? id : null;
}

export function textWithoutInteractiveMarker(text: string): string {
  return String(text || "").replace(/<<INTERACTIVE_ID:[^>]+>>/gi, "").trim();
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseTikTokDisclosure(text: string): TikTokDisclosure | null {
  const id = tiktokInteractiveId(text);
  const candidate = normalize(
    id?.replace(/^tiktok_disclosure:/i, "")
      || textWithoutInteractiveMarker(text),
  );
  if (candidate === "non commercial" || /\bnao (?:e )?comercial\b/.test(candidate) || /\bsem publicidade\b/.test(candidate)) {
    return "non_commercial";
  }
  if (candidate === "brand organic" || /\b(minha marca|propria marca)\b/.test(candidate)) {
    return "brand_organic";
  }
  if (candidate === "branded content" || /\b(outra marca|terceir[oa]s?)\b/.test(candidate)) {
    return "branded_content";
  }
  return null;
}

export function privacyChoiceText(text: string): string {
  const id = tiktokInteractiveId(text);
  if (id?.toLowerCase().startsWith("tiktok_privacy:")) {
    return id.slice("tiktok_privacy:".length);
  }
  return textWithoutInteractiveMarker(text);
}
