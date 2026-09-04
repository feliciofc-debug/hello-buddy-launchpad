// ============================================================
// CORES PEDIDAS EM TEXTO -> PALETA COMPLETA DO VÍDEO MOTION
//
// Caso de uso: prospecção. O responsável pede pelo WhatsApp
// "vídeo pro Supermercado Zona Sul, cores #ffffff e #E30613"
// (ou "nas cores vermelho e branco") e o vídeo precisa sair na
// identidade visual do cliente dele, não na paleta da própria
// empresa.
//
// Nada aqui inventa cor: quando o texto não menciona nenhuma cor,
// devolvemos `null` e o fluxo antigo (paleta do tenant) continua.
// ============================================================

export type CoresVideo = {
  bg: string;
  bg2: string;
  panel: string;
  line: string;
  destaque: string;
  destaqueSoft: string;
  texto: string;
  suave: string;
};

const TEXTO_ESCURO = "#151515";
const TEXTO_CLARO = "#f4f7fb";

const NOMES: Record<string, string> = {
  branco: "#ffffff",
  branca: "#ffffff",
  preto: "#101418",
  preta: "#101418",
  vermelho: "#E30613",
  vermelha: "#E30613",
  azul: "#1d4ed8",
  "azul marinho": "#122a5c",
  "azul claro": "#2f9bdd",
  verde: "#0f9d58",
  "verde escuro": "#0b6b3d",
  amarelo: "#f5b301",
  amarela: "#f5b301",
  laranja: "#FF7A1A",
  roxo: "#6d28d9",
  roxa: "#6d28d9",
  lilas: "#8b5cf6",
  rosa: "#e83e8c",
  cinza: "#6b7280",
  dourado: "#c9a227",
  dourada: "#c9a227",
  prata: "#9aa4ad",
  marrom: "#7a4a24",
  bege: "#efe3d0",
  vinho: "#7b1023",
  turquesa: "#0fb5ad",
};

const NOMES_LEGIVEIS: Array<[RegExp, string]> = Object.keys(NOMES).map((n) => [
  new RegExp(`\\b${n.replace(/ /g, "\\s+")}\\b`, "i"),
  n,
]);

