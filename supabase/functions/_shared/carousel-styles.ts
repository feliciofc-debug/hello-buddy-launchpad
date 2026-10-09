import {
  singleLineInteractiveText,
  truncateCodePoints,
} from "./whatsapp-interactive-safe.ts";

export type CarouselTemplate =
  | "dark-premium"
  | "clean-bright"
  | "gradient-vibrant"
  | "elegant-serif"
  | "neon-tech";

export const CAROUSEL_TEMPLATES: Array<{
  slug: CarouselTemplate;
  label: string;
  description: string;
}> = [
  {
    slug: "dark-premium",
    label: "Escuro premium",
    description: "Fundo escuro e destaques da marca",
  },
  {
    slug: "clean-bright",
    label: "Claro clean",
    description: "Fundo claro e visual leve",
  },
  {
    slug: "gradient-vibrant",
    label: "Colorido vibrante",
    description: "Degradê forte e moderno",
  },
  {
    slug: "elegant-serif",
    label: "Elegante",
    description: "Sofisticado e editorial",
  },
  {
    slug: "neon-tech",
    label: "Neon",
    description: "Tecnologia e futurismo",
  },
];

const NAMED_BACKGROUNDS: Record<string, string> = {
  branco: "#FFFFFF",
  clara: "#FFFFFF",
  claro: "#FFFFFF",
  clean: "#FFFFFF",
  preto: "#09090B",
  preta: "#09090B",
  escuro: "#0F172A",
  escura: "#0F172A",
  laranja: "#F36812",
  azul: "#2563EB",
  roxo: "#8B5CF6",
  verde: "#16A34A",
  vermelho: "#DC2626",
  rosa: "#EC4899",
  dourado: "#D4AF37",
  amarelo: "#FACC15",
};

function normalize(value: unknown): string {
  return String(value ?? "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function normalizeCarouselTemplate(
  value: unknown,
): CarouselTemplate | null {
  const text = normalize(value);
  return CAROUSEL_TEMPLATES.find((item) =>
    item.slug === text || normalize(item.label) === text
  )?.slug ?? null;
}

export function extractCarouselBackgroundColor(
  request: unknown,
): string | null {
  const text = normalize(request);
  const hex = text.match(/\bfundo\s+(#[0-9a-f]{6})\b/i)?.[1];
  if (hex) return hex.toUpperCase();
  const named = text.match(
    /\bfundo\s+(branc[oa]|clar[oa]|clean|pret[oa]|escur[oa]|laranja|azul|roxo|verde|vermelho|rosa|dourado|amarelo)\b/,
  )?.[1];
  return named ? NAMED_BACKGROUNDS[named] ?? null : null;
}

export function resolveCarouselStyleRequest(input: {
  request?: unknown;
  template?: unknown;
  backgroundColor?: unknown;
  brandIdentity?: boolean;
}): {
  template: CarouselTemplate | null;
  backgroundColor: string | null;
  explicit: boolean;
  needsSelector: boolean;
} {
  const directTemplate = normalizeCarouselTemplate(input.template);
  const directBackground = /^#?[0-9a-f]{6}$/i.test(
      String(input.backgroundColor ?? "").trim(),
    )
    ? `#${String(input.backgroundColor).trim().replace(/^#/, "").toUpperCase()}`
    : null;
  if (directTemplate) {
    return {
      template: directTemplate,
      backgroundColor: directBackground,
      explicit: true,
      needsSelector: false,
    };
  }

  const request = normalize(input.request);
  const backgroundColor = directBackground ??
    extractCarouselBackgroundColor(request);
  let template: CarouselTemplate | null = null;
  if (/\b(neon|tecnologia|tecnologico|futurista)\b/.test(request)) {
    template = "neon-tech";
  } else if (
    /\b(elegante|sofisticado|sofisticada|luxo|luxuoso|luxuosa)\b/.test(request)
  ) {
    template = "elegant-serif";
  } else if (
    /\b(colorido|colorida|degrade|vibrante)\b/.test(request)
  ) {
    template = "gradient-vibrant";
  } else if (
    /\b(fundo\s+(?:branc[oa]|clar[oa]|clean)|claro clean)\b/.test(request)
  ) {
    template = "clean-bright";
  } else if (
    /\b(fundo\s+(?:escur[oa]|pret[oa])|escuro premium)\b/.test(request)
  ) {
    template = "dark-premium";
  } else if (backgroundColor) {
    template = backgroundColor === "#09090B" ||
        backgroundColor === "#0F172A"
      ? "dark-premium"
      : "clean-bright";
  } else if (
    input.brandIdentity ||
    /\b(?:identidade visual|cores? do site|cores? da marca|nossa marca|nossa identidade|identidade da marca)\b/
      .test(request)
  ) {
    template = "clean-bright";
  }
  return {
    template,
    backgroundColor,
    explicit: template !== null || backgroundColor !== null,
    needsSelector: template === null,
  };
}

export function carouselStyleListPayload() {
  return {
    header: singleLineInteractiveText("Estilo do carrossel", 60),
    body: singleLineInteractiveText(
      "Escolha o visual do carrossel:",
      1024,
    ),
    button: singleLineInteractiveText("Escolher estilo", 20),
    section_title: singleLineInteractiveText("Estilos", 24),
    rows: CAROUSEL_TEMPLATES.map((style) => ({
      id: truncateCodePoints(`carrossel_estilo_${style.slug}`, 200),
      title: singleLineInteractiveText(style.label, 24),
      description: singleLineInteractiveText(style.description, 72),
    })),
  };
}

export function carouselStyleFallbackButtons() {
  return {
    body: "Escolha o estilo do carrossel:",
    buttons: [
      { id: "carrossel_estilo_dark-premium", title: "Escuro premium" },
      { id: "carrossel_estilo_clean-bright", title: "Claro clean" },
      {
        id: "carrossel_estilo_gradient-vibrant",
        title: "Colorido vibrante",
      },
    ],
  };
}

export function resolveCarouselStyleReply(
  text: unknown,
): CarouselTemplate | null {
  const id = String(text ?? "").match(
    /<<INTERACTIVE_ID:carrossel_estilo_([^>]+)>>/i,
  )?.[1];
  return normalizeCarouselTemplate(id ?? text);
}
