// ============================================================
// VÍDEO MOTION — roteiro paramétrico do template Remotion.
// Multi-tenant: marca, cores, site e textos saem do contexto do
// próprio cliente (empresa_config / produtos), nunca fixos da AMZ.
//
// O objeto devolvido aqui é EXATAMENTE o `props` do componente
// `template-agente` em remotion/src/templates/agente/Template.tsx.
// ============================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { getTenantBusinessContext } from "./business-context.ts";
import { AMZ_TENANT_ID } from "./amz-tenant.ts";
import {
  buildMetodoAmzBlock,
  buildMetodoAmzReviewPrompt,
  revisarComMetodoAmz,
} from "./metodo-amz.ts";

export type Mensagem = { de: "dono" | "agente"; texto: string };

/** Estilos da biblioteca de templates. `conversa` é o histórico (celular + chat). */
export type EstiloMotion = "conversa" | "institucional" | "lista";
export type FundoMotion = "escuro" | "claro";

export const ESTILOS_MOTION: EstiloMotion[] = ["conversa", "institucional", "lista"];

export const TEMPLATE_POR_ESTILO: Record<EstiloMotion, string> = {
  conversa: "template-agente",
  institucional: "template-institucional",
  lista: "template-lista",
};

export type BlocoMotion = { titulo: string; apoio?: string; icone?: string };
export type CenaMotion = {
  numero: number;
  texto: string;
  texto_tela?: string;
  destaque?: string;
  narracao?: string;
  inicio_segundos?: number;
  fim_segundos?: number;
};

const ICONES_OK = [
  "raio",
  "escudo",
  "grafico",
  "relogio",
  "chat",
  "selo",
  "check",
  "engrenagem",
  "alvo",
];

/** Duração da peça. Muda o VOLUME de conteúdo, não a lentidão das cenas. */
export type DuracaoMotion = "curto" | "medio" | "longo";

export const DURACOES_MOTION: DuracaoMotion[] = ["curto", "medio", "longo"];

/** Volume de conteúdo por duração (quantas cenas/blocos/trocas gerar). */
export const VOLUME_POR_DURACAO: Record<
  DuracaoMotion,
  { blocos: number; itens: number; mensagens: number; legendas: number }
> = {
  curto: { blocos: 3, itens: 3, mensagens: 4, legendas: 4 },
  medio: { blocos: 6, itens: 6, mensagens: 8, legendas: 6 },
  longo: { blocos: 9, itens: 9, mensagens: 12, legendas: 8 },
};

/**
 * Frames por cena (bloco/item/mensagem). Mais conteúdo é o principal ganho de
 * duração; o ritmo apenas dá tempo de leitura sem deixar a cena parada.
 */
export const RITMO_POR_DURACAO: Record<DuracaoMotion, Record<EstiloMotion, number>> = {
  curto: { conversa: 52, institucional: 100, lista: 95 },
  medio: { conversa: 62, institucional: 145, lista: 140 },
  longo: { conversa: 72, institucional: 165, lista: 160 },
};

export const ROTULO_DURACAO: Record<DuracaoMotion, string> = {
  curto: "Curto (~25s)",
  medio: "Médio (~45s)",
  longo: "Longo (~75s)",
};

/** Duração pedida em texto livre ("faz um vídeo longo sobre X"). */
export function duracaoPedidaNoTexto(texto: string): DuracaoMotion | null {
  const t = String(texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\b(long[oa]|completo|detalhad[oa]|apresentacao comercial|institucional completo|90s|1 ?min|um minuto|minuto e meio)\b/.test(t)) {
    return "longo";
  }
  if (/\b(medi[oa]|intermediari[oa]|45s?|40 segundos|45 segundos)\b/.test(t)) return "medio";
  if (/\b(curt[oa]|rapid[oa]|reels?|stor(?:y|ies)|15s|20s|25s|30 segundos)\b/.test(t)) return "curto";
  return null;
}

/** Estilo pedido em texto livre ("faz em formato de lista"). */
export function estiloPedidoNoTexto(texto: string): EstiloMotion | null {
  const t = String(texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\b(lista|passo a passo|passos|topicos|motivos|dicas|checklist|numerad[oa])\b/.test(t)) return "lista";
  if (/\b(institucional|autoridade|tecnologia|seguranca|selo|diferenciais?|apresentacao da empresa)\b/.test(t)) {
    return "institucional";
  }
  if (/\b(conversa|chat|whatsapp|celular|balo(?:es|ao)|atendimento por audio|manda audio)\b/.test(t)) return "conversa";
  return null;
}

