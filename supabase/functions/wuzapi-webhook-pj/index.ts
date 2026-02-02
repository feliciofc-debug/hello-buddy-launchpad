import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  encode as base64Encode,
  decode as base64Decode,
} from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOCAWEB_WUZAPI_URL = Deno.env.get("WUZAPI_URL") || "https://wuzapi.amzofertas.com.br";

// ============================================
// HELPERS: links/imagens/validações
// ============================================
function hasPurchaseLink(text: string): boolean {
  return /https?:\/\//i.test(text || "");
}

function resolveProductLink(p: any): string | null {
  return p?.checkout_url || p?.link_marketplace || p?.link || null;
}

function resolveProductImage(p: any): string | null {
  return p?.imagem_url || p?.image_url || p?.foto || null;
}

// ============================================
// TIPOS / INTERFACES
// ============================================
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ============================================
// SYSTEM PROMPT GENÉRICO PARA PJ
// ============================================
function buildSystemPrompt(
  nomeAssistente: string,
  personalidade: string,
  nomeEmpresa: string,
  catalogoMD: string,
  historicoFormatado: string,
  totalProdutos: number
): string {
  return `Você é ${nomeAssistente}, assistente virtual da ${nomeEmpresa || 'nossa empresa'}.

IDENTIDADE:
- Seu nome é ${nomeAssistente}
- Assistente simpático, prestativo e ${personalidade}
- Conhece TODOS os produtos/serviços cadastrados

TOM DE VOZ:
- Amigável e acolhedor, mas equilibrado (sem exageros)
- Uma pitada de bom humor quando apropriado
- Profissional nas informações técnicas
- Respostas de 2-5 linhas NO MÁXIMO
- Use 1-2 emojis por mensagem 😊

🚨🚨🚨 REGRA MAIS IMPORTANTE - VOCÊ PRECISA ENTENDER O CONTEXTO! 🚨🚨🚨

⛔ PROIBIDO OFERECER PRODUTOS QUANDO O CLIENTE:
- Falar de MORTE, LUTO ou PERDA (cachorro morreu, perdi minha mãe, faleceu, etc.)
- Falar de ANSIEDADE, DEPRESSÃO, CRISE, PÂNICO
- Estiver DESABAFANDO problemas pessoais ou emocionais
- Pedir AJUDA emocional ("preciso de ajuda", "estou mal")

NESTES CASOS, RESPONDA APENAS COM EMPATIA:
- "Sinto muito pela sua perda... 😢 Meus sentimentos. Estou aqui se precisar."
- "Puxa, que fase difícil... Se precisar conversar, estou aqui. ❤️"
- NÃO mencione produtos, NÃO envie fotos, NÃO faça ofertas!

QUANDO O CLIENTE DESABAFAR OU FALAR DE PROBLEMAS PESSOAIS:
- Se falar de cansaço, idade, dor, doença, dificuldade de sair de casa
- ACOLHA com empatia e carinho
- Pergunte se pode ajudar (ex: entrega em casa)
- NÃO OFEREÇA PRODUTOS A MENOS QUE ELE PEÇA
- Exemplo: "Poxa, entendo você! 😢 Fico feliz em poder ajudar. Fazemos entrega em casa! Como posso te ajudar hoje?"

CUMPRIMENTOS SIMPLES (oi, olá, bom dia, boa tarde, boa noite, tudo bem):
- APENAS cumprimente de volta e pergunte como pode ajudar
- NÃO mencione nenhum produto
- NÃO sugira nada
- Exemplo correto: "Boa tarde! 😊 Em que posso te ajudar hoje?"
- Exemplo ERRADO: "Boa tarde! Temos a Mochila Premium por R$ 299..."

MENSAGENS DE CONTEXTO (sem pedir produto):
- "quero ir no mercado mas não consigo" → ACOLHA, não ofereça produto
- "estou cansado" → ACOLHA, não ofereça produto
- "minha perna está doendo" → ACOLHA, não ofereça produto
- "tenho idade já" → ACOLHA, não ofereça produto
- Pergunte como pode ajudar SEM oferecer produto específico

SÓ FALE DE PRODUTOS QUANDO O CLIENTE:
- Perguntar sobre um produto específico ("tem feijão?")
- Pedir recomendação ("o que você recomenda?")
- Perguntar "o que vocês têm?"
- Mencionar categoria ou nome de produto explicitamente
- Pedir algo pra comprar ("quero comprar X")

QUANDO O CLIENTE PEDIR PRODUTO:
1. Verifique o catálogo abaixo
2. Se encontrar, responda:
   "Temos sim! 🎉
   *[Nome do Produto]* - R$ X,XX
   👉 [LINK do produto]
   Vou te mandar a foto!"

SE NÃO TIVER LINK CADASTRADO:
"Temos sim! 🎉
*[Nome do Produto]* - R$ X,XX
Para comprar, é só me chamar que organizo pra você! 😊"

QUANDO NÃO ENCONTRAR O PRODUTO PEDIDO:
- Sugira produtos SIMILARES da mesma categoria
- Ex: "Não tenho feijão preto, mas tenho Grão de Bico Granfino por R$ 11,50!"

PALAVRAS PROIBIDAS: "cansada", "cansado", "cansou" → use "ocupada", "parou"

HISTÓRICO DA CONVERSA:
${historicoFormatado || 'Início da conversa.'}

═══════════════════════════════════════════════════════
📦 CATÁLOGO (${totalProdutos} itens) - USE APENAS QUANDO CLIENTE PEDIR EXPLICITAMENTE
═══════════════════════════════════════════════════════
${catalogoMD || 'Nenhum produto cadastrado.'}
═══════════════════════════════════════════════════════`;
}

// ============================================
// BUSCAR PRODUTOS DO USUÁRIO PJ
// ============================================
async function getProdutosPJ(supabase: any, userId: string): Promise<any[]> {
  if (!userId) return [];
  
  try {
    const { data: produtos, error } = await supabase
      .from('produtos')
      .select('*')
      .eq('user_id', userId)
      .eq('ativo', true)
      .order('categoria', { ascending: true })
      .order('nome', { ascending: true })
      .limit(200);
    
    if (error) {
      console.error('❌ [PJ-AI] Erro ao buscar produtos:', error);
      return [];
    }
    
    console.log(`📦 [PJ-AI] Produtos encontrados: ${produtos?.length || 0}`);
    return produtos || [];
    
  } catch (err) {
    console.error('❌ [PJ-AI] Erro:', err);
    return [];
  }
}

