// ============================================================
// APROVAÇÃO ÍNTEGRA — duas regras de raiz para qualquer aprovação:
//
// 1) O dono aprova o TEXTO que vai ao ar, nunca uma descrição do texto.
// 2) Nenhum pedido pode carregar o segmento/assunto de outro cliente.
//
// Módulo leve (sem supabase, sem IA) para ser importado por qualquer
// função que prepare conteúdo para aprovação/publicação.
// ============================================================

const semAcento = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// ---------- 1. Resumo disfarçado de conteúdo ----------

/**
 * Detecta a resposta que descreve as opções em vez de mostrar os textos.
 * Ex.: "*Opção A (Direta):* Foco na praticidade — mostra como ..."
 * Retorna o motivo, ou null quando o texto parece conter as copies reais.
 */
export const pareceResumoDeOpcoes = (texto: unknown): string | null => {
  const t = String(texto ?? "");
  const plano = semAcento(t);
  if (!/\bopcao\s*[abc]\b/.test(plano)) return null;

  if (/\bresumos?\s+(das|de)\s+(3|tres)\s+opcoes\b/.test(plano)) {
    return "anunciou resumo das opções em vez dos textos";
  }
  // "Opção A (Direta):" / "Opção A — Direta:" seguido de meta-descrição
  if (/opcao\s*[abc]\s*[\(\-–—]?\s*[a-z ]{0,18}[\)\-–—]?\s*:?\s*(foco|cenario|provocacao|abordagem|mostra como|ideia|angulo|tom|estilo|explora|destaca a)/.test(plano)) {
    return "descreveu a abordagem da opção em vez do texto";
  }

  // Blocos de opção curtos demais para serem um post real (sem hashtag/CTA).
  const blocos = t.split(/(?=[*_\s]*Op[çc][ãa]o\s*[ABC]\b)/i).slice(1);
  if (blocos.length >= 2) {
    const curtos = blocos.filter((b) => {
      const corpo = b.replace(/[*_]/g, "").replace(/^Op[çc][ãa]o\s*[ABC][^:\n]*[:\n]?/i, "").trim();
      const temPost = /#\w|wa\.me|http|link na bio|chama no direct|comenta\b/i.test(corpo);
      return corpo.length < 160 && !temPost;
    });
    if (curtos.length === blocos.length) return "blocos de opção curtos, sem o post completo";
  }
  return null;
};

// ---------- 2. Segmento de outro cliente ----------

const SEGMENTOS: { nome: string; re: RegExp }[] = [
  { nome: "odontologia", re: /\b(dentista|odontolog\w*|consultorio odontologico|clareamento|implante dentario|ortodont\w*|paciente na cadeira|cadeira do dentista)\b/ },
  { nome: "saude", re: /\b(medic[oa]|clinica|paciente|prontuario|consulta medica|enfermeir\w*|fisioterap\w*)\b/ },
  { nome: "veiculos", re: /\b(test-?drive|seminovo|0km|zero km|concessionaria|quilometragem|km rodados|seu carro na garagem)\b/ },
  { nome: "imoveis", re: /\b(imovel|imoveis|apartamento|corretor de imoveis|metro quadrado|planta do apartamento)\b/ },
  { nome: "consorcio", re: /\b(consorcio|carta de credito|contemplacao|assembleia mensal)\b/ },
  { nome: "beleza", re: /\b(salao de beleza|cabeleireir\w*|manicure|estetica facial|design de sobrancelha)\b/ },
  { nome: "alimentacao", re: /\b(restaurante|delivery de comida|hamburgueria|pizzaria|cardapio)\b/ },
  { nome: "pet", re: /\b(petshop|pet shop|banho e tosa|veterinari\w*|tutor do pet)\b/ },
  { nome: "juridico", re: /\b(advogad\w*|escritorio de advocacia|processo judicial|audiencia)\b/ },
  { nome: "academia", re: /\b(academia|personal trainer|musculacao|treino de hipertrofia)\b/ },
];

/** Segmentos citados no texto. */
export const segmentosNoTexto = (texto: unknown): string[] => {
  const t = semAcento(texto);
  return SEGMENTOS.filter((s) => s.re.test(t)).map((s) => s.nome);
};

/**
 * Segmento que apareceu na copy sem existir no pedido — vazamento de contexto
 * de outro cliente. Retorna o nome do segmento intruso, ou null.
 */
export const segmentoIntruso = (contextoDoPedido: unknown, textoGerado: unknown): string | null => {
  const doPedido = new Set(segmentosNoTexto(contextoDoPedido));
  for (const seg of segmentosNoTexto(textoGerado)) {
    if (!doPedido.has(seg)) return seg;
  }
  return null;
};
