// ============================================================
// carousel-colors.ts — paleta amigável para o usuário leigo.
// O usuário escolhe pelo NOME (1 toque no WhatsApp) e a gente
// traduz para os HEX que o template dark-premium espera.
// ============================================================

import {
  singleLineInteractiveText,
  truncateCodePoints,
} from "./whatsapp-interactive-safe.ts";

export type CarouselColor = {
  slug: string;
  label: string;
  emoji: string;
  primaryColor: string;
  secondaryColor: string;
};

export const CAROUSEL_COLORS: CarouselColor[] = [
  { slug: "azul", label: "Azul", emoji: "🔵", primaryColor: "#3B82F6", secondaryColor: "#2563EB" },
  { slug: "verde", label: "Verde", emoji: "🟢", primaryColor: "#22C55E", secondaryColor: "#16A34A" },
  { slug: "laranja", label: "Laranja", emoji: "🟠", primaryColor: "#F97316", secondaryColor: "#EA580C" },
  { slug: "preto", label: "Preto", emoji: "⚫", primaryColor: "#9CA3AF", secondaryColor: "#4B5563" },
  { slug: "dourado", label: "Dourado", emoji: "🟡", primaryColor: "#F59E0B", secondaryColor: "#B45309" },
  { slug: "roxo", label: "Roxo", emoji: "🟣", primaryColor: "#8B5CF6", secondaryColor: "#6366F1" },
];

export const DEFAULT_CAROUSEL_COLOR = CAROUSEL_COLORS[5]; // roxo (default do app)
export const AMZ_CAROUSEL_COLOR: CarouselColor = {
  slug: "amz",
  label: "Cor da marca",
  emoji: "🎨",
  primaryColor: "#F36812",
  secondaryColor: "#F36812",
};

const ALIASES: Record<string, string> = {
  azul: "azul", blue: "azul", "azul escuro": "azul", "azul marinho": "azul",
  verde: "verde", green: "verde", "verde escuro": "verde",
  laranja: "laranja", orange: "laranja", "laranja escuro": "laranja",
  preto: "preto", black: "preto", cinza: "preto", "preto e branco": "preto", escuro: "preto", prata: "preto",
  dourado: "dourado", gold: "dourado", ouro: "dourado", amarelo: "dourado",
  roxo: "roxo", purple: "roxo", violeta: "roxo", lilas: "roxo", "lilás": "roxo",
};