// ============================================
// FORMATAR CATÁLOGO COMPLETO PARA A IA (MARKDOWN)
// Inclui TODOS os campos cadastrados do produto
// ============================================
function formatarCatalogoMD(produtos: any[]): string {
  if (!produtos || produtos.length === 0) {
    return 'Nenhum produto cadastrado ainda.';
  }
  
  return produtos.map((p, i) => {
    let md = `### 📦 [PRODUTO ${i + 1}] ${p.nome}\n\n`;
    
    // ═══════════════════════════════════════════
    // INFORMAÇÕES BÁSICAS (Sempre mostrar)
    // ═══════════════════════════════════════════
    md += `**Categoria:** ${p.categoria || 'Geral'}\n`;
    md += `**Tipo:** ${p.tipo === 'servico' ? 'Serviço' : 'Produto Físico'}\n`;
    md += `**Preço:** R$ ${Number(p.preco || 0).toFixed(2)}\n`;
    if (p.sku) md += `**SKU/Código:** ${p.sku}\n`;
    if (p.brand) md += `**Marca:** ${p.brand}\n`;
    
    // ═══════════════════════════════════════════
    // IMAGEM (CRÍTICO para envio automático!)
    // ═══════════════════════════════════════════
    const imagem = resolveProductImage(p);
    if (imagem) {
      md += `**📷 IMAGEM DISPONÍVEL:** SIM - ${imagem}\n`;
    } else {
      md += `**📷 IMAGEM:** Não cadastrada\n`;
    }
    
    // ═══════════════════════════════════════════
    // ESTOQUE
    // ═══════════════════════════════════════════
    const estoque = p.estoque;
    if (estoque === null || estoque === undefined) {
      md += `**Estoque:** ✅ Disponível (sem limite)\n`;
    } else if (estoque > 10) {
      md += `**Estoque:** ✅ ${estoque} unidades disponíveis\n`;
    } else if (estoque > 0) {
      md += `**Estoque:** ⚠️ ÚLTIMAS ${estoque} UNIDADES!\n`;
    } else {
      md += `**Estoque:** ❌ ESGOTADO\n`;
    }
    
    // ═══════════════════════════════════════════
    // LINK DE COMPRA (OBRIGATÓRIO PARA VENDAS!)
    // ═══════════════════════════════════════════
    const link = resolveProductLink(p);
    if (link) {
      md += `**🔗 LINK DE COMPRA:** ${link}\n`;
    } else {
      md += `**🔗 LINK:** Não cadastrado (informe ao cliente como comprar)\n`;
    }
    
    // ═══════════════════════════════════════════
    // DESCRIÇÃO COMPLETA
    // ═══════════════════════════════════════════
    if (p.descricao) {
      md += `\n**📝 Descrição:**\n${p.descricao}\n`;
    }
    
    // ═══════════════════════════════════════════
    // FICHA TÉCNICA / ESPECIFICAÇÕES
    // ═══════════════════════════════════════════
    if (p.ficha_tecnica) {
      md += `\n**📋 Ficha Técnica:**\n${p.ficha_tecnica}\n`;
    }
    
    if (p.especificacoes) {
      md += `\n**🔧 Especificações:**\n${p.especificacoes}\n`;
    }
    
    // ═══════════════════════════════════════════
    // INFORMAÇÕES NUTRICIONAIS (para alimentos)
    // ═══════════════════════════════════════════
    if (p.informacao_nutricional) {
      md += `\n**🥗 Informação Nutricional:**\n${p.informacao_nutricional}\n`;
    }
    
    if (p.ingredientes) {
      md += `\n**🧾 Ingredientes:**\n${p.ingredientes}\n`;
    }
    
    // ═══════════════════════════════════════════
    // MODO DE USO / PREPARO
    // ═══════════════════════════════════════════
    if (p.modo_uso) {
      md += `\n**📖 Modo de Uso:**\n${p.modo_uso}\n`;
    }
    
    if (p.preparation) {
      md += `\n**🍳 Preparo:**\n${p.preparation}\n`;
    }
    
    // ═══════════════════════════════════════════
    // BENEFÍCIOS
    // ═══════════════════════════════════════════
    if (p.beneficios) {
      md += `\n**✨ Benefícios:**\n${p.beneficios}\n`;
    }
    
    // ═══════════════════════════════════════════
    // CARACTERÍSTICAS FÍSICAS
    // ═══════════════════════════════════════════
    const temCaracteristicasFisicas = p.dimensoes || p.peso || p.cor || p.tamanhos;
    if (temCaracteristicasFisicas) {
      md += `\n**📐 Características Físicas:**\n`;
      if (p.dimensoes) md += `- Dimensões: ${p.dimensoes}\n`;
      if (p.peso) md += `- Peso: ${p.peso}\n`;
      if (p.cor) md += `- Cores: ${p.cor}\n`;
      if (p.tamanhos) md += `- Tamanhos: ${p.tamanhos}\n`;
    }
    
    // ═══════════════════════════════════════════
    // GARANTIA
    // ═══════════════════════════════════════════
    const garantia = p.garantia || p.warranty;
    if (garantia) {
      md += `\n**🛡️ Garantia:** ${garantia}\n`;
    }
    
    // ═══════════════════════════════════════════
    // ATRIBUTOS EXTRAS (JSON)
    // ═══════════════════════════════════════════
    if (p.attributes && typeof p.attributes === 'object') {
      const attrs = Object.entries(p.attributes);
      if (attrs.length > 0) {
        md += `\n**📊 Atributos Extras:**\n`;
        attrs.forEach(([key, value]) => {
          md += `- ${key}: ${value}\n`;
        });
      }
    }
    
    // ═══════════════════════════════════════════
    // TAGS
    // ═══════════════════════════════════════════
    if (p.tags && Array.isArray(p.tags) && p.tags.length > 0) {
      md += `\n**🏷️ Tags:** ${p.tags.join(', ')}\n`;
    }
    
    md += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    return md;
  }).join('');
}

