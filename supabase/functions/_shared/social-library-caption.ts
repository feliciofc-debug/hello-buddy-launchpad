export type SocialCaptionVariants = { A: string; B: string; C: string };

function normalized(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function textExplicitlyMentions(
  text: string,
  candidate: string | null | undefined,
): boolean {
  const haystack = ` ${normalized(text)} `;
  const needle = normalized(String(candidate || ""));
  return needle.length >= 3 && haystack.includes(` ${needle} `);
}

export function libraryPhotoCaptionSubject(input: {
  visualDescription: string;
  ownerRequest: string;
  suggestedName?: string | null;
}): string {
  const suggested = String(input.suggestedName || "").trim();
  if (suggested && textExplicitlyMentions(input.ownerRequest, suggested)) {
    return suggested.slice(0, 120);
  }
  return String(input.visualDescription || input.ownerRequest || "Produto")
    .trim()
    .slice(0, 120);
}

export function uncitedCatalogNamesInVariants(input: {
  variants: SocialCaptionVariants;
  catalogNames: string[];
  ownerRequest: string;
  visualDescription: string;
}): string[] {
  const copy = `${input.variants.A}\n${input.variants.B}\n${input.variants.C}`;
  return input.catalogNames.filter((name) => {
    const clean = String(name || "").trim();
    if (normalized(clean).length < 4) return false;
    if (textExplicitlyMentions(input.ownerRequest, clean)) return false;
    if (textExplicitlyMentions(input.visualDescription, clean)) return false;
    return textExplicitlyMentions(copy, clean);
  });
}

export function removeUncitedCatalogNames(
  variants: SocialCaptionVariants,
  names: string[],
): SocialCaptionVariants {
  const patterns = names
    .map((name) => String(name || "").trim())
    .filter(Boolean)
    .map((name) =>
      new RegExp(
        name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "giu",
      )
    );
  const clean = (value: string) =>
    patterns.reduce(
      (result, pattern) => result.replace(pattern, "produto"),
      value,
    );
  return {
    A: clean(variants.A),
    B: clean(variants.B),
    C: clean(variants.C),
  };
}
