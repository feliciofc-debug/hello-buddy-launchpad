// ============================================================
// VÍDEO DE PRODUTO — contrato das props do template Remotion
// `template-produto` (remotion/src/templates/produto/Template.tsx).
//
// Custo ZERO por render: tudo roda na VPS (Remotion + rembg).
// Nada aqui chama API paga.
//
// FASE 2 (premium com IA de vídeo) — não implementada de propósito.
// Os ganchos já existem para não refatorar depois:
//   - `nivel`: "padrao" (atual) | "premium" (futuro, whitelist por e-mail)
//   - NIVEL_PREMIUM_FLAG: chave da feature flag que vai controlar quem vê
//   - LIMITE_PREMIUM_DIA: teto rígido pensado para preservar o saldo do Jarvis
// ============================================================

export type NivelVideo = "padrao" | "premium";

/** Flag/limites reservados para a fase 2. Nada consome isso ainda. */
export const NIVEL_PREMIUM_FLAG = "video_premium";
export const LIMITE_PREMIUM_DIA = 3;

export type Paleta = {
  bg: string;
  bg2: string;
  panel: string;
  line: string;
  destaque: string;
  destaqueSoft: string;
  texto: string;
  suave: string;
};

export type ProdutoVideoProps = {
  marca: string;
  logo_path?: string;
  logoUrl?: string;
  site?: string;
  nivel: NivelVideo;
  trilha_id?: string;
  trilha_path?: string;
  trilhaUrl?: string;
  trilha_volume?: number;
  cores: Paleta;
  produto: {
    imagemUrl: string;
    /** pedido do usuário; o worker confirma se o recorte deu certo */
    recortar_fundo?: boolean;
    recortado?: boolean;
    nome: string;
    subtitulo?: string;
    bullets: string[];
    precoDe?: string;
    preco?: string;
    parcelas?: string;
    selo?: string;
  };
  cta: { frase: string; sub?: string; telefone?: string; consultor?: string };
  legendas: string[];
};

export const PALETA_PADRAO_PRODUTO: Paleta = {
  bg: "#0f1720",
  bg2: "#1a2332",
  panel: "#16202c",
  line: "#26313f",
  destaque: "#FF7A1A",
  destaqueSoft: "#ff9e56",
  texto: "#f4f7fb",
  suave: "#93a4b8",
};

const txt = (v: unknown, max: number) =>
  String(v ?? "").replace(/\s+/g, " ").replace(/^["'`\s]+|["'`\s]+$/g, "").slice(0, max).trim();

/** Corta no limite sem quebrar palavra no meio e fecha com reticências. */
const cortar = (v: unknown, max: number) => {
  const bruto = String(v ?? "").replace(/\s+/g, " ").trim();
  if (bruto.length <= max) return bruto;
  const fatia = bruto.slice(0, max - 1);
  const corte = fatia.lastIndexOf(" ");
  return `${(corte > max * 0.6 ? fatia.slice(0, corte) : fatia).replace(/[\s,.;:-]+$/, "")}…`;
};

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizarCores(bruto: unknown): Paleta {
  const entrada = (bruto ?? {}) as Record<string, unknown>;
  const saida = { ...PALETA_PADRAO_PRODUTO };
  for (const chave of Object.keys(PALETA_PADRAO_PRODUTO) as (keyof Paleta)[]) {
    const valor = String(entrada[chave] ?? "");
    if (HEX.test(valor)) saida[chave] = valor;
  }
  return saida;
}

/**
 * Só aceitamos imagem hospedada pelo próprio backend (Storage) ou por um
 * host explicitamente liberado. Impede o worker de ser usado como proxy.
 */
export function validarImagemProduto(url: string, supabaseUrl: string): string | null {
  const limpa = txt(url, 1200);
  if (!/^https:\/\//i.test(limpa)) return null;
  try {
    const alvo = new URL(limpa);
    const permitido = new URL(supabaseUrl);
    if (alvo.host !== permitido.host) return null;
    if (!alvo.pathname.startsWith("/storage/v1/object/")) return null;
    return limpa;
  } catch {
    return null;
  }
}

/** Frames do template (espelha framesTemplateProduto no Remotion). */
const IMPACTO = 48, HEROI = 150, FICHA = 150, PRECO = 120, CTA_F = 140;

export function framesProduto(props: ProdutoVideoProps): number {
  const temFicha = (props.produto.bullets?.length ?? 0) > 0;
  const temPreco = Boolean(props.produto.preco);
  return IMPACTO + HEROI + (temFicha ? FICHA : 0) + (temPreco ? PRECO : 0) + CTA_F;
}

export function duracaoEstimadaProduto(props: ProdutoVideoProps): number {
  return Math.round((framesProduto(props) / 30) * 10) / 10;
}

/** Deixa qualquer entrada (tela ou agente) renderizável e segura. */
export function normalizarPropsProduto(
  bruto: any,
  ctx: { marca?: string; site?: string; telefone?: string; consultor?: string; imagemUrl: string },
): ProdutoVideoProps {
  const marca = txt(bruto?.marca || ctx.marca, 18) || "Sua marca";
  const p = bruto?.produto ?? {};

  const bullets = (Array.isArray(p?.bullets) ? p.bullets : [])
    .slice(0, 4)
    .map((b: unknown) => txt(b, 40))
    .filter(Boolean);

  const legendas = (Array.isArray(bruto?.legendas) ? bruto.legendas : [])
    .slice(0, 5)
    .map((l: unknown) => txt(l, 64))
    .filter(Boolean);

  const nome = txt(p?.nome, 46) || "Nosso produto";

  return {
    marca,
    nivel: "padrao",
    site: txt(bruto?.site ?? ctx.site, 40),
    cores: normalizarCores(bruto?.cores),
    produto: {
      imagemUrl: ctx.imagemUrl,
      recortar_fundo: p?.recortar_fundo === true,
      recortado: false,
      nome,
      subtitulo: cortar(p?.subtitulo, 64) || undefined,
      bullets,
      precoDe: txt(p?.precoDe, 20) || undefined,
      preco: txt(p?.preco, 20) || undefined,
      parcelas: txt(p?.parcelas, 26) || undefined,
      selo: txt(p?.selo, 20) || undefined,
    },
    cta: {
      frase: txt(bruto?.cta?.frase, 42) || "Fale com a gente.",
      sub: txt(bruto?.cta?.sub, 50) || undefined,
      telefone: txt(bruto?.cta?.telefone ?? ctx.telefone, 30) || undefined,
      consultor: txt(bruto?.cta?.consultor ?? ctx.consultor, 40) || undefined,
    },
    // As legendas NÃO repetem nome/bullets (já aparecem em cena). Sem texto
    // próprio, o vídeo sai sem pílula de legenda.
    legendas: legendas.filter(
      (l: string) =>
        l.toLowerCase() !== nome.toLowerCase() &&
        !bullets.some((b: string) => b.toLowerCase() === l.toLowerCase()),
    ),
  };
}
