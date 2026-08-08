/**
 * Template "dark-premium" portado para Satori (render server-side, sem navegador).
 *
 * Satori suporta um SUBSET de CSS. Diferenças conscientes vs. o template do app:
 *  - `textShadow` não existe no Satori → removido (o glow do texto era sutil).
 *  - `radial-gradient` é suportado, mas em formas grandes fica pesado → usamos
 *    círculos com cor sólida translúcida (visual equivalente, mais previsível).
 *  - `filter: drop-shadow` não existe → removido nas logos.
 *  - Todo container com múltiplos filhos declara `display: flex` (exigência do Satori).
 *
 * Retorna a árvore no formato de objeto que o Satori aceita ({ type, props }),
 * evitando a necessidade de transpilar JSX dentro do Deno.
 */

export type SlideType = "cover" | "content" | "cta";

export interface RenderSlide {
  type: SlideType;
  title: string;
  body?: string;
  number?: number;
}

export interface RenderContext {
  primaryColor: string;
  secondaryColor: string;
  totalSlides: number;
  logoDataUrl?: string | null;
  businessName?: string | null;
  profileHandle?: string | null;
  ctaLabel?: string | null;
}

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

const FONT_FAMILY = "Inter";

// ---------- helpers ----------

type Node = { type: string; props: Record<string, unknown> };

function el(
  type: string,
  style: Record<string, unknown>,
  children?: unknown,
): Node {
  return { type, props: { style, ...(children !== undefined ? { children } : {}) } };
}

