// ============================================================
// carousel-colors.ts — paleta amigável para o usuário leigo.
// O usuário escolhe pelo NOME (1 toque no WhatsApp) e a gente
// traduz para os HEX que o template dark-premium espera.
// ============================================================

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

/** Rows prontos para a lista interativa do WhatsApp (1 toque). */
export function carouselColorRows() {
  return CAROUSEL_COLORS.map((c) => ({
    id: `carrossel_cor_${c.slug}`,
    title: `${c.emoji} ${c.label}`,
  }));
}
