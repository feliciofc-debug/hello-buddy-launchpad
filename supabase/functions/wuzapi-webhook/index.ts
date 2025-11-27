import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Frases robóticas para filtrar
const FRASES_ROBOTICAS = [
  'fico feliz',
  'agradeço',
  'é um prazer',
  'gostaria de',
  'certamente',
  'com toda certeza',
  'é importante ressaltar',
  'vale mencionar',
  'posso ajudar',
  'estou à disposição',
  'não hesite',
  'fique à vontade'
];

// Exemplos por segmento
const EXEMPLOS_SEGMENTO: Record<string, string> = {
  'alimentos-bebidas': `
"Bom dia!" → "E aí! Viu o produto? Tá com preço top hoje 😊"
"Quanto?" → "R$ XX! Fresquinho, chegou agora"
"Tem?" → "Tenho sim! Pronta entrega"`,
  'eletronicos-informatica': `
"Bom dia!" → "Opa! Esse produto é muito bom 💻"
"Quanto?" → "R$ XX! Top de linha, garantia de 1 ano"
"Tem?" → "Tenho! Lacrado, com nota fiscal"`,
  'produtos-hospitalares': `
"Bom dia!" → "Bom dia! Equipamento certificado Anvisa"
"Quanto?" → "R$ XX. Com certificação e garantia"
"Tem?" → "Sim, pronta entrega"`,
  'seguranca-automacao': `
"Bom dia!" → "Opa! Equipamento top com garantia 🔒"
"Quanto?" → "R$ XX. Instalação pode ser inclusa"
"Tem?" → "Tenho! Entrego essa semana"`,
  'moda-vestuario': `
"Bom dia!" → "Oi! Peça linda né? 😍"
"Quanto?" → "R$ XX! Tecido de qualidade"
"Tem?" → "Tenho sim! Qual seu tamanho?"`,
  'pet-shop': `
"Bom dia!" → "Oi! Seu pet vai amar 🐾"
"Quanto?" → "R$ XX! Qualidade top pro seu amiguinho"
"Tem?" → "Tenho sim! Pronta entrega"`,
  'beleza-cosmeticos': `
"Bom dia!" → "Oi! Produto maravilhoso esse 💄"
"Quanto?" → "R$ XX! Resultado garantido"
"Tem?" → "Tenho sim! Original lacrado"`,
  'outros': `
"Bom dia!" → "Opa! Tudo bem? 😊"
"Quanto?" → "R$ XX! Preço bom né?"
"Tem?" → "Tenho sim! Pronta entrega"`
};