// ============================================
// EXTRAIR PRODUTOS MENCIONADOS NA RESPOSTA DA IA
// ============================================
function extrairProdutosDaResposta(resposta: string, produtos: any[]): any[] {
  const produtosEncontrados: any[] = [];
  const respostaLower = resposta.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  for (const p of produtos) {
    const nomeProduto = (p.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Verificar se o nome do produto (ou parte significativa) está na resposta
    const palavrasProduto = nomeProduto.split(/\s+/).filter((w: string) => w.length >= 3);
    
    // Se pelo menos 2 palavras do produto estão na resposta, considerar mencionado
    const matches = palavrasProduto.filter((palavra: string) => respostaLower.includes(palavra));
    if (matches.length >= 2 || (palavrasProduto.length === 1 && matches.length === 1)) {
      if (!produtosEncontrados.find(pf => pf.id === p.id)) {
        produtosEncontrados.push(p);
      }
    }
  }
  
  return produtosEncontrados;
}

// ============================================
// DETECTAR SE É PEDIDO REAL DE PRODUTO
// ============================================
function isPedidoRealDeProduto(mensagem: string): boolean {
  const msgLower = mensagem.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Padrões que indicam PEDIDO DE PRODUTO
  const padroesPedido = [
    // Pedidos explícitos
    /quero\s+(comprar|ver|saber|o|a|um|uma|esse|essa)/i,
    /preciso\s+de\s+\w+/i,
    /tem\s+(algum|alguma|o|a|esse|essa)\s+\w+/i,
    /vende[mn]?\s+\w+/i,
    /quanto\s+(custa|e|eh|é)\s+/i,
    /preco\s+(do|da|de|dos|das)\s+/i,
    /preço\s+(do|da|de|dos|das)\s+/i,
    /promocao\s+(de|do|da)\s+/i,
    /promoção\s+(de|do|da)\s+/i,
    /oferta\s+(de|do|da)\s+/i,
    /gostei\s+(do|da|dessa|desse)/i,
    /me\s+interess[ao]/i,
    /quero\s+(feijao|arroz|farinha|acucar|oleo|leite|cafe|manteiga|queijo|presunto)/i,
    /tem\s+(feijao|arroz|farinha|acucar|oleo|leite|cafe|manteiga|queijo|presunto)/i,
    // Lista de compras
    /manda\s+(lista|produtos)/i,
    /o\s+que\s+(voces|vcs|vocês)\s+tem/i,
    /o\s+que\s+tem\s+(pra|para)\s+vender/i,
    /catalogo/i,
    /catálogo/i,
  ];
  
  // Padrões que indicam CONVERSA/DESABAFO (não é pedido de produto)
  // 🚨 IMPORTANTE: Luto, morte, ansiedade = NUNCA enviar produto!
  const padroesConversa = [
    // LUTO E MORTE - PRIORIDADE MÁXIMA!
    /morr(eu|i|endo|er)/i,  // "morreu", "morri", "morrendo"
    /falec(eu|ido|imento)/i,  // "faleceu", "falecido"
    /perdi\s+(meu|minha|o|a)/i,  // "perdi meu cachorro"
    /cachorro|cachorrinho|cachorrinha|pet|gato|gatinho|animal/i,  // pets
    /luto|chora(ndo|r)|saudade|falta\s+d/i,  // "luto", "chorando", "saudade", "falta de"
    
    // ANSIEDADE E SAÚDE MENTAL
    /ansiedade|crise\s+de|panico|pânico|depressao|depressão/i,
    /ajuda|preciso\s+de\s+ajuda/i,
    /triste|tristeza|angustia|angústia|desesper/i,
    /dificil|difícil\s+para\s+mim/i,
    
    // PROBLEMAS DE SAÚDE
    /estou\s+(cansad|doendo|com\s+dor|triste|mal|doente)/i,
    /minha\s+(perna|mao|braco|cabeca|costas)/i,
    /nao\s+(consigo|consegui|posso|da)\s+ir/i,
    /ja\s+tenho\s+idade/i,
    /idade\s+ja/i,
    /ir\s+(no|ao)\s+mercado/i,
    /sair\s+de\s+casa/i,
    
    // AGRADECIMENTOS E CUMPRIMENTOS
    /obrigad[ao]\s*(por|pela)/i,
    /muito\s+obrigad/i,
    /valeu/i,
    /bom\s+dia/i,
    /boa\s+tarde/i,
    /boa\s+noite/i,
    /^oi\s*$/i,
    /^ola\s*$/i,
    /^olá\s*$/i,
    /tudo\s+bem/i,
    /como\s+(voce|você|vc)\s+esta/i,
  ];
  
  // Se bater em padrão de conversa, NÃO é pedido
  for (const padrao of padroesConversa) {
    if (padrao.test(msgLower)) {
      console.log(`💬 [PJ-AI] Mensagem é CONVERSA (match: ${padrao.source})`);
      return false;
    }
  }
  
  // Se bater em padrão de pedido, É pedido
  for (const padrao of padroesPedido) {
    if (padrao.test(msgLower)) {
      console.log(`🛒 [PJ-AI] Mensagem é PEDIDO (match: ${padrao.source})`);
      return true;
    }
  }
  
  // Mensagens muito curtas (< 15 chars) sem termos de produto = conversa
  if (msgLower.length < 15) {
    console.log(`💬 [PJ-AI] Mensagem curta sem contexto = conversa`);
    return false;
  }
  
  // Default: se não bateu em nada, considerar CONVERSA (mais seguro)
  console.log(`💬 [PJ-AI] Nenhum padrão detectado = assumindo conversa`);
  return false;
}

// ============================================
// PRÉ-FILTRAR PRODUTOS RELEVANTES (BUSCA MULTI-PRODUTO)
// ============================================
function filtrarProdutosRelevantes(produtos: any[], mensagem: string): any[] {
  // 🚨 PRIMEIRO: verificar se é PEDIDO REAL de produto
  if (!isPedidoRealDeProduto(mensagem)) {
    console.log(`🚫 [PJ-AI] NÃO é pedido de produto, retornando lista vazia`);
    return []; // Retorna vazio = não vai oferecer produto
  }
  
  // 🔧 LIMPEZA AGRESSIVA: Remove acentos E pontuação
  const limparTexto = (texto: string): string => {
    return (texto || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[?!.,;:'"()\[\]{}]/g, '') // Remove pontuação
      .trim();
  };
  
  const msgLower = limparTexto(mensagem);
  
  // Stop words expandida
  const stopWords = [
    'para', 'com', 'que', 'tem', 'uma', 'um', 'voce', 'você', 
    'ola', 'olá', 'bom', 'boa', 'dia', 'tarde', 'noite', 'por', 'favor', 'obrigado',
    'obrigada', 'muito', 'bem', 'mal', 'sim', 'nao', 'não', 'esse', 'essa', 'este',
    'esta', 'aqui', 'ali', 'onde', 'como', 'quando', 'porque', 'qual', 'quais',
    'meu', 'minha', 'seu', 'sua', 'nos', 'vcs', 'vocês', 'tem', 'ter', 'temos',
    'tenho', 'sobre', 'mais', 'menos', 'tambem', 'também', 'ainda', 'agora',
    'depois', 'antes', 'hoje', 'amanha', 'ontem', 'sempre', 'nunca', 'talvez',
    'ver', 'olhar', 'saber', 'posso', 'pode', 'podem', 'podemos',
    'favor', 'certeza', 'certo', 'errado', 'bom', 'ruim', 'gostei', 'quero',
    'preciso', 'queria', 'gostaria', 'promocao', 'oferta', 'preco', 'valor',
    'ir', 'mercado', 'compra', 'comprar', 'casa', 'idade', 'perna', 'doendo',
    'cansado', 'cansada', 'estou', 'nao', 'consegui', 'tanto'
  ];
  
  // Detectar expressões de interesse
  const expressoesInteresse = [
    'gostei da', 'gostei do', 'gostei dessa', 'gostei desse',
    'quero o', 'quero a', 'quero esse', 'quero essa',
    'me interessa', 'me interessou',
    'promocao de', 'promoção de', 'oferta de',
    'tem o', 'tem a', 'tem esse', 'tem essa',
    'preco do', 'preço do', 'preco da', 'preço da',
    'quanto custa', 'quanto é'
  ];
  
  // Extrair produto específico de expressões de interesse
  let produtoEspecifico = '';
  for (const expr of expressoesInteresse) {
    const idx = msgLower.indexOf(expr);
    if (idx !== -1) {
      // Pegar as próximas palavras após a expressão
      const resto = msgLower.substring(idx + expr.length).trim();
      const palavras = resto.split(/\s+/).slice(0, 4); // Pegar até 4 palavras
      produtoEspecifico = palavras.filter(p => p.length >= 2 && !stopWords.includes(p)).join(' ');
      console.log(`🎯 [PJ-AI] Expressão detectada: "${expr}" → Produto: "${produtoEspecifico}"`);
      break;
    }
  }
  
  // Detectar se é pedido de múltiplos produtos
  const separadores = /\s+e\s+|,\s*|\/|\s+ou\s+/g;
  const partes = msgLower.split(separadores).map(p => p.trim()).filter(p => p.length > 0);
  
  console.log(`🔍 [PJ-AI] Partes detectadas: ${partes.join(' | ')}`);
  
  // Coletar todos os termos para busca
  const termosParaBuscar: string[] = [];
  
  // 🔧 PRIORIDADE 0: Extrair nomes de produtos conhecidos diretamente da mensagem
  const produtosConhecidos = ['arroz', 'feijao', 'feijão', 'farinha', 'acucar', 'açucar', 'oleo', 'óleo', 
    'leite', 'cafe', 'café', 'manteiga', 'queijo', 'presunto', 'flocao', 'flocão', 'milho', 'sal',
    'macarrao', 'macarrão', 'molho', 'sardinha', 'atum', 'biscoito', 'bolacha', 'pao', 'pão'];
  
  for (const prod of produtosConhecidos) {
    const prodNorm = limparTexto(prod);
    if (msgLower.includes(prodNorm)) {
      termosParaBuscar.push(prodNorm);
      console.log(`🎯 [PJ-AI] Produto conhecido detectado: "${prodNorm}"`);
    }
  }
  
  // Prioridade 1: produto específico de expressão de interesse
  if (produtoEspecifico) {
    termosParaBuscar.push(...produtoEspecifico.split(/\s+/).filter(p => p.length >= 2));
  }
  
  // Prioridade 2: múltiplas partes
  if (partes.length > 1) {
    for (const parte of partes) {
      const palavras = parte.split(/\s+/).filter(p => p.length >= 2 && !stopWords.includes(p));
      termosParaBuscar.push(...palavras);
    }
  } else {
    // Pedido único
    const palavras = msgLower.split(/\s+/).filter(p => p.length >= 2 && !stopWords.includes(p));
    termosParaBuscar.push(...palavras);
  }
  
  // 🔧 Limpar termos e remover duplicatas
  const termosUnicos = [...new Set(termosParaBuscar.map(t => limparTexto(t)).filter(t => t.length >= 2))];
  console.log(`🔍 [PJ-AI] Termos para buscar: ${termosUnicos.join(', ')}`);
  
  if (termosUnicos.length === 0) {
    return []; // Sem termos válidos = não buscar produtos
  }
  
  // Normalizar texto para busca (remover acentos E pontuação)
  const normalizar = (texto: string) => {
    return (texto || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[?!.,;:'"()\[\]{}]/g, '')
      .trim();
  };
  
  // Buscar produtos que contenham QUALQUER um dos termos
  const produtosComScore = produtos.map(p => {
    let score = 0;
    const termosEncontrados: string[] = [];
    const nomeLower = normalizar(p.nome);
    const descLower = normalizar(p.descricao);
    const catLower = normalizar(p.categoria);
    const skuLower = normalizar(p.sku);
    
    for (const termo of termosUnicos) {
      const termoNorm = normalizar(termo);
      let matchFound = false;
      
      // Match no nome = maior peso
      if (nomeLower.includes(termoNorm)) {
        score += 20;
        matchFound = true;
      }
      // Match no SKU
      if (skuLower.includes(termoNorm)) {
        score += 15;
        matchFound = true;
      }
      // Match na categoria
      if (catLower.includes(termoNorm)) {
        score += 10;
        matchFound = true;
      }
      // Match na descrição
      if (descLower.includes(termoNorm)) {
        score += 5;
        matchFound = true;
      }
      
      // Busca parcial (ex: "grao" encontra "grão de bico")
      if (!matchFound && termoNorm.length >= 3) {
        if (nomeLower.split(/\s+/).some(word => word.startsWith(termoNorm) || word.includes(termoNorm))) {
          score += 12;
          matchFound = true;
        }
      }
      
      if (matchFound) {
        termosEncontrados.push(termo);
      }
    }
    
    if (score > 0) {
      console.log(`✅ [MATCH] Produto "${p.nome?.slice(0, 40)}" - Termos: ${termosEncontrados.join(', ')} (score: ${score})`);
    }
    
    return { ...p, score, termosEncontrados };
  });
  
  // Filtrar produtos com match e ordenar por score
  const comMatch = produtosComScore.filter(p => p.score > 0);
  
  // Se temos múltiplos termos, garantir que temos ao menos um produto para cada termo
  if (termosUnicos.length > 1) {
    const resultadoFinal: any[] = [];
    const termosAtendidos = new Set<string>();
    
    // Primeiro, pegar o melhor produto para cada termo
    for (const termo of termosUnicos) {
      const produtosComTermo = comMatch
        .filter(p => p.termosEncontrados.includes(termo))
        .sort((a, b) => b.score - a.score);
      
      if (produtosComTermo.length > 0) {
        // Adicionar até 2 produtos por termo (para dar opções)
        for (let i = 0; i < Math.min(2, produtosComTermo.length); i++) {
          const prod = produtosComTermo[i];
          if (!resultadoFinal.find(r => r.id === prod.id)) {
            resultadoFinal.push(prod);
          }
        }
        termosAtendidos.add(termo);
      }
    }
    
    console.log(`🎯 [PJ-AI] Termos atendidos: ${[...termosAtendidos].join(', ')}`);
    console.log(`🎯 [PJ-AI] Termos NÃO encontrados: ${termosUnicos.filter(t => !termosAtendidos.has(t)).join(', ') || 'nenhum'}`);
    console.log(`🎯 [PJ-AI] Produtos selecionados: ${resultadoFinal.length}`);
    
    // Se ainda tem espaço, adicionar mais produtos relevantes
    if (resultadoFinal.length < 15) {
      const restantes = comMatch
        .filter(p => !resultadoFinal.find(r => r.id === p.id))
        .sort((a, b) => b.score - a.score)
        .slice(0, 15 - resultadoFinal.length);
      resultadoFinal.push(...restantes);
    }
    
    return resultadoFinal;
  }
  
  // Busca simples - retornar os melhores por score
  const relevantes = comMatch.sort((a, b) => b.score - a.score).slice(0, 15);
  console.log(`🎯 [PJ-AI] Produtos relevantes: ${relevantes.length}`);
  return relevantes;
}

// ============================================
// GERAR RESPOSTA COM IA (LOVABLE AI GATEWAY)
// ============================================
async function generateAIResponse(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  systemPrompt: string
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    console.error('❌ [PJ-AI] LOVABLE_API_KEY não configurada!');
    return 'Olá! 👋 Como posso ajudar você hoje?';
  }

  try {
    // Montar mensagens para a IA
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-6).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage }
    ];

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        max_tokens: 800,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [PJ-AI] Erro na API:', response.status, errorText);
      
      if (response.status === 429) {
        return 'Opa, estou com muitas mensagens agora! Me manda de novo em alguns segundos? 😅';
      }
      
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    let aiMessage = data.choices?.[0]?.message?.content || '';
    
    // Filtro de palavras proibidas
    aiMessage = aiMessage
      .replace(/cansad[ao]/gi, 'ocupad$1')
      .replace(/cansou/gi, 'parou');
    
    console.log('🤖 [PJ-AI] Resposta:', aiMessage.slice(0, 100));
    
    return aiMessage.trim() || 'Olá! 👋 Como posso ajudar você hoje?';

  } catch (error) {
    console.error('❌ [PJ-AI] Erro ao gerar resposta:', error);
    return 'Olá! 👋 Bem-vindo! Como posso ajudar você?';
  }
}

// ============================================
// BUSCAR HISTÓRICO DE CONVERSA
// ============================================
async function getConversationHistory(supabase: any, phone: string): Promise<ConversationMessage[]> {
  const cleanPhone = phone.replace(/\D/g, '');
  
  const { data } = await supabase
    .from('pj_conversas')
    .select('role, content')
    .eq('phone', cleanPhone)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!data) return [];
  
  // Reverter para ordem cronológica
  return data.reverse();
}

