import { carouselBodyLines } from "../carousel-content.ts";
import type { RenderContext, RenderSlide } from "./darkPremium.ts";

export type SatoriNode = {
  type: string;
  props: Record<string, unknown>;
};

export function el(
  type: string,
  style: Record<string, unknown>,
  children?: unknown,
): SatoriNode {
  return {
    type,
    props: {
      style,
      ...(children !== undefined ? { children } : {}),
    },
  };
}

export function rgba(hex: string, alpha: number): string {
  const clean = String(hex || "#000000").replace("#", "");
  const full = clean.length === 3
    ? clean.split("").map((part) => part + part).join("")
    : clean;
  const red = Number.parseInt(full.slice(0, 2), 16) || 0;
  const green = Number.parseInt(full.slice(2, 4), 16) || 0;
  const blue = Number.parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function rgb(hex: string): [number, number, number] {
  const clean = String(hex || "#000000").replace("#", "");
  return [
    Number.parseInt(clean.slice(0, 2), 16) || 0,
    Number.parseInt(clean.slice(2, 4), 16) || 0,
    Number.parseInt(clean.slice(4, 6), 16) || 0,
  ];
}

export function relativeLuminance(hex: string): number {
  const channels = rgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] +
    0.0722 * channels[2];
}

export function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(
    relativeLuminance(first),
    relativeLuminance(second),
  );
  const darker = Math.min(
    relativeLuminance(first),
    relativeLuminance(second),
  );
  return (lighter + 0.05) / (darker + 0.05);
}

export function contrastTextColor(background: string): string {
  const dark = "#0F172A";
  const light = "#FFFFFF";
  return contrastRatio(background, dark) >= contrastRatio(background, light)
    ? dark
    : light;
}

export function contrastPalette(
  background: string,
): { text: string; muted: string; card: string; border: string } {
  const text = contrastTextColor(background);
  const lightText = text === "#FFFFFF";
  return {
    text,
    muted: lightText ? "rgba(255,255,255,0.72)" : "rgba(15,23,42,0.72)",
    card: lightText ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.48)",
    border: lightText ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.12)",
  };
}

export function effectiveBackground(
  ctx: RenderContext,
  fallback: string,
): string {
  return ctx.backgroundColor || fallback;
}

export function logo(
  dataUrl: string,
  style: Record<string, unknown>,
): SatoriNode {
  return {
    type: "img",
    props: {
      src: dataUrl,
      style: { objectFit: "contain", ...style },
    },
  };
}

export function progressDots(
  current: number,
  total: number,
  active: string,
  inactive: string,
): SatoriNode {
  return el(
    "div",
    { display: "flex", alignItems: "center", gap: 10 },
    Array.from({ length: total }, (_, index) =>
      el("div", {
        width: index === current ? 34 : 12,
        height: 12,
        borderRadius: 12,
        backgroundColor: index === current ? active : inactive,
      })),
  );
}

export function bodyBlock(
  slide: RenderSlide,
  options: {
    text: string;
    card: string;
    border: string;
    bullet: string;
    serif?: boolean;
  },
): SatoriNode | null {
  const lines = carouselBodyLines(slide.body).slice(0, 5);
  if (!lines.length) return null;
  if (lines.length === 1) {
    return el("div", {
      display: "flex",
      flexGrow: 1,
      alignItems: "center",
      color: options.text,
      fontSize: lines[0].length > 260 ? 28 : 34,
      lineHeight: 1.65,
      padding: "34px 38px",
      backgroundColor: options.card,
      border: `2px solid ${options.border}`,
      borderRadius: options.serif ? 18 : 24,
    }, lines[0]);
  }
  return el(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      flexGrow: 1,
      justifyContent: "center",
      marginBottom: 150,
      gap: 16,
    },
    lines.map((line) =>
      el("div", {
        display: "flex",
        alignItems: "center",
        gap: 20,
        color: options.text,
        fontSize: lines.length > 3 ? 30 : 35,
        fontWeight: 500,
        lineHeight: 1.35,
        padding: "22px 30px",
        backgroundColor: options.card,
        border: `2px solid ${options.border}`,
        borderRadius: options.serif ? 16 : 20,
      }, [
        el("div", {
          width: 16,
          height: 16,
          borderRadius: options.serif ? 2 : 16,
          backgroundColor: options.bullet,
          flexShrink: 0,
          ...(options.serif ? { transform: "rotate(45deg)" } : {}),
        }),
        el("div", { display: "flex" }, line.replace(/^•\s*/, "")),
      ])
    ),
  );
}
