import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Env vars globais
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

// Interface para instância Wuzapi
interface WuzapiInstance {
  id: string;
  instance_name: string;
  port: number;
  wuzapi_url: string;
  wuzapi_token: string;
  is_connected: boolean;
  assigned_to_user: string | null;
}

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
    // Ler body como texto primeiro para evitar erro de JSON inválido
    const bodyText = await req.text();
    console.log('📥 Body bruto recebido (primeiros 200 chars):', bodyText.substring(0, 200));
    
    // Tentar parsear como JSON
    try {
      webhookData = JSON.parse(bodyText);
    } catch (parseError) {
      console.log('⚠️ Body não é JSON válido, tentando extrair dados...');
      // Se não for JSON, pode ser query string ou texto simples
      if (bodyText.includes('=')) {
        // Tentar como query string
        const params = new URLSearchParams(bodyText);
        webhookData = Object.fromEntries(params.entries());
      } else {
        console.log('❌ Formato de payload não reconhecido:', bodyText.substring(0, 100));
        return new Response(JSON.stringify({ status: 'error', reason: 'invalid_payload_format' }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }
    
    console.log('📦 Webhook data parseado:', JSON.stringify(webhookData).substring(0, 500));
    
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

    // ═══════════════════════════════════════
    // 🔒 DEDUPLICAÇÃO DE MENSAGENS
    // ═══════════════════════════════════════
    // Extrair ID único da mensagem do payload
    const messageId = webhookData.event?.Info?.ID || 
                      webhookData.event?.Message?.ID || 
                      webhookData.data?.id || 
                      webhookData.message?.id ||
                      `${phoneNumber}_${messageText.substring(0, 50)}_${Date.now()}`;
    
    console.log('🔑 Message ID:', messageId);
    
    // Verificar se já processamos esta mensagem
    const { data: mensagemExistente } = await supabaseClient
      .from('whatsapp_messages')
      .select('id')
      .eq('wuzapi_message_id', messageId)
      .maybeSingle();
    
    if (mensagemExistente) {
      console.log('⏭️ Mensagem já processada, ignorando duplicata');
      return new Response(JSON.stringify({ 
        status: 'ignored', 
        reason: 'duplicate_message',
        message_id: messageId 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    console.log('✅ Mensagem nova, processando...');

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

    // ═══════════════════════════════════════
    // 🔌 MULTI-INSTÂNCIA: BUSCAR INSTÂNCIA PELA PORTA
    // ═══════════════════════════════════════
    const webhookPort = webhookData.port || webhookData.instance_port || null;
    console.log('📍 Porta recebida no webhook:', webhookPort);
    
    let WUZAPI_URL = Deno.env.get('WUZAPI_URL') || '';
    let WUZAPI_TOKEN = Deno.env.get('WUZAPI_TOKEN') || '';
    let WUZAPI_INSTANCE_ID = Deno.env.get('WUZAPI_INSTANCE_ID') || '';
    let instanciaUsada = 'env_fallback';
    
    if (webhookPort) {
      console.log('🔍 Buscando instância para porta:', webhookPort);
      
      const { data: instancia, error: instError } = await supabaseClient
        .from('wuzapi_instances')
        .select('*')
        .eq('port', webhookPort)
        .eq('is_connected', true)
        .single();
      
      if (!instError && instancia) {
        WUZAPI_URL = instancia.wuzapi_url;
        WUZAPI_TOKEN = instancia.wuzapi_token;
        WUZAPI_INSTANCE_ID = instancia.instance_name;
        instanciaUsada = instancia.instance_name;
        console.log(`✅ Instância encontrada: ${instancia.instance_name} (porta ${instancia.port})`);
        console.log(`   URL: ${WUZAPI_URL}`);
      } else {
        console.log(`⚠️ Instância para porta ${webhookPort} não encontrada, usando fallback`);
      }
    } else {
      // Tentar buscar qualquer instância conectada como fallback
      const { data: fallbackInstancia } = await supabaseClient
        .from('wuzapi_instances')
        .select('*')
        .eq('is_connected', true)
        .limit(1)
        .single();
      
      if (fallbackInstancia) {
        WUZAPI_URL = fallbackInstancia.wuzapi_url;
        WUZAPI_TOKEN = fallbackInstancia.wuzapi_token;
        WUZAPI_INSTANCE_ID = fallbackInstancia.instance_name;
        instanciaUsada = fallbackInstancia.instance_name;
        console.log(`📌 Usando instância fallback: ${fallbackInstancia.instance_name}`);
      } else {
        console.log('⚠️ Nenhuma instância encontrada, usando env vars');
      }
    }

    // ═══════════════════════════════════════
    // 📱 PROTEÇÃO ANTI-CONFLITO IPHONE
    // ═══════════════════════════════════════
    console.log('📱 Marcando sessão ativa para:', phoneNumber);
    
    // 1. Marcar sessão como ativa (cliente está em conversa)
    const { error: sessaoError } = await supabaseClient
      .from('sessoes_ativas')
      .upsert({
        whatsapp: phoneNumber,
        tipo: 'ia_marketing',
        ultima_interacao: new Date().toISOString(),
        ativa: true
      }, { 
        onConflict: 'whatsapp' 
      });

    if (sessaoError) {
      console.error('⚠️ Erro ao marcar sessão:', sessaoError);
    } else {
      console.log('✅ Sessão marcada como ativa');
    }

    // 2. Pausar TODAS as campanhas ativas deste cliente
    const { error: pausarError, count } = await supabaseClient
      .from('campanhas_ativas')
      .update({ 
        pausado: true, 
        respondeu: true,
        aguardando_resposta: false
      })
      .eq('whatsapp', phoneNumber)
      .eq('aguardando_resposta', true);

    if (pausarError) {
      console.error('⚠️ Erro ao pausar campanhas:', pausarError);
    } else {
      console.log('✅ Campanhas pausadas para este cliente');
    }

    // ═══════════════════════════════════════
    // 📝 CONTINUA PROCESSAMENTO NORMAL
    // ═══════════════════════════════════════

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
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📱 CONVERSA NÃO EXISTE para:', phoneNumber);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const { data: ultimaMensagem, error: erroBuscaMensagem } = await supabaseClient
        .from('whatsapp_messages')
        .select('*')
        .eq('phone', phoneNumber)
        .eq('direction', 'sent')
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('🔍 Busca mensagem enviada:', ultimaMensagem ? 'ENCONTROU' : 'NÃO ENCONTROU');
      if (erroBuscaMensagem) {
        console.error('❌ Erro ao buscar mensagem:', erroBuscaMensagem);
      }

      if (ultimaMensagem) {
        userId = ultimaMensagem.user_id;
        console.log('✅ User ID encontrado:', userId);
        
        const { data: campanhaRecente, error: erroCampanha } = await supabaseClient
          .from('campanhas_recorrentes')
          .select('*, produtos(*)')
          .eq('user_id', ultimaMensagem.user_id)
          .order('ultima_execucao', { ascending: false })
          .limit(1)
          .maybeSingle();

        console.log('📦 Campanha recente:', campanhaRecente?.nome || 'NENHUMA');
        if (erroCampanha) {
          console.error('❌ Erro ao buscar campanha:', erroCampanha);
        }

        if (campanhaRecente?.produtos) {
          produtoInfo = campanhaRecente.produtos;
          console.log('📦 Produto da campanha:', produtoInfo?.nome);
        }
      } else {
        console.log('⚠️ Nenhuma mensagem enviada encontrada para este telefone');
      }

      // Criar nova conversa se temos um user_id
      if (userId) {
        console.log('➕ CRIANDO NOVA CONVERSA...');
        console.log('   User ID:', userId);
        console.log('   Phone:', phoneNumber);
        
        const pushName = webhookData.event?.Info?.PushName || null;
        console.log('   PushName:', pushName);
        
        const conversaData = {
          user_id: userId,
          phone_number: phoneNumber,
          contact_name: pushName,
          tipo_contato: 'lead',
          origem: 'campanha',
          modo_atendimento: 'ia',
          last_message_at: new Date().toISOString(),
          metadata: produtoInfo ? {
            produto_id: produtoInfo.id,
            produto_nome: produtoInfo.nome,
            produto_descricao: produtoInfo.descricao,
            produto_preco: produtoInfo.preco,
            produto_estoque: produtoInfo.estoque,
            produto_especificacoes: produtoInfo.especificacoes,
            produto_categoria: produtoInfo.categoria,
            produto_sku: produtoInfo.sku,
            produto_tags: produtoInfo.tags,
            produto_imagens: produtoInfo.imagens,
            produto_imagem_url: produtoInfo.imagem_url,
            link_marketplace: produtoInfo.link_marketplace,
            link_produto: produtoInfo.link,
          } : {}
        };
        console.log('   Dados:', JSON.stringify(conversaData, null, 2));
        
        const { data: novaConversa, error: erroCriar } = await supabaseClient
          .from('whatsapp_conversations')
          .insert(conversaData)
          .select()
          .single();

        if (erroCriar) {
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.error('❌ ERRO AO CRIAR CONVERSA:', JSON.stringify(erroCriar));
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        } else {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('✅ CONVERSA CRIADA COM SUCESSO:', novaConversa?.id);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          contexto = novaConversa;
        }
      } else {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('⚠️ SEM USER_ID - NÃO PODE CRIAR CONVERSA');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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
          produto_id: prod.id,
          produto_nome: prod.nome,
          produto_descricao: prod.descricao,
          produto_preco: prod.preco,
          produto_estoque: prod.estoque,
          produto_especificacoes: prod.especificacoes,
          produto_categoria: prod.categoria,
          produto_sku: prod.sku,
          produto_tags: prod.tags,
          produto_imagens: prod.imagens,
          produto_imagem_url: prod.imagem_url,
          link_marketplace: prod.link_marketplace,
          link_produto: prod.link
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

    // ═══════════════════════════════════════
    // 📦 BUSCAR TODOS OS PRODUTOS (COM E SEM ESTOQUE)
    // ═══════════════════════════════════════
    const { data: todosProdutos } = await supabaseClient
      .from('produtos')
      .select('id, nome, preco, estoque, descricao, especificacoes, link_marketplace, imagem_url')
      .eq('user_id', contexto.user_id)
      .eq('ativo', true)
      .order('nome');

    let catalogoProdutos = '';
    if (todosProdutos && todosProdutos.length > 0) {
      catalogoProdutos = '\n━━ CATÁLOGO COMPLETO ━━\n';
      todosProdutos.forEach(p => {
        const statusEstoque = p.estoque > 0 ? `✅ ${p.estoque} un.` : '❌ ESGOTADO';
        catalogoProdutos += `• ${p.nome} - R$ ${Number(p.preco || 0).toFixed(2)} ${statusEstoque}\n`;
      });
      catalogoProdutos += '\nSe cliente perguntar sobre produto, você PODE informar preço/estoque ou que está esgotado!\n';
      console.log('📋 Catálogo carregado:', todosProdutos.length, 'produtos');
    }

    // ═══════════════════════════════════════
    // 🔍 DETECTAR SE CLIENTE ESTÁ PERGUNTANDO SOBRE OUTRO PRODUTO
    // ═══════════════════════════════════════
    let produtoSolicitado = null;
    if (todosProdutos && todosProdutos.length > 0) {
      const msgLower = messageText.toLowerCase();
      for (const prod of todosProdutos) {
        const nomeProdLower = prod.nome.toLowerCase();
        // Detectar menções ao produto na mensagem
        if (msgLower.includes(nomeProdLower) || 
            msgLower.includes('tem ' + nomeProdLower) ||
            msgLower.includes('e ' + nomeProdLower) ||
            msgLower.includes('e o ' + nomeProdLower)) {
          // Cliente está perguntando sobre este produto
          produtoSolicitado = prod;
          console.log('🎯 Produto solicitado detectado:', prod.nome);
          
          // Atualizar contexto para este produto
          ctx = {
            ...ctx,
            produto_nome: prod.nome,
            produto_descricao: prod.descricao,
            produto_preco: prod.preco,
            produto_estoque: prod.estoque,
            produto_especificacoes: prod.especificacoes,
            link_marketplace: prod.link_marketplace,
            produto_imagem_url: prod.imagem_url
          };
          
          // Atualizar conversa com novo produto
          await supabaseClient
            .from('whatsapp_conversations')
            .update({ metadata: ctx })
            .eq('id', contexto.id);
          
          break;
        }
      }
    }

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

    // PREPARAR DADOS COMPLETOS DO PRODUTO COM FALLBACKS
    const produtoNome = ctx.produto_nome || 'Produto';
    const produtoPreco = ctx.produto_preco ? `R$ ${Number(ctx.produto_preco).toFixed(2)}` : 'consulte';
    const produtoDescricao = ctx.produto_descricao || '';
    const produtoEspecs = ctx.produto_especificacoes || '';
    const produtoCategoria = ctx.produto_categoria || '';
    const produtoSku = ctx.produto_sku || '';
    const produtoTags = ctx.produto_tags ? ctx.produto_tags.join(', ') : '';

    console.log('📦 Dados completos do produto para IA:', { 
      produtoNome, 
      produtoPreco, 
      produtoDescricao, 
      produtoEspecs: produtoEspecs ? produtoEspecs.substring(0, 100) + '...' : 'sem specs',
      produtoCategoria,
      produtoTags 
    });
    
     console.log('⚠️ ESPECIFICAÇÕES COMPLETAS (para debug):', produtoEspecs || 'VAZIO - produto não tem especificações cadastradas');

    // ═══════════════════════════════════════
    // 🤖 SEMPRE USAR IA AVANÇADA (ai-product-assistant)
    // A IA avançada conhece TODO o catálogo e responde melhor
    // ═══════════════════════════════════════
    
    // SEMPRE usar IA avançada - ela responde melhor qualquer pergunta
    if (contexto.user_id) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 USANDO IA SIMPLES (baseada em regras)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      try {
        const { data: aiAssistantData, error: aiAssistantError } = await supabaseClient.functions.invoke('ai-product-assistant-simple', {
          body: {
            mensagemCliente: messageText,
            conversationId: contexto.id,
            userId: contexto.user_id,
            phone: phoneNumber
          }
        });

        if (!aiAssistantError && aiAssistantData?.success) {
          console.log('✅ IA Avançada respondeu:', aiAssistantData.mensagem);
          
          // Enviar resposta texto
          const baseUrl = WUZAPI_URL.endsWith('/') ? WUZAPI_URL.slice(0, -1) : WUZAPI_URL;
          const urlTexto = `${baseUrl}/chat/send/text`;
          
          const cleanPhone = phoneNumber.replace(/\D/g, '');
          console.log('📤 ENVIANDO RESPOSTA IA AVANÇADA:');
          console.log('   Telefone:', cleanPhone);
          console.log('   Mensagem:', aiAssistantData.mensagem.substring(0, 50) + '...');
          console.log('   URL:', urlTexto);
          
          const sendResponse = await fetch(urlTexto, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Token': WUZAPI_TOKEN },
            body: JSON.stringify({
              Phone: cleanPhone,
              Body: aiAssistantData.mensagem
            })
          });
          
          const sendResult = await sendResponse.text();
          console.log('📊 RESULTADO ENVIO IA AVANÇADA:', sendResponse.status, sendResult);

          // Se deve enviar foto
          if (aiAssistantData.enviar_foto) {
            console.log('📸 enviar_foto = true, buscando produto para enviar imagem...');
            
            let produto = aiAssistantData.produto_recomendado;
            
            // VALIDAÇÃO CRÍTICA: Identificar produto correto pela mensagem
            const msgLower = messageText.toLowerCase();
            const palavrasChave = ['arroz', 'feijão', 'feijao', 'farinha', 'milho', 'flocão', 'flocao', 'açúcar', 'acucar', 'óleo', 'oleo', 'sal', 'macarrão', 'macarrao', 'leite', 'café', 'cafe'];
            
            // Buscar todos os produtos do usuário
            const { data: todosProdutos } = await supabaseClient
              .from('produtos')
              .select('*')
              .eq('user_id', contexto.user_id)
              .eq('ativo', true);
            
            // Primeiro: tentar identificar produto pela mensagem atual
            let produtoCorreto = null;
            for (const palavra of palavrasChave) {
              if (msgLower.includes(palavra)) {
                const encontrado = todosProdutos?.find(p => 
                  p.nome.toLowerCase().includes(palavra)
                );
                if (encontrado) {
                  produtoCorreto = encontrado;
                  console.log(`🎯 Produto identificado na mensagem: "${palavra}" → ${encontrado.nome}`);
                  break;
                }
              }
            }
            
            // Se encontrou produto na mensagem, usar esse
            if (produtoCorreto) {
              produto = produtoCorreto;
            }
            // Se não encontrou na mensagem, verificar se IA sugeriu produto correto
            else if (produto) {
              const produtoNomeLower = produto.nome?.toLowerCase() || '';
              let produtoValido = false;
              
              for (const palavra of palavrasChave) {
                if (msgLower.includes(palavra) && produtoNomeLower.includes(palavra)) {
                  produtoValido = true;
                  break;
                }
              }
              
              if (!produtoValido) {
                console.log('⚠️ Produto da IA pode não corresponder à mensagem');
                console.log('   Mensagem:', messageText);
                console.log('   Produto IA:', produto.nome);
              }
            }
            // Se ainda não tem, buscar do contexto
            else if (ctx.produto_id) {
              console.log('📸 Buscando produto do contexto:', ctx.produto_id);
              const { data: produtoBuscado } = await supabaseClient
                .from('produtos')
                .select('*')
                .eq('id', ctx.produto_id)
                .single();
              produto = produtoBuscado;
            }
            // Buscar pelo nome no contexto
            else if (ctx.produto_nome) {
              console.log('📸 Buscando produto pelo nome:', ctx.produto_nome);
              const { data: produtoBuscado } = await supabaseClient
                .from('produtos')
                .select('*')
                .eq('user_id', contexto.user_id)
                .ilike('nome', `%${ctx.produto_nome}%`)
                .limit(1)
                .maybeSingle();
              produto = produtoBuscado;
            }
            
            console.log('📸 Produto final selecionado:', produto?.nome || 'NENHUM');
            
            if (produto && produto.imagem_url) {
              console.log('📸 Enviando foto do produto:', produto.nome);
              console.log('📸 URL da imagem:', produto.imagem_url);
              
              let caption = `📦 *${produto.nome}*\n`;
              caption += `💰 *R$ ${Number(produto.preco || 0).toFixed(2)}*\n\n`;
              
              if (produto.descricao) caption += `${produto.descricao}\n\n`;
              if (produto.beneficios) caption += `✨ ${produto.beneficios}\n\n`;
              
              if (produto.estoque > 0 && produto.link_marketplace) {
                caption += `🛒 Link: ${produto.link_marketplace}`;
              } else if (produto.estoque === 0) {
                caption += `❌ Esgotado no momento`;
              }

              // Aguardar 2 segundos antes de enviar foto
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              const urlImagem = `${baseUrl}/chat/send/image`;
              console.log('📸 Enviando para:', urlImagem);
              
              const imagemResponse = await fetch(urlImagem, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Token': WUZAPI_TOKEN },
                body: JSON.stringify({
                  Phone: phoneNumber.replace(/\D/g, ''),
                  Image: produto.imagem_url,
                  Caption: caption.trim()
                })
              });
              
              const imagemResult = await imagemResponse.text();
              console.log('📸 Resultado envio imagem:', imagemResponse.status, imagemResult);

              // Atualizar contexto da conversa com produto
              await supabaseClient
                .from('whatsapp_conversations')
                .update({ 
                  metadata: {
                    ...ctx,
                    produto_id: produto.id,
                    produto_nome: produto.nome,
                    produto_preco: produto.preco,
                    produto_descricao: produto.descricao,
                    produto_estoque: produto.estoque,
                    link_marketplace: produto.link_marketplace,
                    produto_imagem_url: produto.imagem_url
                  },
                  last_message_at: new Date().toISOString()
                })
                .eq('id', contexto.id);
            } else {
              console.log('⚠️ Produto não encontrado ou sem imagem:', produto?.nome || 'null');
            }
          }

          // ═══════════════════════════════════════
          // 🛒 ENVIAR LINK DE CHECKOUT SE CLIENTE QUER COMPRAR
          // ═══════════════════════════════════════
          if (aiAssistantData.enviar_link) {
            console.log('🛒 Cliente quer comprar! Enviando link de checkout...');
            
            // Aguardar 2 segundos
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Buscar produto para enviar link
            let produtoParaLink = aiAssistantData.produto_recomendado;
            
            // Se não veio produto da IA, buscar do contexto
            if (!produtoParaLink && ctx.produto_id) {
              const { data: produtoBuscado } = await supabaseClient
                .from('produtos')
                .select('*')
                .eq('id', ctx.produto_id)
                .single();
              produtoParaLink = produtoBuscado;
            }
            
            // Se ainda não tem, buscar pelo nome no contexto
            if (!produtoParaLink && ctx.produto_nome) {
              const { data: produtoBuscado } = await supabaseClient
                .from('produtos')
                .select('*')
                .eq('user_id', contexto.user_id)
                .ilike('nome', `%${ctx.produto_nome}%`)
                .limit(1)
                .maybeSingle();
              produtoParaLink = produtoBuscado;
            }
            
            // Buscar pela última menção na conversa
            if (!produtoParaLink) {
              const { data: ultimasMensagens } = await supabaseClient
                .from('whatsapp_messages')
                .select('message')
                .eq('phone', phoneNumber)
                .eq('user_id', contexto.user_id)
                .order('timestamp', { ascending: false })
                .limit(5);
              
              const { data: todosProdutosUser } = await supabaseClient
                .from('produtos')
                .select('*')
                .eq('user_id', contexto.user_id)
                .eq('ativo', true);
              
              const palavrasChave = ['arroz', 'feijão', 'feijao', 'farinha', 'milho', 'flocão', 'flocao', 'açúcar', 'acucar', 'óleo', 'oleo', 'sal', 'macarrão', 'macarrao', 'leite', 'café', 'cafe', 'manteiga'];
              
              for (const msg of ultimasMensagens || []) {
                const msgLower = msg.message.toLowerCase();
                for (const palavra of palavrasChave) {
                  if (msgLower.includes(palavra)) {
                    const encontrado = todosProdutosUser?.find(p => p.nome.toLowerCase().includes(palavra));
                    if (encontrado) {
                      produtoParaLink = encontrado;
                      console.log('🎯 Produto para link encontrado no histórico:', encontrado.nome);
                      break;
                    }
                  }
                }
                if (produtoParaLink) break;
              }
            }
            
            if (produtoParaLink) {
              console.log('📦 Enviando link para produto:', produtoParaLink.nome);
              
              // Usar link_mensagem da IA se disponível, senão construir
              let linkMessage = aiAssistantData.link_mensagem;
              
              if (!linkMessage) {
                const linkFinal = produtoParaLink.checkout_url || produtoParaLink.link_marketplace || 'https://amzofertas.com.br/checkout';
                console.log('🔗 Link final:', linkFinal);
                
                linkMessage = `🛒 *Finalize sua compra:*

${linkFinal}

📦 *${produtoParaLink.nome}*
💰 *R$ ${Number(produtoParaLink.preco || 0).toFixed(2)}*

_Escolha quantidade e finalize!_ ✅

O frete aparece na finalização! 😊`;
              }
              
              console.log('📤 Mensagem de link a enviar:', linkMessage);

              const linkResponse = await fetch(`${baseUrl}/chat/send/text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Token': WUZAPI_TOKEN },
                body: JSON.stringify({
                  Phone: phoneNumber.replace(/\D/g, ''),
                  Body: linkMessage
                })
              });
              
              const linkResult = await linkResponse.text();
              console.log('✅ Link de checkout enviado:', linkResponse.status, linkResult);
              
              // Salvar que enviou link
              const linkFinalSalvo = produtoParaLink.checkout_url || produtoParaLink.link_marketplace || 'amzofertas.com.br';
              await supabaseClient.from('whatsapp_messages').insert({
                phone: phoneNumber,
                direction: 'sent',
                message: `[Link enviado: ${produtoParaLink.nome}] - ${linkFinalSalvo}`,
                user_id: contexto.user_id,
                origem: 'campanha'
              });
              
            } else {
              console.log('⚠️ Produto não tem link cadastrado ou não foi identificado');
            }
          }

          // Salvar mensagens no histórico com wuzapi_message_id
          await supabaseClient.from('whatsapp_messages').insert([
            { 
              phone: phoneNumber, 
              direction: 'received', 
              message: messageText, 
              user_id: contexto.user_id, 
              origem: contexto.origem || 'campanha',
              wuzapi_message_id: messageId
            },
            { 
              phone: phoneNumber, 
              direction: 'sent', 
              message: aiAssistantData.mensagem, 
              user_id: contexto.user_id, 
              origem: contexto.origem || 'campanha'
            }
          ]);

          // Salvar também no histórico de conversação
          await supabaseClient.from('whatsapp_conversation_messages').insert([
            { conversation_id: contexto.id, role: 'user', content: messageText },
            { conversation_id: contexto.id, role: 'assistant', content: aiAssistantData.mensagem }
          ]);

          // Detectar lead quente
          const keywordsHot = ['quero', 'comprar', 'pagar', 'pix', 'link', 'fechado', 'aceita', 'quanto', 'sim', 'beleza', 'ok', 'vou', 'pega'];
          const isHot = keywordsHot.some(k => messageText.toLowerCase().includes(k));
          if (isHot && contexto.user_id) {
            await supabaseClient.from('lead_notifications').insert({
              user_id: contexto.user_id,
              phone: phoneNumber,
              produto_nome: aiAssistantData.produto_recomendado?.nome || produtoNome,
              mensagem_cliente: messageText,
              status: 'quente'
            });
            console.log('🔥 Lead quente detectado e registrado');
          }

          return new Response(JSON.stringify({ status: 'success_ai_advanced' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } catch (aiError) {
        console.error('⚠️ Erro na IA Avançada, usando IA padrão como fallback:', aiError);
        // Continua com IA padrão abaixo
      }
    }

    // ═══════════════════════════════════════
    // 🤖 IA PADRÃO (fallback)
    // ═══════════════════════════════════════
    console.log('🤖 Usando IA Padrão (Claude) para resposta');

    // MONTAR FICHA TÉCNICA COMPLETA - INCLUIR TODAS AS INFORMAÇÕES
    let fichaTecnicaCompleta = `📦 PRODUTO: ${produtoNome} - ${produtoPreco}\n`;
    if (produtoCategoria) fichaTecnicaCompleta += `🏷️ CATEGORIA: ${produtoCategoria}\n`;
    if (produtoSku) fichaTecnicaCompleta += `📋 SKU/CÓDIGO: ${produtoSku}\n`;
    if (produtoDescricao) fichaTecnicaCompleta += `📝 DESCRIÇÃO: ${produtoDescricao}\n`;
    
    // ESPECIFICAÇÕES TÉCNICAS - CRUCIAL PARA RESPONDER PERGUNTAS TÉCNICAS
    if (produtoEspecs && produtoEspecs.trim()) {
      fichaTecnicaCompleta += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      fichaTecnicaCompleta += `🔬 ESPECIFICAÇÕES TÉCNICAS COMPLETAS:\n`;
      fichaTecnicaCompleta += `${produtoEspecs}\n`;
      fichaTecnicaCompleta += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      fichaTecnicaCompleta += `⚠️ IMPORTANTE: Você TEM estas especificações técnicas acima! Use-as para responder perguntas sobre tabela nutricional, ingredientes, composição, valores nutricionais, etc.\n`;
    } else {
      fichaTecnicaCompleta += `\n⚠️ ATENÇÃO: Este produto NÃO tem especificações técnicas cadastradas no sistema.\n`;
    }
    
    if (produtoTags) fichaTecnicaCompleta += `🏷️ TAGS: ${produtoTags}\n`;

    // PROMPT HUMANIZADO COM FICHA TÉCNICA COMPLETA
    const promptIA = `Você é vendedor WhatsApp. MÁXIMO 2 LINHAS.

${fichaTecnicaCompleta}

📊 ESTOQUE: ${infoEstoque}
${catalogoProdutos}
${historicoTexto}

💬 CLIENTE: "${messageText}"

REGRAS:
1. MÁXIMO 2 LINHAS
2. Linguagem informal natural: "vc", "pra", "blz", "show"
3. NÃO use "tá?" no final das frases - varie a linguagem!
4. NUNCA "Fico feliz", "Agradeço"
5. 1 emoji só
6. ${produtoSolicitado ? '🎯 PRODUTO SOLICITADO - já vai imagem com descrição completa! Seja BREVE: "Esse é o arroz que tenho! 😊" ou "Olha só 👆"' : 'FOQUE no produto principal - NÃO ofereça outros espontaneamente'}
7. SOMENTE se cliente perguntar sobre outro produto (ex: "tem feijão?"), aí sim responda com preço/estoque ou informe "esgotado no momento"
8. Se produto SEM ESTOQUE → informe de forma natural: "Esse tá esgotado agora 😔" ou "Acabou hoje, volta semana que vem"
9. 🔗 LINK DIRETO: Se cliente mostra interesse em comprar (diz "quero", "comprar", "pagar", "pix", "link", "fechado", "sim", "ok", "vou", "pega") e produto TEM ESTOQUE → COLOQUE O LINK na sua resposta: "${ctx.link_marketplace || '[link não disponível]'}" - NUNCA pergunte se quer link, ENVIE direto! Ex: "Ótimo! ${ctx.link_marketplace}" ou "Fechou! ${ctx.link_marketplace} 🎉"
10. 🔬 DADOS TÉCNICOS: 
   - SE cliente perguntar EXPLICITAMENTE sobre especificações, tabela nutricional, ingredientes, composição, dados nutricionais → RESPONDA usando as "ESPECIFICAÇÕES TÉCNICAS COMPLETAS" acima
   - Se as especificações estiverem lá em cima, você TEM essa informação! Use-a para responder
   - Se NÃO houver especificações cadastradas (indicado no prompt), diga: "Não tenho essa info no sistema, mas posso te passar o link pra ver lá"
   - Seu padrão normal (sem perguntas técnicas): atendimento curto de marketing + link

${EXEMPLOS_SEGMENTO[segmentoId] || EXEMPLOS_SEGMENTO['outros']}

RESPONDA (curto e humano, sem repetir "tá"):`;

    console.log('🤖 Chamando IA padrão...');

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
    // 📸 ENVIAR IMAGEM DO PRODUTO SE CLIENTE PERGUNTOU
    // ═══════════════════════════════════════
    if (produtoSolicitado && produtoSolicitado.imagem_url) {
      console.log('📸 Cliente perguntou sobre produto com imagem, enviando foto...');
      
      // Caption CURTO - apenas nome, preço e link
      let caption = `Confira nosso produto:\n\n`;
      caption += `${produtoSolicitado.nome}\n`;
      caption += `💰 R$ ${Number(produtoSolicitado.preco || 0).toFixed(2)}\n\n`;
      
      if (produtoSolicitado.estoque > 0 && produtoSolicitado.link_marketplace) {
        caption += `🛒 ${produtoSolicitado.link_marketplace}`;
      } else if (produtoSolicitado.estoque === 0) {
        caption += `❌ Esgotado no momento`;
      }

      console.log('📸 Caption:', caption);
      console.log('📸 Imagem URL:', produtoSolicitado.imagem_url);

      const baseUrl = WUZAPI_URL.endsWith('/') ? WUZAPI_URL.slice(0, -1) : WUZAPI_URL;
      
      // Tentar enviar imagem via Wuzapi
      try {
        const urlImagem = `${baseUrl}/chat/send/image`;
        const bodyImagem = {
          Phone: phoneNumber,
          Image: produtoSolicitado.imagem_url,
          Caption: caption
        };
        
        console.log('📸 Enviando para:', urlImagem);
        console.log('📸 Body:', JSON.stringify(bodyImagem));
        
        const resImagem = await fetch(urlImagem, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Token': WUZAPI_TOKEN },
          body: JSON.stringify(bodyImagem)
        });
        
        const textImagem = await resImagem.text();
        console.log('📸 Status:', resImagem.status);
        console.log('📸 Response:', textImagem);
        
        if (resImagem.ok) {
          console.log('✅ Imagem enviada com sucesso!');
          
          // Salvar mensagem de imagem no histórico
          await supabaseClient.from('whatsapp_messages').insert({
            phone: phoneNumber,
            user_id: contexto.user_id,
            direction: 'sent',
            message: `[Imagem] ${caption}`,
            timestamp: new Date().toISOString()
          });
        } else {
          console.error('❌ Erro ao enviar imagem:', textImagem);
        }
      } catch (errImagem) {
        console.error('❌ Exceção ao enviar imagem:', errImagem);
      }
      
      // Pequeno delay para não sobrepor mensagens
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

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
      { user_id: contexto.user_id, phone: phoneNumber, direction: 'received', message: messageText, origem, wuzapi_message_id: messageId },
      { user_id: contexto.user_id, phone: phoneNumber, direction: 'sent', message: respostaIA, origem }
    ]);

    // SALVAR TAMBÉM em whatsapp_conversation_messages (para exibir na tela IA Conversas)
    await supabaseClient.from('whatsapp_conversation_messages').insert([
      { conversation_id: contexto.id, role: 'user', content: messageText, wuzapi_message_id: messageId },
      { conversation_id: contexto.id, role: 'assistant', content: respostaIA }
    ]);

    // Atualizar última mensagem da conversa
    await supabaseClient
      .from('whatsapp_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', contexto.id);

    // ═══════════════════════════════════════
    // 🎯 ATUALIZAR LEAD SE VINCULADO (PROSPECÇÃO)
    // ═══════════════════════════════════════
    const leadId = contexto.lead_id;
    const leadTipo = contexto.metadata?.lead_tipo;
    
    if (leadId && leadTipo) {
      console.log('🎯 Lead vinculado encontrado:', leadId, leadTipo);
      
      // Registrar interação no lead
      await supabaseClient.from('interacoes').insert({
        lead_id: leadId,
        lead_tipo: leadTipo,
        tipo: 'whatsapp',
        titulo: '💬 Lead respondeu!',
        descricao: messageText,
        resultado: 'respondeu'
      });

      // Atualizar pipeline do lead para "respondeu"
      const tabelaLead = leadTipo === 'b2c' ? 'leads_b2c' : 'leads_b2b';
      const scoreAtual = contexto.metadata?.score || 50;
      
      await supabaseClient.from(tabelaLead).update({
        pipeline_status: 'respondeu',
        respondeu_em: new Date().toISOString(),
        score: Math.min(scoreAtual + 15, 100)
      }).eq('id', leadId);

      console.log('✅ Lead atualizado para status "respondeu"');
    }

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

      // Se tem lead vinculado, atualizar para qualificado
      if (leadId && leadTipo) {
        const tabelaLead = leadTipo === 'b2c' ? 'leads_b2c' : 'leads_b2b';
        await supabaseClient.from(tabelaLead).update({
          pipeline_status: 'qualificado',
          score: 90
        }).eq('id', leadId);
        console.log('🔥 Lead promovido para QUALIFICADO!');
      }
    }

    return new Response(JSON.stringify({ 
      status: 'success',
      envio_sucesso: envioSucesso,
      formato_usado: formatoUsado,
      aiResponse: respostaIA,
      leadQuente: temInteresse
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ ERRO GERAL NO WEBHOOK:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Tentar salvar log do erro
    try {
      await supabaseClient.from('webhook_debug_logs').insert({
        payload: webhookData,
        extracted_phone: phoneNumber || 'ERRO',
        extracted_message: messageText || 'ERRO',
        processing_result: `ERRO: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      });
    } catch (logError) {
      console.error('❌ Erro ao salvar log:', logError);
    }

    // ⚠️ SEMPRE RETORNAR 200 - MESMO COM ERRO!
    // Isso evita que o WhatsApp fique reenviando a mensagem
    return new Response(
      JSON.stringify({ 
        status: 'error_handled',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
