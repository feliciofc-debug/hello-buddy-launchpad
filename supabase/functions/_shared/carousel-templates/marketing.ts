import type { RenderContext, RenderSlide } from "./darkPremium.ts";
import {
  bodyBlock,
  contrastPalette,
  effectiveBackground,
  el,
  logo,
  progressDots,
  rgba,
  type SatoriNode,
} from "./shared.ts";

export type MarketingTemplate =
  | "clean-bright"
  | "gradient-vibrant"
  | "elegant-serif"
  | "neon-tech";

type TemplateSpec = {
  defaultBackground: string;
  gradient?: (primary: string, secondary: string) => string;
  titleFont: string;
  contentPadding: number;
  accentLabel: string;
  ctaLabel: string;
  serif?: boolean;
  neon?: boolean;
  vibrant?: boolean;
};

const specs: Record<MarketingTemplate, TemplateSpec> = {
  "clean-bright": {
    defaultBackground: "#FFFFFF",
    titleFont: "Inter",
    contentPadding: 80,
    accentLabel: "GUIA COMPLETO",
    ctaLabel: "COMECE AGORA",
  },
  "gradient-vibrant": {
    defaultBackground: "#8B5CF6",
    gradient: (primary, secondary) =>
      `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
    titleFont: "Inter",
    contentPadding: 70,
    accentLabel: "CONTEÚDO EXCLUSIVO",
    ctaLabel: "QUERO COMEÇAR",
    vibrant: true,
  },
  "elegant-serif": {
    defaultBackground: "#FAF8F5",
    titleFont: "Georgia",
    contentPadding: 80,
    accentLabel: "✦",
    ctaLabel: "SAIBA MAIS",
    serif: true,
  },
  "neon-tech": {
    defaultBackground: "#09090B",
    titleFont: "Inter",
    contentPadding: 80,
    accentLabel: "TECH CONTENT",
    ctaLabel: "ACESSAR AGORA",
    neon: true,
  },
};

function backgroundStyle(
  spec: TemplateSpec,
  ctx: RenderContext,
): Record<string, unknown> {
  const background = effectiveBackground(ctx, spec.defaultBackground);
  return {
    backgroundColor: background,
    ...(spec.gradient && !ctx.backgroundColor
      ? { backgroundImage: spec.gradient(ctx.primaryColor, ctx.secondaryColor) }
      : {}),
  };
}

function paletteFor(spec: TemplateSpec, ctx: RenderContext) {
  if (ctx.backgroundColor) return contrastPalette(ctx.backgroundColor);
  if (spec.vibrant || spec.neon) {
    return {
      text: "#FFFFFF",
      muted: "rgba(255,255,255,0.72)",
      card: "rgba(255,255,255,0.10)",
      border: "rgba(255,255,255,0.20)",
    };
  }
  return contrastPalette(spec.defaultBackground);
}

function frame(
  spec: TemplateSpec,
  ctx: RenderContext,
): SatoriNode[] {
  if (!spec.serif) return [];
  return [
    el("div", {
      position: "absolute",
      top: 30,
      left: 30,
      right: 30,
      bottom: 30,
      border: `2px solid ${ctx.primaryColor}`,
    }),
    el("div", {
      position: "absolute",
      top: 38,
      left: 38,
      right: 38,
      bottom: 38,
      border: `1px solid ${rgba(ctx.primaryColor, 0.28)}`,
    }),
  ];
}

function decorations(
  spec: TemplateSpec,
  ctx: RenderContext,
): SatoriNode[] {
  if (spec.serif) return frame(spec, ctx);
  if (spec.neon) {
    return [
      el("div", {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        backgroundColor: ctx.primaryColor,
      }),
      el("div", {
        position: "absolute",
        top: -100,
        right: -100,
        width: 400,
        height: 400,
        borderRadius: 400,
        backgroundColor: rgba(ctx.primaryColor, 0.12),
      }),
      el("div", {
        position: "absolute",
        bottom: -80,
        left: -80,
        width: 300,
        height: 300,
        borderRadius: 300,
        backgroundColor: rgba(ctx.secondaryColor, 0.1),
      }),
    ];
  }
  if (spec.vibrant) {
    return [
      el("div", {
        position: "absolute",
        top: -100,
        right: -100,
        width: 400,
        height: 400,
        borderRadius: 400,
        backgroundColor: "rgba(255,255,255,0.08)",
      }),
      el("div", {
        position: "absolute",
        bottom: -80,
        left: -80,
        width: 350,
        height: 350,
        borderRadius: 350,
        backgroundColor: "rgba(255,255,255,0.06)",
      }),
    ];
  }
  return [
    el("div", {
      position: "absolute",
      top: 0,
      left: 60,
      right: 60,
      height: 6,
      borderRadius: 3,
      backgroundColor: ctx.primaryColor,
    }),
    el("div", {
      position: "absolute",
      bottom: -200,
      right: -200,
      width: 500,
      height: 500,
      borderRadius: 500,
      backgroundColor: rgba(ctx.primaryColor, 0.04),
    }),
  ];
}

function root(
  spec: TemplateSpec,
  ctx: RenderContext,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  return {
    width: 1080,
    height: 1350,
    position: "relative",
    overflow: "hidden",
    display: "flex",
    fontFamily: "Inter",
    padding: spec.serif ? 100 : spec.contentPadding,
    ...backgroundStyle(spec, ctx),
    ...extra,
  };
}

function cover(
  spec: TemplateSpec,
  slide: RenderSlide,
  ctx: RenderContext,
): SatoriNode {
  const palette = paletteFor(spec, ctx);
  const children: SatoriNode[] = [...decorations(spec, ctx)];
  if (ctx.businessName) {
    children.push(el("div", {
      display: "flex",
      color: palette.text,
      fontFamily: spec.titleFont,
      fontSize: ctx.businessName.length > 20 ? 52 : 64,
      fontWeight: spec.serif ? 700 : 900,
      letterSpacing: spec.serif ? 4 : 3,
      textTransform: "uppercase",
      textAlign: "center",
      marginBottom: 30,
    }, ctx.businessName.toUpperCase()));
  }
  if (spec.serif) {
    children.push(el("div", {
      display: "flex",
      alignItems: "center",
      gap: 16,
      marginBottom: 40,
      color: ctx.primaryColor,
      fontSize: 24,
    }, [
      el("div", { width: 60, height: 2, backgroundColor: ctx.primaryColor }),
      "✦",
      el("div", { width: 60, height: 2, backgroundColor: ctx.primaryColor }),
    ]));
  } else {
    children.push(el("div", {
      display: "flex",
      color: spec.vibrant ? palette.text : ctx.primaryColor,
      backgroundColor: spec.vibrant
        ? "rgba(255,255,255,0.15)"
        : rgba(ctx.primaryColor, 0.1),
      border: spec.neon
        ? `2px solid ${rgba(ctx.primaryColor, 0.55)}`
        : spec.vibrant
        ? "2px solid rgba(255,255,255,0.25)"
        : undefined,
      borderRadius: spec.neon ? 4 : spec.vibrant ? 50 : 12,
      padding: "12px 30px",
      marginBottom: 40,
      fontSize: 18,
      fontWeight: 700,
      letterSpacing: 3,
    }, spec.neon ? `⚡ ${spec.accentLabel}` : spec.accentLabel));
  }
  children.push(el("div", {
    display: "flex",
    color: palette.text,
    fontFamily: spec.titleFont,
    fontSize: slide.title.length > 46 ? 62 : 72,
    fontWeight: spec.serif ? 700 : 900,
    textAlign: "center",
    lineHeight: spec.serif ? 1.15 : 1.1,
    marginBottom: 30,
    maxWidth: 880,
  }, slide.title));
  if (slide.body) {
    children.push(el("div", {
      display: "flex",
      color: palette.muted,
      fontSize: 30,
      textAlign: "center",
      lineHeight: 1.55,
      maxWidth: 800,
    }, slide.body));
  }
  children.push(el("div", {
    position: "absolute",
    bottom: 60,
    left: 0,
    width: 1080,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
  }, [
    ...(spec.serif ? [] : [el("div", {
      display: "flex",
      color: palette.muted,
      fontSize: 16,
      letterSpacing: spec.neon ? 3 : 2,
    }, spec.neon ? "[ SWIPE → ]" : "DESLIZE →")]),
    progressDots(
      0,
      ctx.totalSlides,
      spec.vibrant ? palette.text : ctx.primaryColor,
      spec.vibrant || spec.neon
        ? "rgba(255,255,255,0.22)"
        : rgba(palette.text, 0.16),
    ),
  ]));
  if (ctx.logoDataUrl) {
    children.push(logo(ctx.logoDataUrl, {
      position: "absolute",
      top: 40,
      left: 60,
      width: 240,
      height: 120,
    }));
  }
  return el(
    "div",
    root(spec, ctx, {
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
    }),
    children,
  );
}

function content(
  spec: TemplateSpec,
  slide: RenderSlide,
  ctx: RenderContext,
): SatoriNode {
  const palette = paletteFor(spec, ctx);
  const children: SatoriNode[] = [...decorations(spec, ctx)];
  if (spec.serif) {
    children.push(el("div", {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      marginBottom: 36,
      color: ctx.primaryColor,
      fontFamily: spec.titleFont,
      fontSize: 72,
      fontWeight: 700,
    }, [
      String(slide.number ?? 1).padStart(2, "0"),
      el("div", {
        width: 50,
        height: 3,
        backgroundColor: ctx.primaryColor,
        marginTop: 8,
      }),
    ]));
  } else {
    children.push(el("div", {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: 80,
      height: 80,
      borderRadius: spec.vibrant ? 80 : spec.neon ? 8 : 20,
      backgroundColor: spec.vibrant
        ? "rgba(255,255,255,0.2)"
        : spec.neon
        ? rgba(ctx.primaryColor, 0.1)
        : ctx.primaryColor,
      border: spec.vibrant
        ? "2px solid rgba(255,255,255,0.3)"
        : spec.neon
        ? `2px solid ${ctx.primaryColor}`
        : undefined,
      color: spec.neon ? ctx.primaryColor : "#FFFFFF",
      fontSize: 40,
      fontWeight: 900,
      marginBottom: 36,
    }, String(slide.number ?? 1)));
  }
  children.push(el("div", {
    display: "flex",
    color: palette.text,
    fontFamily: spec.titleFont,
    fontSize: slide.title.length > 42 ? 48 : 54,
    fontWeight: spec.serif ? 700 : 800,
    lineHeight: 1.15,
    marginBottom: 28,
  }, slide.title));
  if (!spec.vibrant) {
    children.push(el("div", {
      width: spec.serif ? 120 : 80,
      height: spec.serif ? 2 : spec.neon ? 2 : 4,
      backgroundColor: ctx.primaryColor,
      marginBottom: 28,
    }));
  }
  const body = bodyBlock(slide, {
    text: palette.text,
    card: palette.card,
    border: spec.neon ? rgba(ctx.primaryColor, 0.3) : palette.border,
    bullet: spec.vibrant ? palette.text : ctx.primaryColor,
    serif: spec.serif,
  });
  if (body) children.push(body);
  children.push(el(
    "div",
    {
      position: "absolute",
      bottom: 50,
      left: 0,
      width: 1080,
      display: "flex",
      justifyContent: "center",
    },
    progressDots(
      slide.number ?? 0,
      ctx.totalSlides,
      spec.vibrant ? palette.text : ctx.primaryColor,
      spec.vibrant || spec.neon
        ? "rgba(255,255,255,0.22)"
        : rgba(palette.text, 0.16),
    ),
  ));
  if (ctx.logoDataUrl) {
    children.push(logo(ctx.logoDataUrl, {
      position: "absolute",
      bottom: 50,
      right: 60,
      width: 180,
      height: 85,
      opacity: 0.7,
    }));
  }
  return el(
    "div",
    root(spec, ctx, {
      flexDirection: "column",
      padding: spec.contentPadding,
    }),
    children,
  );
}

function cta(
  spec: TemplateSpec,
  slide: RenderSlide,
  ctx: RenderContext,
): SatoriNode {
  const palette = paletteFor(spec, ctx);
  const children: SatoriNode[] = [
    ...decorations(spec, ctx),
    el("div", {
      display: "flex",
      color: palette.text,
      fontFamily: spec.titleFont,
      fontSize: slide.title.length > 42 ? 52 : 60,
      fontWeight: spec.serif || spec.neon ? 700 : 900,
      textAlign: "center",
      lineHeight: 1.12,
      marginBottom: 30,
      maxWidth: 880,
    }, slide.title),
  ];
  if (slide.body) {
    children.push(el("div", {
      display: "flex",
      color: palette.muted,
      fontSize: 28,
      textAlign: "center",
      lineHeight: 1.6,
      marginBottom: 50,
      maxWidth: 800,
    }, slide.body.replace(/\\n/g, "\n")));
  }
  children.push(el("div", {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: spec.vibrant
      ? palette.text
      : spec.serif || spec.neon
      ? "transparent"
      : ctx.primaryColor,
    border: spec.serif || spec.neon
      ? `3px solid ${ctx.primaryColor}`
      : undefined,
    borderRadius: spec.serif ? 4 : spec.neon ? 8 : 60,
    padding: spec.serif ? "20px 56px" : "24px 60px",
    color: spec.vibrant
      ? ctx.primaryColor
      : spec.serif || spec.neon
      ? ctx.primaryColor
      : "#FFFFFF",
    fontSize: spec.serif || spec.neon ? 24 : 28,
    fontWeight: 800,
    letterSpacing: spec.serif ? 3 : 1,
  }, (ctx.ctaLabel || spec.ctaLabel).toUpperCase()));
  if (ctx.profileHandle) {
    children.push(el("div", {
      display: "flex",
      color: palette.muted,
      fontSize: 22,
      marginTop: 36,
    }, ctx.profileHandle));
  }
  children.push(el(
    "div",
    {
      position: "absolute",
      bottom: 50,
      left: 0,
      width: 1080,
      display: "flex",
      justifyContent: "center",
    },
    progressDots(
      ctx.totalSlides - 1,
      ctx.totalSlides,
      spec.vibrant ? palette.text : ctx.primaryColor,
      spec.vibrant || spec.neon
        ? "rgba(255,255,255,0.22)"
        : rgba(palette.text, 0.16),
    ),
  ));
  if (ctx.logoDataUrl) {
    children.push(logo(ctx.logoDataUrl, {
      position: "absolute",
      bottom: 50,
      right: 60,
      width: 180,
      height: 85,
      opacity: 0.7,
    }));
  }
  return el(
    "div",
    root(spec, ctx, {
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
    }),
    children,
  );
}

export function buildMarketingTemplateSlide(
  template: MarketingTemplate,
  slide: RenderSlide,
  ctx: RenderContext,
): SatoriNode {
  const spec = specs[template];
  if (slide.type === "cover") return cover(spec, slide, ctx);
  if (slide.type === "cta") return cta(spec, slide, ctx);
  return content(spec, slide, ctx);
}
