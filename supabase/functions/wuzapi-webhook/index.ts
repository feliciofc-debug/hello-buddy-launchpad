import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookData = await req.json();
    console.log('[WEBHOOK] ========== EVENTO RECEBIDO ==========');
    console.log('[WEBHOOK] Type:', webhookData.type);
    console.log('[WEBHOOK] Payload completo:', JSON.stringify(webhookData, null, 2));

    // Extrair dados do evento
    const event = webhookData.event || {};
    
    // Ignorar mensagens do próprio bot
    if (event.IsFromMe) {
      console.log('[WEBHOOK] ❌ Ignorando: mensagem própria');
      return new Response(JSON.stringify({ status: 'ignored', reason: 'own message' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Tentar extrair mensagem de diferentes locais do payload
    let messageText = null;
    
    // Formato 1: webhookData.message.conversation
    if (webhookData.message?.conversation) {
      messageText = webhookData.message.conversation;
      console.log('[WEBHOOK] ✅ Mensagem encontrada em: message.conversation');
    }
    // Formato 2: webhookData.message.text
    else if (webhookData.message?.text) {
      messageText = webhookData.message.text;
      console.log('[WEBHOOK] ✅ Mensagem encontrada em: message.text');
    }
    // Formato 3: webhookData.text
    else if (webhookData.text) {
      messageText = webhookData.text;
      console.log('[WEBHOOK] ✅ Mensagem encontrada em: text');
    }
    // Formato 4: event.Body
    else if (event.Body) {
      messageText = event.Body;
      console.log('[WEBHOOK] ✅ Mensagem encontrada em: event.Body');
    }
    // Formato 5: Verificar se é ReadReceipt ou outro tipo sem mensagem
    else {
      console.log('[WEBHOOK] ❌ Ignorando: evento tipo', webhookData.type, '(sem texto)');
      return new Response(JSON.stringify({ status: 'ignored', reason: `no text in ${webhookData.type}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extrair número de telefone
    const phoneNumber = (event.Sender?.replace('@s.whatsapp.net', '') || 
                        event.Chat?.replace('@s.whatsapp.net', '') ||
                        event.From?.replace('@s.whatsapp.net', ''))?.replace(/\D/g, '');
    
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

    // Gerar resposta com IA
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('[WEBHOOK] LOVABLE_API_KEY não configurada');
      return new Response(JSON.stringify({ status: 'error', reason: 'API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar histórico de conversas com este número
    const { data: messageHistory } = await supabaseClient
      .from('whatsapp_messages_received')
      .select('message, created_at')
      .eq('phone_number', formattedPhone)
      .order('created_at', { ascending: true })
      .limit(10);

    // Montar contexto da conversa
    const conversationContext = messageHistory
      ?.map(msg => `Cliente: ${msg.message}`)
      .join('\n') || '';

    // Prompt para a IA
    const systemPrompt = `Você é um assistente de vendas inteligente via WhatsApp.

REGRAS IMPORTANTES:
- Seja simpático, profissional e direto
- Use emojis ocasionalmente (📱💡✨)
- Responda objeções com argumentos sólidos
- Ofereça produtos relevantes baseado no interesse do cliente
- Negocie preços quando necessário (desconto máximo: 15%)
- Conduza o cliente para a compra
- Seja breve (máx 3 linhas por resposta)

PRODUTOS DISPONÍVEIS:
1. Produto A - R$ 199,90 - Solução completa
2. Produto B - R$ 149,90 - Versão básica
3. Produto C - R$ 299,90 - Versão premium

HISTÓRICO DA CONVERSA:
${conversationContext}

MENSAGEM ATUAL:
${messageText}

Responda de forma natural e persuasiva:`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: messageText }
        ],
        temperature: 0.7,
        max_tokens: 200
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[WEBHOOK] Erro na IA:', errorText);
      throw new Error('Erro ao gerar resposta com IA');
    }

    const aiData = await aiResponse.json();
    const aiMessage = aiData.choices?.[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.';

    console.log('[WEBHOOK] Resposta da IA:', aiMessage);

    // Enviar resposta via Wuzapi
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

    console.log('[WEBHOOK] Resposta enviada com sucesso!');

    // Registrar resposta enviada
    await supabaseClient
      .from('whatsapp_messages_sent')
      .insert({
        phone_number: formattedPhone,
        message: aiMessage,
        in_response_to: messageId
      });

    return new Response(JSON.stringify({ 
      status: 'success', 
      message: 'Mensagem processada e respondida',
      aiResponse: aiMessage
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[WEBHOOK] Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
