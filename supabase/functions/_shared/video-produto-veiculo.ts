// Contrato e normalização do template Remotion `template-veiculo-estudio`.
// Modo produto continua em video-produto.ts + template-produto.

import type { Paleta, ProdutoVideoProps } from "./video-produto.ts";
import { framesProduto } from "./video-produto.ts";

export const TEMPLATE_VEICULO_ESTUDIO = "template-veiculo-estudio";

/** Paleta estúdio (fundo claro); destaque vem da marca da loja. */
export const PALETA_ESTUDIO_VEICULO: Paleta = {
  bg: "#F8F9FA",
  bg2: "#EEF0F2",
  panel: "#FFFFFF",
  line: "#D8DCE0",
  destaque: "#F26B1D",
  destaqueSoft: "#FF8F4D",
  texto: "#111111",
  suave: "#4B5563",
};

const txt = (v: unknown, max: number) =>
  String(v ?? "").replace(/\s+/g, " ").replace(/^["'`\s]+|["'`\s]+$/g, "").slice(0, max).trim();

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function formatTelefoneBR(raw: unknown): string | undefined {
  const limpo = String(raw ?? "").trim();
  if (!limpo) return undefined;
  const d = limpo.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (/^\(\d{2}\)\s*\d/.test(limpo)) return limpo;
  return limpo.slice(0, 30);
}

export function formatPrecoVeiculoVideo(precoRaw: unknown): string | undefined {
  const bruto = txt(precoRaw, 24);
  if (!bruto) return undefined;
  const num = Number(
    bruto.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."),
  );
  if (!Number.isFinite(num) || num <= 0) return bruto;
  const cents = Math.round((num - Math.floor(num)) * 100);
  if (cents === 0) {
    return `R$ ${Math.round(num).toLocaleString("pt-BR")}`;
  }
  return `R$ ${num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Quebra título em até 2 linhas sem cortar palavra. */
export function quebrarTituloVeiculo(nome: string, maxLinhas = 2): string[] {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return [""];
  if (palavras.length === 1 || maxLinhas <= 1) return [palavras.join(" ")];

  let melhor: [string, string] | null = null;
  let melhorDiff = Infinity;
  for (let i = 1; i < palavras.length; i++) {
    const a = palavras.slice(0, i).join(" ");
    const b = palavras.slice(i).join(" ");
    const diff = Math.abs(a.length - b.length);
    if (diff < melhorDiff) {
      melhorDiff = diff;
      melhor = [a, b];
    }
  }
  return melhor ?? [palavras.join(" ")];
}

export function tamanhoFonteTituloVeiculo(linhas: string[]): number {
  const maior = Math.max(...linhas.map((l) => l.length), 1);
  if (linhas.length <= 1) {
    if (maior <= 16) return 72;
    if (maior <= 22) return 64;
    if (maior <= 28) return 56;
    return 48;
  }
  if (maior <= 14) return 58;
  if (maior <= 20) return 52;
  if (maior <= 26) return 46;
  return 40;
}

function normalizarCoresEstudio(bruto: unknown): Paleta {
  const entrada = (bruto ?? {}) as Record<string, unknown>;
  const saida = { ...PALETA_ESTUDIO_VEICULO };
  for (const chave of ["destaque", "destaqueSoft"] as (keyof Paleta)[]) {
    const valor = String(entrada[chave] ?? "");
    if (HEX.test(valor)) saida[chave] = valor;
  }
  return saida;
}

export function normalizarPropsProdutoVeiculo(
  bruto: any,
  ctx: { marca?: string; site?: string; telefone?: string; consultor?: string; imagemUrl: string },
): ProdutoVideoProps {
  const marca = txt(bruto?.marca || ctx.marca, 40) || "Sua loja";
  const p = bruto?.produto ?? {};

  const bullets = (Array.isArray(p?.bullets) ? p.bullets : [])
    .slice(0, 4)
    .map((b: unknown) => txt(b, 36))
    .filter(Boolean);

  const legendas = (Array.isArray(bruto?.legendas) ? bruto.legendas : [])
    .slice(0, 5)
    .map((l: unknown) => txt(l, 64))
    .filter(Boolean);

  const nome = txt(p?.nome, 56) || "Veículo";
  const precoFmt = formatPrecoVeiculoVideo(p?.preco);

  return {
    marca,
    nivel: "padrao",
    site: txt(bruto?.site ?? ctx.site, 40),
    cores: normalizarCoresEstudio(bruto?.cores),
    produto: {
      imagemUrl: ctx.imagemUrl,
      recortar_fundo: p?.recortar_fundo !== false,
      recortado: false,
      nome,
      subtitulo: txt(p?.subtitulo, 72) || undefined,
      bullets,
      precoDe: txt(p?.precoDe, 20) || undefined,
      preco: precoFmt,
      parcelas: txt(p?.parcelas, 26) || undefined,
      selo: txt(p?.selo, 20) || undefined,
    },
    cta: {
      frase: txt(bruto?.cta?.frase, 42) || "Chama no WhatsApp",
      sub: txt(bruto?.cta?.sub, 50) || undefined,
      telefone: formatTelefoneBR(bruto?.cta?.telefone ?? ctx.telefone),
      consultor: txt(bruto?.cta?.consultor ?? ctx.consultor, 40) || undefined,
    },
    legendas: legendas.filter(
      (l: string) =>
        l.toLowerCase() !== nome.toLowerCase() &&
        !bullets.some((b: string) => b.toLowerCase() === l.toLowerCase()),
    ),
  };
}

export function duracaoEstimadaVeiculoEstudio(props: ProdutoVideoProps): number {
  return Math.round((framesProduto(props) / 30) * 10) / 10;
}
