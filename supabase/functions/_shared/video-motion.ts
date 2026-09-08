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

export type Mensagem = { de: "dono" | "agente"; texto: string };

/** Estilos da biblioteca de templates. `conversa` é o histórico (celular + chat). */
export type EstiloMotion = "conversa" | "institucional" | "lista";

export const ESTILOS_MOTION: EstiloMotion[] = ["conversa", "institucional", "lista"];

export const TEMPLATE_POR_ESTILO: Record<EstiloMotion, string> = {
  conversa: "template-agente",
  institucional: "template-institucional",
  lista: "template-lista",
};

export type BlocoMotion = { titulo: string; apoio?: string; icone?: string };

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

export type MotionProps = {
  marca: string;
  /** estilo/template desta peça */
  estilo?: EstiloMotion;
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

const limparBruto = (s: unknown, max: number) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .replace(/^["'`\s]+|["'`\s]+$/g, "")
    .slice(0, max)
    .trim();

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
  },
): MotionProps {
  const nomes = ctx.nomes ?? [];
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
    .slice(0, 6)
    .map((m) => ({
      de: m?.de === "agente" ? "agente" : "dono",
      texto: limpar(m?.texto, 110),
    }))
    .filter((m) => m.texto.length > 0);

  const linhas = (Array.isArray(bruto?.hook?.linhas) ? bruto.hook.linhas : [])
    .slice(0, 3)
    .map((l: unknown) => limpar(l, 22))
    .filter(Boolean);

  const legendas = (Array.isArray(bruto?.legendas) ? bruto.legendas : [])
    .slice(0, 6)
    .map((l: unknown) => limpar(l, 64))
    .filter(Boolean);

  const cores = { ...PALETA_PADRAO, ...(bruto?.cores || {}) };
  const marca = marcaBase || "Sua marca";
  const site = removerVestigiosAmz(limparBruto(bruto?.site ?? ctx.site, 40), marca);

  return {
    marca,
    logo_path: typeof bruto?.logo_path === "string" ? bruto.logo_path : undefined,
    logoUrl: typeof bruto?.logoUrl === "string" ? bruto.logoUrl : undefined,
    trilha_id: typeof bruto?.trilha_id === "string" ? bruto.trilha_id : undefined,
    trilha_path: typeof bruto?.trilha_path === "string" ? bruto.trilha_path : undefined,
    trilha_volume: typeof bruto?.trilha_volume === "number"
      ? Math.min(1, Math.max(0, bruto.trilha_volume))
      : 0.28,
    // Não remover a chave quando estiver vazio. O Remotion combina inputProps
    // com defaultProps; uma chave ausente poderia ressuscitar um site antigo
    // existente no bundle em cache da VPS.
    site,
    cores,
    hook: {
      kicker: limpar(bruto?.hook?.kicker, 28) || marca,
      linhas: linhas.length ? linhas : ["Seu negócio", "no automático."],
      destaque: limpar(bruto?.hook?.destaque, 22) || undefined,
      sub: limpar(bruto?.hook?.sub, 90) || undefined,
    },
    chat: {
      titulo: limpar(bruto?.chat?.titulo, 30) || "Tudo pelo",
      tituloDestaque: limpar(bruto?.chat?.tituloDestaque, 18) || "WhatsApp",
      mensagens: mensagens.length
        ? mensagens
        : [
            { de: "dono", texto: "posta isso hoje às 19h" },
            { de: "agente", texto: "Fechado. Escrevi a legenda e agendei para 19:00." },
          ],
    },
    cta: {
      frase: limpar(bruto?.cta?.frase, 44) || "Fale com a gente.",
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


/** Duração aproximada em segundos (espelha framesTemplateAgente/30). */
export function duracaoEstimada(props: MotionProps): number {
  const frames = 190 + (40 + Math.max(1, props.chat.mensagens.length) * 52 + 115) + 170 - 60;
  return Math.round((frames / 30) * 10) / 10;
}

/**
 * Gera o roteiro do vídeo com IA a partir do contexto real do tenant.
 * Falha de IA NÃO derruba o fluxo: cai num roteiro base do próprio negócio.
 */
export async function gerarRoteiroMotion(
  sb: SupabaseClient,
  userId: string,
  tema: string,
  opts?: { nomeFallback?: string | null; marca?: string | null; tomDeVoz?: string | null },
): Promise<{ props: MotionProps; legendaPost: string; usouIA: boolean; nomes: string[] }> {
  const ctx = await getTenantBusinessContext(sb, userId, { nomeFallback: opts?.nomeFallback });
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
  };

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  const instrucao = `Você escreve roteiros de vídeos verticais (20-25s) para redes sociais.
NEGÓCIO: ${nome}${ctx.segmento ? ` — ${ctx.segmento}` : ""}
${terceiro ? "" : `${ctx.sobre ? `SOBRE: ${ctx.sobre}\n` : ""}${ctx.diferenciais ? `DIFERENCIAIS: ${ctx.diferenciais}\n` : ""}${ctx.publicoAlvo ? `PÚBLICO: ${ctx.publicoAlvo}\n` : ""}${ctx.produtos.length ? `PRODUTOS: ${ctx.produtos.slice(0, 6).join("; ")}\n` : ""}`}TEMA PEDIDO: ${tema}
${tom ? `TOM DE VOZ DA MARCA (obrigatório seguir): ${tom}\n` : ""}
ATENÇÃO: o nome do negócio e as marcas citadas devem ser escritos EXATAMENTE assim, letra por letra: ${nomes.join(", ") || nome}. Nunca abrevie, traduza ou altere a grafia.
Escreva o nome da marca por extenso sempre que citá-lo. NUNCA deixe lacuna, espaço em branco, placeholder, chave {{ }} ou colchete no lugar de um nome.
${terceiro ? "Este vídeo é para a marca acima, não para quem está pedindo: não cite nome de pessoa, telefone, consultor ou outra empresa.\n" : ""}
Devolva SOMENTE JSON válido, sem markdown, neste formato:
{
 "hook": {"kicker":"até 24 caracteres","linhas":["até 18 chars","até 18 chars"],"destaque":"até 20 chars","sub":"até 80 chars, pode ter \\n"},
 "chat": {"titulo":"até 24 chars","tituloDestaque":"até 16 chars","mensagens":[{"de":"dono","texto":"até 90 chars"},{"de":"agente","texto":"até 100 chars"}]},
 "cta": {"frase":"até 40 chars, frase completa","sub":"até 55 chars"},
 "legendas": ["frase curta 1","frase curta 2","frase curta 3","frase curta 4"],
 "legenda_post": "legenda pronta para publicar, 2 a 4 linhas, tom institucional, 6 a 10 hashtags no final"
}
Regras: 4 ou 6 mensagens no chat, alternando dono/agente, frases COMPLETAS dentro do limite de caracteres (nunca corte no meio de palavra), sem emoji nos textos do vídeo, sem promessa de resultado garantido, sem inventar preço.
O leitor é um profissional: proibido gíria e informalidade exagerada ("tá insano", "bora", "top", "sem neura"). Se o tom da marca for institucional ou formal, escreva formal.
O nome da marca identifica QUEM fala, nunca o objeto da ação: escreva "publicação concluída", "campanha aprovada", jamais "${nome} concluída" ou "${nome} aprovada".
Nunca atribua a automação a outra empresa, plataforma, rede social ou ferramenta citada no site do cliente, nem escreva "o sistema ${nome}". Fale do resultado ("o agente agenda", "o conteúdo sai no horário") sem citar nome de plataforma.
Português correto: o verbo é "publicado" ("o conteúdo foi criado, aprovado e publicado"). Nunca use "Público" como verbo.`;

  if (apiKey) {
    try {
      const r = await fetch(GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODELO,
          messages: [{ role: "user", content: instrucao }],
          response_format: { type: "json_object" },
        }),
      });

      if (!r.ok) {
        const corpo = await r.text();
        console.warn("[video-motion] IA falhou", r.status, corpo.slice(0, 300));
      } else {
        const j = await r.json();
        const txt = j?.choices?.[0]?.message?.content ?? "";
        const bruto = JSON.parse(txt.replace(/^```json|```$/g, "").trim());
        return {
          props: normalizarProps(bruto, base),
          legendaPost: corrigirTexto(limparBruto(bruto?.legenda_post, 1200), nomes),
          usouIA: true,
          nomes,
        };
      }
    } catch (e) {
      console.warn("[video-motion] roteiro IA erro:", (e as Error).message);
    }
  }

  // Fallback determinístico — ainda personalizado com o nome do negócio.
  const props = normalizarProps(
    {
      hook: {
        kicker: nome.slice(0, 24),
        linhas: [tema.split(/\s+/).slice(0, 2).join(" "), "sem complicação."],
        destaque: "Hoje.",
        sub: ctx.diferenciais?.slice(0, 80) || "Atendimento direto pelo WhatsApp.",
      },
      chat: {
        titulo: "Atendimento pelo",
        tituloDestaque: "WhatsApp",
        mensagens: [
          { de: "dono", texto: `quero saber sobre ${tema.slice(0, 60)}` },
          { de: "agente", texto: "Te explico agora e já deixo tudo agendado." },
          { de: "dono", texto: "pode me mandar as opções?" },
          { de: "agente", texto: "Mandei. Qualquer dúvida, é só responder aqui." },
        ],
      },
      cta: { frase: "Fale com a gente.", sub: cortarFrase(nome, 55), telefone: base.telefone },
      legendas: [cortarFrase(tema, 60), "Atendimento pelo WhatsApp.", "Simples e rápido."],
    },
    base,
  );

  return {
    props,
    legendaPost: `${tema}\n\n${nome} — atendimento direto pelo WhatsApp.`,
    usouIA: false,
    nomes,
  };
}