/** Fundo pedido explicitamente em texto livre; menções soltas a cores não contam. */
export function fundoPedidoNoTexto(texto: string): FundoMotion | null {
  const t = String(texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const match = t.match(/\b(?:fundo|background)(?:\s+(?:na\s+cor|cor|para|por))?\s+(branco|claro|preto|escuro)\b/);
  if (!match) return null;
  return match[1] === "branco" || match[1] === "claro" ? "claro" : "escuro";
}

export function cenasPedidasNoTexto(texto: string): CenaMotion[] {
  const source = String(texto ?? "");
  const pattern =
    /(?:^|\n)\s*cena\s*(\d+)(?:\s*[\[(]?\s*(\d+)\s*(?:-|–|a|até)\s*(\d+)\s*s(?:egundos?)?\s*[\])]?)?\s*[:\-–]?\s*/gimu;
  const matches = [...source.matchAll(pattern)];
  const limparCampo = (value: string): string => {
    let cleaned = value.trim().replace(/^[\s,;:.-]+/, "").trim();
    const quoted = cleaned.match(/^["“”'‘’](.*?)["“”'‘’]\s*[.;]?\s*$/su);
    if (quoted) return quoted[1].trim();
    return cleaned
      .replace(/^["“”'‘’]+|["“”'‘’]+\s*[.;]?\s*$/gu, "")
      .trim();
  };
  const interpretar = (body: string) => {
    const labels =
      [...body.matchAll(
        /\b(t[ií]tulo|texto|tela|narra[cç][aã]o|locu[cç][aã]o|fala|(?:com\s+)?destaque(?:\s+em\s+[\p{L}\s-]+)?)\s*:\s*/giu,
      )];
    let textoTela = "";
    let destaque = "";
    let narracao = "";
    for (let labelIndex = 0; labelIndex < labels.length; labelIndex++) {
      const label = labels[labelIndex];
      const start = Number(label.index ?? 0) + label[0].length;
      const end = labelIndex + 1 < labels.length
        ? Number(labels[labelIndex + 1].index ?? body.length)
        : body.length;
      const value = limparCampo(body.slice(start, end));
      const normalized = String(label[1]).normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (normalized.includes("destaque")) destaque = value;
      else if (/narracao|locucao|fala/.test(normalized)) narracao = value;
      else textoTela = value;
    }
    if (!textoTela && labels.length === 0) {
      const cleaned = limparCampo(body);
      const sentence = cleaned.match(/^(.+?[.!?])(?:\s+|$)([\s\S]*)$/u);
      const first = sentence?.[1]?.trim() || cleaned;
      if (first.length <= 100) {
        textoTela = first;
        narracao = sentence?.[2]?.trim() || "";
      } else {
        const words = cleaned.split(/\s+/);
        textoTela = words.slice(0, 8).join(" ");
        narracao = words.slice(8).join(" ");
      }
    }
    return {
      textoTela: limparCampo(textoTela),
      destaque: limparCampo(destaque),
      narracao: limparCampo(narracao),
    };
  };
  return matches.map((match, index) => {
    const start = Number(match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length
      ? Number(matches[index + 1].index ?? source.length)
      : source.length;
    const fields = interpretar(source.slice(start, end).trim());
    return {
      numero: Number(match[1]),
      texto: [fields.textoTela, fields.destaque, fields.narracao]
        .filter(Boolean).join(" "),
      texto_tela: fields.textoTela || undefined,
      destaque: fields.destaque || undefined,
      narracao: fields.narracao || undefined,
      inicio_segundos: match[2] ? Number(match[2]) : undefined,
      fim_segundos: match[3] ? Number(match[3]) : undefined,
    };
  }).filter((cena) =>
    Boolean(cena.texto_tela || cena.destaque || cena.narracao)
  );
}

export function removerDestaqueDuplicado(
  linhas: string[],
  destaque?: string,
): string[] {
  if (!destaque || linhas.length === 0) return linhas;
  const normalizar = (value: string) =>
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const next = [...linhas];
  const ultima = next.at(-1)!;
  const palavras = ultima.split(/\s+/);
  const destaqueNormalizado = normalizar(destaque);
  for (let inicio = 0; inicio < palavras.length; inicio++) {
    if (normalizar(palavras.slice(inicio).join(" ")) !== destaqueNormalizado) {
      continue;
    }
    const prefixo = palavras.slice(0, inicio).join(" ")
      .replace(/[\s,.;:!?\-–—]+$/, "");
    if (prefixo) next[next.length - 1] = prefixo;
    else next.pop();
    break;
  }
  return next;
}

export type MotionProps = {
  marca: string;
  /** estilo/template desta peça */
  estilo?: EstiloMotion;
  /** duração pedida; define o volume de conteúdo do roteiro */
  duracao?: DuracaoMotion;
  /** fundo neutro forçado pelo usuário; ausente preserva a paleta original */
  fundo?: FundoMotion;
  /** frames por cena, derivado da duração (lido pelos templates Remotion) */
  ritmo?: number;
  /** arranjo de cena dentro do estilo (1, 2 ou 3) */
  arranjo?: number;
  /** institucional: blocos de argumento */
  blocos?: BlocoMotion[];
  /** institucional: dado ou selo em destaque */
  selo?: { valor: string; rotulo?: string };
  /** lista: itens numerados */
  itens?: BlocoMotion[];
  /** lista: rótulo ("3 motivos", "4 passos") */
  rotulo?: string;
  /** preenchido pelo backend; nunca vem do usuário para outro tenant */
  logo_path?: string;
  logoUrl?: string;
  /** Referência segura da trilha; a URL assinada só é criada no claim. */
  trilha_id?: string;
  trilha_path?: string;
  trilhaUrl?: string;
  trilha_volume?: number;
  /** Só fica true quando o dono escolheu explicitamente "Sem trilha". */
  sem_trilha?: boolean;
  /** Duração exata pedida pelo dono; o ritmo é calculado para chegar nela. */
  duracao_alvo_segundos?: number;
  /** Persistidas no rascunho para sobreviver à aprovação e renormalização. */
  frases_literais?: string[];
  roteiro_cenas?: CenaMotion[];
  legendas_timeline?: Array<{
    texto: string;
    inicio_segundos?: number;
    fim_segundos?: number;
  }>;
  /** Identidade de terceiro: impede fallback para a logo do tenant. */
  sem_logo_tenant?: boolean;
  site?: string;
  cores: {
    bg: string;
    bg2: string;
    panel: string;
    line: string;
    destaque: string;
    destaqueSoft: string;
    texto: string;
    suave: string;
  };
  hook: { kicker: string; linhas: string[]; destaque?: string; sub?: string };
  chat: { titulo: string; tituloDestaque?: string; mensagens: Mensagem[] };
  cta: { frase: string; sub?: string; telefone?: string; consultor?: string };
  legendas: string[];
};

export const PALETA_PADRAO: MotionProps["cores"] = {
  bg: "#0f1720",
  bg2: "#1a2332",
  panel: "#16202c",
  line: "#26313f",
  destaque: "#FF7A1A",
  destaqueSoft: "#ff9e56",
  texto: "#f4f7fb",
  suave: "#93a4b8",
};

const MODELO = "google/gemini-2.5-flash";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

function politicaCertificacaoTenant(userId: string): string {
  const tenantPermitido = String(userId || "").trim().toLowerCase() === AMZ_TENANT_ID.toLowerCase();
  if (tenantPermitido) {
    const texto = String(
      Deno.env.get("AMZ_TECH_PROVIDER_TEXT")
        || "AMZ Ofertas - Tech Provider verificado pela Meta",
    ).replace(/\s+/g, " ").trim();
    return `EXCEÇÃO EXCLUSIVA DESTE TENANT: se o roteiro usar selo ou certificação, a única alegação permitida é ${JSON.stringify(texto)}. Copie esse texto exatamente; não invente, amplie ou atribua qualquer outra parceria, homologação, badge ou programa de terceiros.`;
  }
  return `PROIBIDO ABSOLUTO no selo e em qualquer texto: alegar selo, certificação, verificação, parceria, homologação ou programa de terceiros. Nada de "verificado pela Meta", "Tech Provider", "parceiro oficial", "certificado por", "homologado por", nem menção a badge ou programa do Google, Meta, TikTok, LinkedIn ou WhatsApp. Se o contexto mencionar integração oficial, escreva no máximo "integração via API oficial", sem citar selo, verificação ou parceria.`;
}

const limparBruto = (s: unknown, max: number) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .replace(/^["'`\s]+|["'`\s]+$/g, "")
    .slice(0, max)
    .trim();

/** Converte links Markdown/URLs em um endereço curto e próprio para exibição. */
export function normalizarSiteMotion(valor: unknown, max = 40): string {
  let site = String(valor ?? "").replace(/\s+/g, " ").trim();
  const markdown = site.match(/^\[[^\]]*]\(\s*<?([^)\s>]+)>?\s*\)$/);
  if (markdown) site = markdown[1];
  site = site
    .replace(/^<|>$/g, "")
    .replace(/^https?:\/\//i, "")
    .replace(/[)\],.;:!?]+$/g, "")
    .replace(/\/+$/g, "")
    .trim();
  return site.slice(0, max);
}

/** Corta respeitando a palavra e sinalizando o corte — nunca "campanhas d". */
export const cortarFrase = (s: string, max: number): string => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const parcial = t.slice(0, max - 1);
  const espaco = parcial.lastIndexOf(" ");
  const base = espaco > max * 0.45 ? parcial.slice(0, espaco) : parcial;
  return `${base.replace(/[\s,.;:!?\-–—]+$/, "")}…`;
};

const ehMarcaAmz = (marca: string) => /\bamz(?:\s+ofertas)?\b/i.test(marca);

/**
 * Peça white label não pode citar a plataforma. Antes apagávamos a menção e o
 * texto ficava com buraco ("Com a , seu marketing..."); agora TROCAMOS pelo
 * nome da marca do vídeo.
 */
const removerVestigiosAmz = (texto: string, marca: string) => {
  if (!texto || ehMarcaAmz(marca)) return texto;
  const nome = marca && marca !== "Sua marca" ? marca : "sua marca";
  return texto
    .replace(/(?:https?:\/\/)?(?:www\.)?amzofertas\.com\.br\/?/gi, nome)
    .replace(/\bAMZ\s+Ofertas\b/gi, nome)
    .replace(/\bAMZ\b/g, nome)
    // buracos herdados de versões antigas: "com a , seu" -> "com a marca, seu"
    .replace(/\b(com|de|da|do|na|no|pela|pelo|para)\s+([ao]s?)\s*,/gi, `$1 $2 ${nome},`)
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/^[\s—|,:;-]+|[\s—|,:;-]+$/g, "")
    .trim();
};

/** Palavras genéricas de razão social: descartáveis quando o nome não cabe. */
const GENERICOS =
  /^(supermercados?|hipermercados?|mercados?|minimercados?|lojas?|rede|redes|grupo|comercial|com[ée]rcio|distribuidora|empresa|cia\.?|companhia|casas?|atacado|atacadista|varejo|e|de|da|do|dos|das)$/i;

/**
 * Nome curto de exibição. "Supermercados Zona Sul" -> "Zona Sul"
 * (antes cortava em 18 caracteres e saía "Supermercados Zona").
 */
export function marcaCurta(nome: string, max = 18): string {
  const limpo = String(nome ?? "").replace(/\s+/g, " ").trim();
  if (!limpo) return "Sua marca";
  if (limpo.length <= max) return limpo;

  const palavras = limpo.split(" ");
  const uteis = palavras.filter((p) => !GENERICOS.test(p.replace(/[^\p{L}\p{N}.]/gu, "")));
  const tentativas = [
    uteis.join(" "),
    uteis.slice(0, 2).join(" "),
    uteis.slice(0, 1).join(" "),
    palavras.slice(0, 2).join(" "),
    palavras[0],
  ];
  for (const t of tentativas) {
    const c = t.trim();
    if (c && c.length <= max) return c;
  }
  return palavras.map((p) => p[0]).join("").toUpperCase().slice(0, max);
}

// ---- Proteção do nome da marca -------------------------------------------
// A IA às vezes erra a grafia do nome do cliente ("ADOMICON" em vez de
// "ADEMICON"). Aqui reescrevemos qualquer palavra parecida com um nome
// oficial do tenant pela grafia correta.

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function distancia(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 99;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

/** Extrai nomes próprios candidatos (nome do negócio + palavras do tema). */
export function nomesOficiais(nome: string, tema?: string): string[] {
  const out: string[] = [];
  const add = (p: string) => {
    const limpo = p.replace(/[^\p{L}\p{N}]/gu, "");
    if (limpo.length >= 5 && !out.some((o) => semAcento(o) === semAcento(limpo))) out.push(limpo);
  };
  String(nome ?? "").split(/\s+/).forEach(add);
  String(tema ?? "")
    .split(/\s+/)
    .filter((p) => /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(p))
    .forEach(add);
  return out;
}

function corrigirTexto(texto: string, nomes: string[]): string {
  if (!texto || !nomes.length) return texto;
  return texto.replace(/[\p{L}\p{N}]{5,}/gu, (palavra) => {
    const alvo = semAcento(palavra);
    for (const nome of nomes) {
      const ref = semAcento(nome);
      if (alvo === ref) return palavra;
      if (distancia(alvo, ref) <= 2) {
        // preserva o caixa-alta usado pela IA (ex.: "ADOMICON" -> "ADEMICON")
        return palavra === palavra.toUpperCase() ? nome.toUpperCase() : nome;
      }
    }
    return palavra;
  });
}

/** Garante que o objeto vindo da IA (ou do usuário) é renderizável. */
export function normalizarProps(
  bruto: any,
  ctx: {
    marca: string;
    site?: string;
    telefone?: string;
    consultor?: string;
    nomes?: string[];
    /** vídeo para marca de terceiro: nunca herdar contato do tenant */
    semContato?: boolean;
    /** trechos do tenant que não podem aparecer (nome do dono, telefone) */
    proibidos?: string[];
    /** estilo escolhido pelo usuário; vence o que a IA sugeriu */
    estilo?: EstiloMotion | null;
    /** arranjo de cena forçado (1..3) */
    arranjo?: number | null;
    /** duração escolhida; define quantas cenas/blocos entram na peça */
    duracao?: DuracaoMotion | null;
  },
): MotionProps {
  const nomes = ctx.nomes ?? [];
  const duracao: DuracaoMotion = DURACOES_MOTION.includes(ctx.duracao as DuracaoMotion)
    ? (ctx.duracao as DuracaoMotion)
    : DURACOES_MOTION.includes(bruto?.duracao)
      ? (bruto.duracao as DuracaoMotion)
      : "curto";
  const volume = VOLUME_POR_DURACAO[duracao];
  const marcaBase = marcaCurta(String(bruto?.marca || ctx.marca || ""), 18);
  const proibidos = (ctx.proibidos ?? []).map((p) => String(p ?? "").trim()).filter((p) => p.length >= 4);
  const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const semDadosDoTenant = (t: string) => {
    let out = t;
    for (const p of proibidos) out = out.replace(new RegExp(escapar(p), "gi"), "");
    return out.replace(/\s{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
  };
  // "Revista concluída e aprovada" -> "publicação concluída e aprovada":
  // o nome do cliente identifica quem fala, nunca o objeto da ação.
  const marcaNaoEhObjeto = (t: string) => {
    if (!marcaBase) return t;
    const alvo = escapar(marcaBase);
    return t.replace(
      new RegExp(`\\b(?:a|o|as|os)?\\s*${alvo}\\s+(conclu[ií]d[oa]s?|aprovad[oa]s?|finalizad[oa]s?|agendad[oa]s?|public[oa]d[oa]s?)\\b`, "gi"),
      (_m, p1) => `publicação ${String(p1).replace(/o(s?)$/i, "a$1")}`,
    );
  };
  // A marca do cliente NUNCA executa a automação: "O sistema BeautyLink
  // transcreve" -> "O sistema transcreve".
  const marcaNaoAutomatiza = (t: string) => {
    if (!marcaBase) return t;
    const alvo = escapar(marcaBase);
    const acoes = "transcreve|redige|escreve|agenda|publica|posta|otimiza|automatiza|gera|cria|responde|programa|analisa";
    return t
      .replace(new RegExp(`\\b(sistema|plataforma|agente|assistente|app|aplicativo)\\s+(?:d[ao]\\s+)?${alvo}\\b`, "gi"), "$1")
      .replace(new RegExp(`\\b(?:a|o)\\s+${alvo}\\s+(${acoes})\\b`, "gi"), (_m, p1) => `a plataforma ${p1}`)
      .replace(/\s{2,}/g, " ")
      .trim();
  };
  // A IA usava o rótulo de privacidade ("Público") como verbo.
  const corrigirPortugues = (t: string) =>
    t
      .replace(/\b(e|foi|ser|seja|sendo|est[áa]|fica|ficou|j[áa])\s+p[úu]blico\b/gi, (_m, p1) => `${p1} publicado`)
      .replace(/\bp[úu]blico\s+(em|no|na|nas|nos)\s+(todas?|todos?|instagram|facebook|tiktok|redes)/gi,
        (_m, p1, p2) => `publicado ${p1} ${p2}`);
  const limpar = (s: unknown, max: number) => corrigirPortugues(marcaNaoAutomatiza(marcaNaoEhObjeto(semDadosDoTenant(removerVestigiosAmz(
    corrigirTexto(cortarFrase(limparBruto(s, max * 3), max), nomes),
    marcaBase,
  )))));


  const mensagensBrutas: any[] = Array.isArray(bruto?.chat?.mensagens) ? bruto.chat.mensagens : [];
  const mensagens: Mensagem[] = mensagensBrutas
    .slice(0, volume.mensagens)
    .map((m): Mensagem => ({
      de: m?.de === "agente" ? "agente" : "dono",
      texto: limpar(m?.texto, 110),
    }))
    .filter((m) => m.texto.length > 0);

  const linhasCompletas = (Array.isArray(bruto?.hook?.linhas) ? bruto.hook.linhas : [])
    .slice(0, 3)
    .map((l: unknown) => limpar(l, 60))
    .filter(Boolean);
  const hookDestaque = limpar(bruto?.hook?.destaque, 22) || undefined;
  const linhasSemDestaque = removerDestaqueDuplicado(
    linhasCompletas,
    hookDestaque,
  );
  const linhas = linhasSemDestaque.map((linha) => limpar(linha, 60)).filter(Boolean);

  const legendas = (Array.isArray(bruto?.legendas) ? bruto.legendas : [])
    .slice(0, volume.legendas)
    .map((l: unknown) => limpar(l, 64))
    .filter(Boolean);

  const cores = { ...PALETA_PADRAO, ...(bruto?.cores || {}) };
  const marca = marcaBase || "Sua marca";
  const site = removerVestigiosAmz(normalizarSiteMotion(bruto?.site ?? ctx.site), marca);

  // ---- biblioteca de templates ----
  const estilo: EstiloMotion = ESTILOS_MOTION.includes(ctx.estilo as EstiloMotion)
    ? (ctx.estilo as EstiloMotion)
    : ESTILOS_MOTION.includes(bruto?.estilo)
      ? (bruto.estilo as EstiloMotion)
      : "conversa";

  const listaDe = (v: unknown, max: number): BlocoMotion[] =>
    (Array.isArray(v) ? v : [])
      .slice(0, max)
      .map((b: any) => ({
        titulo: limpar(b?.titulo, 30),
        apoio: limpar(b?.apoio, 62) || undefined,
        icone: ICONES_OK.includes(String(b?.icone)) ? String(b.icone) : undefined,
      }))
      .filter((b) => b.titulo.length > 0);

  const blocos = listaDe(bruto?.blocos, volume.blocos);
  const itens = listaDe(bruto?.itens, volume.itens);
  const seloValor = limpar(bruto?.selo?.valor, 22);

  // Arranjo: o pedido manda; sem pedido, sorteia para dois vídeos seguidos do
  // mesmo estilo não saírem com o mesmo visual.
  const arranjoBruto = Number(ctx.arranjo ?? bruto?.arranjo);
  let arranjo = [1, 2, 3].includes(arranjoBruto)
    ? arranjoBruto
    : 1 + Math.floor(Math.random() * 3);

  const blocosFinais = estilo === "institucional"
    ? blocos.slice(0, volume.blocos)
    : undefined;
  const itensFinais = estilo === "lista"
    ? itens.slice(0, volume.itens)
    : undefined;

  // Muitos blocos/itens não cabem empilhados na tela: usa o arranjo de uma
  // cena por argumento, que também dá ritmo ao vídeo longo.
  if (estilo === "institucional" && (blocosFinais?.length ?? 0) > 4) arranjo = 2;
  if (estilo === "lista" && (itensFinais?.length ?? 0) > 5) arranjo = 3;

  return {
    marca,
    estilo,
    duracao,
    fundo: bruto?.fundo === "claro" || bruto?.fundo === "escuro" ? bruto.fundo : undefined,
    ritmo: RITMO_POR_DURACAO[duracao][estilo],
    arranjo,
    blocos: blocosFinais,
    selo: estilo === "institucional" && seloValor
      ? { valor: seloValor, rotulo: limpar(bruto?.selo?.rotulo, 34) || undefined }
      : undefined,
    itens: itensFinais,
    rotulo: estilo === "lista" ? (limpar(bruto?.rotulo, 20) || undefined) : undefined,
    logo_path: typeof bruto?.logo_path === "string" ? bruto.logo_path : undefined,
    logoUrl: typeof bruto?.logoUrl === "string" ? bruto.logoUrl : undefined,
    trilha_id: typeof bruto?.trilha_id === "string" ? bruto.trilha_id : undefined,
    trilha_path: typeof bruto?.trilha_path === "string" ? bruto.trilha_path : undefined,
    trilha_volume: typeof bruto?.trilha_volume === "number"
      ? Math.min(1, Math.max(0, bruto.trilha_volume))
      : 0.28,
    roteiro_cenas: Array.isArray(bruto?.roteiro_cenas)
      ? bruto.roteiro_cenas
      : undefined,
    legendas_timeline: Array.isArray(bruto?.legendas_timeline)
      ? bruto.legendas_timeline
      : undefined,
    // Não remover a chave quando estiver vazio. O Remotion combina inputProps
    // com defaultProps; uma chave ausente poderia ressuscitar um site antigo
    // existente no bundle em cache da VPS.
    site,
    cores,
    hook: {
      kicker: limpar(bruto?.hook?.kicker, 28) || marca,
      linhas: linhas.length ? linhas : [marca],
      destaque: hookDestaque,
      sub: limpar(bruto?.hook?.sub, 90) || undefined,
    },
    chat: {
      titulo: limpar(bruto?.chat?.titulo, 30) || marca,
      tituloDestaque: limpar(bruto?.chat?.tituloDestaque, 18) || undefined,
      mensagens: (() => {
        return mensagens.slice(0, volume.mensagens);
      })(),
    },
    cta: {
      frase: limpar(bruto?.cta?.frase, 44),
      sub: limpar(bruto?.cta?.sub, 58) || undefined,
      // Vídeo de prospecção: sem contato do tenant. O campo fica vazio para o
      // usuário preencher o contato do próprio cliente.
      telefone: ctx.semContato
        ? (limparBruto(bruto?.cta?.telefone, 30) || undefined)
        : (limparBruto(bruto?.cta?.telefone ?? ctx.telefone, 30) || undefined),
      consultor: ctx.semContato
        ? (limpar(bruto?.cta?.consultor, 40) || undefined)
        : (limpar(bruto?.cta?.consultor ?? ctx.consultor, 40) || undefined),
    },
    legendas: legendas.length ? legendas : linhas.length ? [linhas.join(" ")] : [],
  };
}


/** Duração aproximada em segundos — espelha os frames de cada template. */
export function duracaoEstimada(props: MotionProps): number {
  const estilo = (props.estilo ?? "conversa") as EstiloMotion;
  const fallback = RITMO_POR_DURACAO[(props.duracao ?? "curto") as DuracaoMotion][estilo];
  const minimo = estilo === "conversa" ? 40 : 60;
  const maximo = estilo === "conversa" ? 200 : 300;
  const solicitado = Number(props.ritmo);
  const ritmo = Number.isFinite(solicitado) && solicitado >= minimo && solicitado <= maximo
    ? Math.round(solicitado)
    : fallback;
  let frames: number;
  if (estilo === "institucional") {
    const blocos = Math.max(1, (props.blocos ?? []).length);
    const selo = props.selo?.valor ? 120 : 0;
    frames = 170 + blocos * ritmo + selo + 170 - 30 * (selo ? 3 : 2);
  } else if (estilo === "lista") {
    const itens = Math.max(1, (props.itens ?? []).length);
    frames = 170 + itens * ritmo + 170 - 60;
  } else {
    frames = 190 + (40 + Math.max(1, props.chat.mensagens.length) * ritmo + 115) + 170 - 60;
  }
  return Math.round((frames / 30) * 10) / 10;
}

/** Ajusta os frames do template para a duração explícita sem trocar o conteúdo. */
export function aplicarDuracaoAlvo(props: MotionProps, alvo?: number | null): MotionProps {
  const segundos = Number(alvo);
  if (!Number.isFinite(segundos) || segundos < 20 || segundos > 95) return props;

  const estilo = (props.estilo ?? "conversa") as EstiloMotion;
  const framesAlvo = Math.round(segundos * 30);
  let quantidade = 1;
  let framesFixos = 280;
  if (estilo === "conversa") {
    quantidade = Math.max(1, props.chat.mensagens.length);
    framesFixos = 455;
  } else if (estilo === "institucional") {
    quantidade = Math.max(1, (props.blocos ?? []).length);
    framesFixos = props.selo?.valor ? 370 : 280;
  } else {
    quantidade = Math.max(1, (props.itens ?? []).length);
  }

  const minimo = estilo === "conversa" ? 40 : 60;
  const maximo = estilo === "conversa" ? 200 : 300;
  const ritmo = Math.min(maximo, Math.max(minimo, Math.round((framesAlvo - framesFixos) / quantidade)));
  return { ...props, ritmo, duracao_alvo_segundos: segundos };
}

const dividirFraseLiteral = (frase: string, max = 22): string[] => {
  const palavras = frase.trim().split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  for (const palavra of palavras) {
    const atual = linhas[linhas.length - 1] ?? "";
    if (!atual || `${atual} ${palavra}`.length > max) linhas.push(palavra);
    else linhas[linhas.length - 1] = `${atual} ${palavra}`;
  }
  return linhas.slice(0, 3);
};

/** Frases ditadas pelo dono não podem ser parafraseadas pela IA. */
export function aplicarFrasesLiterais(props: MotionProps, frases?: string[] | null): MotionProps {
  const obrigatorias = (frases ?? []).map((f) => String(f).replace(/\s+/g, " ").trim()).filter((f) => f.length >= 4 && f.length <= 64);
  if (obrigatorias.length === 0) return props;

  let next = {
    ...props,
    hook: { ...props.hook },
    legendas: [...props.legendas],
  };
  const primeira = obrigatorias[0];
  const linhas = dividirFraseLiteral(primeira);
  if (linhas.join(" ") === primeira) next.hook.linhas = linhas;

  const serializado = () => JSON.stringify(next);
  for (const frase of obrigatorias) {
    if (!serializado().includes(frase)) next.legendas.push(frase);
  }
  return { ...next, frases_literais: obrigatorias };
}

export function aplicarCenasLiterais(
  props: MotionProps,
  cenas?: CenaMotion[] | null,
): MotionProps {
  if (!cenas?.length) return props;
  const ordered = [...cenas].sort((a, b) => a.numero - b.numero);
  const first = ordered[0];
  const last = ordered.at(-1)!;
  const middle = ordered.slice(1, -1);
  const normalize = (value: string) =>
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const shortSentence = (value?: string): string | undefined => {
    const cleaned = String(value ?? "").trim();
    if (!cleaned) return undefined;
    const sentence = cleaned.match(/^.+?[.!?](?:\s|$)/u)?.[0]?.trim() ||
      cleaned;
    if (sentence.length <= 120) return sentence;
    const words = sentence.split(/\s+/);
    let output = "";
    for (const word of words) {
      if (`${output} ${word}`.trim().length > 117) break;
      output = `${output} ${word}`.trim();
    }
    return output ? `${output.replace(/[,:;\s]+$/, "")}…` : undefined;
  };
  const iconFor = (cena: CenaMotion): string => {
    const topic = normalize(
      `${cena.texto_tela ?? ""} ${cena.destaque ?? ""} ${cena.narracao ?? ""}`,
    );
    if (/\b(whatsapp|mensagem|audio|conversa|chat)\b/.test(topic)) return "chat";
    if (/\b(tempo|hora|rapido|segundo|agenda)\b/.test(topic)) return "relogio";
    if (/\b(resultado|metrica|grafico|crescimento|numero)\b/.test(topic)) return "grafico";
    if (/\b(seguranca|protecao|privacidade|dados)\b/.test(topic)) return "escudo";
    if (/\b(selo|certificado|qualidade|garantia)\b/.test(topic)) return "selo";
    if (/\b(meta|objetivo|alvo|conversao|venda)\b/.test(topic)) return "alvo";
    if (/\b(ia|inteligencia artificial|automacao|sistema|tecnologia)\b/.test(topic)) return "engrenagem";
    return "check";
  };
  const firstText = first.texto_tela || first.destaque || "";
  const firstLines = removerDestaqueDuplicado(
    firstText ? [firstText] : [],
    first.destaque,
  );
  const kicker = normalize(props.marca) === normalize(firstText)
    ? ""
    : props.marca;
  const narrationScenes = ordered.filter((cena) => cena.narracao);
  const fim = Number(last.fim_segundos ?? 0);
  const next: MotionProps = {
    ...props,
    estilo: "institucional",
    arranjo: 2,
    roteiro_cenas: ordered.map((cena) => ({ ...cena })),
    hook: {
      kicker,
      linhas: firstLines,
      destaque: first.destaque,
      sub: shortSentence(first.narracao),
    },
    blocos: middle.map((cena) => ({
      titulo: cena.texto_tela || cena.destaque || "",
      apoio: shortSentence(cena.narracao),
      icone: iconFor(cena),
    })),
    itens: undefined,
    selo: undefined,
    cta: {
      ...props.cta,
      frase: last.texto_tela || last.destaque || "",
      sub: shortSentence(last.narracao),
    },
    legendas: narrationScenes.map((cena) => cena.narracao!),
    legendas_timeline: narrationScenes.map((cena) => ({
      texto: cena.narracao!,
      inicio_segundos: cena.inicio_segundos,
      fim_segundos: cena.fim_segundos,
    })),
  };
  return fim > 0 ? aplicarDuracaoAlvo(next, fim) : next;
}

/** Rótulo do estilo para mensagens ao usuário. */
export const ROTULO_ESTILO: Record<EstiloMotion, string> = {
  conversa: "Conversa no celular",
  institucional: "Institucional",
  lista: "Lista / passo a passo",
};

/**
 * Gera o roteiro do vídeo com IA a partir do contexto real do tenant.
 * Falha de IA NÃO derruba o fluxo: cai num roteiro base do próprio negócio.
 */
export async function gerarRoteiroMotion(
  sb: SupabaseClient,
  userId: string,
  tema: string,
  opts?: {
    nomeFallback?: string | null;
    marca?: string | null;
    tomDeVoz?: string | null;
    /** estilo pedido pelo usuário; null/undefined = a IA escolhe */
    estilo?: EstiloMotion | null;
    arranjo?: number | null;
    /** duração pedida; null = curto (padrão para redes) */
    duracao?: DuracaoMotion | null;
    /** duração exata em segundos, quando foi dita pelo dono */
    duracaoAlvoSegundos?: number | null;
    /** textos fornecidos explicitamente e que não podem ser reescritos */
    frasesLiterais?: string[] | null;
  },
): Promise<{ props: MotionProps; legendaPost: string; usouIA: boolean; nomes: string[] }> {
  const ctx = await getTenantBusinessContext(sb, userId, {
    nomeFallback: opts?.nomeFallback,
    tipoCriativo: "roteiro",
  });
  // A marca informada no formulário manda: o vídeo é do cliente, não do tenant.
  const marcaInformada = limparBruto(opts?.marca, 60);
  const nome = marcaInformada || ctx.nome || "Sua empresa";
  const nomes = nomesOficiais(nome, tema);

  // Marca de terceiro (prospecção): nada do tenant pode aparecer na peça.
  const terceiro = Boolean(marcaInformada) &&
    semAcento(marcaInformada).replace(/\W/g, "") !== semAcento(String(ctx.nome ?? "")).replace(/\W/g, "");

  const tom = limparBruto(opts?.tomDeVoz ?? (terceiro ? "" : ctx.tomDeVoz), 120);

  const base = {
    marca: marcaCurta(nome),
    // Ao criar para outra marca, o site deve ser preenchido explicitamente no
    // formulário. Nunca herdamos o domínio do tenant/plataforma nesse caso.
    site: terceiro ? "" : (ctx.site || "").replace(/^https?:\/\//, ""),
    telefone: terceiro ? undefined : (ctx.atendimentoTelefoneFmt || undefined),
    semContato: terceiro,
    proibidos: terceiro
      ? [
        String(ctx.nome ?? ""),
        String(opts?.nomeFallback ?? ""),
        String(ctx.atendimentoTelefoneFmt ?? ""),
        String(ctx.atendimentoTelefone ?? ""),
      ]
      : [],
    nomes,
    // Estilo explícito (formulário ou pedido no WhatsApp). Sem isso a IA decide.
    estilo: (ESTILOS_MOTION.includes(opts?.estilo as EstiloMotion)
      ? (opts?.estilo as EstiloMotion)
      : estiloPedidoNoTexto(tema)) as EstiloMotion | null,
    arranjo: opts?.arranjo ?? null,
    // Duração explícita (formulário) ou pedida em texto no WhatsApp.
    duracao: (DURACOES_MOTION.includes(opts?.duracao as DuracaoMotion)
      ? (opts?.duracao as DuracaoMotion)
      : duracaoPedidaNoTexto(tema) ?? "curto") as DuracaoMotion,
  };

  const estiloForcado = base.estilo;
  const dur = base.duracao;
  const vol = VOLUME_POR_DURACAO[dur];
  const segundos = opts?.duracaoAlvoSegundos
    ? `${opts.duracaoAlvoSegundos}s (alvo exato, tolerância máxima de 1s)`
    : dur === "curto" ? "20-25s" : dur === "medio" ? "40-50s" : "70-90s";
  const frasesObrigatorias = (opts?.frasesLiterais ?? []).filter(Boolean);
  const politicaCertificacao = politicaCertificacaoTenant(userId);


  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  const instrucao = `Você escreve roteiros de vídeos verticais (${segundos}) para redes sociais.
${buildMetodoAmzBlock({ tipo: "roteiro" })}

NEGÓCIO: ${nome}${ctx.segmento ? ` — ${ctx.segmento}` : ""}
${terceiro ? "" : `${ctx.sobre ? `SOBRE: ${ctx.sobre}\n` : ""}${ctx.diferenciais ? `DIFERENCIAIS: ${ctx.diferenciais}\n` : ""}${ctx.publicoAlvo ? `PÚBLICO: ${ctx.publicoAlvo}\n` : ""}${ctx.produtos.length ? `PRODUTOS: ${ctx.produtos.slice(0, 6).join("; ")}\n` : ""}`}TEMA PEDIDO: ${tema}
${tom ? `TOM DE VOZ DA MARCA (obrigatório seguir): ${tom}\n` : ""}
${frasesObrigatorias.length ? `TEXTOS LITERAIS OBRIGATÓRIOS: ${frasesObrigatorias.map((f) => JSON.stringify(f)).join(", ")}. Copie letra por letra, sem trocar, resumir ou parafrasear. Se for gancho, apenas divida entre as linhas sem alterar nenhuma palavra.\n` : ""}
ATENÇÃO: o nome do negócio e as marcas citadas devem ser escritos EXATAMENTE assim, letra por letra: ${nomes.join(", ") || nome}. Nunca abrevie, traduza ou altere a grafia.
Escreva o nome da marca por extenso sempre que citá-lo. NUNCA deixe lacuna, espaço em branco, placeholder, chave {{ }} ou colchete no lugar de um nome.
${terceiro ? "Este vídeo é para a marca acima, não para quem está pedindo: não cite nome de pessoa, telefone, consultor ou outra empresa.\n" : ""}
ESTILO DO VÍDEO: ${
    estiloForcado
      ? `use obrigatoriamente "${estiloForcado}".`
      : `escolha o estilo que melhor conta ESTE tema, no campo "estilo":
 - "conversa": só quando o tema é interação, atendimento, pedido por áudio, resposta ao cliente;
 - "institucional": tecnologia, segurança, diferencial, autoridade, dado ou selo;
 - "lista": "3 motivos", "como funciona em N passos", dicas, checklist.
Na dúvida entre conversa e institucional, prefira institucional.`
  }
Devolva SOMENTE JSON válido, sem markdown, neste formato:
{
 "estilo": "conversa | institucional | lista",
 "hook": {"kicker":"até 24 caracteres","linhas":["até 18 chars","até 18 chars"],"destaque":"até 20 chars","sub":"até 80 chars, pode ter \\n"},
 "chat": {"titulo":"até 24 chars","tituloDestaque":"até 16 chars","mensagens":[{"de":"dono","texto":"até 90 chars"},{"de":"agente","texto":"até 100 chars"}]},
 "blocos": [{"titulo":"até 28 chars","apoio":"até 60 chars","icone":"raio|escudo|grafico|relogio|chat|selo|check|engrenagem|alvo"}],
 "selo": {"valor":"até 20 chars (dado, número ou selo)","rotulo":"até 32 chars"},
 "itens": [{"titulo":"até 28 chars","apoio":"até 60 chars","icone":"um dos ícones acima"}],
 "rotulo": "até 18 chars, ex.: 3 motivos / 4 passos",
 "cta": {"frase":"até 40 chars, frase completa","sub":"até 55 chars"},
 "legendas": ["frase curta 1","frase curta 2","frase curta 3","frase curta 4"],
 "legenda_post": "legenda pronta para publicar, 2 a 4 linhas, tom institucional, 6 a 10 hashtags no final"
}
Preencha a seção do estilo escolhido: "chat" (conversa), "blocos" + "selo" (institucional) ou "itens" + "rotulo" (lista). As outras seções podem ficar vazias.
DURAÇÃO PEDIDA: ${segundos}. O vídeo mais longo precisa de MAIS conteúdo, nunca cenas mais lentas. Para esta duração escreva: ${vol.mensagens} mensagens no chat (alternando dono/agente), ${vol.blocos} blocos no institucional, ${vol.itens} itens na lista e ${vol.legendas} legendas. Cada bloco/item/mensagem deve trazer um argumento NOVO, sem repetir ideia.
No institucional, só preencha "selo" com dado REAL do contexto acima; sem dado confiável, deixe vazio — nunca invente número, percentual ou certificação.
${politicaCertificacao}
Regras: número par de mensagens no chat, alternando dono/agente, frases COMPLETAS dentro do limite de caracteres (nunca corte no meio de palavra), sem emoji nos textos do vídeo, sem promessa de resultado garantido, sem inventar preço.
Use SOMENTE fatos e frases do TEMA PEDIDO e do contexto real do negócio acima. É proibido completar espaço ou duração com frases genéricas como "Planejamento completo", "Produção profissional", "Acompanhamento contínuo" ou qualquer benefício não informado. Se o contexto não sustentar uma afirmação, omita o bloco em vez de inventar.
O leitor é um profissional: proibido gíria e informalidade exagerada ("tá insano", "bora", "top", "sem neura"). Se o tom da marca for institucional ou formal, escreva formal.
O nome da marca identifica QUEM fala, nunca o objeto da ação: escreva "publicação concluída", "campanha aprovada", jamais "${nome} concluída" ou "${nome} aprovada".
Nunca atribua a automação a outra empresa, plataforma, rede social ou ferramenta citada no site do cliente, nem escreva "o sistema ${nome}". Fale do resultado ("o agente agenda", "o conteúdo sai no horário") sem citar nome de plataforma.
ACENTUAÇÃO OBRIGATÓRIA: escreva em português brasileiro COM todos os acentos e cedilhas corretos (ação, automação, conversão, você, frequência, é, já, só). Texto sem acento está ERRADO e será rejeitado.
Português correto: o verbo é "publicado" ("o conteúdo foi criado, aprovado e publicado"). Nunca use "Público" como verbo.`;

  if (apiKey) {
    try {
      const gerarJson = async (prompt: string): Promise<any> => {
        const response = await fetch(GATEWAY, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODELO,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
          }),
        });
        if (!response.ok) {
          const corpo = await response.text();
          throw new Error(`IA ${response.status}: ${corpo.slice(0, 300)}`);
        }
        const payload = await response.json();
        const text = payload?.choices?.[0]?.message?.content ?? "";
        return JSON.parse(text.replace(/^```json|```$/g, "").trim());
      };
      const primeiraVersao = await gerarJson(instrucao);
      const bruto = await revisarComMetodoAmz({
        tipo: "roteiro",
        primeiraVersao,
        revisar: async (draft) =>
          await gerarJson(
            `${instrucao}\n\n${buildMetodoAmzReviewPrompt({
              tipo: "roteiro",
              primeiraVersao: draft,
            })}`,
          ),
      });
      return {
        props: aplicarDuracaoAlvo(
          aplicarFrasesLiterais(normalizarProps(bruto, base), frasesObrigatorias),
          opts?.duracaoAlvoSegundos,
        ),
        legendaPost: corrigirTexto(
          limparBruto(bruto?.legenda_post, 1200),
          nomes,
        ),
        usouIA: true,
        nomes,
      };
    } catch (e) {
      console.warn("[video-motion] roteiro IA erro:", (e as Error).message);
    }
  }

  // Fallback determinístico — ainda personalizado com o nome do negócio.
  const props = aplicarDuracaoAlvo(aplicarFrasesLiterais(normalizarProps(
    {
      estilo: base.estilo ?? "lista",
      hook: {
        kicker: nome.slice(0, 24),
        linhas: dividirFraseLiteral(cortarFrase(tema, 60)),
        sub: terceiro ? undefined : ctx.diferenciais?.slice(0, 80),
      },
      chat: {
        titulo: nome,
        mensagens: [{ de: "dono", texto: cortarFrase(tema, 110) }],
      },
      blocos: [{ titulo: cortarFrase(tema, 30) }],
      itens: [{ titulo: cortarFrase(tema, 30) }],
      cta: { frase: "", telefone: base.telefone },
      legendas: [cortarFrase(tema, 60)],
    },
    base,
  ), frasesObrigatorias), opts?.duracaoAlvoSegundos);

  return {
    props,
    legendaPost: `${tema}\n\n${nome} — atendimento direto pelo WhatsApp.`,
    usouIA: false,
    nomes,
  };
}
