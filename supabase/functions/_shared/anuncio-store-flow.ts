import { cleanSiteBrandName } from "./brand-site-identity.ts";

export type StoreReply =
  | { action: "site"; site: string; name: string | null }
  | { action: "ask_site"; name: string }
  | { action: "name_only"; name: string }
  | { action: "ignore" };

function cleanStoreNameAroundSite(value: string): string {
  let name = value.replace(/\s+/g, " ").trim();
  const looseWords =
    "(?:o\\s+site\\s+[ée]|o\\s+site|site|loja|cliente|[ée]|e|da|do|de|para|pra)";
  for (let pass = 0; pass < 4; pass++) {
    const previous = name;
    name = name
      .replace(new RegExp(`^[\\s,.:;|–—-]*(?:${looseWords})\\b[\\s,.:;|–—-]*`, "i"), "")
      .replace(new RegExp(`[\\s,.:;|–—-]*(?:${looseWords})[\\s,.:;|–—-]*$`, "i"), "")
      .replace(/^[\s,.:;|–—-]+|[\s,.:;|–—-]+$/g, "")
      .trim();
    if (name === previous) break;
  }
  return name;
}

export function storeNameFromSite(
  site: string,
  siteBrandName?: string | null,
): string {
  if (siteBrandName?.trim()) return siteBrandName.trim().slice(0, 100);
  const hostname = new URL(site).hostname.replace(/^www\./i, "");
  return cleanSiteBrandName(hostname) || hostname;
}

export function classifyStoreReply(input: {
  text: string;
  site?: string | null;
  storedName?: string | null;
  askedSite?: boolean;
}): StoreReply {
  const text = String(input.text || "").replace(/\s+/g, " ").trim();
  if (input.site) {
    const withoutSite = text
      .replace(
        /https?:\/\/[^\s<>"']+|(?:www\.)?[a-z0-9][a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s<>"']*)?/i,
        " ",
      )
      .replace(/\s+/g, " ");
    return {
      action: "site",
      site: input.site,
      name: input.storedName?.trim() ||
        cleanStoreNameAroundSite(withoutSite).slice(0, 100) || null,
    };
  }
  if (
    input.askedSite &&
    input.storedName &&
    /^(?:n[aã]o|nao tenho|sem site)$/i.test(text)
  ) {
    return { action: "name_only", name: input.storedName.trim().slice(0, 100) };
  }
  const name = text
    .replace(/^(?:nome(?:\s+da\s+loja)?|cliente)\s*[:=-]\s*/i, "")
    .trim()
    .slice(0, 100);
  return name.length >= 2
    ? { action: "ask_site", name }
    : { action: "ignore" };
}
