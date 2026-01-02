// supabase/functions/wuzapi-webhook-afiliados/index.ts
// FASE 2: Webhook para sistema de eBooks de afiliados
// Infraestrutura: Contabo (api2.amzofertas.com.br)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================
// CORS HEADERS
// ============================================
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================
// TIPOS / INTERFACES
// ============================================
interface WhatsAppMessage {
  from: string
  to?: string
  type: 'image' | 'text' | 'document' | 'audio' | 'video'
  text?: string
  imageUrl?: string
  caption?: string
  timestamp: number
}

interface UserState {
  phone: string
  status: 'idle' | 'aguardando_comprovante' | 'aguardando_escolha' | 'processando'
  state: {
    comprovante_url?: string
    ebooks_disponiveis?: any[]
    ebook_escolhido?: number
    compra_info?: any
    user_id?: string | null
    recebido_em?: string
  }
}

// ============================================
// MAIN HANDLER
// ============================================
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔔 [AFILIADO-EBOOK] Webhook recebido!')
    
    // Inicializar Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse payload
    const payload = await req.json()
    console.log('📨 [AFILIADO-EBOOK] Payload:', JSON.stringify(payload, null, 2))

    // Extrair mensagem do payload Wuzapi
    const message = parseWuzapiPayload(payload)
    console.log('💬 [AFILIADO-EBOOK] Mensagem processada:', message)

    if (!message.from) {
      console.log('⚠️ [AFILIADO-EBOOK] Mensagem sem remetente, ignorando')
      return new Response(
        JSON.stringify({ success: true, message: 'Ignorado - sem remetente' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar afiliado pelo número que RECEBEU a mensagem (wuzapi_jid)
    const affiliateInfo = await findAffiliateByReceivingNumber(supabase, message.to || '')
    const wuzapiToken = affiliateInfo?.wuzapi_token
    const userId = affiliateInfo?.user_id

    if (!wuzapiToken) {
      console.log('⚠️ [AFILIADO-EBOOK] Token do afiliado não encontrado, usando token admin')
    }

    // Verificar blacklist
    const isBlacklisted = await checkBlacklist(supabase, message.from)
    if (isBlacklisted) {
      console.log('🚫 [AFILIADO-EBOOK] Número bloqueado:', message.from)
      await logEvent(supabase, {
        evento: 'mensagem_bloqueada',
        cliente_phone: message.from,
        user_id: userId
      })
      return new Response(
        JSON.stringify({ success: true, message: 'Bloqueado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar rate limit (5 por dia)
    const rateLimit = await checkRateLimit(supabase, message.from)
    if (rateLimit >= 5) {
      await sendWhatsAppMessage(
        message.from,
        '⚠️ *Limite diário atingido!*\n\nVocê já recebeu 5 eBooks hoje.\n\nTente novamente amanhã! 😊',
        wuzapiToken
      )
      
      await logEvent(supabase, {
        evento: 'rate_limit_excedido',
        cliente_phone: message.from,
        user_id: userId
      })
      
      return new Response(
        JSON.stringify({ success: true, message: 'Rate limit' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Roteamento por tipo de mensagem
    if (message.type === 'text' && message.text) {
      await handleTextMessage(supabase, message, wuzapiToken, userId)
    } else if (message.type === 'image' && message.imageUrl) {
      await handleImageMessage(supabase, message, wuzapiToken, userId)
    } else {
      // Tipo não suportado
      await sendWhatsAppMessage(
        message.from,
        '❌ Tipo de mensagem não suportado.\n\nEnvie:\n• Texto para escolher eBook\n• Imagem com seu comprovante',
        wuzapiToken
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Processado' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('❌ [AFILIADO-EBOOK] Erro no webhook:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// ============================================
// HELPER: FIND AFFILIATE BY RECEIVING NUMBER
// ============================================
async function findAffiliateByReceivingNumber(supabase: any, toNumber: string): Promise<any> {
  if (!toNumber) return null

  // Limpar número
  const cleanNumber = toNumber.replace(/\D/g, '')

  const { data, error } = await supabase
    .from('clientes_afiliados')
    .select('id, user_id, wuzapi_token, wuzapi_jid')
    .or(`wuzapi_jid.eq.${cleanNumber},wuzapi_jid.ilike.%${cleanNumber}%`)
    .limit(1)
    .single()

  if (error) {
    console.log('ℹ️ [AFILIADO-EBOOK] Afiliado não encontrado para:', toNumber)
    return null
  }

  return data
}

// ============================================
// HELPER: PARSE WUZAPI PAYLOAD
// ============================================
function parseWuzapiPayload(payload: any): WhatsAppMessage {
  // Wuzapi pode enviar em formatos diferentes
  // Formatos conhecidos: Evolution API, Wuzapi, Z-API
  
  // Tentar extrair número do remetente
  let from = ''
  if (payload.data?.key?.remoteJid) {
    from = payload.data.key.remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '')
  } else if (payload.from) {
    from = payload.from
  } else if (payload.author) {
    from = payload.author
  } else if (payload.sender) {
    from = payload.sender
  }

  // Tentar extrair número do destinatário (nosso número)
  let to = ''
  if (payload.data?.key?.participant) {
    to = payload.data.key.participant.replace('@s.whatsapp.net', '').replace('@c.us', '')
  } else if (payload.to) {
    to = payload.to
  } else if (payload.instance) {
    to = payload.instance
  }

  // Determinar tipo de mensagem
  let type: 'text' | 'image' | 'document' | 'audio' | 'video' = 'text'
  if (payload.data?.message?.imageMessage || payload.type === 'image' || payload.image) {
    type = 'image'
  } else if (payload.data?.message?.documentMessage || payload.type === 'document') {
    type = 'document'
  } else if (payload.data?.message?.audioMessage || payload.type === 'audio') {
    type = 'audio'
  } else if (payload.data?.message?.videoMessage || payload.type === 'video') {
    type = 'video'
  }

  // Extrair texto
  let text = ''
  if (payload.data?.message?.conversation) {
    text = payload.data.message.conversation
  } else if (payload.data?.message?.extendedTextMessage?.text) {
    text = payload.data.message.extendedTextMessage.text
  } else if (payload.text) {
    text = payload.text
  } else if (payload.body) {
    text = payload.body
  } else if (payload.message?.text) {
    text = payload.message.text
  }

  // Extrair URL da imagem
  let imageUrl = ''
  if (payload.data?.message?.imageMessage?.url) {
    imageUrl = payload.data.message.imageMessage.url
  } else if (payload.imageUrl) {
    imageUrl = payload.imageUrl
  } else if (payload.image?.url) {
    imageUrl = payload.image.url
  } else if (payload.media?.url) {
    imageUrl = payload.media.url
  }

  // Extrair caption
  let caption = ''
  if (payload.data?.message?.imageMessage?.caption) {
    caption = payload.data.message.imageMessage.caption
  } else if (payload.caption) {
    caption = payload.caption
  } else if (payload.image?.caption) {
    caption = payload.image.caption
  }

  return {
    from,
    to,
    type,
    text,
    imageUrl,
    caption,
    timestamp: payload.data?.messageTimestamp || payload.timestamp || Date.now()
  }
}

// ============================================
// HANDLER: MENSAGEM DE TEXTO
// ============================================
async function handleTextMessage(
  supabase: any, 
  message: WhatsAppMessage, 
  wuzapiToken: string | null,
  userId: string | null
) {
  const text = message.text!.trim().toLowerCase()
  console.log('💬 [AFILIADO-EBOOK] Processando texto:', text)

  // Comandos especiais
  if (text === 'ajuda' || text === 'help') {
    await sendWhatsAppMessage(message.from, getMensagemAjuda(), wuzapiToken)
    await logEvent(supabase, { evento: 'comando_ajuda', cliente_phone: message.from, user_id: userId })
    return
  }

  if (text === 'ebooks' || text === 'lista') {
    await sendWhatsAppMessage(message.from, getMensagemListaEbooks(), wuzapiToken)
    await logEvent(supabase, { evento: 'comando_lista', cliente_phone: message.from, user_id: userId })
    return
  }

  if (text === 'status') {
    const userState = await getUserState(supabase, message.from)
    await sendWhatsAppMessage(
      message.from,
      `📊 *Seu Status*\n\nEstado: ${userState?.status || 'idle'}\n\nEnvie seu comprovante para ganhar eBooks!`,
      wuzapiToken
    )
    await logEvent(supabase, { evento: 'comando_status', cliente_phone: message.from, user_id: userId })
    return
  }

  // Verifica se usuário está aguardando escolha de eBook
  const userState = await getUserState(supabase, message.from)

  if (userState && userState.status === 'aguardando_escolha') {
    await handleEbookChoice(supabase, message, userState, wuzapiToken, userId)
    return
  }

  // Mensagem padrão (usuário não está em fluxo específico)
  await sendWhatsAppMessage(message.from, getMensagemBemVindo(), wuzapiToken)
  
  // Salvar estado inicial
  await saveUserState(supabase, message.from, {
    status: 'idle',
    state: { user_id: userId }
  })

  await logEvent(supabase, {
    evento: 'mensagem_texto_recebida',
    cliente_phone: message.from,
    user_id: userId,
    metadata: { text: message.text }
  })
}

// ============================================
// HANDLER: MENSAGEM DE IMAGEM
// ============================================
async function handleImageMessage(
  supabase: any, 
  message: WhatsAppMessage,
  wuzapiToken: string | null,
  userId: string | null
) {
  console.log('📸 [AFILIADO-EBOOK] Processando imagem de:', message.from)

  // Salvar URL da imagem no estado do usuário
  await saveUserState(supabase, message.from, {
    status: 'processando',
    state: {
      comprovante_url: message.imageUrl,
      recebido_em: new Date().toISOString(),
      user_id: userId
    }
  })

  // Mensagem temporária (validação real será na FASE 3)
  await sendWhatsAppMessage(
    message.from,
    '📸 *Comprovante recebido!*\n\n⏳ Analisando...\n\n_Validação automática com IA será implementada na próxima fase._\n\nPor enquanto, envie o número *1* para receber um eBook de teste!',
    wuzapiToken
  )

  // Atualizar estado para aguardando escolha (simulado)
  await saveUserState(supabase, message.from, {
    status: 'aguardando_escolha',
    state: {
      comprovante_url: message.imageUrl,
      user_id: userId,
      ebooks_disponiveis: [
        { id: 1, titulo: 'Receitas Airfryer', arquivo: 'cozinha-receitas-airfryer.pdf' },
        { id: 2, titulo: 'Skincare Rotina', arquivo: 'beleza-skincare-rotina.pdf' },
        { id: 3, titulo: 'Treino em Casa', arquivo: 'fitness-treino-casa.pdf' }
      ]
    }
  })

  // Enviar opções (simulado)
  await sendWhatsAppMessage(
    message.from,
    '🎁 *Escolha seu eBook GRÁTIS!*\n\n' +
    '*1* - 🍳 Receitas Airfryer\n' +
    '*2* - ✨ Skincare Rotina\n' +
    '*3* - 💪 Treino em Casa\n\n' +
    'Digite o *número* do eBook que deseja!',
    wuzapiToken
  )

  await logEvent(supabase, {
    evento: 'comprovante_recebido',
    cliente_phone: message.from,
    user_id: userId,
    metadata: { imageUrl: message.imageUrl }
  })
}

// ============================================
// HANDLER: ESCOLHA DE EBOOK
// ============================================
async function handleEbookChoice(
  supabase: any, 
  message: WhatsAppMessage, 
  userState: UserState,
  wuzapiToken: string | null,
  userId: string | null
) {
  const escolha = parseInt(message.text!)

  if (isNaN(escolha) || escolha < 1 || escolha > 3) {
    await sendWhatsAppMessage(
      message.from,
      '❌ *Escolha inválida!*\n\nDigite *1*, *2* ou *3*',
      wuzapiToken
    )
    return
  }

  const ebook = userState.state.ebooks_disponiveis![escolha - 1]

  // Enviar PDF
  await sendWhatsAppPDF(message.from, ebook.arquivo, ebook.titulo, wuzapiToken)

  // Mensagem de sucesso
  await sendWhatsAppMessage(
    message.from,
    `✅ *eBook enviado!*\n\n📚 ${ebook.titulo}\n\n` +
    `Aproveite seu eBook!\n\n` +
    `💡 *Dica:* Faça mais compras e ganhe mais eBooks! 🎁`,
    wuzapiToken
  )

  // Registrar entrega
  await logEbookDelivery(supabase, {
    phone: message.from,
    ebook_titulo: ebook.titulo,
    ebook_filename: ebook.arquivo,
    loja: 'Teste',
    valor_compra: 0,
    categoria: 'Teste',
    comprovante_url: userState.state.comprovante_url,
    user_id: userId
  })

  // Limpar estado
  await clearUserState(supabase, message.from)

  await logEvent(supabase, {
    evento: 'ebook_entregue',
    cliente_phone: message.from,
    user_id: userId,
    metadata: { titulo: ebook.titulo, arquivo: ebook.arquivo }
  })
}

// ============================================
// DATABASE: GET USER STATE
// ============================================
async function getUserState(supabase: any, phone: string): Promise<UserState | null> {
  const { data, error } = await supabase
    .from('afiliado_user_states')
    .select('*')
    .eq('phone', phone)
    .single()

  if (error) {
    console.log('ℹ️ [AFILIADO-EBOOK] Estado não encontrado para:', phone)
    return null
  }

  return data
}

// ============================================
// DATABASE: SAVE USER STATE
// ============================================
async function saveUserState(supabase: any, phone: string, stateData: Partial<UserState>) {
  const { error } = await supabase
    .from('afiliado_user_states')
    .upsert({
      phone: phone,
      status: stateData.status || 'idle',
      state: stateData.state || {},
      updated_at: new Date().toISOString()
    }, { onConflict: 'phone' })

  if (error) {
    console.error('❌ [AFILIADO-EBOOK] Erro ao salvar estado:', error)
    throw error
  }

  console.log('✅ [AFILIADO-EBOOK] Estado salvo:', phone, stateData.status)
}

// ============================================
// DATABASE: CLEAR USER STATE
// ============================================
async function clearUserState(supabase: any, phone: string) {
  const { error } = await supabase
    .from('afiliado_user_states')
    .delete()
    .eq('phone', phone)

  if (error) {
    console.error('❌ [AFILIADO-EBOOK] Erro ao limpar estado:', error)
  } else {
    console.log('🗑️ [AFILIADO-EBOOK] Estado limpo:', phone)
  }
}

// ============================================
// DATABASE: CHECK BLACKLIST
// ============================================
async function checkBlacklist(supabase: any, phone: string): Promise<boolean> {
  const { data } = await supabase
    .rpc('verificar_blacklist_afiliado', { p_phone: phone })

  return data === true
}

// ============================================
// DATABASE: CHECK RATE LIMIT
// ============================================
async function checkRateLimit(supabase: any, phone: string): Promise<number> {
  const { data } = await supabase
    .rpc('verificar_rate_limit_afiliado', { p_phone: phone })

  return data || 0
}

// ============================================
// DATABASE: LOG EVENT
// ============================================
async function logEvent(supabase: any, event: any) {
  const { error } = await supabase
    .from('afiliado_analytics_ebooks')
    .insert({
      evento: event.evento,
      cliente_phone: event.cliente_phone,
      loja: event.loja || null,
      valor: event.valor || null,
      categoria: event.categoria || null,
      ebook_id: event.ebook_id || null,
      produto: event.produto || null,
      motivo: event.motivo || null,
      confianca: event.confianca || null,
      user_id: event.user_id || null,
      metadata: event.metadata || {}
    })

  if (error) {
    console.error('❌ [AFILIADO-EBOOK] Erro ao registrar evento:', error)
  } else {
    console.log('📊 [AFILIADO-EBOOK] Evento registrado:', event.evento)
  }
}

// ============================================
// DATABASE: LOG EBOOK DELIVERY
// ============================================
async function logEbookDelivery(supabase: any, delivery: any) {
  const { error } = await supabase
    .from('afiliado_ebook_deliveries')
    .insert({
      phone: delivery.phone,
      ebook_titulo: delivery.ebook_titulo,
      ebook_filename: delivery.ebook_filename,
      loja: delivery.loja || null,
      valor_compra: delivery.valor_compra || null,
      categoria: delivery.categoria || null,
      comprovante_url: delivery.comprovante_url || null,
      user_id: delivery.user_id || null
    })

  if (error) {
    console.error('❌ [AFILIADO-EBOOK] Erro ao registrar entrega:', error)
  } else {
    console.log('✅ [AFILIADO-EBOOK] Entrega registrada:', delivery.ebook_titulo)
  }
}

// ============================================
// WHATSAPP: SEND MESSAGE (via Contabo)
// ============================================
async function sendWhatsAppMessage(to: string, message: string, customToken?: string | null) {
  // Usar infraestrutura Contabo para afiliados
  const WUZAPI_URL = Deno.env.get('CONTABO_WUZAPI_URL') || Deno.env.get('WUZAPI_URL')
  const WUZAPI_TOKEN = customToken || Deno.env.get('CONTABO_WUZAPI_ADMIN_TOKEN') || Deno.env.get('WUZAPI_TOKEN')

  if (!WUZAPI_URL || !WUZAPI_TOKEN) {
    console.error('❌ [AFILIADO-EBOOK] WUZAPI_URL ou WUZAPI_TOKEN não configurado!')
    return
  }

  // Limpar número
  const cleanPhone = to.replace(/\D/g, '')

  try {
    const response = await fetch(`${WUZAPI_URL}/chat/send/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': WUZAPI_TOKEN
      },
      body: JSON.stringify({
        phone: cleanPhone,
        message: message
      })
    })

    const responseText = await response.text()
    
    if (!response.ok) {
      console.error('❌ [AFILIADO-EBOOK] Erro ao enviar mensagem:', responseText)
    } else {
      console.log('✅ [AFILIADO-EBOOK] Mensagem enviada para:', cleanPhone)
    }
  } catch (error) {
    console.error('❌ [AFILIADO-EBOOK] Erro ao enviar mensagem:', error)
  }
}

// ============================================
// WHATSAPP: SEND PDF (via Contabo)
// ============================================
async function sendWhatsAppPDF(to: string, filename: string, caption: string, customToken?: string | null) {
  const WUZAPI_URL = Deno.env.get('CONTABO_WUZAPI_URL') || Deno.env.get('WUZAPI_URL')
  const WUZAPI_TOKEN = customToken || Deno.env.get('CONTABO_WUZAPI_ADMIN_TOKEN') || Deno.env.get('WUZAPI_TOKEN')
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')

  if (!WUZAPI_URL || !WUZAPI_TOKEN || !SUPABASE_URL) {
    console.error('❌ [AFILIADO-EBOOK] Variáveis não configuradas!')
    return
  }

  // URL pública do PDF no Supabase Storage
  const pdfUrl = `${SUPABASE_URL}/storage/v1/object/public/ebooks/${filename}`
  const cleanPhone = to.replace(/\D/g, '')

  try {
    const response = await fetch(`${WUZAPI_URL}/chat/send/document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': WUZAPI_TOKEN
      },
      body: JSON.stringify({
        phone: cleanPhone,
        document: pdfUrl,
        caption: `📚 ${caption}`,
        filename: filename
      })
    })

    const responseText = await response.text()
    
    if (!response.ok) {
      console.error('❌ [AFILIADO-EBOOK] Erro ao enviar PDF:', responseText)
      // Fallback: enviar link
      await sendWhatsAppMessage(
        to,
        `📚 *${caption}*\n\n📥 Baixe aqui: ${pdfUrl}`,
        customToken
      )
    } else {
      console.log('✅ [AFILIADO-EBOOK] PDF enviado para:', cleanPhone)
    }
  } catch (error) {
    console.error('❌ [AFILIADO-EBOOK] Erro ao enviar PDF:', error)
    // Fallback: enviar link
    await sendWhatsAppMessage(
      to,
      `📚 *${caption}*\n\n📥 Baixe aqui: ${pdfUrl}`,
      customToken
    )
  }
}

// ============================================
// MENSAGENS PADRÃO
// ============================================
function getMensagemBemVindo(): string {
  return `🎉 *Bem-vindo ao Sistema de eBooks!*\n\n` +
    `📸 *Envie seu comprovante* de compra da Amazon, Magazine Luiza ou Mercado Livre\n\n` +
    `🎁 *Ganhe eBooks GRÁTIS* como brinde!\n\n` +
    `💡 *Comandos:*\n` +
    `• Digite *AJUDA* para instruções\n` +
    `• Digite *EBOOKS* para ver catálogo\n` +
    `• Digite *STATUS* para ver seu status`
}

function getMensagemAjuda(): string {
  return `📚 *Como Funciona*\n\n` +
    `1️⃣ Faça uma compra na Amazon, Magazine Luiza ou Mercado Livre\n\n` +
    `2️⃣ Tire uma foto do seu comprovante\n\n` +
    `3️⃣ Envie aqui no WhatsApp\n\n` +
    `4️⃣ Nossa IA valida automaticamente\n\n` +
    `5️⃣ Escolha seu eBook grátis!\n\n` +
    `⚡ *Rápido, fácil e automático!*`
}

function getMensagemListaEbooks(): string {
  return `📚 *Catálogo de eBooks*\n\n` +
    `🍳 *COZINHA*\n` +
    `• Receitas Airfryer\n` +
    `• Guia de Panelas\n\n` +
    `✨ *BELEZA*\n` +
    `• Skincare Completo\n` +
    `• Maquiagem Iniciante\n\n` +
    `💪 *FITNESS*\n` +
    `• Treino em Casa\n` +
    `• Dieta Flexível\n\n` +
    `👶 *BEBÊ*\n` +
    `• Primeiros Meses\n` +
    `• Alimentação Infantil\n\n` +
    `📱 *TECH*\n` +
    `• Apps Essenciais\n` +
    `• Produtividade Digital\n\n` +
    `*E muito mais!*\n\n` +
    `Envie seu comprovante e ganhe! 🎁`
}
