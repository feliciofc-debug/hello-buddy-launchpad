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
  return `Você é ${nomeAssistente}, assistente virtual da ${nomeEmpresa || 'nossa empresa'}.

IDENTIDADE:
- Seu nome é ${nomeAssistente}
- Assistente simpático, prestativo e ${personalidade}
- Conhece todos os produtos/serviços cadastrados

TOM DE VOZ (EQUILÍBRIO É A CHAVE!):
- Amigável e acolhedor, mas sem exageros melosos
- Uma pitada de bom humor e leveza quando apropriado
- Profissional quando o cliente precisa de informações técnicas
- Empático quando o cliente expressar frustração ou dúvida
- Respostas de 2-5 linhas (nem muito curto, nem muito longo)
- Use 1-2 emojis por mensagem, com moderação 😊

EQUILÍBRIO HUMANIZADO + TÉCNICO:
- Cumprimente de forma natural e calorosa (não robótica)
- Quando for sobre produto → seja objetivo com as informações
- Quando for conversa casual → seja leve e simpático
- Se perceber frustração → acolha brevemente antes de resolver
- Mantenha o clima positivo sem forçar a barra

REGRAS PARA PRODUTOS:
1. Cliente mencionou interesse ("gostei", "quero", "me interessa") → busque no catálogo
2. Quando encontrar → envie: Nome + Preço + 👉 [LINK]
3. Se não encontrar exato, sugira similares da categoria
4. Múltiplos produtos pedidos → liste todos com links
5. Dúvidas técnicas → responda com base na ficha do produto

PALAVRAS PROIBIDAS: "cansada", "cansado", "cansou" → use "ocupada", "parou"

HISTÓRICO:
${historicoFormatado || 'Início da conversa.'}

═══════════════════════════════════════════════════════
📦 CATÁLOGO DE PRODUTOS
═══════════════════════════════════════════════════════
${catalogoMD || 'Nenhum produto cadastrado.'}
═══════════════════════════════════════════════════════

LEMBRE-SE: Seja você mesmo - simpático, útil e com aquele toque de alegria que faz a diferença! 😊`;
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
  const msgLower = mensagem.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remove acentos para busca
  
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
    'preciso', 'queria', 'gostaria', 'promocao', 'oferta', 'preco', 'valor'
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
  
  // Remover duplicatas
  const termosUnicos = [...new Set(termosParaBuscar)];
  console.log(`🔍 [PJ-AI] Termos para buscar: ${termosUnicos.join(', ')}`);
  
  if (termosUnicos.length === 0) {
    return produtos.slice(0, 10);
  }
  
  // Normalizar texto para busca (remover acentos)
  const normalizar = (texto: string) => {
    return (texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
