function normalizePt(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function compactSpaces(text: string): string {
  return (text || "").replace(/\s+/g, " ").trim();
}

function cleanSearchQuery(query: string): string {
  return compactSpaces((query || "")
    .replace(/^jarvis[,\s]*/i, "")
    .replace(/\b(depois\s+te\s+dou\s+mais\s+instru[cç][oõ]es|por\s+enquanto|aguarde\s+um\s+instante)\b/gi, " ")
    .replace(/\b(procura|procurar|busca|buscar|pesquisa|pesquisar|consulta|consulte)\s+(no\s+google\s+|na\s+internet\s+|na\s+web\s+)?/gi, " ")
    .slice(0, 320));
}

function currentMonthYearPt(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function isLodgingQuery(query: string): boolean {
  const t = normalizePt(query);
  return /\b(pousada|pousadas|hotel|hoteis|hostel|resort|hospedagem|hospedar|diaria|diarias|booking|tripadvisor|luxo|alto padrao|5 estrelas|cinco estrelas)\b/.test(t);
}

export type DetectWebSearchIntentOpts = {
  hasMedia?: boolean;
  /** Dono: textos longos (ex. briefing) nunca disparam busca automática */
  ownerMessageOver600?: boolean;
};

import { isGestaoLojaDataQuestion } from "./jarvis-gestao-data-intent.ts";

export function detectWebSearchIntent(
  text: string,
  opts: DetectWebSearchIntentOpts = {},
): { query: string; recencia?: string } | null {
  if (opts.hasMedia) return null;
  const raw = typeof text === "string" ? text.trim() : "";
  if (!raw) return null;
  if (opts.ownerMessageOver600 && raw.length > 600) return null;
  if (isGestaoLojaDataQuestion(raw)) return null;

  const t = normalizePt(raw);

  const isOperacional = /\b(vou (te )?(enviar|mandar|passar|gravar)|te envio|te mando|segue|segura|aguarda|aguarde|espera|espere|olha (isso|aqui|esse|essa)|ve (isso|aqui)|escuta|ouve|transcreve|transcrever|transcricao|resume|resumir|resumo disso|traduz|traduzir|corrige|corrigir|posta|postar|publica|publicar|salva|salvar|edita|editar|manda pro|encaminha|repassa)\b/.test(t);
  if (isOperacional) return null;

  const pedidoExplicito = /\b(procura|procurar|busca|buscar|pesquisa|pesquisar|pesquise|busque|procure|google|na internet|na web|acha ai|ve pra mim|consulte|consulta ai)\b/.test(t);

  const temPergunta = /\?/.test(raw)
    || /\b(quanto|quantos|quantas|qual|quais|quando|onde|quem|por que|porque|como esta|como ta|o que (esta|ta|aconteceu|houve|rolou))\b/.test(t);
  const assuntoExterno = /\b(cotacao|dolar|euro|bitcoin|btc|bolsa|ibovespa|selic|inflacao|ipca|noticia|noticias|manchete|placar|jogo|jogos|campeonato|eleicao|clima|tempo|previsao|transito|trafego|greve|acao|acoes|passagem|voo|hotel|pousada|receita|ingredientes|modo de preparo)\b/.test(t);
  const fatoAtual = temPergunta && assuntoExterno;

  if (!pedidoExplicito && !fatoAtual) return null;

  let query = cleanSearchQuery(raw);
  if (!query) query = raw;
  if (/\btransito\b/.test(t)) query = `${query} trânsito agora ${currentMonthYearPt()}`;
  if (/\b(notícias|noticias|recente|hoje|agora|atual|transito|trafego|greve)\b/i.test(raw)) {
    return { query, recencia: "d" };
  }
  if (isLodgingQuery(query)) return { query, recencia: "m" };
  return { query };
}