serve(async (req) => {
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Endpoint de teste GET
  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      status: 'online',
      timestamp: new Date().toISOString(),
      message: 'Webhook humanizado ativo! ✅'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  console.log('='.repeat(50));
  console.log('🔔 WEBHOOK HUMANIZADO v2.0');
  console.log('Timestamp:', new Date().toISOString());
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let webhookData: any = {};
  let phoneNumber = '';
  let messageText = '';

  try {
    webhookData = await req.json();
    console.log('✅ Payload recebido:', JSON.stringify(webhookData, null, 2));

    // ===== EXTRAÇÃO MULTI-FORMATO =====
    if (webhookData.event?.Message?.conversation) {
      messageText = webhookData.event.Message.conversation;
      phoneNumber = webhookData.event?.Info?.Chat || webhookData.event?.Info?.RemoteJid || '';
    }
    
    if (!messageText && webhookData.event?.Message?.extendedTextMessage?.text) {
      messageText = webhookData.event.Message.extendedTextMessage.text;
      phoneNumber = webhookData.event?.Info?.Chat || webhookData.event?.Info?.RemoteJid || '';
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

    // Limpar telefone
    phoneNumber = phoneNumber
      .replace('@s.whatsapp.net', '')
      .replace('@c.us', '')
      .replace('@lid', '')
      .replace(/\D/g, '');

    if (phoneNumber && !phoneNumber.startsWith('55') && phoneNumber.length === 11) {
      phoneNumber = '55' + phoneNumber;
    }

    console.log('📱 Telefone:', phoneNumber);
    console.log('💬 Mensagem:', messageText);

    // Verificar se é mensagem própria
    const isFromMe = webhookData.event?.Info?.IsFromMe || 
                     webhookData.event?.IsFromMe || 
                     webhookData.data?.fromMe ||
                     webhookData.fromMe;

    // Salvar log de debug
    await supabaseClient.from('webhook_debug_logs').insert({
      payload: webhookData,
      extracted_phone: phoneNumber || 'NÃO EXTRAÍDO',
      extracted_message: messageText || 'NÃO EXTRAÍDA',
      processing_result: isFromMe ? 'IGNORADO: própria' : 'PROCESSANDO'
    });

    if (isFromMe === true) {
      console.log('❌ Ignorando: mensagem própria');
      return new Response(JSON.stringify({ status: 'ignored', reason: 'own message' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!phoneNumber || !messageText) {
      console.log('❌ Dados incompletos');
      return new Response(JSON.stringify({ status: 'error', reason: 'incomplete data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // BUSCAR CONTEXTO
    let { data: contexto } = await supabaseClient
      .from('whatsapp_conversations')
      .select('*')
      .eq('phone_number', phoneNumber)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!contexto) {
      const { data: ultimaMensagem } = await supabaseClient
        .from('whatsapp_messages')
        .select('*')
        .eq('phone', phoneNumber)
        .eq('direction', 'sent')
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ultimaMensagem) {
        const { data: campanhaRecente } = await supabaseClient
          .from('campanhas_recorrentes')
          .select('*, produtos(*)')
          .eq('user_id', ultimaMensagem.user_id)
          .order('ultima_execucao', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (campanhaRecente?.produtos) {
          const produto = campanhaRecente.produtos;
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
        }
      }
    }

    if (!contexto) {
      console.log('❌ Sem contexto');
      return new Response(JSON.stringify({ status: 'no_context' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const ctx = contexto.metadata || contexto.last_message_context || {};
    const origem = contexto.origem || 'campanha';

    // BUSCAR SEGMENTO
    const { data: empresaConfig } = await supabaseClient
      .from('empresa_config')
      .select('segmento, nome_empresa')
      .eq('user_id', contexto.user_id)
      .maybeSingle();

    const segmentoId = empresaConfig?.segmento || 'outros';
    console.log('🎯 Segmento:', segmentoId);

    // BUSCAR HISTÓRICO (últimas 3 mensagens)
    const { data: historico } = await supabaseClient
      .from('whatsapp_messages')
      .select('direction, message')
      .eq('phone', phoneNumber)
      .eq('user_id', contexto.user_id)
      .order('timestamp', { ascending: false })
      .limit(3);

    let historicoTexto = '';
    if (historico && historico.length > 0) {
      historicoTexto = '\n━━━ CONVERSA ATÉ AGORA ━━━\n';
      historico.reverse().forEach(msg => {
        historicoTexto += `${msg.direction === 'received' ? '👤' : '🤖'}: ${msg.message}\n`;
      });
    }

    // LÓGICA DE ESTOQUE ESTRATÉGICA
    const estoque = ctx.produto_estoque || 0;
    const temEstoque = estoque > 0;
    const estoqueBaixo = estoque > 0 && estoque <= 10;
    const estoqueAlto = estoque > 10;

    let infoEstoque = '';
    if (!temEstoque) {
      infoEstoque = 'SEM ESTOQUE - diga que acabou e pergunte se quer ser avisado quando chegar';
    } else if (estoqueBaixo) {
      infoEstoque = `POUCO ESTOQUE (${estoque}) - pode mencionar "só tem ${estoque} ainda" para criar urgência`;
    } else {
      infoEstoque = 'TEM ESTOQUE - diga apenas "tenho sim" ou "tenho disponível", NUNCA revele quantidade';
    }

    console.log('📊 Estoque real:', estoque, '| Estratégia:', infoEstoque);

    // PROMPT SUPER HUMANIZADO
    const promptIA = `Você é vendedor via WhatsApp. Responda como humano real.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 PRODUTO:
${ctx.produto_nome} - R$ ${ctx.produto_preco}
${ctx.produto_descricao ? ctx.produto_descricao : ''}

📊 ESTOQUE:
${infoEstoque}

⚠️ REGRA DE ESTOQUE (CRÍTICO):
- Estoque ALTO (>10): Diga "Tenho sim!" ou "Tenho disponível!" - NUNCA quantidade
- Estoque BAIXO (≤10): Pode dizer "Só tenho ${estoque} ainda" para criar urgência
- SEM estoque: "Acabou, mas chega essa semana. Quer que eu avise?"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${historicoTexto}

💬 CLIENTE DISSE: "${messageText}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 REGRAS ABSOLUTAS:

1. MÁXIMO 2 LINHAS (seja MUITO breve!)
2. 100% NATURAL - escreva como vc falaria no WhatsApp
3. Use "vc", "tá", "pra", "né", "viu" - seja informal
4. NUNCA diga "Fico feliz", "Agradeço", "É um prazer" - frases robóticas
5. 1 emoji NO MÁXIMO
6. Seja DIRETO - vendedor de WhatsApp real

RESPOSTAS POR TIPO:

Se cumprimento (oi/bom dia):
→ Cumprimente de volta + 1 frase curta sobre produto/preço

Se pergunta preço:
→ "R$ ${ctx.produto_preco}! [1 característica]"

Se pergunta estoque/tem/disponível:
${!temEstoque ? '→ "Acabou agora, mas chega essa semana. Quer que eu avise?"' : ''}
${estoqueBaixo ? `→ "Tenho sim! Só restam ${estoque} ainda, tá saindo rápido"` : ''}
${estoqueAlto ? '→ "Tenho sim! Pronta entrega" (NUNCA fale quantidade!)' : ''}

Se quer comprar/interesse forte:
→ "Fechou! 🎉 Segue o link: ${ctx.link_marketplace || '[link]'}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXEMPLOS DO SEU SEGMENTO:
${EXEMPLOS_SEGMENTO[segmentoId] || EXEMPLOS_SEGMENTO['outros']}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXEMPLOS CORRETOS DE ESTOQUE:

👤: "Tem aí?"
✅ "Tenho sim! Pronta entrega"
❌ "Tenho 100 unidades disponíveis" (NUNCA!)

👤: "Tem em estoque?"  
✅ "Tem sim! Quer quantas?"
❌ "Temos 50 unidades em estoque" (NUNCA!)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RESPONDA AGORA (SÓ A MENSAGEM, curta e humana):`;

    console.log('🤖 Chamando IA humanizada...');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const WUZAPI_URL = Deno.env.get('WUZAPI_URL');
    const WUZAPI_TOKEN = Deno.env.get('WUZAPI_TOKEN');
    const WUZAPI_INSTANCE_ID = Deno.env.get('WUZAPI_INSTANCE_ID');

    if (!LOVABLE_API_KEY || !WUZAPI_URL || !WUZAPI_TOKEN || !WUZAPI_INSTANCE_ID) {
      console.error('❌ Credenciais faltando');
      return new Response(JSON.stringify({ status: 'error', reason: 'missing credentials' }), {
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
        messages: [{ role: 'user', content: promptIA }],
        max_tokens: 100, // Forçar respostas curtas
        temperature: 0.8, // Mais naturalidade
        top_p: 0.9
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('❌ Erro IA:', errorText);
      throw new Error('Erro na IA');
    }

    const aiData = await aiResponse.json();
    let respostaIA = aiData.choices?.[0]?.message?.content || 'Opa, pode repetir?';

    console.log('🤖 Resposta bruta:', respostaIA);

    // LIMPAR RESPOSTA
    // Limitar a 2 linhas
    const linhas = respostaIA.split('\n').filter((l: string) => l.trim());
    if (linhas.length > 2) {
      respostaIA = linhas.slice(0, 2).join('\n');
    }

    // Remover frases robóticas
    FRASES_ROBOTICAS.forEach(frase => {
      respostaIA = respostaIA.replace(new RegExp(frase, 'gi'), '');
    });
    respostaIA = respostaIA.replace(/\s+/g, ' ').trim();

    // Verificar se revelou estoque alto
    const revelouEstoqueAlto = estoqueAlto && /\d{2,}\s*(unidade|unidades|em estoque|disponível|disponíveis)/gi.test(respostaIA);
    
    if (revelouEstoqueAlto) {
      console.log('⚠️ IA revelou estoque! Corrigindo...');
      respostaIA = 'Tenho sim! Pronta entrega 😊';
    }

    // Validar se resposta é muito robótica
    const ehRobotica = FRASES_ROBOTICAS.some(f => respostaIA.toLowerCase().includes(f)) ||
                       respostaIA.length > 200 ||
                       respostaIA.split('\n').length > 3;

    if (ehRobotica) {
      console.log('⚠️ Resposta robótica detectada, usando fallback...');
      
      const msgLower = messageText.toLowerCase();
      
      if (['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'eae', 'eai'].some(c => msgLower.includes(c))) {
        respostaIA = `Opa! ${ctx.produto_nome} tá R$ ${ctx.produto_preco} 😊`;
      } else if (['quanto', 'preço', 'preco', 'valor', 'custa'].some(p => msgLower.includes(p))) {
        respostaIA = `R$ ${ctx.produto_preco}! Tenho disponível`;
      } else if (['tem', 'estoque', 'disponível', 'disponivel'].some(e => msgLower.includes(e))) {
        respostaIA = temEstoque 
          ? (estoqueBaixo ? `Só tenho ${estoque} ainda! Tá acabando` : 'Tenho sim! Pronta entrega')
          : 'Acabou, mas chega essa semana. Te aviso?';
      } else if (['quero', 'comprar', 'pagar', 'pix', 'link', 'fechado', 'fechar'].some(i => msgLower.includes(i))) {
        respostaIA = `Fechou! 🎉 Segue: ${ctx.link_marketplace || 'te mando o link'}`;
      } else {
        respostaIA = `Opa! Sobre o ${ctx.produto_nome}, tá R$ ${ctx.produto_preco} 😊`;
      }
    }

    console.log('✅ Resposta final:', respostaIA);

    // ENVIAR VIA WUZAPI
    const baseUrl = WUZAPI_URL.endsWith('/') ? WUZAPI_URL.slice(0, -1) : WUZAPI_URL;
    
    let wuzapiResponse = await fetch(`${baseUrl}/chat/send/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Token': WUZAPI_TOKEN,
      },
      body: JSON.stringify({
        Phone: phoneNumber,
        Body: respostaIA,
        Id: WUZAPI_INSTANCE_ID
      }),
    });

    if (!wuzapiResponse.ok) {
      wuzapiResponse = await fetch(`${baseUrl}/send/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Token': WUZAPI_TOKEN,
        },
        body: JSON.stringify({
          phone: phoneNumber,
          message: respostaIA
        }),
      });
    }

    const envioOk = wuzapiResponse.ok;
    console.log(envioOk ? '✅ Mensagem enviada!' : '❌ Falha no envio');

    // SALVAR HISTÓRICO
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
        message: respostaIA,
        origem: origem
      }
    ]);

    // DETECTAR LEAD QUENTE
    const palavrasInteresse = [
      'quero', 'comprar', 'vou comprar', 'pagar', 'pix',
      'link', 'fechado', 'aceita', 'beleza', 'sim', 'ok', 
      'vou', 'me manda', 'envia', 'fechar', 'fecha'
    ];

    const temInteresse = palavrasInteresse.some(p => 
      messageText.toLowerCase().includes(p)
    );

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

    // Atualizar log de debug
    await supabaseClient.from('webhook_debug_logs')
      .update({ processing_result: `SUCESSO: "${respostaIA.substring(0, 50)}..."` })
      .eq('extracted_phone', phoneNumber)
      .order('timestamp', { ascending: false })
      .limit(1);

    return new Response(JSON.stringify({ 
      status: 'success', 
      aiResponse: respostaIA,
      leadQuente: temInteresse
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    
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