// ============================================
// INSERIR NA FILA ANTI-BLOQUEIO PJ
// ============================================
async function inserirNaFilaPJ(
  supabase: any,
  phone: string,
  message: string,
  wuzapiToken: string,
  userId: string | null,
  leadName?: string | null,
  wuzapiUrl?: string | null
) {
  const cleanPhone = phone.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
  
  // Delay aleatório entre 3-8 segundos
  const delayMs = Math.floor(Math.random() * 5000) + 3000;
  const scheduledAt = new Date(Date.now() + delayMs);
  
  // URL padrão do WuzAPI PJ na Locaweb (PORTA 8080 = principal)
  const finalUrl = wuzapiUrl || 'http://191.252.193.73:8080';
  
  const { error } = await supabase
    .from('fila_atendimento_pj')
    .insert({
      lead_phone: formattedPhone,
      lead_name: leadName || null,
      mensagem: message,
      tipo_mensagem: 'texto',
      prioridade: 1,
      status: 'pendente',
      wuzapi_token: wuzapiToken,
      wuzapi_url: finalUrl,
      user_id: userId,
      scheduled_at: scheduledAt.toISOString()
    });
  
  if (error) {
    console.error('❌ [PJ-FILA] Erro:', error);
    return false;
  }
  
  console.log(`✅ [PJ-FILA] Mensagem agendada para ${formattedPhone} (${finalUrl})`);
  return true;
}

