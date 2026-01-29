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

PERSONALIDADE:
- Simpático, educado, mas natural (não exagerado)
- Respostas CURTAS e diretas (máximo 3-4 linhas quando possível)
- Use emojis com moderação (1-2 por mensagem)
- Fale como um vendedor experiente e amigável
- NUNCA pareça robô ou use linguagem corporativa engessada
- Seja proativo e sempre ofereça ajuda adicional
- NUNCA use palavras como "cansada", "cansado", "cansou" - substitua por "ocupada", "parou"

REGRAS DE OURO PARA PRODUTOS:
1. Se o cliente perguntar sobre um produto → PROCURE NO CATÁLOGO ABAIXO
2. Quando encontrar o produto → SEMPRE inclua o link de compra
3. Formato obrigatório: Nome + Preço + 👉 [LINK]
4. NUNCA invente produtos - use APENAS os listados no catálogo
5. Se não encontrar o produto específico, sugira categorias similares
6. Sempre mencione os benefícios e diferenciais do produto

FLUXO DE ATENDIMENTO:
1. Saudação inicial → cumprimente e pergunte como pode ajudar
2. Cliente pergunta sobre produto → BUSQUE no catálogo e mostre
3. Dúvidas técnicas → responda com base nas especificações cadastradas
4. Cliente quer comprar → envie o link de compra
5. Pós-venda → agradeça e ofereça suporte adicional

HISTÓRICO DA CONVERSA:
${historicoFormatado || 'Início da conversa.'}

═══════════════════════════════════════════════════════
📦 CATÁLOGO DE PRODUTOS (USE ESTES DADOS!)
═══════════════════════════════════════════════════════
${catalogoMD || 'Nenhum produto cadastrado ainda.'}
═══════════════════════════════════════════════════════

INSTRUÇÃO OBRIGATÓRIA:
- Quando mencionar um produto, SEMPRE inclua o link de compra no formato: 👉 [LINK]
- Se o produto não tiver link cadastrado, diga que vai verificar disponibilidade`;
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
// PRÉ-FILTRAR PRODUTOS RELEVANTES (BUSCA SEMÂNTICA)
// ============================================
function filtrarProdutosRelevantes(produtos: any[], mensagem: string): any[] {
  const msgLower = mensagem.toLowerCase();
  
  // Extrair palavras-chave (ignorar palavras muito curtas e comuns)
  const stopWords = ['para', 'com', 'que', 'tem', 'uma', 'quero', 'preciso', 'voce', 'você', 'ola', 'olá', 'bom', 'boa', 'dia', 'tarde', 'noite'];
  const palavrasChave = msgLower
    .split(/\s+/)
    .filter(p => p.length >= 3)
    .filter(p => !stopWords.includes(p));
  
  console.log(`🔍 [PJ-AI] Palavras-chave: ${palavrasChave.join(', ')}`);
  
  if (palavrasChave.length === 0) {
    // Sem palavras-chave específicas, retornar amostra
    return produtos.slice(0, 10);
  }
  
  // Buscar por nome do produto
  const produtosComScore = produtos.map(p => {
    let score = 0;
    const nomeLower = (p.nome || '').toLowerCase();
    const descLower = (p.descricao || '').toLowerCase();
    const catLower = (p.categoria || '').toLowerCase();
    
    for (const palavra of palavrasChave) {
      // Match no nome = maior peso
      if (nomeLower.includes(palavra)) {
        score += 10;
        console.log(`✅ [MATCH] "${palavra}" em nome: ${p.nome?.slice(0, 50)}`);
      }
      // Match na descrição
      if (descLower.includes(palavra)) {
        score += 3;
      }
      // Match na categoria
      if (catLower.includes(palavra)) {
        score += 5;
      }
    }
    
    return { ...p, score };
  });
  
  // Filtrar e ordenar por score
  const relevantes = produtosComScore
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);
  
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
    console.log("📨 [PJ-WEBHOOK] Recebido:", JSON.stringify(body).substring(0, 300));

    // Extrair dados da mensagem
    const messageData = body?.data || body;
    const phone = messageData?.Info?.Sender || messageData?.from || messageData?.phone || "";
    const messageText = messageData?.Message?.Conversation || 
                       messageData?.Message?.ExtendedTextMessage?.Text ||
                       messageData?.message?.conversation ||
                       messageData?.body ||
                       messageData?.text || "";
    const messageId = messageData?.Info?.Id || messageData?.id || "";
    const isFromMe = messageData?.Info?.IsFromMe || messageData?.fromMe || false;
    const isGroup = phone?.includes("@g.us") || false;

    // Ignorar mensagens próprias e de grupos
    if (isFromMe || isGroup || !phone || !messageText) {
      console.log("⏭️ [PJ-WEBHOOK] Ignorando:", { isFromMe, isGroup, hasPhone: !!phone, hasText: !!messageText });
      return new Response(
        JSON.stringify({ success: true, ignored: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanPhone = phone.replace(/\D/g, "").replace("@s.whatsapp.net", "");
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
