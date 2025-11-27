import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Inicializar Supabase no início
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Endpoint de teste GET
  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      status: 'online',
      timestamp: new Date().toISOString(),
      message: 'Webhook está funcionando! ✅'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  console.log('='.repeat(50));
  console.log('🔔 WEBHOOK CHAMADO!');
  console.log('Timestamp:', new Date().toISOString());
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let webhookData: any = {};
  let phoneNumber = '';
  let messageText = '';
  let processingResult = '';

  try {
    webhookData = await req.json();
    console.log('✅ [WEBHOOK] ========== EVENTO RECEBIDO ==========');
    console.log('[WEBHOOK] Payload completo:', JSON.stringify(webhookData, null, 2));
    console.log('[WEBHOOK] Payload keys:', Object.keys(webhookData));
    console.log('='.repeat(50));

    // ===== EXTRAÇÃO MULTI-FORMATO =====
    // Formato 1: event.Message.conversation (Wuzapi padrão)
    if (webhookData.event?.Message?.conversation) {
      messageText = webhookData.event.Message.conversation;
      phoneNumber = webhookData.event?.Info?.Chat || webhookData.event?.Info?.RemoteJid || '';
      console.log('📌 Formato detectado: event.Message.conversation');
    }
    
    // Formato 2: event.Message.extendedTextMessage (mensagem com link/citação)
    if (!messageText && webhookData.event?.Message?.extendedTextMessage?.text) {
      messageText = webhookData.event.Message.extendedTextMessage.text;
      phoneNumber = webhookData.event?.Info?.Chat || webhookData.event?.Info?.RemoteJid || '';
      console.log('📌 Formato detectado: event.Message.extendedTextMessage');
    }

    // Formato 3: data.body (formato alternativo)
    if (!messageText && webhookData.data?.body) {
      messageText = webhookData.data.body;
      phoneNumber = webhookData.data?.from || '';
      console.log('📌 Formato detectado: data.body');
    }

    // Formato 4: message.body
    if (!messageText && webhookData.message?.body) {
      messageText = webhookData.message.body;
      phoneNumber = webhookData.message?.from || '';
      console.log('📌 Formato detectado: message.body');
    }

    // Formato 5: text direto
    if (!messageText && webhookData.text) {
      messageText = webhookData.text;
      phoneNumber = webhookData.from || webhookData.phone || '';
      console.log('📌 Formato detectado: text direto');
    }

    // Formato 6: body direto
    if (!messageText && webhookData.body) {
      messageText = webhookData.body;
      phoneNumber = webhookData.from || webhookData.phone || webhookData.sender || '';
      console.log('📌 Formato detectado: body direto');
    }

    // Limpar telefone
    phoneNumber = phoneNumber
      .replace('@s.whatsapp.net', '')
      .replace('@c.us', '')
      .replace('@lid', '')
      .replace(/\D/g, '');

    // Adicionar código do país se necessário
    if (phoneNumber && !phoneNumber.startsWith('55') && phoneNumber.length === 11) {
      phoneNumber = '55' + phoneNumber;
    }

    console.log('📱 Telefone extraído:', phoneNumber);
    console.log('💬 Mensagem extraída:', messageText);

    // Verificar se é mensagem própria
    const isFromMe = webhookData.event?.Info?.IsFromMe || 
                     webhookData.event?.IsFromMe || 
                     webhookData.data?.fromMe ||
                     webhookData.fromMe;
    
    console.log('🤖 FromMe?:', isFromMe);

    // SALVAR LOG DE DEBUG (sempre salva o payload bruto)
    await supabaseClient.from('webhook_debug_logs').insert({
      payload: webhookData,
      extracted_phone: phoneNumber || 'NÃO EXTRAÍDO',
      extracted_message: messageText || 'NÃO EXTRAÍDA',
      processing_result: isFromMe ? 'IGNORADO: mensagem própria' : 'PROCESSANDO'
    });

    if (isFromMe === true) {
      console.log('[WEBHOOK] ❌ Ignorando: mensagem própria');
      return new Response(JSON.stringify({ status: 'ignored', reason: 'own message' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!phoneNumber || !messageText) {
      processingResult = `FALHOU: phone=${!phoneNumber}, message=${!messageText}, keys=${Object.keys(webhookData).join(',')}`;
      console.log('❌ PAROU AQUI - Motivo:');
      console.log('  - Mensagem vazia?', !messageText);
      console.log('  - Telefone vazio?', !phoneNumber);
      console.log('  - Payload keys:', Object.keys(webhookData));
      
      await supabaseClient.from('webhook_debug_logs')
        .update({ processing_result: processingResult })
        .eq('extracted_phone', 'NÃO EXTRAÍDO')
        .order('timestamp', { ascending: false })
        .limit(1);

      return new Response(JSON.stringify({ 
        status: 'error', 
        reason: 'incomplete data',
        payload_keys: Object.keys(webhookData)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[WEBHOOK] Nova mensagem de ${phoneNumber}: ${messageText}`);

    // BUSCAR CONTEXTO DO PRODUTO
    console.log('🔍 Buscando contexto para:', phoneNumber);
    
    const { data: contexto, error: ctxError } = await supabaseClient
      .from('whatsapp_conversations')
      .select('*')
      .eq('phone_number', phoneNumber)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log('📦 Contexto encontrado:', contexto ? 'SIM' : 'NÃO');
    console.log('📦 Erro:', ctxError);
    if (contexto) {
      console.log('📦 Dados:', JSON.stringify(contexto, null, 2));
    }

    if (ctxError || !contexto || !contexto.last_message_context) {
      console.log('[WEBHOOK] ❌ Sem contexto encontrado para este cliente');
      return new Response(JSON.stringify({ status: 'no_context' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const ctx = contexto.last_message_context;
    const origem = contexto.origem || 'campanha';
    console.log('[WEBHOOK] 📦 Origem:', origem);
    
    if (origem === 'campanha') {
      console.log('[WEBHOOK] 📦 Produto no contexto:', ctx.produto_nome);
    } else {
      console.log('[WEBHOOK] 🏢 Lead no contexto:', ctx.empresa || 'Prospecção');
    }

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
      .eq('phone', phoneNumber)
      .order('timestamp', { ascending: true })
      .limit(10);

    const conversationHistory = messageHistory
      ?.map(msg => `${msg.direction === 'received' ? 'Cliente' : ctx.vendedor_nome}: ${msg.message}`)
      .join('\n') || '';

    // PROMPT PARA IA (DIFERENTE POR ORIGEM)
    const promptIA = origem === 'campanha'
      ? `Você é ${ctx.vendedor_nome || 'vendedor'}.

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

RESPONDA (apenas a resposta, sem explicações):`
      : `Você é ${ctx.vendedor_nome || 'representante comercial'}.

CONTEXTO: Este é um lead de prospecção B2B/B2C.

LEAD:
- Empresa: ${ctx.empresa || 'N/A'}
- Cargo: ${ctx.cargo || 'N/A'}
- LinkedIn: ${ctx.linkedin_url || 'N/A'}
- Origem: ${ctx.origem_lead || 'Prospecção'}

HISTÓRICO DA CONVERSA:
${conversationHistory}

SUA MISSÃO:
1. QUALIFICAR o lead fazendo perguntas estratégicas
2. Identificar dores e necessidades
3. Apresentar soluções de forma consultiva
4. Agendar reunião se houver fit
5. Manter tom profissional e respeitoso

REGRAS:
- NÃO seja invasivo ou agressivo
- Faça perguntas abertas
- Escute ativamente as respostas
- Seja breve (máximo 3 linhas)
- Use 1-2 emojis profissionais

LEAD DISSE: "${messageText}"

RESPONDA (apenas a resposta, sem explicações):`;

    // CHAMAR LOVABLE AI (Gemini)
    console.log('🤖 Chamando IA...');
    console.log('Prompt:', promptIA.substring(0, 200) + '...');
    
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
    console.log('📤 Enviando para Wuzapi...');
    console.log('URL:', WUZAPI_URL);
    console.log('Token:', WUZAPI_TOKEN ? 'Configurado' : 'FALTANDO');
    
    const baseUrl = WUZAPI_URL.endsWith('/') ? WUZAPI_URL.slice(0, -1) : WUZAPI_URL;
    const wuzapiResponse = await fetch(`${baseUrl}/chat/send/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Token': WUZAPI_TOKEN,
      },
      body: JSON.stringify({
        Phone: phoneNumber,
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

    // SALVAR HISTÓRICO COM ORIGEM
    await supabaseClient.from('whatsapp_messages').insert([
      {
        user_id: contexto.user_id,
        phone: phoneNumber,
        direction: 'received',
        message: messageText,
        origem: origem
      },
      {
        user_id: contexto.user_id,
        phone: phoneNumber,
        direction: 'sent',
        message: aiMessage,
        origem: origem
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
        phone: phoneNumber,
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

    // Atualizar log com sucesso
    processingResult = `SUCESSO: IA respondeu "${aiMessage.substring(0, 50)}..."`;
    await supabaseClient.from('webhook_debug_logs')
      .update({ processing_result: processingResult })
      .eq('extracted_phone', phoneNumber)
      .order('timestamp', { ascending: false })
      .limit(1);

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
    
    // Salvar erro no log
    await supabaseClient.from('webhook_debug_logs').insert({
      payload: webhookData,
      extracted_phone: phoneNumber || 'ERRO',
      extracted_message: messageText || 'ERRO',
      processing_result: `ERRO: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    });

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});