/** #RRGGBB + alpha(0..1) -> rgba(...) — Satori não entende "#RRGGBB20". */
export function rgba(hex: string, alpha: number): string {
  const h = (hex || "#6366F1").replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function circle(
  size: number,
  color: string,
  pos: Record<string, number | string>,
): Node {
  return el("div", {
    position: "absolute",
    width: size,
    height: size,
    borderRadius: size,
    backgroundColor: color,
    ...pos,
  });
}

function accentBar(primary: string, secondary: string): Node {
  return el("div", {
    position: "absolute",
    top: 0,
    left: 0,
    width: CARD_WIDTH,
    height: 6,
    backgroundImage: `linear-gradient(90deg, ${primary}, ${secondary}, ${primary})`,
  });
}

function progressDots(current: number, total: number, primary: string): Node {
  const dots: Node[] = [];
  for (let i = 0; i < total; i++) {
    const active = i === current;
    dots.push(
      el("div", {
        width: active ? 34 : 12,
        height: 12,
        borderRadius: 12,
        backgroundColor: active ? primary : "rgba(255,255,255,0.2)",
      }),
    );
  }
  return el("div", { display: "flex", alignItems: "center", gap: 10 }, dots);
}

function logoImg(
  dataUrl: string,
  style: Record<string, unknown>,
): Node {
  return { type: "img", props: { src: dataUrl, style: { objectFit: "contain", ...style } } };
}

const baseCard = (primary: string, secondary: string, extra: Record<string, unknown>) => ({
  width: CARD_WIDTH,
  height: CARD_HEIGHT,
  position: "relative" as const,
  display: "flex",
  fontFamily: FONT_FAMILY,
  backgroundColor: "#0F172A",
  backgroundImage: `linear-gradient(145deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)`,
  padding: 80,
  ...extra,
});

// ---------- COVER ----------

function cover(slide: RenderSlide, ctx: RenderContext): Node {
  const { primaryColor: p, secondaryColor: s } = ctx;
  const children: Node[] = [
    circle(400, rgba(p, 0.14), { top: -120, right: -120 }),
    circle(300, rgba(s, 0.12), { bottom: -80, left: -80 }),
    accentBar(p, s),
  ];

  if (ctx.businessName) {
    children.push(
      el("div", {
        display: "flex",
        color: "#FFFFFF",
        fontSize: ctx.businessName.length > 20 ? 50 : 62,
        fontWeight: 900,
        letterSpacing: 3,
        textAlign: "center",
        textTransform: "uppercase",
        marginBottom: 30,
      }, ctx.businessName.toUpperCase()),
    );
  }

  // Badge
  children.push(
    el("div", {
      display: "flex",
      alignItems: "center",
      gap: 12,
      backgroundColor: rgba(p, 0.16),
      border: `2px solid ${rgba(p, 0.35)}`,
      borderRadius: 50,
      padding: "12px 32px",
      marginBottom: 44,
    }, [
      el("div", { width: 10, height: 10, borderRadius: 10, backgroundColor: p }),
      el("div", {
        display: "flex",
        color: p,
        fontSize: 20,
        fontWeight: 700,
        letterSpacing: 4,
      }, "CARROSSEL"),
    ]),
  );

  // Título
  children.push(
    el("div", {
      display: "flex",
      color: "#FFFFFF",
      fontSize: slide.title.length > 46 ? 62 : 74,
      fontWeight: 900,
      textAlign: "center",
      lineHeight: 1.1,
      marginBottom: 30,
      maxWidth: 880,
    }, slide.title),
  );

  if (slide.body) {
    children.push(
      el("div", {
        display: "flex",
        color: "rgba(255,255,255,0.65)",
        fontSize: 30,
        lineHeight: 1.5,
        textAlign: "center",
        maxWidth: 800,
      }, slide.body),
    );
  }

  // Swipe + dots
  children.push(
    el("div", {
      position: "absolute",
      bottom: 60,
      left: 0,
      width: CARD_WIDTH,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 18,
    }, [
      el("div", {
        display: "flex",
        color: "rgba(255,255,255,0.4)",
        fontSize: 18,
        fontWeight: 500,
        letterSpacing: 2,
      }, "DESLIZE PARA VER"),
      progressDots(0, ctx.totalSlides, p),
    ]),
  );

  if (ctx.logoDataUrl) {
    children.push(logoImg(ctx.logoDataUrl, { position: "absolute", top: 44, left: 60, width: 220, height: 110 }));
  }

  return el("div", baseCard(p, s, {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  }), children);
}

// ---------- CONTENT ----------

function content(slide: RenderSlide, ctx: RenderContext): Node {
  const { primaryColor: p, secondaryColor: s } = ctx;
  const children: Node[] = [
    el("div", {
      position: "absolute",
      top: 0,
      left: 0,
      width: 8,
      height: CARD_HEIGHT,
      backgroundColor: p,
      opacity: 0.85,
    }),
    circle(300, rgba(p, 0.1), { top: -100, right: -100 }),
    // Number badge
    el("div", {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: 96,
      height: 96,
      borderRadius: 24,
      backgroundImage: `linear-gradient(135deg, ${p}, ${s})`,
      marginBottom: 40,
    }, el("div", { display: "flex", color: "#FFFFFF", fontSize: 46, fontWeight: 900 }, String(slide.number ?? 1))),
    // Título
    el("div", {
      display: "flex",
      color: "#FFFFFF",
      fontSize: slide.title.length > 40 ? 48 : 56,
      fontWeight: 800,
      lineHeight: 1.15,
      marginBottom: 28,
    }, slide.title),
    // Divider
    el("div", {
      width: 90,
      height: 5,
      borderRadius: 5,
      backgroundImage: `linear-gradient(90deg, ${p}, ${s})`,
      marginBottom: 34,
    }),
  ];

  const lines = (slide.body || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length > 1) {
    children.push(
      el("div", {
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        justifyContent: "center",
        marginBottom: 170,
        gap: 18,
      }, lines.slice(0, 5).map((line) =>
        el("div", {
          display: "flex",
          alignItems: "center",
          gap: 22,
          backgroundColor: "rgba(255,255,255,0.05)",
          border: "2px solid rgba(255,255,255,0.08)",
          borderRadius: 22,
          padding: "24px 32px",
        }, [
          el("div", { width: 18, height: 18, borderRadius: 18, backgroundColor: p, flexShrink: 0 }),
          el("div", {
            display: "flex",
            color: "rgba(255,255,255,0.92)",
            fontSize: lines.length > 3 ? 30 : 34,
            fontWeight: 500,
            lineHeight: 1.35,
          }, line),
        ])
      )),
    );
  } else if (lines.length === 1) {
    children.push(
      el("div", {
        display: "flex",
        flexGrow: 1,
        alignItems: "flex-start",
      }, el("div", {
        display: "flex",
        color: "rgba(255,255,255,0.82)",
        fontSize: lines[0].length > 260 ? 28 : 34,
        lineHeight: 1.6,
      }, lines[0])),
    );
  }

  children.push(
    el("div", {
      position: "absolute",
      bottom: 50,
      left: 0,
      width: CARD_WIDTH,
      display: "flex",
      justifyContent: "center",
    }, progressDots(slide.number ?? 0, ctx.totalSlides, p)),
  );

  if (ctx.logoDataUrl) {
    children.push(logoImg(ctx.logoDataUrl, { position: "absolute", bottom: 46, right: 60, width: 170, height: 80, opacity: 0.7 }));
  }

  return el("div", baseCard(p, s, {
    flexDirection: "column",
    backgroundImage: `linear-gradient(165deg, #0F172A 0%, #1E293B 100%)`,
  }), children);
}

// ---------- CTA ----------

function cta(slide: RenderSlide, ctx: RenderContext): Node {
  const { primaryColor: p, secondaryColor: s } = ctx;
  const children: Node[] = [
    circle(500, rgba(p, 0.12), { top: -150, left: 290 }),
    circle(350, rgba(s, 0.1), { bottom: -100, right: -100 }),
    accentBar(p, s),
    el("div", {
      display: "flex",
      color: "#FFFFFF",
      fontSize: slide.title.length > 40 ? 52 : 62,
      fontWeight: 900,
      textAlign: "center",
      lineHeight: 1.1,
      marginBottom: 30,
      maxWidth: 880,
    }, slide.title),
  ];

  if (slide.body) {
    children.push(
      el("div", {
        display: "flex",
        color: "rgba(255,255,255,0.6)",
        fontSize: 28,
        textAlign: "center",
        lineHeight: 1.6,
        marginBottom: 50,
        maxWidth: 800,
      }, slide.body.replace(/\\n/g, " ")),
    );
  }

  children.push(
    el("div", {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundImage: `linear-gradient(135deg, ${p}, ${s})`,
      borderRadius: 60,
      padding: "26px 64px",
    }, el("div", { display: "flex", color: "#FFFFFF", fontSize: 30, fontWeight: 700, letterSpacing: 1 },
      (ctx.ctaLabel || "SAIBA MAIS").toUpperCase())),
  );

  if (ctx.profileHandle) {
    children.push(
      el("div", { display: "flex", color: "rgba(255,255,255,0.45)", fontSize: 24, marginTop: 42 }, ctx.profileHandle),
    );
  }

  children.push(
    el("div", {
      position: "absolute",
      bottom: 50,
      left: 0,
      width: CARD_WIDTH,
      display: "flex",
      justifyContent: "center",
    }, progressDots(ctx.totalSlides - 1, ctx.totalSlides, p)),
  );

  if (ctx.logoDataUrl) {
    children.push(logoImg(ctx.logoDataUrl, { position: "absolute", bottom: 46, right: 60, width: 170, height: 80, opacity: 0.7 }));
  }

  return el("div", baseCard(p, s, {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  }), children);
}

/** Monta a árvore Satori de um slide do template dark-premium. */
export function buildDarkPremiumSlide(slide: RenderSlide, ctx: RenderContext): Node {
  if (slide.type === "cover") return cover(slide, ctx);
  if (slide.type === "cta") return cta(slide, ctx);
  return content(slide, ctx);
}
