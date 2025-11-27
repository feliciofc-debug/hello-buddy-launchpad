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
    
    // Tentar buscar contexto na tabela de conversas
    let { data: contexto, error: ctxError } = await supabaseClient
      .from('whatsapp_conversations')
      .select('*')
      .eq('phone_number', phoneNumber)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Se não encontrou, criar contexto baseado na última mensagem enviada
    if (!contexto) {
      console.log('[WEBHOOK] Buscando contexto na última mensagem enviada...');
      
      const { data: ultimaMensagem } = await supabaseClient
        .from('whatsapp_messages')
        .select('*')
        .eq('phone', phoneNumber)
        .eq('direction', 'sent')
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ultimaMensagem) {
        // Buscar produto da campanha mais recente
        const { data: campanhaRecente } = await supabaseClient
          .from('campanhas_recorrentes')
          .select('*, produtos(*)')
          .eq('user_id', ultimaMensagem.user_id)
          .order('ultima_execucao', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (campanhaRecente?.produtos) {
          const produto = campanhaRecente.produtos;
          
          // Criar contexto dinamicamente
          contexto = {
            user_id: ultimaMensagem.user_id,
            phone_number: phoneNumber,
            origem: 'campanha',
            metadata: {
              produto_nome: produto.nome,
              produto_descricao: produto.descricao,
              produto_preco: produto.preco,
              produto_estoque: produto.estoque,
              produto_especificacoes: produto.especificacoes,
              link_marketplace: produto.link_marketplace,
              vendedor_nome: 'Vendedor'
            }
          };
          
          console.log('[WEBHOOK] ✅ Contexto criado a partir da última campanha:', produto.nome);
        }
      }
    }

    console.log('📦 Contexto encontrado:', contexto ? 'SIM' : 'NÃO');

    if (!contexto) {
      console.log('[WEBHOOK] ❌ Sem contexto encontrado para este cliente');
      
      // Atualizar log de debug
      await supabaseClient.from('webhook_debug_logs')
        .update({ processing_result: 'SEM CONTEXTO: nenhuma campanha encontrada para este número' })
        .eq('extracted_phone', phoneNumber)
        .order('timestamp', { ascending: false })
        .limit(1);

      return new Response(JSON.stringify({ status: 'no_context' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Usar metadata como contexto (compatibilidade)
    const ctx = contexto.metadata || contexto.last_message_context || {
      produto_nome: 'Produto',
      produto_descricao: '',
      produto_preco: 0,
      vendedor_nome: 'Vendedor'
    };
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

    // PROMPT PARA IA - HUMANIZADO E DETALHADO
    const promptIA = origem === 'campanha'
      ? `Você é ${ctx.vendedor_nome || 'um vendedor'} especializado em ${ctx.produto_nome}.

INFORMAÇÕES COMPLETAS DO PRODUTO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Nome: ${ctx.produto_nome}
💰 Preço: R$ ${ctx.produto_preco}
📊 Estoque: ${ctx.produto_estoque || 'disponível'} unidades disponíveis
${ctx.produto_descricao ? `📝 Descrição: ${ctx.produto_descricao}` : ''}
${ctx.produto_especificacoes ? `⚙️ Especificações:\n${ctx.produto_especificacoes}` : ''}
🔗 Link de compra: ${ctx.link_marketplace || 'disponível'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HISTÓRICO DA CONVERSA:
${conversationHistory}

CLIENTE PERGUNTOU/DISSE:
"${messageText}"

SUAS INSTRUÇÕES DE RESPOSTA:
1. Responda como um VENDEDOR HUMANO experiente, não como um robô
2. Use linguagem NATURAL e INFORMAL (pode usar "vc", "tá", "pra", etc)
3. Seja ESPECÍFICO sobre o produto - mencione detalhes, qualidades, benefícios
4. Se perguntarem sobre:
   • ESTOQUE → Confirme que tem ${ctx.produto_estoque || 'unidades'} disponíveis
   • QUALIDADE → Fale dos diferenciais e especificações técnicas
   • PREÇO → Mencione o valor R$ ${ctx.produto_preco} e destaque o custo-benefício
   • ENTREGA → Diga que combina após a compra
   • PAGAMENTO → Envie o link e diga que aceita várias formas
5. Se cliente demonstrar INTERESSE FORTE (palavras: quero/comprar/pagar/reservar/fechar):
   → Envie o link diretamente: ${ctx.link_marketplace || 'Link de compra'}
   → Diga "Segue o link para finalizar! 😊"
6. Use 1-2 emojis relevantes (mas não exagere)
7. Mantenha tom ENTUSIASMADO mas não forçado
8. Seja BREVE (máximo 3-4 linhas)
9. Faça UMA pergunta no final para continuar conversa (ex: "Quer saber mais alguma coisa?")

IMPORTANTE: Seja VOCÊ MESMO, converse naturalmente como se estivesse no balcão da loja!

RESPONDA AGORA (APENAS A MENSAGEM PARA O CLIENTE):`
      : `Você é ${ctx.vendedor_nome || 'atendente'} da empresa.

HISTÓRICO DA CONVERSA:
${conversationHistory}

CLIENTE DISSE: "${messageText}"

Responda de forma:
- Natural e profissional
- Breve (2-3 linhas)
- Prestativa
- Faça uma pergunta para entender melhor a necessidade

RESPONDA AGORA:`;

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
    console.log('Instance ID:', WUZAPI_INSTANCE_ID);
    console.log('Telefone destino:', phoneNumber);
    console.log('Mensagem a enviar:', aiMessage);
    
    const baseUrl = WUZAPI_URL.endsWith('/') ? WUZAPI_URL.slice(0, -1) : WUZAPI_URL;
    
    // Tentar formato principal
    let wuzapiResponse = await fetch(`${baseUrl}/chat/send/text`, {
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

    let responseText = await wuzapiResponse.text();
    console.log('📤 Status formato 1:', wuzapiResponse.status);
    console.log('📤 Response formato 1:', responseText);

    // Se falhou, tentar formato alternativo
    if (!wuzapiResponse.ok) {
      console.log('⚠️ Tentando formato alternativo...');
      
      wuzapiResponse = await fetch(`${baseUrl}/send/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Token': WUZAPI_TOKEN,
        },
        body: JSON.stringify({
          phone: phoneNumber,
          message: aiMessage
        }),
      });

      responseText = await wuzapiResponse.text();
      console.log('📤 Status formato 2:', wuzapiResponse.status);
      console.log('📤 Response formato 2:', responseText);
    }

    if (!wuzapiResponse.ok) {
      console.error('[WEBHOOK] ❌ Erro ao enviar resposta - todos formatos falharam');
      // Não falha o webhook, apenas loga o erro
    } else {
      console.log('[WEBHOOK] ✅ Resposta enviada com sucesso!');
    }

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