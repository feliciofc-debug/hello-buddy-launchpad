import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀 [WEBHOOK] Chamada recebida!');
  
  if (req.method === 'OPTIONS') {
    console.log('[WEBHOOK] OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookData = await req.json();
    console.log('✅ [WEBHOOK] ========== EVENTO RECEBIDO ==========');
    console.log('[WEBHOOK] Method:', req.method);
    console.log('[WEBHOOK] Type:', webhookData.type);
    console.log('[WEBHOOK] Payload completo:', JSON.stringify(webhookData, null, 2));

    // Extrair dados básicos do evento
    const message = webhookData.message || {};
    const event = webhookData.event || {};
    
    // Ignorar mensagens próprias
    if (event.IsFromMe === true) {
      console.log('[WEBHOOK] ❌ Ignorando: mensagem própria');
      return new Response(JSON.stringify({ status: 'ignored', reason: 'own message' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extrair mensagem de texto
    let messageText = message.conversation || 
                      message.extendedTextMessage?.text ||
                      webhookData.text || 
                      event.Body || 
                      '';
    
    console.log('[WEBHOOK] Mensagem extraída:', messageText);
    
    // Extrair telefone
    const phoneNumber = (event.Sender?.replace('@s.whatsapp.net', '') || 
                        event.Chat?.replace('@s.whatsapp.net', '') ||
                        event.From?.replace('@s.whatsapp.net', ''))?.replace(/\D/g, '');
    
    console.log('[WEBHOOK] Telefone:', phoneNumber);
    
    const messageId = webhookData.messageID || webhookData.userID || event.MessageID;
    
    if (!phoneNumber || !messageText) {
      console.log('[WEBHOOK] ❌ Dados incompletos - Phone:', phoneNumber, 'Text:', messageText);
      return new Response(JSON.stringify({ status: 'ignored', reason: 'incomplete data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Garantir que o número tem código de país
    let formattedPhone = phoneNumber;
    if (formattedPhone && !formattedPhone.startsWith('55') && formattedPhone.length === 11) {
      formattedPhone = '55' + formattedPhone;
    }

    console.log(`[WEBHOOK] Nova mensagem de ${formattedPhone}: ${messageText}`);

    // Inicializar Supabase
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Registrar mensagem recebida
    await supabaseClient
      .from('whatsapp_messages_received')
      .insert({
        phone_number: formattedPhone,
        message: messageText,
        message_id: messageId,
        raw_data: webhookData
      });

    // BUSCAR CONTEXTO DO PRODUTO
    const { data: contexto, error: ctxError } = await supabaseClient
      .from('whatsapp_conversations')
      .select(`
        *,
        users!inner (
          id,
          email,
          user_metadata
        )
      `)
      .eq('phone_number', formattedPhone)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ctxError || !contexto || !contexto.last_message_context) {
      console.log('[WEBHOOK] ❌ Sem contexto encontrado para este cliente');
      return new Response(JSON.stringify({ status: 'no_context' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const ctx = contexto.last_message_context;
    console.log('[WEBHOOK] 📦 Produto no contexto:', ctx.produto_nome);

    // BUSCAR CREDENCIAIS WUZAPI
    const WUZAPI_URL = Deno.env.get('WUZAPI_URL');
    const WUZAPI_TOKEN = Deno.env.get('WUZAPI_TOKEN');
    const WUZAPI_INSTANCE_ID = Deno.env.get('WUZAPI_INSTANCE_ID');

    if (!WUZAPI_URL || !WUZAPI_TOKEN || !WUZAPI_INSTANCE_ID) {
      console.error('[WEBHOOK] Credenciais Wuzapi não configuradas');
      return new Response(JSON.stringify({ status: 'error', reason: 'Wuzapi not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // BUSCAR HISTÓRICO DE CONVERSA
    const { data: messageHistory } = await supabaseClient
      .from('whatsapp_messages')
      .select('direction, message, timestamp')
      .eq('user_id', contexto.user_id)
      .eq('phone', formattedPhone)
      .order('timestamp', { ascending: true })
      .limit(10);

    const conversationHistory = messageHistory
      ?.map(msg => `${msg.direction === 'received' ? 'Cliente' : ctx.vendedor_nome}: ${msg.message}`)
      .join('\n') || '';

    // PROMPT PARA IA
    const promptIA = `Você é ${ctx.vendedor_nome || 'vendedor'}.

CONTEXTO: Você enviou oferta do produto "${ctx.produto_nome}" para este cliente.

PRODUTO:
- Nome: ${ctx.produto_nome}
- Descrição: ${ctx.produto_descricao}
- Preço: R$ ${ctx.produto_preco}
- Estoque: ${ctx.produto_estoque} unidades
${ctx.produto_especificacoes ? `- Especificações: ${ctx.produto_especificacoes}` : ''}
- Link para compra: ${ctx.link_marketplace}

HISTÓRICO DA CONVERSA:
${conversationHistory}

SUA MISSÃO:
1. Responda de forma HUMANIZADA e NATURAL
2. Ajude o cliente com dúvidas sobre o produto
3. Negocie de forma amigável
4. Se cliente demonstrar INTERESSE FORTE, envie o link: ${ctx.link_marketplace}
5. Informe disponibilidade de estoque quando perguntado
6. Seja profissional mas amigável

REGRAS:
- NÃO invente informações que não estão no contexto
- Se não souber algo, seja honesto
- Use 1-2 emojis por mensagem
- Mantenha tom profissional mas amigável
- Seja breve (máximo 3 linhas)

CLIENTE DISSE: "${messageText}"

RESPONDA (apenas a resposta, sem explicações):`;

    // CHAMAR LOVABLE AI (Gemini)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('[WEBHOOK] LOVABLE_API_KEY não configurada');
      return new Response(JSON.stringify({ status: 'error', reason: 'API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: promptIA }
        ],
        temperature: 0.7,
        max_tokens: 300
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[WEBHOOK] Erro na IA:', errorText);
      throw new Error('Erro ao gerar resposta com IA');
    }

    const aiData = await aiResponse.json();
    const aiMessage = aiData.choices?.[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.';

    console.log('[WEBHOOK] 🤖 Resposta da IA:', aiMessage);

    // ENVIAR RESPOSTA VIA WUZAPI
    const baseUrl = WUZAPI_URL.endsWith('/') ? WUZAPI_URL.slice(0, -1) : WUZAPI_URL;
    const wuzapiResponse = await fetch(`${baseUrl}/chat/send/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Token': WUZAPI_TOKEN,
      },
      body: JSON.stringify({
        Phone: formattedPhone,
        Body: aiMessage,
        Id: WUZAPI_INSTANCE_ID
      }),
    });

    if (!wuzapiResponse.ok) {
      const errorData = await wuzapiResponse.json();
      console.error('[WEBHOOK] Erro ao enviar resposta:', errorData);
      throw new Error('Erro ao enviar resposta via WhatsApp');
    }

    console.log('[WEBHOOK] ✅ Resposta enviada com sucesso!');

    // SALVAR HISTÓRICO
    await supabaseClient.from('whatsapp_messages').insert([
      {
        user_id: contexto.user_id,
        phone: formattedPhone,
        direction: 'received',
        message: messageText
      },
      {
        user_id: contexto.user_id,
        phone: formattedPhone,
        direction: 'sent',
        message: aiMessage
      }
    ]);

    // DETECTAR LEAD QUENTE (palavras-chave de interesse)
    const palavrasInteresse = [
      'quero', 'comprar', 'vou comprar', 'pagar', 'pix',
      'link', 'fechado', 'aceita', 'quanto', 'beleza',
      'sim', 'ok', 'vou', 'me manda', 'envia'
    ];

    const temInteresse = palavrasInteresse.some(p => 
      messageText.toLowerCase().includes(p)
    );

    if (temInteresse) {
      console.log('[WEBHOOK] 🔥 LEAD QUENTE DETECTADO!');
      
      await supabaseClient.from('lead_notifications').insert({
        user_id: contexto.user_id,
        phone: formattedPhone,
        produto_nome: ctx.produto_nome,
        mensagem_cliente: messageText,
        status: 'quente'
      });
    }

    return new Response(JSON.stringify({ 
      status: 'success', 
      message: 'Mensagem processada e respondida',
      aiResponse: aiMessage,
      leadQuente: temInteresse
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[WEBHOOK] ❌ Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});