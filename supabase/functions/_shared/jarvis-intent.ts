// ============================================================
// ROTEADOR DE INTENÇÃO DO JARVIS (módulo isolado e testável)
// ------------------------------------------------------------
// Regra de ouro:
//  1. aprovação/cancelamento só quando existe pendência compatível
//  2. NOVA intenção explícita da mensagem atual
//  3. continuação do fluxo anterior
//  4. pergunta de esclarecimento quando ainda houver ambiguidade
//
// Tolerante ao jeito real de escrever no WhatsApp: acento faltando,
// letra faltando, abreviação ("vd", "video animad", "insta").
// ============================================================

export type JarvisIntent =
  | "aprovar_video"
  | "cancelar_video"
  | "video"
  | "post"
  | "publicar"
  | "editar_imagem"
  | "outro"
  | "ambigua";

export type PendingState = {
  videoDraft?: boolean;
  socialPost?: boolean;
  imagemRecente?: boolean;
};

export type IntentDecision = {
  intent: JarvisIntent;
  motivo: string;
};

export function normalizarTexto(text: string): string {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// "vdeo", "video", "vido", "vd", "viideo", "video animad"
const RE_VIDEO_PALAVRA =
  /\b(v[ií]?deos?|vdeos?|vidoes?|vidos?|viideos?|vds?|motion|reels?\s*animad[oa]s?|animacao|animacoes)\b/;
const RE_VIDEO_ACAO =
  /\b(fa[czs]|faca|faz(?:er|e)?|cri(?:a|ar|e|e?a)?|crie|mont(?:a|ar|e)|ger(?:a|ar|e)|produz(?:ir|a)?|quero|queria|preciso|pode)\b/;
const RE_POST_PALAVRA = /\b(post|posts|postagem|postagens|arte|artes|legenda|carrossel|carrosseis)\b/;
const RE_PUBLICAR =
  /\b(public(?:a|ar|ca|que|co)?|publiq(?:ue|ua)|posta(?:r|ndo)?|poste|sobe|subir)\b/;
const RE_TODAS_REDES = /\b(todas?(?:\s+as)?(?:\s+redes)?|redes\s+sociais|tudo)\b/;
const RE_EDICAO_ALVO =
  /\b(fot(?:o|os|u)s?|imagens?|imagem|imgs?|cen[aá]?rios?|cenario|ambientes?|fundos?|est[uú]?dios?|showroom|logo(?:marca|tipo)?|marca|cor|cores)\b/;
const RE_EDICAO_ACAO =
  /\b(edit(?:a|ar|e)?|melhor(?:a|ar|e)?|trat(?:a|ar|e)?|ajust(?:a|ar|e)?|troc(?:a|ar|e)?|mud(?:a|ar|e)?|tir(?:a|ar|e)?|remov(?:e|er)?|coloc(?:a|ar|e)?|p[oõ]e|aplic(?:a|ar|e)?|inclu(?:i|ir|a)|adicion(?:a|ar|e)?|recort(?:a|ar|e)?|apag(?:a|ar|e)?)\b/;
const RE_APROVACAO =
  /^(sim|ok|okay|blz|beleza|pode|pode fazer|manda|manda ver|confirma|confirmo|aprovad[oa]|aprovo|fechado|fechou|vai|isso|perfeito)$|\b(aprovad[oa]|aprovo|pode (fazer|gerar|renderizar|mandar|produzir|seguir)|manda ver)\b/;
const RE_CANCELAMENTO =
  /\b(cancel(?:a|ar|e)?|descart(?:a|ar|e)?|abandon(?:a|ar|e)?|deixa pra la|esquec(?:e|er)|nao quero mais)\b/;

/** Pedido explícito de vídeo, mesmo com erro de digitação. */
export function ehPedidoDeVideo(text: string): boolean {
  const n = normalizarTexto(text);
  if (!RE_VIDEO_PALAVRA.test(n)) return false;
  if (/\b(v[ií]?deo|vdeo|vd)s?\s+(animad|institucional|motion|publicit)/.test(n)) return true;
  return RE_VIDEO_ACAO.test(n) || RE_PUBLICAR.test(n) === false;
}

/** Pedido explícito de edição de imagem. Citar rede social NÃO basta. */
export function ehPedidoDeEdicaoImagem(text: string): boolean {
  const n = normalizarTexto(text);
  if (RE_VIDEO_PALAVRA.test(n)) return false; // vídeo vence: intenção mais específica
  if (!RE_EDICAO_ALVO.test(n)) return false;
  return RE_EDICAO_ACAO.test(n);
}

export function ehPedidoDePublicar(text: string): boolean {
  const n = normalizarTexto(text);
  if (RE_VIDEO_PALAVRA.test(n) && RE_VIDEO_ACAO.test(n)) return false;
  if (!RE_PUBLICAR.test(n)) return false;
  return RE_TODAS_REDES.test(n) || /\b(insta(?:gram)?|face(?:book)?|fb|ig|tiktok|tik tok|linkedin|linked in)\b/.test(n);
}

export function ehPedidoDePost(text: string): boolean {
  const n = normalizarTexto(text);
  if (RE_VIDEO_PALAVRA.test(n)) return false;
  if (!RE_POST_PALAVRA.test(n)) return false;
  return RE_VIDEO_ACAO.test(n) || RE_PUBLICAR.test(n);
}

export function ehAprovacao(text: string): boolean {
  const n = normalizarTexto(text).replace(/[.!?]+$/g, "");
  return RE_APROVACAO.test(n);
}

export function ehCancelamento(text: string): boolean {
  return RE_CANCELAMENTO.test(normalizarTexto(text));
}

/**
 * Classifica SEMPRE a mensagem atual antes de considerar o estado anterior.
 * Pendências só ganham quando a mensagem é uma resposta curta (aprovar/cancelar).
 */
export function classificarIntencao(text: string, pending: PendingState = {}): IntentDecision {
  const n = normalizarTexto(text);
  if (!n) return { intent: "ambigua", motivo: "mensagem vazia" };

  const video = ehPedidoDeVideo(text);
  const edicao = ehPedidoDeEdicaoImagem(text);
  const publicar = ehPedidoDePublicar(text);
  const post = ehPedidoDePost(text);

  // 1) aprovação/cancelamento apenas quando NÃO há nova intenção explícita
  const novaIntencao = video || edicao || publicar || post;
  if (!novaIntencao && pending.videoDraft && ehCancelamento(text)) {
    return { intent: "cancelar_video", motivo: "cancelamento de rascunho pendente" };
  }
  if (!novaIntencao && pending.videoDraft && ehAprovacao(text)) {
    return { intent: "aprovar_video", motivo: "aprovação de rascunho pendente" };
  }

  // 2) nova intenção explícita da mensagem atual
  if (video) return { intent: "video", motivo: "pedido explícito de vídeo na mensagem atual" };
  if (publicar) return { intent: "publicar", motivo: "pedido de publicação em redes" };
  if (post) return { intent: "post", motivo: "pedido de post/arte/legenda" };
  if (edicao) return { intent: "editar_imagem", motivo: "pedido explícito de alterar foto/imagem" };

  // 3) continuação de fluxo anterior
  if (pending.videoDraft && ehAprovacao(text)) {
    return { intent: "aprovar_video", motivo: "continuação do fluxo de vídeo" };
  }

  // 4) ambiguidade real
  if (pending.imagemRecente && RE_EDICAO_ACAO.test(n) && !RE_EDICAO_ALVO.test(n)) {
    return { intent: "ambigua", motivo: "ação sem alvo claro com foto recente" };
  }

  return { intent: "outro", motivo: "nenhuma intenção crítica reconhecida" };
}

/** Cinto e suspensório: a ferramenta só roda se combinar com a intenção. */
export function ferramentaPermitida(intent: JarvisIntent, tool: string): boolean {
  if (intent === "video" || intent === "aprovar_video" || intent === "cancelar_video") {
    return !/imagem|anuncio|carrossel/.test(tool);
  }
  if (intent === "editar_imagem") return !/video/.test(tool);
  return true;
}

/** Nenhum código interno chega ao cliente. */
const ERROS_USUARIO: Record<string, string> = {
  sem_imagem: "Não encontrei a foto para editar. Me envie a imagem junto com o pedido, por favor.",
  sem_imagem_retornada: "A imagem não ficou pronta agora. Pode pedir de novo em alguns segundos?",
  image_gateway_indisponivel: "O gerador de imagens está indisponível neste momento. Tente novamente em instantes.",
  chave_invalida: "A geração de imagens está temporariamente fora do ar. Já estamos verificando.",
  creditos_ou_politica: "Não consegui gerar a imagem agora por um limite da conta de geração.",
};

export function mensagemDeErroParaUsuario(erro?: string, instrucao?: string): string {
  const chave = String(erro || "").trim();
  if (ERROS_USUARIO[chave]) return ERROS_USUARIO[chave];
  const amigavel = String(instrucao || "").trim();
  if (amigavel && !/^[a-z_]+$/.test(amigavel)) return amigavel;
  return "Não consegui concluir agora. Pode tentar de novo em alguns instantes?";
}