const rgb = (hex: string): [number, number, number] => {
  let v = String(hex || "").replace("#", "").trim();
  if (v.length === 3) v = v.split("").map((c) => c + c).join("");
  v = v.padEnd(6, "0").slice(0, 6);
  const n = Number.parseInt(v, 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const hex = (c: [number, number, number]) =>
  "#" + c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");

function luminancia(cor: string): number {
  const canais = rgb(cor).map((canal) => {
    const n = canal / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2];
}

function contraste(a: string, b: string): number {
  const l = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l[0] + 0.05) / (l[1] + 0.05);
}

const textoSobre = (cor: string) =>
  contraste(cor, TEXTO_ESCURO) >= contraste(cor, TEXTO_CLARO) ? TEXTO_ESCURO : TEXTO_CLARO;

function mistura(a: string, b: string, peso: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return hex([r1 + (r2 - r1) * peso, g1 + (g2 - g1) * peso, b1 + (b2 - b1) * peso]);
}

/** Saturação aproximada (HSL) — separa cor "de marca" de neutro (fundo). */
function saturacao(cor: string): number {
  const [r, g, b] = rgb(cor).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const l = (max + min) / 2;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

const normalizarHex = (bruto: string): string | null => {
  const m = String(bruto).match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let v = m[1];
  if (v.length === 3) v = v.split("").map((c) => c + c).join("");
  return `#${v.toLowerCase()}`;
};

const ROTULOS: Array<{ chave: "bg" | "bg2" | "panel" | "line" | "destaque" | "destaqueSoft" | "texto"; re: RegExp }> = [
  { chave: "bg2", re: /\b(?:fundo\s*2|segundo\s+fundo|fundo\s+secund[aá]rio)\b/i },
  { chave: "destaqueSoft", re: /\b(?:apoio|destaque\s+suave|secund[aá]ria?|cor\s+de\s+apoio)\b/i },
  { chave: "destaque", re: /\b(?:destaque|principal|cor\s+principal|realce)\b/i },
  { chave: "panel", re: /\b(?:painel|card|caixa)\b/i },
  { chave: "line", re: /\b(?:linha|borda|contorno)\b/i },
  { chave: "texto", re: /\b(?:texto|letra|fonte)\b/i },
  { chave: "bg", re: /\b(?:fundo|background)\b/i },
];

function rotuloAntes(texto: string, posHex: number): string | null {
  const janela = texto.slice(Math.max(0, posHex - 40), posHex);
  let melhor: { chave: string; idx: number } | null = null;
  for (const r of ROTULOS) {
    const m = janela.match(new RegExp(r.re.source + "[^#]*$", "i"));
    if (m && typeof m.index === "number") {
      if (!melhor || m.index > melhor.idx) melhor = { chave: r.chave, idx: m.index };
    }
  }
  return melhor?.chave ?? null;
}

/** Nome legível ("vermelho #E30613") para mostrar no roteiro. */
function nomeAproximado(cor: string): string {
  const [r, g, b] = rgb(cor);
  let melhorNome = "";
  let melhorDist = Infinity;
  for (const [nome, valor] of Object.entries(NOMES)) {
    const [r2, g2, b2] = rgb(valor);
    const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
    if (d < melhorDist) {
      melhorDist = d;
      melhorNome = nome;
    }
  }
  return melhorNome;
}

/** Monta a paleta completa a partir de fundo + destaque (e do que mais vier). */
export function paletaAPartirDe(parcial: Partial<CoresVideo>): CoresVideo {
  const bg = normalizarHex(parcial.bg ?? "") ?? "#0f1720";
  const destaque = normalizarHex(parcial.destaque ?? "") ?? "#FF7A1A";
  const claro = luminancia(bg) > 0.4;
  const extremo = claro ? "#ffffff" : "#000000";
  const oposto = claro ? "#000000" : "#ffffff";

  const bg2 = normalizarHex(parcial.bg2 ?? "") ?? mistura(bg, destaque, claro ? 0.06 : 0.12);
  const panel = normalizarHex(parcial.panel ?? "") ?? mistura(bg, extremo, claro ? 0.55 : 0.16);
  const texto = normalizarHex(parcial.texto ?? "") ?? textoSobre(bg);
  const line = normalizarHex(parcial.line ?? "") ?? mistura(panel, oposto, 0.14);
  const destaqueSoft = normalizarHex(parcial.destaqueSoft ?? "") ??
    mistura(destaque, claro ? "#000000" : "#ffffff", 0.28);
  const suave = normalizarHex(parcial.suave ?? "") ?? mistura(texto, bg, 0.42);

  const cores: CoresVideo = { bg, bg2, panel, line, destaque, destaqueSoft, texto, suave };

  // Correções automáticas: o vídeo é recusado pelo validador de contraste,
  // então nunca devolvemos uma paleta ilegível por causa de um hex do usuário.
  if (contraste(cores.bg, cores.texto) < 4.5) cores.texto = textoSobre(cores.bg);
  if (contraste(cores.bg2, cores.texto) < 4.5) cores.bg2 = mistura(cores.bg, cores.destaque, claro ? 0.04 : 0.1);
  if (contraste(cores.bg2, cores.texto) < 4.5) cores.bg2 = cores.bg;
  let guarda = 0;
  while (contraste(cores.panel, textoSobre(cores.panel)) < 4.5 && guarda++ < 8) {
    cores.panel = mistura(cores.panel, extremo, 0.2);
  }
  guarda = 0;
  while (contraste(cores.destaque, textoSobre(cores.destaque)) < 4.5 && guarda++ < 8) {
    cores.destaque = mistura(cores.destaque, oposto, 0.12);
  }
  if (contraste(cores.suave, cores.bg) < 3) cores.suave = mistura(cores.texto, cores.bg, 0.25);
  return cores;
}

export type CoresPedidas = { cores: CoresVideo; resumo: string };

/**
 * Lê cores mencionadas no pedido (hex com ou sem rótulo, ou nomes em
 * português) e devolve a paleta completa + um resumo legível.
 * Devolve null quando o texto não menciona cor nenhuma.
 */
export function extrairCoresDoTexto(texto: string): CoresPedidas | null {
  const t = String(texto ?? "");
  if (!t.trim()) return null;

  const parcial: Partial<CoresVideo> = {};
  const soltos: string[] = [];

  const re = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const cor = normalizarHex(m[0]);
    if (!cor) continue;
    const chave = rotuloAntes(t, m.index);
    if (chave && !(parcial as any)[chave]) (parcial as any)[chave] = cor;
    else soltos.push(cor);
  }

  // Nomes de cor ("vermelho e branco", "nas cores do cliente: azul e amarelo")
  const mencionaCor = /\bcores?\b|\bpaleta\b|\bidentidade\s+visual\b/i.test(t);
  const nomesEncontrados: string[] = [];
  for (const [reNome, nome] of NOMES_LEGIVEIS) {
    if (reNome.test(t)) nomesEncontrados.push(NOMES[nome]);
  }
  const usarNomes = nomesEncontrados.length > 0 && (mencionaCor || nomesEncontrados.length >= 2);
  if (usarNomes) soltos.push(...nomesEncontrados);

  // Hex/nome sem rótulo: neutro (branco/preto/cinza) vira fundo, cor viva vira destaque.
  for (const cor of soltos) {
    const viva = saturacao(cor) >= 0.25 && luminancia(cor) > 0.03 && luminancia(cor) < 0.9;
    if (viva) {
      if (!parcial.destaque) parcial.destaque = cor;
      else if (!parcial.destaqueSoft) parcial.destaqueSoft = cor;
    } else {
      if (!parcial.bg) parcial.bg = cor;
      else if (!parcial.bg2) parcial.bg2 = cor;
    }
  }

  if (!parcial.bg && !parcial.destaque && !parcial.bg2 && !parcial.panel && !parcial.texto) return null;

  const cores = paletaAPartirDe(parcial);
  const resumo = `fundo ${nomeAproximado(cores.bg)} (${cores.bg}), destaque ${nomeAproximado(cores.destaque)} (${cores.destaque})`;
  return { cores, resumo };
}