function normalize(v: string): string {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Resolve nome/emoji/hex informado pelo usuário. Retorna null se não reconhecer. */
export function resolveCarouselColor(input?: string | null): CarouselColor | null {
  if (!input) return null;
  const raw = String(input).trim();

  // HEX direto (usuário avançado / app)
  if (/^#?[0-9a-fA-F]{6}$/.test(raw)) {
    const hex = raw.startsWith("#") ? raw : `#${raw}`;
    return { slug: "custom", label: hex, emoji: "🎨", primaryColor: hex, secondaryColor: hex };
  }

  const n = normalize(raw);
  const direct = CAROUSEL_COLORS.find((c) => c.slug === n || normalize(c.label) === n);
  if (direct) return direct;

  const bySlug = ALIASES[n];
  if (bySlug) return CAROUSEL_COLORS.find((c) => c.slug === bySlug) ?? null;

  // Emoji ou nome dentro de uma frase ("quero em azul")
  const byEmoji = CAROUSEL_COLORS.find((c) => raw.includes(c.emoji));
  if (byEmoji) return byEmoji;
  const contained = CAROUSEL_COLORS.find((c) => n.includes(c.slug));
  if (contained) return contained;

  return null;
}

export function detectExplicitCarouselColor(
  input?: string | null,
): CarouselColor | null {
  const value = normalize(String(input || ""));
  const match = value.match(
    /\b(?:em|na cor|com a cor|cor|fundo|destaque)\s*[:=-]?\s*(azul|verde|laranja|preto|dourado|roxo)\b/,
  );
  return match?.[1] ? resolveCarouselColor(match[1]) : null;
}

export function requestsCarouselBrandIdentity(input?: string | null): boolean {
  const value = normalize(String(input || ""));
  return /\b(?:identidade visual|cores? do site|cores? da marca|nossa marca|nossa identidade|identidade da marca)\b/
    .test(value);
}

export function carouselBrandColor(
  colors: string[],
  fallback?: CarouselColor | null,
): CarouselColor | null {
  const primary = resolveCarouselColor(colors[0]);
  if (!primary) return fallback ?? null;
  const secondary = resolveCarouselColor(colors[1])?.primaryColor ??
    primary.primaryColor;
  return {
    slug: "marca",
    label: "Cor da marca",
    emoji: "🎨",
    primaryColor: primary.primaryColor,
    secondaryColor: secondary,
  };
}

export function resolveCarouselColorPlan(input: {
  explicitColor?: string | null;
  request?: string | null;
  brandColors?: string[];
  brandFallback?: CarouselColor | null;
}): {
  color: CarouselColor | null;
  source: "explicit" | "tenant_brand" | "default" | "selector";
  shouldAsk: boolean;
} {
  const explicit = resolveCarouselColor(input.explicitColor);
  if (explicit) {
    return { color: explicit, source: "explicit", shouldAsk: false };
  }
  const brand = carouselBrandColor(
    input.brandColors ?? [],
    input.brandFallback,
  );
  if (brand) {
    return { color: brand, source: "tenant_brand", shouldAsk: false };
  }
  if (requestsCarouselBrandIdentity(input.request)) {
    return {
      color: input.brandFallback ?? DEFAULT_CAROUSEL_COLOR,
      source: "default",
      shouldAsk: false,
    };
  }
  return { color: null, source: "selector", shouldAsk: true };
}

export function safeCarouselThemeSummary(input: unknown): string {
  return singleLineInteractiveText(input, 60);
}

/** Rows prontos para a lista interativa do WhatsApp (1 toque). */
export function carouselColorRows() {
  return CAROUSEL_COLORS.map((c) => ({
    id: truncateCodePoints(`carrossel_cor_${c.slug}`, 200),
    title: singleLineInteractiveText(`${c.emoji} ${c.label}`, 24),
  }));
}

export function carouselColorListPayload(
  theme: unknown,
  demonstration = false,
) {
  const summary = safeCarouselThemeSummary(theme) || "seu tema";
  return {
    header: singleLineInteractiveText("🎨 Cor do carrossel", 60),
    body: singleLineInteractiveText(
      `Vou montar o carrossel sobre ${summary}. Escolha a cor de destaque:`,
      1024,
    ),
    footer: singleLineInteractiveText(
      demonstration
        ? "Demonstração: nada será publicado"
        : "Depois você confere antes de publicar",
      60,
    ),
    button: singleLineInteractiveText("Escolher cor", 20),
    section_title: singleLineInteractiveText("Cores", 24),
    rows: carouselColorRows(),
  };
}

export function carouselColorFallbackButtons() {
  return {
    body: "Escolha uma cor para o carrossel:",
    buttons: [
      { id: "carrossel_cor_marca", title: "Cor da marca" },
      { id: "carrossel_cor_azul", title: "Azul" },
      { id: "carrossel_cor_roxo", title: "Roxo" },
    ],
  };
}

export type CarouselSelectorDelivery = "list" | "buttons" | "automatic";

export async function deliverCarouselColorSelector(input: {
  sendList: () => Promise<void>;
  sendButtons: () => Promise<void>;
  notifyAutomatic: () => Promise<void>;
  logFailure?: (stage: "list" | "buttons" | "notice", error: unknown) => void;
}): Promise<CarouselSelectorDelivery> {
  try {
    await input.sendList();
    return "list";
  } catch (error) {
    input.logFailure?.("list", error);
  }
  try {
    await input.sendButtons();
    return "buttons";
  } catch (error) {
    input.logFailure?.("buttons", error);
  }
  try {
    await input.notifyAutomatic();
  } catch (error) {
    input.logFailure?.("notice", error);
  }
  return "automatic";
}
