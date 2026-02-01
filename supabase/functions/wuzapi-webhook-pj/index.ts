import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOCAWEB_WUZAPI_URL = Deno.env.get("WUZAPI_URL") || "https://wuzapi.amzofertas.com.br";

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
  historicoFormatado: string
): string {
  return `Você é ${nomeAssistente}, assistente virtual inteligente da empresa ${nomeEmpresa || 'nossa empresa'}.

IDENTIDADE:
- Seu nome é ${nomeAssistente} (sempre se apresente assim quando perguntarem)
- Você é um assistente prestativo, profissional e ${personalidade}
- Conhece TODOS os produtos/serviços cadastrados e pode responder perguntas técnicas
- Sua missão é ajudar o cliente a encontrar o que precisa e fechar vendas
- MAS ACIMA DE TUDO: você entende que negócios são sobre PESSOAS, não apenas vendas

PERSONALIDADE E INTELIGÊNCIA EMOCIONAL:
- Simpático, educado, mas acima de tudo HUMANO e ACOLHEDOR
- Você tem conhecimento de psicologia humanizada e sabe lidar com emoções
- Quando perceber que o cliente precisa de atenção, escuta ou apoio → PRIORIZE o acolhimento
- Valide as emoções do cliente antes de qualquer coisa ("entendo como você se sente...")
- Use linguagem empática e amorosa, tratando TODOS com carinho e respeito
- Respostas adaptadas: curtas quando for objetivo, mais longas quando precisar acolher
- Use emojis com carinho (💜 ❤️ 🤗 quando apropriado para momentos emocionais)

HABILIDADES DE APOIO EMOCIONAL:
- Se o cliente expressar ansiedade → ofereça técnicas de respiração (inspira 4s, segura 4s, solta 6s)
- Se o cliente estiver triste ou desanimado → acolha primeiro, ouça, depois ofereça perspectiva positiva
- Se o cliente estiver estressado → valide o sentimento e sugira pausas ou autocuidado
- Se o cliente só quiser conversar → esteja presente, sem pressa de vender nada
- Lembre-se: às vezes a pessoa só precisa ser ouvida e sentir que alguém se importa
- NUNCA julgue, minimize ou ignore as emoções do cliente

REGRAS DE OURO:
1. PESSOAS EM PRIMEIRO LUGAR - vendas são consequência de bons relacionamentos
2. Ouça ativamente e demonstre que entendeu antes de responder
3. Adapte seu tom: mais técnico para dúvidas de produto, mais carinhoso para momentos pessoais
4. Celebre as vitórias do cliente, por menores que sejam
5. Seja genuíno - você realmente se importa com o bem-estar de cada pessoa

REGRAS PARA PRODUTOS:
1. Se o cliente perguntar sobre um produto → PROCURE NO CATÁLOGO ABAIXO
2. Quando encontrar o produto → SEMPRE inclua o link de compra
3. Formato obrigatório: Nome + Preço + 👉 [LINK]
4. NUNCA invente produtos - use APENAS os listados no catálogo
5. Se não encontrar o produto específico, sugira categorias similares
6. Sempre mencione os benefícios e diferenciais do produto

FLUXO DE ATENDIMENTO:
1. Saudação inicial → cumprimente com calor humano
2. LEIA O TOM do cliente → precisa de ajuda prática ou emocional?
3. Se emocional → acolha, ouça, apoie com amor
4. Se prático → busque produtos, tire dúvidas, ajude na compra
5. Sempre encerre com carinho e deixando as portas abertas

PALAVRAS PROIBIDAS: "cansada", "cansado", "cansou" → substitua por "ocupada", "parou"

HISTÓRICO DA CONVERSA:
${historicoFormatado || 'Início da conversa.'}

═══════════════════════════════════════════════════════
📦 CATÁLOGO DE PRODUTOS (USE ESTES DADOS!)
═══════════════════════════════════════════════════════
${catalogoMD || 'Nenhum produto cadastrado ainda.'}
═══════════════════════════════════════════════════════

INSTRUÇÃO FINAL:
- Quando mencionar um produto, SEMPRE inclua o link de compra no formato: 👉 [LINK]
- Se o produto não tiver link cadastrado, diga que vai verificar disponibilidade
- LEMBRE-SE: No final, tudo é sobre PESSOAS. Trate cada cliente como um ser humano valioso 💜`;
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
// FORMATAR CATÁLOGO PARA A IA (MARKDOWN)
// ============================================
function formatarCatalogoMD(produtos: any[]): string {
  if (!produtos || produtos.length === 0) {
    return 'Nenhum produto cadastrado ainda.';
  }
  
  return produtos.map((p, i) => {
    let md = `### [PRODUTO ${i + 1}] ${p.nome}\n`;
    
    // Informações básicas
    md += `**Categoria:** ${p.categoria || 'Não informada'}\n`;
    md += `**Preço:** R$ ${Number(p.preco || 0).toFixed(2)}\n`;
    if (p.sku) md += `**SKU:** ${p.sku}\n`;
    
    // Estoque
    const estoque = p.estoque || 0;
    if (estoque > 10) {
      md += `**Estoque:** ✅ Disponível\n`;
    } else if (estoque > 0) {
      md += `**Estoque:** ⚠️ Últimas ${estoque} unidades!\n`;
    } else {
      md += `**Estoque:** ❌ Esgotado\n`;
    }
    
    // LINK (CRÍTICO!)
    const link = p.link_marketplace || p.link;
    if (link) {
      md += `**🔗 LINK DE COMPRA:** ${link}\n`;
    } else {
      md += `**🔗 LINK:** Não cadastrado\n`;
    }
    
    // Descrição
    if (p.descricao) {
      md += `**Descrição:** ${p.descricao.substring(0, 300)}${p.descricao.length > 300 ? '...' : ''}\n`;
    }
    
    // Detalhes técnicos
    if (p.ficha_tecnica) {
      md += `**Ficha Técnica:** ${p.ficha_tecnica.substring(0, 300)}${p.ficha_tecnica.length > 300 ? '...' : ''}\n`;
    }
    
    if (p.especificacoes) {
      md += `**Especificações:** ${p.especificacoes.substring(0, 200)}${p.especificacoes.length > 200 ? '...' : ''}\n`;
    }
    
    if (p.modo_uso) {
      md += `**Modo de Uso:** ${p.modo_uso.substring(0, 200)}\n`;
    }
    
    if (p.beneficios) {
      md += `**Benefícios:** ${p.beneficios.substring(0, 200)}\n`;
    }
    
    if (p.garantia) {
      md += `**Garantia:** ${p.garantia}\n`;
    }
    
    if (p.brand) {
      md += `**Marca:** ${p.brand}\n`;
    }
    
    md += `---\n`;
    
    return md;
  }).join('\n');
}

// ============================================
// PRÉ-FILTRAR PRODUTOS RELEVANTES (BUSCA MULTI-PRODUTO)
// ============================================
function filtrarProdutosRelevantes(produtos: any[], mensagem: string): any[] {
  const msgLower = mensagem.toLowerCase();
  
  // Stop words expandida
  const stopWords = [
    'para', 'com', 'que', 'tem', 'uma', 'um', 'quero', 'preciso', 'voce', 'você', 
    'ola', 'olá', 'bom', 'boa', 'dia', 'tarde', 'noite', 'por', 'favor', 'obrigado',
    'obrigada', 'muito', 'bem', 'mal', 'sim', 'nao', 'não', 'esse', 'essa', 'este',
    'esta', 'aqui', 'ali', 'onde', 'como', 'quando', 'porque', 'qual', 'quais',
    'meu', 'minha', 'seu', 'sua', 'nos', 'vcs', 'vocês', 'tem', 'ter', 'temos',
    'tenho', 'sobre', 'mais', 'menos', 'tambem', 'também', 'ainda', 'agora',
    'depois', 'antes', 'hoje', 'amanha', 'ontem', 'sempre', 'nunca', 'talvez',
    'ver', 'olhar', 'saber', 'posso', 'pode', 'podem', 'podemos', 'queria',
    'gostaria', 'favor', 'certeza', 'certo', 'errado', 'bom', 'ruim'
  ];
  
  // Detectar se é pedido de múltiplos produtos (usando "e", ",", "/", etc.)
  // Exemplos: "feijão e farinha", "arroz, feijão e macarrão", "leite/queijo"
  const separadores = /\s+e\s+|,\s*|\/|\s+ou\s+/g;
  const partes = msgLower.split(separadores).map(p => p.trim()).filter(p => p.length > 0);
  
  console.log(`🔍 [PJ-AI] Partes detectadas: ${partes.join(' | ')}`);
  
  // Se detectou múltiplas partes, buscar cada uma separadamente
  const termosParaBuscar: string[] = [];
  
  if (partes.length > 1) {
    // Múltiplos produtos - extrair termo principal de cada parte
    for (const parte of partes) {
      const palavras = parte.split(/\s+/).filter(p => p.length >= 3 && !stopWords.includes(p));
      if (palavras.length > 0) {
        // Pegar a palavra mais relevante (geralmente a última substantivo)
        termosParaBuscar.push(...palavras);
      }
    }
  } else {
    // Pedido único - extrair todas as palavras-chave
    const palavras = msgLower.split(/\s+/).filter(p => p.length >= 3 && !stopWords.includes(p));
    termosParaBuscar.push(...palavras);
  }
  
  // Remover duplicatas
  const termosUnicos = [...new Set(termosParaBuscar)];
  console.log(`🔍 [PJ-AI] Termos para buscar: ${termosUnicos.join(', ')}`);
  
  if (termosUnicos.length === 0) {
    return produtos.slice(0, 10);
  }
  
  // Buscar produtos que contenham QUALQUER um dos termos
  // Cada produto recebe score baseado em quantos termos ele atende
  const produtosComScore = produtos.map(p => {
    let score = 0;
    const termosEncontrados: string[] = [];
    const nomeLower = (p.nome || '').toLowerCase();
    const descLower = (p.descricao || '').toLowerCase();
    const catLower = (p.categoria || '').toLowerCase();
    
    for (const termo of termosUnicos) {
      let matchFound = false;
      
      // Match no nome = maior peso
      if (nomeLower.includes(termo)) {
        score += 15;
        matchFound = true;
      }
      // Match na descrição
      if (descLower.includes(termo)) {
        score += 5;
        matchFound = true;
      }
      // Match na categoria
      if (catLower.includes(termo)) {
        score += 8;
        matchFound = true;
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
  leadName?: string | null
) {
  const cleanPhone = phone.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
  
  // Delay aleatório entre 3-8 segundos
  const delayMs = Math.floor(Math.random() * 5000) + 3000;
  const scheduledAt = new Date(Date.now() + delayMs);
  
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
      user_id: userId,
      scheduled_at: scheduledAt.toISOString()
    });
  
  if (error) {
    console.error('❌ [PJ-FILA] Erro:', error);
    return false;
  }
  
  console.log(`✅ [PJ-FILA] Mensagem agendada para ${formattedPhone}`);
  return true;
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
    const messageText =
      msg?.Conversation ||
      msg?.conversation ||
      msg?.ExtendedTextMessage?.Text ||
      msg?.extendedTextMessage?.text ||
      messageData?.body ||
      messageData?.text ||
      "";

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
    if (isFromMe || isGroup || senderInvalid || !messageText) {
      console.log("⏭️ [PJ-WEBHOOK] Ignorando:", {
        isFromMe,
        isGroup,
        senderInvalid,
        hasText: !!messageText,
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

    // Buscar configuração do assistente PJ
    const { data: pjConfig } = await supabase
      .from("pj_clientes_config")
      .select("*")
      .limit(1)
      .maybeSingle();

    const nomeAssistente = pjConfig?.nome_assistente || "Assistente Virtual";
    const personalidade = pjConfig?.personalidade_assistente || "profissional e prestativo";
    const userId = pjConfig?.user_id;
    const wuzapiToken = pjConfig?.wuzapi_token;
    
    console.log(`👤 [PJ-WEBHOOK] Config: ${nomeAssistente}, user: ${userId?.slice(0, 8)}...`);

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
      historicoFormatado
    );

    // Gerar resposta com IA
    console.log("🧠 [PJ-WEBHOOK] Gerando resposta IA...");
    const resposta = await generateAIResponse(
      messageText,
      conversationHistory,
      systemPrompt
    );

    console.log(`🤖 [PJ-WEBHOOK] Resposta: ${resposta.substring(0, 80)}...`);

    // Salvar resposta no histórico
    await supabase.from("pj_conversas").insert({
      phone: cleanPhone,
      role: "assistant",
      content: resposta,
    });

    // Adicionar à fila anti-bloqueio
    await inserirNaFilaPJ(supabase, cleanPhone, resposta, wuzapiToken, userId);

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
