import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FRASES_ROBOTICAS = [
  'fico feliz', 'agradeço', 'é um prazer', 'gostaria de', 'certamente',
  'com toda certeza', 'é importante ressaltar', 'vale mencionar', 
  'posso ajudar', 'estou à disposição', 'não hesite', 'fique à vontade'
];

const EXEMPLOS_SEGMENTO: Record<string, string> = {
  'alimentos-bebidas': `"Bom dia!" → "E aí! Viu o produto? Preço top hoje 😊"\n"Quanto?" → "R$ XX! Fresquinho, chegou agora"\n"Tem?" → "Tenho sim! Pronta entrega"`,
  'eletronicos-informatica': `"Bom dia!" → "Opa! Esse produto é muito bom 💻"\n"Quanto?" → "R$ XX! Top de linha"\n"Tem?" → "Tenho! Lacrado"`,
  'outros': `"Bom dia!" → "Opa! Tudo bem? 😊"\n"Quanto?" → "R$ XX!"\n"Tem?" → "Tenho sim!"`
};

serve(async (req) => {
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      status: 'online',
      timestamp: new Date().toISOString(),
      message: 'Webhook v3.0 com debug completo ✅'
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  console.log('═══════════════════════════════════════');
  console.log('🔔 WEBHOOK v3.0 - DEBUG COMPLETO');
  console.log('═══════════════════════════════════════');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let webhookData: any = {};
  let phoneNumber = '';
  let messageText = '';

  try {
    webhookData = await req.json();
    
    // ═══════════════════════════════════════
    // 🚫 FILTRAR TIPOS DE EVENTO - MUITO IMPORTANTE!
    // ═══════════════════════════════════════
    const eventType = webhookData.type || '';
    
    // IGNORAR eventos que não são mensagens
    if (eventType === 'ReadReceipt' || eventType === 'ChatPresence' || eventType === 'HistorySync') {
      console.log(`⏭️ Ignorando evento tipo: ${eventType}`);
      return new Response(JSON.stringify({ status: 'ignored', reason: `event_type_${eventType}` }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    // SÓ PROCESSAR tipo "Message"
    if (eventType && eventType !== 'Message') {
      console.log(`⏭️ Ignorando tipo desconhecido: ${eventType}`);
      return new Response(JSON.stringify({ status: 'ignored', reason: 'not_message_type' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    console.log('📥 Payload (tipo Message):', JSON.stringify(webhookData, null, 2));

    // EXTRAÇÃO MULTI-FORMATO
    // CORREÇÃO: Quando Chat termina com @lid, usar SenderAlt para pegar telefone real
    if (webhookData.event?.Message?.conversation) {
      messageText = webhookData.event.Message.conversation;
      const chat = webhookData.event?.Info?.Chat || '';
      // Se é um ID de lista (@lid), pegar o telefone real de SenderAlt
      if (chat.endsWith('@lid')) {
        phoneNumber = webhookData.event?.Info?.SenderAlt || webhookData.event?.Info?.Sender || chat;
      } else {
        phoneNumber = chat || webhookData.event?.Info?.RemoteJid || '';
      }
    }
    if (!messageText && webhookData.event?.Message?.extendedTextMessage?.text) {
      messageText = webhookData.event.Message.extendedTextMessage.text;
      const chat = webhookData.event?.Info?.Chat || '';
      if (chat.endsWith('@lid')) {
        phoneNumber = webhookData.event?.Info?.SenderAlt || webhookData.event?.Info?.Sender || chat;
      } else {
        phoneNumber = chat || webhookData.event?.Info?.RemoteJid || '';
      }
    }
    if (!messageText && webhookData.data?.body) {
      messageText = webhookData.data.body;
      phoneNumber = webhookData.data?.from || '';
    }
    if (!messageText && webhookData.message?.body) {
      messageText = webhookData.message.body;
      phoneNumber = webhookData.message?.from || '';
    }
    if (!messageText && webhookData.text) {
      messageText = webhookData.text;
      phoneNumber = webhookData.from || webhookData.phone || '';
    }
    if (!messageText && webhookData.body) {
      messageText = webhookData.body;
      phoneNumber = webhookData.from || webhookData.phone || webhookData.sender || '';
    }

    phoneNumber = phoneNumber.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@lid', '').replace(/\D/g, '');
    if (phoneNumber && !phoneNumber.startsWith('55') && phoneNumber.length === 11) {
      phoneNumber = '55' + phoneNumber;
    }

    console.log('📱 Telefone:', phoneNumber);
    console.log('💬 Mensagem:', messageText);

    const isFromMe = webhookData.event?.Info?.IsFromMe || webhookData.event?.IsFromMe || webhookData.data?.fromMe || webhookData.fromMe;

    await supabaseClient.from('webhook_debug_logs').insert({
      payload: webhookData,
      extracted_phone: phoneNumber || 'NÃO EXTRAÍDO',
      extracted_message: messageText || 'NÃO EXTRAÍDA',
      processing_result: isFromMe ? 'IGNORADO_PROPRIA' : 'PROCESSANDO'
    });

    if (isFromMe === true) {
      console.log('❌ Ignorando: própria');
      return new Response(JSON.stringify({ status: 'ignored' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!phoneNumber || !messageText) {
      console.log('❌ Dados incompletos');
      return new Response(JSON.stringify({ status: 'incomplete' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // BUSCAR OU CRIAR CONVERSA
    let { data: contexto } = await supabaseClient
      .from('whatsapp_conversations')
      .select('*')
      .eq('phone_number', phoneNumber)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let userId = contexto?.user_id;
    let produtoInfo: any = null;

    // Se não existe conversa, buscar por mensagens anteriores ou criar nova
    if (!contexto) {
      console.log('📱 Conversa não existe, buscando contexto...');
      
      const { data: ultimaMensagem } = await supabaseClient
        .from('whatsapp_messages')
        .select('*')
        .eq('phone', phoneNumber)
        .eq('direction', 'sent')
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ultimaMensagem) {
        userId = ultimaMensagem.user_id;
        
        const { data: campanhaRecente } = await supabaseClient
          .from('campanhas_recorrentes')
          .select('*, produtos(*)')
          .eq('user_id', ultimaMensagem.user_id)
          .order('ultima_execucao', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (campanhaRecente?.produtos) {
          produtoInfo = campanhaRecente.produtos;
        }
      }

      // Criar nova conversa se temos um user_id
      if (userId) {
        console.log('➕ Criando nova conversa para user_id:', userId);
        
        const pushName = webhookData.event?.Info?.PushName || null;
        
        const { data: novaConversa, error: erroCriar } = await supabaseClient
          .from('whatsapp_conversations')
          .insert({
            user_id: userId,
            phone_number: phoneNumber,
            contact_name: pushName,
            tipo_contato: 'lead',
            origem: 'campanha',
            modo_atendimento: 'ia',
            last_message_at: new Date().toISOString(),
            metadata: produtoInfo ? {
              produto_nome: produtoInfo.nome,
              produto_descricao: produtoInfo.descricao,
              produto_preco: produtoInfo.preco,
              produto_estoque: produtoInfo.estoque,
              link_marketplace: produtoInfo.link_marketplace,
            } : {}
          })
          .select()
          .single();

        if (erroCriar) {
          console.error('❌ Erro ao criar conversa:', erroCriar);
        } else {
          console.log('✅ Nova conversa criada:', novaConversa?.id);
          contexto = novaConversa;
        }
      }
    }

    if (!contexto) {
      console.log('❌ Sem contexto e sem como criar');
      return new Response(JSON.stringify({ status: 'no_context' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══════════════════════════════════════
    // 🔒 VERIFICAR MODO DE ATENDIMENTO
    // ═══════════════════════════════════════
    const modoAtendimento = contexto.modo_atendimento || 'ia';
    console.log('📋 Modo de atendimento:', modoAtendimento);
    
    if (modoAtendimento === 'humano') {
      console.log('🚫 Conversa em modo HUMANO - IA não vai responder');
      
      // Salvar mensagem recebida mas NÃO responder
      await supabaseClient.from('whatsapp_conversation_messages').insert({
        conversation_id: contexto.id,
        role: 'user',
        content: messageText
      });
      
      // Atualizar última mensagem da conversa
      await supabaseClient
        .from('whatsapp_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', contexto.id);
      
      return new Response(JSON.stringify({ 
        success: true, 
        modo: 'humano',
        message: 'Mensagem salva, humano atendendo' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('🤖 Modo IA - IA vai responder');

    let ctx = contexto.metadata || contexto.last_message_context || {};
    const origem = contexto.origem || 'campanha';

    // ═══════════════════════════════════════
    // 🔍 SE NÃO TEM DADOS DO PRODUTO, BUSCAR DA ÚLTIMA CAMPANHA
    // ═══════════════════════════════════════
    if (!ctx.produto_nome || !ctx.produto_preco) {
      console.log('⚠️ Contexto sem dados de produto, buscando da última campanha...');
      
      // Buscar última campanha enviada para este telefone
      const { data: ultimaCampanha } = await supabaseClient
        .from('campanhas_recorrentes')
        .select('*, produtos(*)')
        .eq('user_id', contexto.user_id)
        .order('ultima_execucao', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ultimaCampanha?.produtos) {
        const prod = ultimaCampanha.produtos;
        console.log('✅ Produto encontrado:', prod.nome, '- R$', prod.preco);
        
        // IMPORTANTE: spread ctx PRIMEIRO, depois os novos valores sobrescrevem
        ctx = {
          ...ctx,
          produto_nome: prod.nome,
          produto_descricao: prod.descricao,
          produto_preco: prod.preco,
          produto_estoque: prod.estoque,
          produto_especificacoes: prod.especificacoes,
          link_marketplace: prod.link_marketplace
        };

        // Atualizar o contexto na conversa para próximas mensagens
        await supabaseClient
          .from('whatsapp_conversations')
          .update({ metadata: ctx })
          .eq('id', contexto.id);
      } else {
        console.log('⚠️ Nenhum produto encontrado nas campanhas');
      }
    }

    // BUSCAR SEGMENTO
    const { data: empresaConfig } = await supabaseClient
      .from('empresa_config')
      .select('segmento')
      .eq('user_id', contexto.user_id)
      .maybeSingle();

    const segmentoId = empresaConfig?.segmento || 'outros';

    // BUSCAR HISTÓRICO
    const { data: historico } = await supabaseClient
      .from('whatsapp_messages')
      .select('direction, message')
      .eq('phone', phoneNumber)
      .eq('user_id', contexto.user_id)
      .order('timestamp', { ascending: false })
      .limit(3);

    let historicoTexto = '';
    if (historico && historico.length > 0) {
      historicoTexto = '\n━━ CONVERSA ━━\n';
      historico.reverse().forEach(msg => {
        historicoTexto += `${msg.direction === 'received' ? '👤' : '🤖'}: ${msg.message}\n`;
      });
    }

    // LÓGICA DE ESTOQUE
    const estoque = ctx.produto_estoque || 0;
    const temEstoque = estoque > 0;
    const estoqueBaixo = estoque > 0 && estoque <= 10;

    let infoEstoque = !temEstoque 
      ? 'SEM ESTOQUE - diga que acabou' 
      : estoqueBaixo 
        ? `POUCO (${estoque}) - pode criar urgência` 
        : 'TEM - diga "tenho sim", nunca quantidade';

    // PREPARAR DADOS DO PRODUTO COM FALLBACKS
    const produtoNome = ctx.produto_nome || 'Produto';
    const produtoPreco = ctx.produto_preco ? `R$ ${Number(ctx.produto_preco).toFixed(2)}` : 'consulte';
    const produtoDescricao = ctx.produto_descricao || '';
    const produtoEspecs = ctx.produto_especificacoes || '';

    console.log('📦 Dados do produto para IA:', { produtoNome, produtoPreco, produtoDescricao });

    // PROMPT HUMANIZADO
    const promptIA = `Você é vendedor WhatsApp. MÁXIMO 2 LINHAS.

📦 ${produtoNome} - ${produtoPreco}
${produtoDescricao}
${produtoEspecs ? `Especificações: ${produtoEspecs}` : ''}

📊 ESTOQUE: ${infoEstoque}
${historicoTexto}

💬 CLIENTE: "${messageText}"

REGRAS:
1. MÁXIMO 2 LINHAS
2. Linguagem informal natural: "vc", "pra", "blz", "show"
3. NÃO use "tá?" no final das frases - varie a linguagem!
4. NUNCA "Fico feliz", "Agradeço"
5. 1 emoji só
6. Se quer comprar → link: ${ctx.link_marketplace || '[link]'}

${EXEMPLOS_SEGMENTO[segmentoId] || EXEMPLOS_SEGMENTO['outros']}

RESPONDA (curto e humano, sem repetir "tá"):`;

    console.log('🤖 Chamando IA...');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const WUZAPI_URL = Deno.env.get('WUZAPI_URL');
    const WUZAPI_TOKEN = Deno.env.get('WUZAPI_TOKEN');
    const WUZAPI_INSTANCE_ID = Deno.env.get('WUZAPI_INSTANCE_ID');

    if (!LOVABLE_API_KEY || !WUZAPI_URL || !WUZAPI_TOKEN) {
      console.error('❌ Credenciais faltando');
      return new Response(JSON.stringify({ status: 'missing_credentials' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: promptIA }],
        max_tokens: 100,
        temperature: 0.8
      }),
    });

    const aiData = await aiResponse.json();
    let respostaIA = aiData.choices?.[0]?.message?.content || 'Opa, pode repetir?';

    // LIMPAR RESPOSTA
    const linhas = respostaIA.split('\n').filter((l: string) => l.trim());
    if (linhas.length > 2) respostaIA = linhas.slice(0, 2).join('\n');
    
    FRASES_ROBOTICAS.forEach(f => { respostaIA = respostaIA.replace(new RegExp(f, 'gi'), ''); });
    
    // REMOVER REPETIÇÃO DE "TÁ" - máximo 1 por mensagem
    const taMatches = respostaIA.match(/\btá\b/gi);
    if (taMatches && taMatches.length > 1) {
      // Manter só o primeiro "tá" e remover os outros
      let taCount = 0;
      respostaIA = respostaIA.replace(/\btá\b/gi, (match: string) => {
        taCount++;
        return taCount === 1 ? match : '';
      });
    }
    // Remover "tá?" do final das frases (fica repetitivo)
    respostaIA = respostaIA.replace(/,?\s*tá\?\s*$/gi, '');
    respostaIA = respostaIA.replace(/,?\s*tá\?/gi, '');
    
    respostaIA = respostaIA.replace(/\s+/g, ' ').trim();

    // Fallback se robótica
    if (respostaIA.length > 200 || FRASES_ROBOTICAS.some(f => respostaIA.toLowerCase().includes(f))) {
      const msgLower = messageText.toLowerCase();
      if (['oi', 'olá', 'bom dia', 'boa tarde'].some(c => msgLower.includes(c))) {
        respostaIA = `Opa! ${produtoNome} tá ${produtoPreco} 😊`;
      } else if (['quanto', 'preço', 'valor'].some(p => msgLower.includes(p))) {
        respostaIA = `${produtoPreco}! Tenho disponível`;
      } else if (['tem', 'estoque'].some(e => msgLower.includes(e))) {
        respostaIA = temEstoque ? 'Tenho sim! Pronta entrega' : 'Acabou, mas chega essa semana';
      } else if (['quero', 'comprar', 'pix'].some(i => msgLower.includes(i))) {
        respostaIA = `Fechou! 🎉 ${ctx.link_marketplace || 'te mando o link'}`;
      }
    }

    console.log('✅ Resposta IA:', respostaIA);

    // ═══════════════════════════════════════
    // 📤 PROCESSO DE ENVIO COM DEBUG COMPLETO
    // ═══════════════════════════════════════
    console.log('═══════════════════════════════════════');
    console.log('📤 INICIANDO ENVIO WUZAPI');
    console.log('═══════════════════════════════════════');
    console.log('1️⃣ DADOS:');
    console.log('   Telefone:', phoneNumber);
    console.log('   Mensagem:', respostaIA);
    console.log('2️⃣ CONFIG:');
    console.log('   URL:', WUZAPI_URL);
    console.log('   Token existe?:', !!WUZAPI_TOKEN);
    console.log('   Token (20 chars):', WUZAPI_TOKEN?.substring(0, 20) + '...');
    console.log('   Instance ID:', WUZAPI_INSTANCE_ID);

    const baseUrl = WUZAPI_URL.endsWith('/') ? WUZAPI_URL.slice(0, -1) : WUZAPI_URL;
    let envioSucesso = false;
    let formatoUsado = '';
    let respostaWuzapi = '';

    // FORMATO 1: /chat/send/text (SEM o campo Id que estava causando problema!)
    console.log('3️⃣ FORMATO 1: /chat/send/text');
    try {
      const url1 = `${baseUrl}/chat/send/text`;
      // CORRIGIDO: Removido o campo Id que estava interferindo no envio
      const body1 = { Phone: phoneNumber, Body: respostaIA };
      console.log('   URL:', url1);
      console.log('   Body:', JSON.stringify(body1));
      
      const res1 = await fetch(url1, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Token': WUZAPI_TOKEN },
        body: JSON.stringify(body1)
      });
      const text1 = await res1.text();
      console.log('   Status:', res1.status);
      console.log('   Response:', text1);
      
      if (res1.ok) {
        envioSucesso = true;
        formatoUsado = 'chat/send/text';
        respostaWuzapi = text1;
        console.log('   ✅ SUCESSO FORMATO 1!');
      }
    } catch (e1) { console.error('   ❌ Erro formato 1:', e1); }

    // FORMATO 2: /send/text
    if (!envioSucesso) {
      console.log('4️⃣ FORMATO 2: /send/text');
      try {
        const url2 = `${baseUrl}/send/text`;
        const body2 = { phone: phoneNumber, message: respostaIA };
        console.log('   URL:', url2);
        console.log('   Body:', JSON.stringify(body2));
        
        const res2 = await fetch(url2, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Token': WUZAPI_TOKEN },
          body: JSON.stringify(body2)
        });
        const text2 = await res2.text();
        console.log('   Status:', res2.status);
        console.log('   Response:', text2);
        
        if (res2.ok) {
          envioSucesso = true;
          formatoUsado = 'send/text';
          respostaWuzapi = text2;
          console.log('   ✅ SUCESSO FORMATO 2!');
        }
      } catch (e2) { console.error('   ❌ Erro formato 2:', e2); }
    }

    // FORMATO 3: /send-message
    if (!envioSucesso) {
      console.log('5️⃣ FORMATO 3: /send-message');
      try {
        const url3 = `${baseUrl}/send-message`;
        const body3 = { phone: phoneNumber, message: respostaIA };
        console.log('   URL:', url3);
        console.log('   Body:', JSON.stringify(body3));
        
        const res3 = await fetch(url3, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Token': WUZAPI_TOKEN },
          body: JSON.stringify(body3)
        });
        const text3 = await res3.text();
        console.log('   Status:', res3.status);
        console.log('   Response:', text3);
        
        if (res3.ok) {
          envioSucesso = true;
          formatoUsado = 'send-message';
          respostaWuzapi = text3;
          console.log('   ✅ SUCESSO FORMATO 3!');
        }
      } catch (e3) { console.error('   ❌ Erro formato 3:', e3); }
    }

    // FORMATO 4: /message/text
    if (!envioSucesso) {
      console.log('6️⃣ FORMATO 4: /message/text');
      try {
        const url4 = `${baseUrl}/message/text`;
        const body4 = { number: phoneNumber, text: respostaIA };
        console.log('   URL:', url4);
        console.log('   Body:', JSON.stringify(body4));
        
        const res4 = await fetch(url4, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Token': WUZAPI_TOKEN },
          body: JSON.stringify(body4)
        });
        const text4 = await res4.text();
        console.log('   Status:', res4.status);
        console.log('   Response:', text4);
        
        if (res4.ok) {
          envioSucesso = true;
          formatoUsado = 'message/text';
          respostaWuzapi = text4;
          console.log('   ✅ SUCESSO FORMATO 4!');
        }
      } catch (e4) { console.error('   ❌ Erro formato 4:', e4); }
    }

    // FORMATO 5: /chat/send-text (hífen)
    if (!envioSucesso) {
      console.log('7️⃣ FORMATO 5: /chat/send-text');
      try {
        const url5 = `${baseUrl}/chat/send-text`;
        const body5 = { chatId: phoneNumber + '@s.whatsapp.net', text: respostaIA };
        console.log('   URL:', url5);
        console.log('   Body:', JSON.stringify(body5));
        
        const res5 = await fetch(url5, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Token': WUZAPI_TOKEN },
          body: JSON.stringify(body5)
        });
        const text5 = await res5.text();
        console.log('   Status:', res5.status);
        console.log('   Response:', text5);
        
        if (res5.ok) {
          envioSucesso = true;
          formatoUsado = 'chat/send-text';
          respostaWuzapi = text5;
          console.log('   ✅ SUCESSO FORMATO 5!');
        }
      } catch (e5) { console.error('   ❌ Erro formato 5:', e5); }
    }

    console.log('═══════════════════════════════════════');
    console.log('📊 RESULTADO ENVIO:', envioSucesso ? '✅ SUCESSO' : '❌ FALHOU');
    console.log('   Formato usado:', formatoUsado || 'NENHUM');
    console.log('═══════════════════════════════════════');

    // Salvar log de envio
    await supabaseClient.from('webhook_debug_logs').insert({
      payload: {
        tipo: 'ENVIO_WUZAPI',
        formato: formatoUsado || 'TODOS_FALHARAM',
        sucesso: envioSucesso,
        telefone: phoneNumber,
        mensagem: respostaIA,
        response: respostaWuzapi,
        wuzapi_url: baseUrl,
        instance_id: WUZAPI_INSTANCE_ID
      },
      extracted_phone: phoneNumber,
      extracted_message: respostaIA,
      processing_result: envioSucesso ? `ENVIADO_${formatoUsado.toUpperCase().replace(/\//g, '_')}` : 'ERRO_ENVIO_TODOS_FORMATOS'
    });

    // SALVAR HISTÓRICO em whatsapp_messages
    await supabaseClient.from('whatsapp_messages').insert([
      { user_id: contexto.user_id, phone: phoneNumber, direction: 'received', message: messageText, origem },
      { user_id: contexto.user_id, phone: phoneNumber, direction: 'sent', message: respostaIA, origem }
    ]);

    // SALVAR TAMBÉM em whatsapp_conversation_messages (para exibir na tela IA Conversas)
    await supabaseClient.from('whatsapp_conversation_messages').insert([
      { conversation_id: contexto.id, role: 'user', content: messageText },
      { conversation_id: contexto.id, role: 'assistant', content: respostaIA }
    ]);

    // Atualizar última mensagem da conversa
    await supabaseClient
      .from('whatsapp_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', contexto.id);

    // DETECTAR LEAD QUENTE
    const palavrasInteresse = ['quero', 'comprar', 'pagar', 'pix', 'link', 'fechado', 'fechar', 'sim', 'ok', 'beleza'];
    const temInteresse = palavrasInteresse.some(p => messageText.toLowerCase().includes(p));

    if (temInteresse) {
      console.log('🔥 LEAD QUENTE!');
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
      envio_sucesso: envioSucesso,
      formato_usado: formatoUsado,
      aiResponse: respostaIA,
      leadQuente: temInteresse
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('❌ ERRO GERAL:', error);
    
    await supabaseClient.from('webhook_debug_logs').insert({
      payload: webhookData,
      extracted_phone: phoneNumber || 'ERRO',
      extracted_message: messageText || 'ERRO',
      processing_result: `ERRO: ${error instanceof Error ? error.message : 'Erro'}`
    });

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
