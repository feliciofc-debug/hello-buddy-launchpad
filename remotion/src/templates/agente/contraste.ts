// ============================================================
// Helpers de contraste — garantem legibilidade em QUALQUER paleta
// (clara ou escura) escolhida pelo cliente. Sem cores fixas.
// ============================================================

export const TEXTO_ESCURO = "#151515";
export const TEXTO_CLARO = "#f4f7fb";

/** Converte hex (#rgb ou #rrggbb) em [r,g,b] 0-255. */
export function hexRgb(hex: string): [number, number, number] {
  const h = String(hex || "").replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0");
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminância relativa (WCAG) 0 = preto, 1 = branco. */
export function luminancia(hex: string): number {
  const [r, g, b] = hexRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Texto legível por cima de uma cor de fundo. */
export function textoSobre(hex: string): string {
  // Maior contraste real (WCAG) em vez de limiar de luminancia.
  return contraste(hex, TEXTO_ESCURO) >= contraste(hex, TEXTO_CLARO) ? TEXTO_ESCURO : TEXTO_CLARO;
}

/** Razão de contraste WCAG entre duas cores. */
export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  const [claro, escuro] = la > lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (escuro + 0.05);
}

export const ehClaro = (hex: string) => luminancia(hex) > 0.5;

/** rgba a partir de hex + alpha. */
export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Cor de texto legível sobre um fundo, respeitando a cor preferida da paleta
 * quando ela já tem contraste WCAG suficiente (>= 4.5:1).
 */
export function textoLegivelSobre(fundo: string, preferida?: string): string {
  if (preferida && contraste(fundo, preferida) >= 4.5) return preferida;
  return textoSobre(fundo);
}

/**
 * Fundo da pílula de legenda derivado da paleta:
 * paleta clara -> superfície clara; paleta escura -> painel escuro.
 */
export function fundoLegenda(bg: string, panel: string): string {
  if (!ehClaro(bg)) return panel;
  return ehClaro(panel) ? panel : bg;
}