// ============================================
// INSERIR IMAGEM NA FILA ANTI-BLOQUEIO PJ
// ============================================
async function inserirImagemNaFilaPJ(
  supabase: any,
  phone: string,
  imagemUrl: string,
  caption: string,
  wuzapiToken: string,
  userId: string | null,
  wuzapiUrl?: string | null
) {
  const cleanPhone = phone.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
  
  // Delay maior para imagem (após o texto)
  const delayMs = Math.floor(Math.random() * 3000) + 5000; // 5-8 segundos após o texto
  const scheduledAt = new Date(Date.now() + delayMs);
  
  // URL padrão do WuzAPI PJ na Locaweb (PORTA 8080 = principal)
  const finalUrl = wuzapiUrl || 'http://191.252.193.73:8080';
  
  const { error } = await supabase
    .from('fila_atendimento_pj')
    .insert({
      lead_phone: formattedPhone,
      mensagem: caption || 'Confira este produto!',
      imagem_url: imagemUrl,
      tipo_mensagem: 'imagem',
      prioridade: 2,
      status: 'pendente',
      wuzapi_token: wuzapiToken,
      wuzapi_url: finalUrl,
      user_id: userId,
      scheduled_at: scheduledAt.toISOString()
    });
  
  if (error) {
    console.error('❌ [PJ-FILA] Erro ao inserir imagem:', error);
    return false;
  }
  
  console.log(`✅ [PJ-FILA] Imagem agendada para ${formattedPhone}`);
  return true;
}

// ============================================
// INSERIR ÁUDIO NA FILA ANTI-BLOQUEIO PJ (TTS)
// ============================================
async function inserirAudioNaFilaPJ(
  supabase: any,
  phone: string,
  audioBase64: string,
  wuzapiToken: string,
  userId: string | null,
  wuzapiUrl?: string | null
) {
  const cleanPhone = phone.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
  
  // Delay maior para áudio (após o texto, antes da imagem)
  const delayMs = Math.floor(Math.random() * 2000) + 4000; // 4-6 segundos após o texto
  const scheduledAt = new Date(Date.now() + delayMs);
  
  const finalUrl = wuzapiUrl || 'http://191.252.193.73:8080';
  
  const { error } = await supabase
    .from('fila_atendimento_pj')
    .insert({
      lead_phone: formattedPhone,
      mensagem: '[ÁUDIO]',
      audio_base64: audioBase64,
      tipo_mensagem: 'audio',
      prioridade: 1, // Mesma prioridade do texto
      status: 'pendente',
      wuzapi_token: wuzapiToken,
      wuzapi_url: finalUrl,
      user_id: userId,
      scheduled_at: scheduledAt.toISOString()
    });
  
  if (error) {
    console.error('❌ [PJ-FILA] Erro ao inserir áudio:', error);
    return false;
  }
  
  console.log(`🔊 [PJ-FILA] Áudio agendado para ${formattedPhone}`);
  return true;
}

// ============================================
// GERAR ÁUDIO VIA ELEVENLABS TTS
// ============================================
async function gerarAudioTTS(
  supabaseUrl: string,
  supabaseKey: string,
  texto: string,
  voz: string = 'roger'
): Promise<string | null> {
  try {
    // Limitar texto para TTS (máximo 500 chars para respostas curtas)
    const textoLimpo = texto
      .replace(/\*+/g, '') // Remove asteriscos (negrito)
      .replace(/https?:\/\/\S+/g, 'link de compra') // Substitui URLs
      .replace(/[📦💰🔥🛒🎉✨👉💬📷]/g, '') // Remove emojis
      .slice(0, 500);
    
    console.log(`🎤 [TTS-PJ] Gerando áudio para: ${textoLimpo.slice(0, 50)}...`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/elevenlabs-tts-pj`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: textoLimpo,
        voice: voz,
        returnBase64: true,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [TTS-PJ] Erro ${response.status}:`, errorText);
      return null;
    }
    
    const data = await response.json();
    
    if (data.success && data.audioBase64) {
      console.log(`✅ [TTS-PJ] Áudio gerado! Size: ${data.size} bytes`);
      return data.audioBase64;
    }
    
    console.error('❌ [TTS-PJ] Resposta sem áudio:', data);
    return null;
    
  } catch (error) {
    console.error('❌ [TTS-PJ] Erro ao gerar áudio:', error);
    return null;
  }
}

// ============================================
// TRANSCREVER ÁUDIO VIA LOVABLE AI (GEMINI)
// ============================================
type TranscreverAudioInput = {
  audioUrl: string;
  mediaKeyBase64?: string | null;
};

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

async function decryptWhatsAppMedia(encrypted: Uint8Array, mediaKeyBase64: string, mediaType: "audio"): Promise<Uint8Array> {
  // WhatsApp media encryption (Baileys-compatible): HKDF-SHA256 with info string.
  // For audio: "WhatsApp Audio Keys".
  const infoStr = mediaType === "audio" ? "WhatsApp Audio Keys" : "WhatsApp Media Keys";
  const mediaKeyBytes = new Uint8Array(base64Decode(mediaKeyBase64));
  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(mediaKeyBytes),
    "HKDF",
    false,
    ["deriveBits"],
  );

  const salt = new Uint8Array(32); // 32 zero bytes
  const info = new TextEncoder().encode(infoStr);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    hkdfKey,
    112 * 8,
  );
  const derived = new Uint8Array(derivedBits);
  const iv = derived.slice(0, 16);
  const cipherKey = derived.slice(16, 48);
  // const macKey = derived.slice(48, 80); // not verifying MAC for now

  // WhatsApp appends a 10-byte MAC at the end.
  const macLen = 10;
  const ciphertext = encrypted.length > macLen ? encrypted.slice(0, encrypted.length - macLen) : encrypted;

  const aesKey = await crypto.subtle.importKey(
    "raw",
    cipherKey,
    { name: "AES-CBC" },
    false,
    ["decrypt"],
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv },
    aesKey,
    toArrayBuffer(ciphertext),
  );

  return new Uint8Array(decrypted);
}

async function transcreverAudio(
  input: TranscreverAudioInput
): Promise<string | null> {
  try {
    const { audioUrl, mediaKeyBase64 } = input;
    console.log(`🎧 [STT-PJ] Baixando áudio de: ${audioUrl.slice(0, 80)}...`);
    
    // 1. Baixar o áudio do WhatsApp
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      console.error(`❌ [STT-PJ] Erro ao baixar áudio: ${audioResponse.status}`);
      return null;
    }
    
    const audioBuffer = await audioResponse.arrayBuffer();
    let audioBytes: Uint8Array = new Uint8Array(audioBuffer);
    console.log(`🎧 [STT-PJ] Áudio baixado! Size: ${audioBytes.byteLength} bytes`);

    // URLs do WhatsApp geralmente são .enc (criptografadas). Se tiver mediaKey, descriptografar antes.
    if (mediaKeyBase64) {
      try {
        const decrypted = await decryptWhatsAppMedia(audioBytes, mediaKeyBase64, "audio");
        // Heurística simples: só troca se vier algo maior e plausível
        if (decrypted?.byteLength && decrypted.byteLength > 1000) {
          audioBytes = decrypted;
          console.log(`🔓 [STT-PJ] Áudio descriptografado! Size: ${audioBytes.byteLength} bytes`);
        }
      } catch (e) {
        console.warn("⚠️ [STT-PJ] Falha ao descriptografar áudio, tentando bruto...", e);
      }
    }

    const audioBase64 = base64Encode(toArrayBuffer(audioBytes));
    
    // 2. Usar Lovable AI (Gemini) para transcrever
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("❌ [STT-PJ] LOVABLE_API_KEY não configurada");
      return null;
    }
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um transcritor de áudio de WhatsApp em português brasileiro.

REGRAS ABSOLUTAS:
1. Transcreva EXATAMENTE e LITERALMENTE o que a pessoa está falando
2. NÃO INVENTE conteúdo - se não entender, escreva "[inaudível]"
3. NÃO INTERPRETE ou ADICIONE informações que não foram ditas
4. O áudio é de uma conversa INFORMAL de WhatsApp (geralmente cumprimentos, perguntas simples, pedidos)
5. Pessoas costumam dizer coisas como: "oi", "tudo bem?", "bom dia", "quero comprar X", "tem Y?", etc.
6. Se o áudio estiver vazio, ruído ou incompreensível, retorne: "[áudio não compreendido]"
7. NÃO transcreva notícias, textos longos ou conteúdos formais - isso indica erro

Retorne APENAS a transcrição literal, sem aspas, sem explicações, sem prefixos.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcreva este áudio de WhatsApp:"
              },
              {
                type: "input_audio",
                input_audio: {
                  data: audioBase64,
                  format: "ogg"
                }
              }
            ]
          }
        ],
        temperature: 0.1, // Baixa temperatura para transcrição literal
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [STT-PJ] Erro Lovable AI ${response.status}:`, errorText);
      return null;
    }
    
    const data = await response.json();
    const transcricao = data.choices?.[0]?.message?.content?.trim();
    
    if (transcricao) {
      console.log(`✅ [STT-PJ] Transcrição: "${transcricao.slice(0, 100)}..."`);
      return transcricao;
    }
    
    console.error('❌ [STT-PJ] Resposta sem transcrição:', data);
    return null;
    
  } catch (error) {
    console.error('❌ [STT-PJ] Erro ao transcrever:', error);
    return null;
  }
}

// ============================================
// MAIN HANDLER
// ============================================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    // Log maior para facilitar debug sem lotar demais
    console.log("📨 [PJ-WEBHOOK] Recebido:", JSON.stringify(body).substring(0, 2000));

    // Extrair dados da mensagem (WuzAPI pode enviar em formatos diferentes)
    // Formato novo observado:
    // { type: "Message" | "ChatPresence" | ..., event: { Info: { Sender, ID, IsFromMe, IsGroup, ... }, Message: {...}, ... } }
    const envelope = body?.data || body;
    const eventType = envelope?.type || envelope?.event?.type || "";
    const messageData = envelope?.event || envelope;

    // Eventos não-mensagem: registrar ReadReceipt para diagnosticar entrega
    if (eventType && eventType !== "Message") {
      if (eventType === "ReadReceipt" || eventType === "Receipt") {
        const info = (messageData as any)?.Info || {};
        const receiptId = info?.ID || info?.Id || (messageData as any)?.id || null;
        const receiptChat = info?.Chat || info?.Sender || info?.RemoteJid || null;
        const receiptFromMe = info?.IsFromMe ?? (messageData as any)?.fromMe ?? null;
        console.log("📬 [PJ-WEBHOOK] ReadReceipt:", {
          eventType,
          receiptId,
          receiptChat,
          receiptFromMe,
        });
      } else {
        console.log("⏭️ [PJ-WEBHOOK] Evento não-mensagem, ignorando:", eventType);
      }

      return new Response(
        JSON.stringify({ success: true, ignored: true, reason: "non_message_event", eventType }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const info = messageData?.Info || {};
    
    // DEBUG: verificar onde está o SenderAlt
    console.log("🔍 [DEBUG] info.SenderAlt =", info?.SenderAlt);
    console.log("🔍 [DEBUG] info.Sender =", info?.Sender);
    console.log("🔍 [DEBUG] envelope.event?.Info?.SenderAlt =", (envelope as any)?.event?.Info?.SenderAlt);

    // Alguns builds (ex: Locaweb) enviam @lid no Sender e o telefone real em SenderAlt.
    // Coletamos candidatos e priorizamos @s.whatsapp.net.
    const candidateSenders: string[] = [
      // SenderAlt primeiro (build Locaweb manda telefone real aqui)
      info?.SenderAlt,
      (envelope as any)?.event?.Info?.SenderAlt, // acesso direto ao envelope
      messageData?.SenderAlt,
      // Depois os clássicos
      info?.Sender,
      info?.Chat,
      info?.RemoteJid,
      info?.RemoteJID,
      messageData?.Sender,
      messageData?.Chat,
      messageData?.from,
      messageData?.phone,
      // formatos comuns em key
      (messageData as any)?.key?.remoteJid,
      (messageData as any)?.key?.participant,
      (messageData as any)?.Message?.key?.remoteJid,
      (messageData as any)?.Message?.key?.participant,
      (messageData as any)?.message?.key?.remoteJid,
      (messageData as any)?.message?.key?.participant,
      (envelope as any)?.event?.Message?.key?.remoteJid,
      (envelope as any)?.event?.Message?.key?.participant,
    ].filter(Boolean);

    const msg = messageData?.Message || messageData?.message || {};
    let messageText =
      msg?.Conversation ||
      msg?.conversation ||
      msg?.ExtendedTextMessage?.Text ||
      msg?.extendedTextMessage?.text ||
      messageData?.body ||
      messageData?.text ||
      "";

    // ═══════════════════════════════════════════════════════════════════════════
    // DETECTAR E TRANSCREVER ÁUDIO (PTT / Voice Message)
    // ═══════════════════════════════════════════════════════════════════════════
    const audioMessage = msg?.audioMessage || msg?.AudioMessage || null;
    const isPTT = audioMessage?.PTT || audioMessage?.ptt || false;
    const audioUrl = audioMessage?.URL || audioMessage?.url || null;
    let isAudioMessage = false;

    if (audioMessage && audioUrl) {
      console.log(`🎧 [PJ-WEBHOOK] Áudio detectado! PTT: ${isPTT}, URL: ${audioUrl.slice(0, 80)}...`);
      isAudioMessage = true;
      
      // Tentar transcrever o áudio
      const transcricao = await transcreverAudio({
        audioUrl,
        mediaKeyBase64: audioMessage?.mediaKey || audioMessage?.MediaKey || null,
      });
      
      if (transcricao) {
        messageText = transcricao;
        console.log(`✅ [PJ-WEBHOOK] Áudio transcrito: "${messageText.slice(0, 100)}..."`);
      } else {
        // Fallback: informar que não conseguiu transcrever
        messageText = "[áudio não transcrito - cliente enviou mensagem de voz]";
        console.log(`⚠️ [PJ-WEBHOOK] Falha na transcrição, usando fallback`);
      }
    }

    const messageId = info?.ID || info?.Id || messageData?.id || messageData?.Info?.id || "";
    const isFromMe = info?.IsFromMe || messageData?.fromMe || false;

    const normalizeWaIdToDigits = (raw: string) => {
      if (!raw) return "";
      let s = String(raw);
      s = s.replace("@s.whatsapp.net", "").replace("@g.us", "").replace("@lid", "");
      if (s.includes(":")) s = s.split(":")[0];
      s = s.replace(/\D/g, "");
      return s;
    };

    const looksLikePhone = (digits: string) => {
      // BR típico: 11 (sem 55) ou 13 (com 55). Aceitar faixa geral e rejeitar IDs enormes.
      if (!digits) return false;
      if (digits.length < 10) return false;
      if (digits.length > 13) return false;
      return true;
    };

    const bestCandidate =
      candidateSenders.find((c) => String(c).includes("@s.whatsapp.net")) ||
      candidateSenders.find((c) => looksLikePhone(normalizeWaIdToDigits(String(c)))) ||
      "";

    const cleanPhone = normalizeWaIdToDigits(bestCandidate);
    const senderInvalid = !looksLikePhone(cleanPhone);
    const isGroup = Boolean(info?.IsGroup) || String(bestCandidate).includes("@g.us") || false;

    // Ignorar mensagens próprias, grupos e remetentes inválidos (ex: @lid)
    // MAS processar áudios mesmo sem texto (já que vamos transcrever)
    if (isFromMe || isGroup || senderInvalid || (!messageText && !isAudioMessage)) {
      console.log("⏭️ [PJ-WEBHOOK] Ignorando:", {
        isFromMe,
        isGroup,
        senderInvalid,
        hasText: !!messageText,
        isAudioMessage,
        bestCandidate,
        candidatesPreview: candidateSenders.slice(0, 10),
      });
      return new Response(
        JSON.stringify({ success: true, ignored: true, reason: senderInvalid ? "invalid_sender" : "filtered" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📱 [PJ-WEBHOOK] Mensagem de ${cleanPhone}: ${messageText.substring(0, 50)}...`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Deduplicação
    if (messageId) {
      const { data: existing } = await supabase
        .from("pj_webhook_dedup")
        .select("id")
        .eq("message_id", messageId)
        .maybeSingle();

      if (existing) {
        console.log("⏭️ [PJ-WEBHOOK] Mensagem duplicada, ignorando");
        return new Response(
          JSON.stringify({ success: true, duplicate: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Registrar dedup
      await supabase.from("pj_webhook_dedup").insert({ message_id: messageId });
    }

    // Salvar mensagem do usuário
    await supabase.from("pj_conversas").insert({
      phone: cleanPhone,
      role: "user",
      content: messageText,
    });

    // Buscar histórico de conversa
    const conversationHistory = await getConversationHistory(supabase, cleanPhone);
    const historicoFormatado = conversationHistory
      .map((h) => `${h.role === "user" ? "Cliente" : "Assistente"}: ${h.content}`)
      .join("\n");

    // ═══════════════════════════════════════════════════════════════════════════
    // BUSCAR CONFIGURAÇÃO DO ASSISTENTE PJ - ORDEM DE PRIORIDADE
    // ═══════════════════════════════════════════════════════════════════════════
    const instanceName = envelope?.instanceName || envelope?.instance || body?.instanceName || body?.instance;
    let pjConfig: any = null;

    console.log(`🔍 [PJ-WEBHOOK] Procurando config para instanceName: "${instanceName || 'NÃO RECEBIDO'}"`);

    // 🚨 PRIORIDADE MÁXIMA: Buscar por instanceName específico PRIMEIRO!
    // Isso garante que cada assistente (ex: Moreirinha) responda pela instância correta
    if (instanceName) {
      // Tentar buscar pela config que tem esse instanceName
      const { data: configPorInstance } = await supabase
        .from("pj_clientes_config")
        .select("*")
        .eq("wuzapi_instance_name", instanceName)
        .maybeSingle();
      
      if (configPorInstance) {
        pjConfig = configPorInstance;
        console.log(`✅ [PJ-WEBHOOK] Config encontrada por instanceName: ${instanceName}, user: ${configPorInstance.user_id?.slice(0, 8)}, nome: ${configPorInstance.nome_assistente}`);
      } else {
        // Também buscar na tabela wuzapi_instances para encontrar o user_id
        const { data: instanceData } = await supabase
          .from("wuzapi_instances")
          .select("assigned_to_user, port, wuzapi_token")
          .eq("instance_name", instanceName)
          .maybeSingle();
        
        if (instanceData?.assigned_to_user) {
          const { data: configByUser } = await supabase
            .from("pj_clientes_config")
            .select("*")
            .eq("user_id", instanceData.assigned_to_user)
            .maybeSingle();
          
          if (configByUser) {
            pjConfig = configByUser;
            // Usar a porta e token da instância encontrada se for mais específica
            if (instanceData.port && instanceData.port !== 8080) {
              pjConfig.wuzapi_port = instanceData.port;
            }
            if (instanceData.wuzapi_token) {
              pjConfig.wuzapi_token = instanceData.wuzapi_token;
            }
            console.log(`✅ [PJ-WEBHOOK] Config encontrada via wuzapi_instances (${instanceName}): user ${configByUser.user_id?.slice(0, 8)}, porta: ${pjConfig.wuzapi_port}, nome: ${configByUser.nome_assistente}`);
          }
        }
      }
    }

    // PRIORIDADE 2: Buscar pela wuzapi_instances conectada (qualquer porta)
    if (!pjConfig && instanceName) {
      const { data: instances } = await supabase
        .from("wuzapi_instances")
        .select("assigned_to_user, port, instance_name, wuzapi_token")
        .eq("instance_name", instanceName)
        .limit(1);
      
      if (instances && instances.length > 0 && instances[0]?.assigned_to_user) {
        const { data: configByUser } = await supabase
          .from("pj_clientes_config")
          .select("*")
          .eq("user_id", instances[0].assigned_to_user)
          .maybeSingle();
        
        if (configByUser) {
          pjConfig = {
            ...configByUser,
            wuzapi_port: instances[0].port,
            wuzapi_token: instances[0].wuzapi_token || configByUser.wuzapi_token,
          };
          console.log(`✅ [PJ-WEBHOOK] Config encontrada por wuzapi_instances: ${instanceName}, porta ${instances[0].port}, user ${configByUser.user_id?.slice(0, 8)}`);
        }
      }
    }

    // PRIORIDADE 3 (FALLBACK): Buscar pela config na porta 8080 que tenha produtos
    if (!pjConfig) {
      const { data: configsConectadas } = await supabase
        .from("pj_clientes_config")
        .select("*")
        .eq("whatsapp_conectado", true)
        .eq("wuzapi_port", 8080);

      if (configsConectadas && configsConectadas.length > 0) {
        // Verificar qual tem produtos cadastrados
        for (const cfg of configsConectadas) {
          const { count } = await supabase
            .from("produtos")
            .select("id", { count: "exact", head: true })
            .eq("user_id", cfg.user_id)
            .eq("ativo", true);
          
          if (count && count > 0) {
            pjConfig = cfg;
            console.log(`⚠️ [PJ-WEBHOOK] Fallback: Config porta 8080 com ${count} produtos! user: ${cfg.user_id?.slice(0, 8)}, nome: ${cfg.nome_assistente}`);
            break;
          }
        }
      }
    }

    // PRIORIDADE 4: Pegar qualquer config na porta 8080 com produtos
    if (!pjConfig) {
      const { data: configsPorPorta } = await supabase
        .from("pj_clientes_config")
        .select("*")
        .eq("wuzapi_port", 8080)
        .order("created_at", { ascending: true });
      
      if (configsPorPorta) {
        for (const cfg of configsPorPorta) {
          const { count } = await supabase
            .from("produtos")
            .select("id", { count: "exact", head: true })
            .eq("user_id", cfg.user_id)
            .eq("ativo", true);
          
          if (count && count > 0) {
            pjConfig = cfg;
            console.log(`⚠️ [PJ-WEBHOOK] Fallback porta 8080 com ${count} produtos: user ${cfg.user_id?.slice(0, 8)}`);
            break;
          }
        }
        
        // Se nenhuma tem produtos, pegar a primeira
        if (!pjConfig && configsPorPorta.length > 0) {
          pjConfig = configsPorPorta[0];
          console.log(`⚠️ [PJ-WEBHOOK] Usando config porta 8080 (sem produtos): user ${pjConfig.user_id?.slice(0, 8)}`);
        }
      }
    }

    // ÚLTIMO FALLBACK: qualquer config
    if (!pjConfig) {
      const { data } = await supabase
        .from("pj_clientes_config")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      pjConfig = data;
      console.log(`⚠️ [PJ-WEBHOOK] Usando fallback genérico: user ${data?.user_id?.slice(0, 8) || 'N/A'}`);
    }

    const nomeAssistente = pjConfig?.nome_assistente || "Pietro Eugênio";
    const personalidade = pjConfig?.personalidade_assistente || "profissional e prestativo";
    const userId = pjConfig?.user_id;
    const wuzapiToken = pjConfig?.wuzapi_token;
    const wuzapiPort = pjConfig?.wuzapi_port || 8080; // DEFAULT: 8080 (não 8081!)
    
    // Construir URL do WuzAPI baseado na porta
    const wuzapiUrl = `http://191.252.193.73:${wuzapiPort}`;
    
    console.log(`👤 [PJ-WEBHOOK] Config FINAL: ${nomeAssistente}, user: ${userId?.slice(0, 8) || 'N/A'}..., port: ${wuzapiPort}`);

    if (!wuzapiToken) {
      console.error("❌ [PJ-WEBHOOK] wuzapi_token não configurado!");
      return new Response(
        JSON.stringify({ success: false, error: "Token não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar nome da empresa (se tiver tabela de empresas)
    let nomeEmpresa = "Nossa Empresa";
    const { data: empresaData } = await supabase
      .from("empresas")
      .select("nome")
      .eq("user_id", userId)
      .maybeSingle();
    
    if (empresaData?.nome) {
      nomeEmpresa = empresaData.nome;
    }

    // Buscar TODOS os produtos do usuário PJ
    const todosProdutos = await getProdutosPJ(supabase, userId);
    console.log(`📦 [PJ-WEBHOOK] Total produtos: ${todosProdutos.length}`);

    // Pré-filtrar produtos baseado na mensagem
    const produtosRelevantes = filtrarProdutosRelevantes(todosProdutos, messageText);
    
    // Formatar catálogo para a IA
    let catalogoMD = "";
    if (produtosRelevantes.length > 0) {
      catalogoMD = formatarCatalogoMD(produtosRelevantes);
      catalogoMD += `\n\n🚨 INSTRUÇÃO: Você TEM ${produtosRelevantes.length} produtos listados acima. ESCOLHA os melhores e MOSTRE com nome + preço + link!`;
    } else if (todosProdutos.length > 0) {
      // Mostrar amostra se não achou match específico
      catalogoMD = formatarCatalogoMD(todosProdutos.slice(0, 10));
      catalogoMD += `\n\nℹ️ Mostrando amostra do catálogo. Total: ${todosProdutos.length} produtos.`;
    } else {
      catalogoMD = "Nenhum produto cadastrado ainda.";
    }

    // Construir system prompt completo
    const systemPrompt = buildSystemPrompt(
      nomeAssistente,
      personalidade,
      nomeEmpresa,
      catalogoMD,
      historicoFormatado,
      todosProdutos.length
    );

    // Gerar resposta com IA
    console.log("🧠 [PJ-WEBHOOK] Gerando resposta IA...");
    const resposta = await generateAIResponse(
      messageText,
      conversationHistory,
      systemPrompt
    );

    // Verificar se é cumprimento simples (não deve oferecer produtos)
    const isCumprimento = /^(oi|ol[aá]|bom dia|boa tarde|boa noite|tudo bem|e a[ií]|fala|hey|hi|hello|salve|eai)[\s\?\!\.]*$/i.test(messageText.trim());
    
    // Garantia de venda: se cliente PEDIU produto, a IA achou mas não incluiu link, anexar bloco.
    // MAS NÃO FAZER ISSO EM CUMPRIMENTOS!
    let respostaFinal = resposta;
    const produtoPrincipal = produtosRelevantes?.[0];
    const clientePediuProduto = !isCumprimento && produtosRelevantes.length > 0;
    
    if (clientePediuProduto && produtoPrincipal && !hasPurchaseLink(respostaFinal)) {
      const link = resolveProductLink(produtoPrincipal);
      const preco = produtoPrincipal?.preco ? `R$ ${Number(produtoPrincipal.preco).toFixed(2)}` : null;
      
      // Formato estilo campanha
      let bloco = "\n\n🔥 *OFERTA ESPECIAL* 🔥\n";
      bloco += `📦 *${produtoPrincipal.nome}*\n`;
      if (preco) bloco += `💰 *${preco}*\n`;
      if (link) {
        bloco += `\n🛒 *Compre agora:*\n${link}\n`;
      } else {
        bloco += `\n💬 Para comprar, é só responder aqui!\n`;
      }
      
      respostaFinal = `${respostaFinal.trim()}${bloco}`;
    }

    console.log(`🤖 [PJ-WEBHOOK] Resposta: ${respostaFinal.substring(0, 80)}...`);

    // Salvar resposta no histórico
    await supabase.from("pj_conversas").insert({
      phone: cleanPhone,
      role: "assistant",
      content: respostaFinal,
    });

    // Adicionar texto à fila anti-bloqueio
    await inserirNaFilaPJ(supabase, cleanPhone, respostaFinal, wuzapiToken, userId, null, wuzapiUrl);

    // ═══════════════════════════════════════════════════════════════════════════
    // 🔊 TTS: GERAR E ENVIAR ÁUDIO (se habilitado para este usuário)
    // ═══════════════════════════════════════════════════════════════════════════
    const ttsAtivo = pjConfig?.tts_ativo === true;
    const ttsVoz = pjConfig?.tts_voz || 'roger';
    
    if (ttsAtivo) {
      console.log(`🔊 [PJ-WEBHOOK] TTS ativo! Gerando áudio com voz: ${ttsVoz}`);
      
      const audioBase64 = await gerarAudioTTS(supabaseUrl, supabaseKey, respostaFinal, ttsVoz);
      
      if (audioBase64) {
        await inserirAudioNaFilaPJ(supabase, cleanPhone, audioBase64, wuzapiToken, userId, wuzapiUrl);
        console.log(`🔊 [PJ-WEBHOOK] Áudio agendado para ${cleanPhone}`);
      } else {
        console.warn(`⚠️ [PJ-WEBHOOK] Falha ao gerar áudio TTS, enviando apenas texto`);
      }
    }

    // Enviar imagem APENAS se o cliente pediu produto (não em cumprimentos)
    if (clientePediuProduto && produtoPrincipal) {
      const img = resolveProductImage(produtoPrincipal);
      if (img) {
        console.log(`📷 [PJ-WEBHOOK] Enviando imagem: ${produtoPrincipal.nome}`);
        // Caption formatado estilo campanha
        const caption = `📦 *${produtoPrincipal.nome}*\n💰 R$ ${Number(produtoPrincipal.preco || 0).toFixed(2)}`;
        await inserirImagemNaFilaPJ(supabase, cleanPhone, img, caption, wuzapiToken, userId, wuzapiUrl);
      }
    }

    console.log(`📬 [PJ-WEBHOOK] Resposta agendada para ${cleanPhone}`);

    return new Response(
      JSON.stringify({
        success: true,
        phone: cleanPhone,
        responseQueued: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("❌ [PJ-WEBHOOK] Erro:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
