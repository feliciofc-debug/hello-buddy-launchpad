// supabase/functions/wuzapi-webhook-afiliados/index.ts
// FASE 4: Funil de Captação via eBook com Segmentação Automática
// Fluxo: Nome → Nichos → eBook → Cashback 2% → Listas de Transmissão

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
  status: 'idle' | 'aguardando_nome' | 'aguardando_nichos' | 'aguardando_comprovante' | 'aguardando_escolha' | 'processando'
  state: {
    nome?: string
    nichos_escolhidos?: string[]
    comprovante_url?: string
    ebooks_disponiveis?: any[]
    ebook_escolhido?: number
    compra_info?: any
    user_id?: string | null
    recebido_em?: string
    origem?: string
  }
}

interface ComprovanteAnalysis {
  valido: boolean
  loja: string
  valor: number
  produto: string
  data: string
  categoria: string
  confianca: number
  motivo_invalido?: string
}

// ============================================
// CATEGORIAS DISPONÍVEIS
// ============================================
const CATEGORIAS = [
  { id: 'casa', nome: 'Casa', icone: '🏠' },
  { id: 'cozinha', nome: 'Cozinha', icone: '🍳' },
  { id: 'bebe', nome: 'Bebê', icone: '👶' },
  { id: 'tech', nome: 'Tech', icone: '📱' },
  { id: 'gamer', nome: 'Gamer', icone: '🎮' },
  { id: 'beleza', nome: 'Beleza', icone: '💄' },
  { id: 'fitness', nome: 'Fitness', icone: '💪' },
  { id: 'ferramentas', nome: 'Ferramentas', icone: '🔧' },
  { id: 'pet', nome: 'Pet', icone: '🐾' },
  { id: 'decoracao', nome: 'Decoração', icone: '🎨' },
  { id: 'moda', nome: 'Moda', icone: '👗' },
  { id: 'automotivo', nome: 'Automotivo', icone: '🚗' },
]

// ============================================
// MAIN HANDLER
// ============================================
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔔 [AFILIADO-FUNIL] Webhook recebido!')
    
    // Inicializar Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse payload (robusto - aceita JSON, text/plain, urlencoded)
    let payload: any = null
    let rawBody = ''
    const contentType = req.headers.get('content-type') || ''

    try {
      if (contentType.includes('application/json')) {
        payload = await req.json()
      } else {
        rawBody = await req.text()

        // 1) tentar JSON direto
        try {
          payload = JSON.parse(rawBody)
        } catch {
          // 2) tentar urlencoded/querystring
          const params = new URLSearchParams(rawBody)

          // algumas Wuzapi mandam um campo com JSON dentro
          const embeddedJson =
            params.get('jsonData') ||
            params.get('payload') ||
            params.get('data')

          const allParams = Object.fromEntries(params.entries())

          if (embeddedJson) {
            try {
              const parsed = JSON.parse(embeddedJson)
              // mantém instanceName/userID e também expõe o JSON parseado
              payload = {
                ...allParams,
                jsonData: parsed,
                ...parsed,
              }
            } catch {
              payload = { ...allParams, raw: rawBody, note: 'embeddedJson_invalid' }
            }
          } else {
            payload = allParams
          }
        }
      }
    } catch (err: any) {
      try { rawBody = rawBody || await req.text() } catch {}
      payload = { raw: rawBody, parse_error: String(err?.message || err) }
    }

    if (rawBody) {
      console.log('📦 [AFILIADO-FUNIL] Raw body (non-json):', rawBody.slice(0, 2000))
    }

    console.log('📨 [AFILIADO-FUNIL] Payload:', JSON.stringify(payload, null, 2))

    // Extrair mensagem do payload Wuzapi
    const message = parseWuzapiPayload(payload)
    console.log('💬 [AFILIADO-FUNIL] Mensagem processada:', message)

    if (!message.from) {
      console.log('⚠️ [AFILIADO-FUNIL] Mensagem sem remetente, ignorando')
      return new Response(
        JSON.stringify({ success: true, message: 'Ignorado - sem remetente' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar afiliado pelo número que RECEBEU a mensagem (wuzapi_jid) OU pelo instanceName (wuzapi_instance_id)
    const affiliateInfo = await findAffiliateByReceivingNumber(supabase, message.to || '')
    const wuzapiToken = affiliateInfo?.wuzapi_token
    const userId = affiliateInfo?.user_id

    // Sem token do afiliado: não responde (evita sair pelo PJ)
    if (!wuzapiToken) {
      console.log('🚫 [AFILIADO-FUNIL] Token do afiliado não encontrado. Abortando envio para evitar PJ.')
      return new Response(
        JSON.stringify({ success: true, message: 'Ignorado - token afiliado ausente' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }


    // Verificar blacklist
    const isBlacklisted = await checkBlacklist(supabase, message.from)
    if (isBlacklisted) {
      console.log('🚫 [AFILIADO-FUNIL] Número bloqueado:', message.from)
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

    // Roteamento por tipo de mensagem
    if (message.type === 'text' && message.text) {
      await handleTextMessage(supabase, message, wuzapiToken, userId)
    } else if (message.type === 'image' && message.imageUrl) {
      await handleImageMessage(supabase, message, wuzapiToken, userId)
    } else {
      // Tipo não suportado - APENAS IGNORAR, não responder para evitar spam
      console.log(`⏭️ [AFILIADO-FUNIL] Tipo não suportado ignorado: ${message.type}`)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Processado' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('❌ [AFILIADO-FUNIL] Erro no webhook:', error)
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

  const raw = String(toNumber).trim()
  const cleanNumber = raw.replace(/\D/g, '')

  // 1) Quando vier número/JID, buscar por wuzapi_jid
  if (cleanNumber.length >= 8) {
    const { data, error } = await supabase
      .from('clientes_afiliados')
      .select('id, user_id, wuzapi_token, wuzapi_jid, wuzapi_instance_id')
      .or(`wuzapi_jid.eq.${cleanNumber},wuzapi_jid.ilike.%${cleanNumber}%`)
      .limit(1)
      .single()

    if (!error && data) return data
  }

  // 2) Quando vier instanceName (ex: "AMZ-Ofertas"), buscar por wuzapi_instance_id
  const { data, error } = await supabase
    .from('clientes_afiliados')
    .select('id, user_id, wuzapi_token, wuzapi_jid, wuzapi_instance_id')
    .or(`wuzapi_instance_id.eq.${raw},wuzapi_instance_id.ilike.%${raw}%`)
    .limit(1)
    .single()

  if (error) {
    console.log('ℹ️ [AFILIADO-FUNIL] Afiliado não encontrado para:', raw)
    return null
  }

  return data
}


// ============================================
// HELPER: PARSE WUZAPI PAYLOAD
// ============================================
function parseWuzapiPayload(payload: any): WhatsAppMessage {
  // ===== Formato Contabo (urlencoded + jsonData), ex: payload.type === "Message"
  if (payload?.type === 'Message' && payload?.event?.Info) {
    const info = payload.event.Info
    const msg = payload.event.Message

    // só processa mensagens recebidas do cliente (ignora IsFromMe)
    if (info.IsFromMe === true) {
      console.log('⏭️ [AFILIADO-FUNIL] Ignorando mensagem enviada por nós (IsFromMe=true)')
      return { from: '', to: '', type: 'text', text: '', timestamp: Date.now() }
    }

    const cleanJid = (jid: string) => {
      // Remove sufixos WhatsApp e extrai apenas dígitos
      // Ex: "5521995379550:11@s.whatsapp.net" -> "5521995379550"
      const cleaned = (jid || '')
        .replace('@s.whatsapp.net', '')
        .replace('@c.us', '')
        .replace('@lid', '')
        .replace(/:\d+$/, '') // Remove :XX no final (device ID)
      return cleaned.replace(/\D/g, '') // Só dígitos
    }

    // Contabo pode mandar o número real em Sender (ex: 5521...@s.whatsapp.net)
    // e SenderAlt pode vir como LID (não roteável). Então só usamos SenderAlt se parecer telefone.
    const senderAlt = String(info.SenderAlt || '')
    const sender = String(info.Sender || '')
    const chat = String(info.Chat || '')

    const senderAltDigits = cleanJid(senderAlt)
    const senderDigits = cleanJid(sender)

    const looksLikePhone = (digits: string) => digits.length >= 10 && digits.startsWith('55')

    const from = looksLikePhone(senderAltDigits)
      ? senderAltDigits
      : (looksLikePhone(senderDigits) ? senderDigits : cleanJid(chat))

    const to = String(payload.instanceName || '')

    const text =
      msg?.conversation ||
      msg?.extendedTextMessage?.text ||
      ''

    console.log(`📱 [AFILIADO-FUNIL] Contabo format - From: ${from}, To: ${to}, Text: ${text.slice(0,50)}`)

    return {
      from,
      to,
      type: 'text',
      text,
      timestamp: Date.parse(info.Timestamp || '') || Date.now(),
    }
  }

  // ===== Formato antigo / outros formatos =====
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
  const text = message.text!.trim()
  const textLower = text.toLowerCase()
  console.log('💬 [AFILIADO-FUNIL] Processando texto:', text)

  // Buscar estado atual do usuário
  const userState = await getUserState(supabase, message.from)
  console.log('📊 [AFILIADO-FUNIL] Estado atual:', userState?.status || 'novo')

  // Comandos especiais (funcionam em qualquer estado)
  if (textLower === 'ajuda' || textLower === 'help') {
    await sendWhatsAppMessage(message.from, getMensagemAjuda(), wuzapiToken)
    await logEvent(supabase, { evento: 'comando_ajuda', cliente_phone: message.from, user_id: userId })
    return
  }

  if (textLower === 'saldo' || textLower === 'cashback') {
    await handleCashbackCommand(supabase, message.from, wuzapiToken, userId)
    return
  }

  if (textLower === 'status') {
    await sendWhatsAppMessage(
      message.from,
      `📊 *Seu Status*\n\nEstado: ${userState?.status || 'Novo usuário'}\n\nDigite qualquer coisa para começar!`,
      wuzapiToken
    )
    return
  }

  if (textLower === 'reiniciar' || textLower === 'recomecar') {
    await clearUserState(supabase, message.from)
    await sendWhatsAppMessage(message.from, getMensagemBoasVindas(), wuzapiToken)
    await saveUserState(supabase, message.from, {
      status: 'aguardando_nome',
      state: { user_id: userId, origem: 'reinicio' }
    })
    return
  }

  // ========== FLUXO CONVERSACIONAL ==========

  // Palavras-chave que ativam o funil (link de campanha)
  const triggerKeywords = ['ebook', 'oferta', 'quero', 'receita', 'airfryer']
  const isTriggerWord = triggerKeywords.some(kw => textLower.includes(kw))

  // ESTADO: Novo usuário ou idle → Só inicia se tiver palavra-chave
  if (!userState || userState.status === 'idle') {
    if (!isTriggerWord) {
      console.log(`⏸️ [AFILIADO-FUNIL] Mensagem ignorada (sem palavra-chave): "${text}"`)
      return // Não responde - não veio pelo link da campanha
    }
    
    await sendWhatsAppMessage(message.from, getMensagemBoasVindas(), wuzapiToken)
    await saveUserState(supabase, message.from, {
      status: 'aguardando_nome',
      state: { user_id: userId, origem: 'whatsapp' }
    })
    await logEvent(supabase, { evento: 'novo_lead', cliente_phone: message.from, user_id: userId })
    return
  }

  // ESTADO: Aguardando Nome
  if (userState.status === 'aguardando_nome') {
    await handleNomeInput(supabase, message, userState, wuzapiToken, userId)
    return
  }

  // ESTADO: Aguardando Nichos
  if (userState.status === 'aguardando_nichos') {
    await handleNichosInput(supabase, message, userState, wuzapiToken, userId)
    return
  }

  // ESTADO: Aguardando Comprovante
  if (userState.status === 'aguardando_comprovante') {
    await sendWhatsAppMessage(
      message.from,
      '📸 Estou aguardando seu *comprovante de compra*!\n\n' +
      'Envie uma *foto* do comprovante para validar e receber seu cashback de 2%! 💰\n\n' +
      '💡 Lojas aceitas: Amazon, Magazine Luiza, Mercado Livre',
      wuzapiToken
    )
    return
  }

  // ESTADO: Aguardando Escolha de eBook
  if (userState.status === 'aguardando_escolha') {
    await handleEbookChoice(supabase, message, userState, wuzapiToken, userId)
    return
  }

  // Fallback: reiniciar fluxo
  await sendWhatsAppMessage(message.from, getMensagemBoasVindas(), wuzapiToken)
  await saveUserState(supabase, message.from, {
    status: 'aguardando_nome',
    state: { user_id: userId }
  })
}

// ============================================
// HANDLER: INPUT DO NOME
// ============================================
async function handleNomeInput(
  supabase: any, 
  message: WhatsAppMessage, 
  userState: UserState,
  wuzapiToken: string | null,
  userId: string | null
) {
  const nome = message.text!.trim()
  
  // Validar nome (pelo menos 2 caracteres, sem números)
  if (nome.length < 2 || /\d/.test(nome)) {
    await sendWhatsAppMessage(
      message.from,
      '❌ Por favor, digite um nome válido (sem números).\n\nQual é o seu nome?',
      wuzapiToken
    )
    return
  }

  console.log('✅ [AFILIADO-FUNIL] Nome recebido:', nome)

  // Salvar nome e avançar para nichos
  await saveUserState(supabase, message.from, {
    status: 'aguardando_nichos',
    state: {
      ...userState.state,
      nome: nome
    }
  })

  // Montar mensagem com categorias
  let mensagem = `Prazer, *${nome}*! 😊\n\n`
  mensagem += `Agora escolha os *nichos* que você mais gosta:\n\n`
  
  CATEGORIAS.forEach((cat) => {
    mensagem += `${cat.icone} ${cat.nome}\n`
  })

  mensagem += `\n━━━━━━━━━━━━━━━━━━\n\n`
  mensagem += `💡 *Digite os nomes separados por vírgula*\n`
  mensagem += `Exemplo: *Casa, Cozinha, Pet*\n\n`
  mensagem += `Ou digite *TODOS* para receber de tudo!`

  await sendWhatsAppMessage(message.from, mensagem, wuzapiToken)
  
  await logEvent(supabase, {
    evento: 'nome_informado',
    cliente_phone: message.from,
    user_id: userId,
    metadata: { nome }
  })
}

// ============================================
// HANDLER: INPUT DOS NICHOS
// ============================================
async function handleNichosInput(
  supabase: any, 
  message: WhatsAppMessage, 
  userState: UserState,
  wuzapiToken: string | null,
  userId: string | null
) {
  const text = message.text!.trim()
  const textLower = text.toLowerCase()
  let nichosEscolhidos: string[] = []

  // Função para normalizar texto (remover acentos)
  const normalizar = (str: string) => 
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

  // Verificar se escolheu TODOS
  if (textLower === 'todos' || textLower === 'tudo') {
    nichosEscolhidos = CATEGORIAS.map(c => c.nome)
  } else {
    // Separar por vírgula, ponto-e-vírgula ou espaço
    const partes = text.split(/[,;]+/).map(p => p.trim()).filter(p => p.length > 0)
    
    if (partes.length === 0) {
      await sendWhatsAppMessage(
        message.from,
        '❌ Não entendi sua escolha.\n\nDigite os *nomes* das categorias separados por vírgula.\n\nExemplo: *Casa, Cozinha, Pet*\n\nOu digite *TODOS* para receber de tudo!',
        wuzapiToken
      )
      return
    }

    // Mapear nomes para categorias (ignorando acentos e maiúsculas)
    for (const parte of partes) {
      const parteNorm = normalizar(parte)
      const catEncontrada = CATEGORIAS.find(c => normalizar(c.nome) === parteNorm)
      if (catEncontrada && !nichosEscolhidos.includes(catEncontrada.nome)) {
        nichosEscolhidos.push(catEncontrada.nome)
      }
    }

    if (nichosEscolhidos.length === 0) {
      const nomesDisponiveis = CATEGORIAS.map(c => c.nome).join(', ')
      await sendWhatsAppMessage(
        message.from,
        `❌ Não encontrei essas categorias!\n\nCategorias disponíveis: *${nomesDisponiveis}*\n\nExemplo: *Casa, Cozinha, Pet*`,
        wuzapiToken
      )
      return
    }
  }

  console.log('✅ [AFILIADO-FUNIL] Nichos escolhidos:', nichosEscolhidos)

  const nome = userState.state.nome || 'Amigo(a)'

  // ========== SALVAR LEAD NO BANCO ==========
  const lead = await saveLeadAndAddToLists(supabase, message.from, nome, nichosEscolhidos, userId)
  console.log('✅ [AFILIADO-FUNIL] Lead salvo:', lead?.id)

  // ========== ATUALIZAR ESTADO ==========
  await saveUserState(supabase, message.from, {
    status: 'aguardando_comprovante',
    state: {
      ...userState.state,
      nichos_escolhidos: nichosEscolhidos
    }
  })

  // ========== ENTREGAR EBOOK GRÁTIS ==========
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
  const ebookHtmlUrl = `${SUPABASE_URL}/functions/v1/ebook-airfryer`
  
  // Montar lista de nichos
  const nichosFormatados = nichosEscolhidos.map(n => {
    const cat = CATEGORIAS.find(c => c.nome === n)
    return cat ? `${cat.icone} ${cat.nome}` : n
  }).join('\n')

  let mensagem = `✅ *Perfeito, ${nome}!*\n\n`
  mensagem += `Você foi adicionado(a) às listas:\n${nichosFormatados}\n\n`
  mensagem += `━━━━━━━━━━━━━━━━━━\n\n`
  mensagem += `🎁 *PRESENTE DE BOAS-VINDAS!*\n\n`
  mensagem += `📚 Seu eBook *"50 Receitas na Airfryer"* está pronto!\n\n`
  mensagem += `👉 Acesse aqui: ${ebookHtmlUrl}\n\n`
  mensagem += `━━━━━━━━━━━━━━━━━━\n\n`
  mensagem += `💰 *CASHBACK DE 2% ATIVADO!*\n\n`
  mensagem += `A partir de agora, a cada compra que você fizer nos marketplaces, envie o comprovante aqui e ganhe:\n\n`
  mensagem += `✅ 2% de cashback no seu saldo\n`
  mensagem += `✅ eBooks exclusivos\n`
  mensagem += `✅ Ofertas personalizadas\n\n`
  mensagem += `📸 *Envie seu primeiro comprovante!*`

  await sendWhatsAppMessage(message.from, mensagem, wuzapiToken)

  // Tentar enviar PDF também
  await sendWhatsAppPDF(message.from, 'ebook-airfryer-COMPLETO.pdf', '50 Receitas na Airfryer', wuzapiToken)

  await logEvent(supabase, {
    evento: 'lead_captado',
    cliente_phone: message.from,
    user_id: userId,
    metadata: { nome, nichos: nichosEscolhidos }
  })
}

// ============================================
// SALVAR LEAD E ADICIONAR ÀS LISTAS
// ============================================
async function saveLeadAndAddToLists(
  supabase: any,
  phone: string,
  nome: string,
  nichos: string[],
  userId: string | null
): Promise<any> {
  try {
    // 1. Upsert Lead
    const { data: lead, error: leadError } = await supabase
      .from('leads_ebooks')
      .upsert({
        phone: phone.replace(/\D/g, ''),
        nome: nome,
        origem: 'ebook',
        origem_detalhe: 'whatsapp',
        ebook_recebido: 'ebook-airfryer-COMPLETO.html',
        cashback_ativo: true,
        user_id: userId
      }, { onConflict: 'phone' })
      .select()
      .single()

    if (leadError) {
      console.error('❌ [AFILIADO-FUNIL] Erro ao salvar lead:', leadError)
      return null
    }

    console.log('✅ [AFILIADO-FUNIL] Lead salvo:', lead.id)

    // 2. Buscar listas por nome
    const { data: listas } = await supabase
      .from('afiliado_listas_categoria')
      .select('id, nome')
      .in('nome', nichos)

    if (!listas || listas.length === 0) {
      console.log('⚠️ [AFILIADO-FUNIL] Nenhuma lista encontrada para:', nichos)
      return lead
    }

    // 3. Adicionar lead às listas
    const membros = listas.map((lista: any) => ({
      lead_id: lead.id,
      lista_id: lista.id
    }))

    const { error: membrosError } = await supabase
      .from('afiliado_lista_membros')
      .upsert(membros, { onConflict: 'lead_id,lista_id', ignoreDuplicates: true })

    if (membrosError) {
      console.error('❌ [AFILIADO-FUNIL] Erro ao adicionar às listas:', membrosError)
    } else {
      console.log('✅ [AFILIADO-FUNIL] Lead adicionado a', listas.length, 'listas')
    }

    // 4. Ativar cashback automaticamente
    await supabase
      .from('afiliado_cashback')
      .upsert({
        phone: phone.replace(/\D/g, ''),
        saldo_atual: 0,
        total_acumulado: 0,
        total_resgatado: 0,
        compras_total: 0,
        valor_compras_total: 0
      }, { onConflict: 'phone' })

    console.log('✅ [AFILIADO-FUNIL] Cashback ativado para:', phone)

    return lead

  } catch (error) {
    console.error('❌ [AFILIADO-FUNIL] Erro geral ao salvar lead:', error)
    return null
  }
}

// ============================================
// HANDLER: MENSAGEM DE IMAGEM (COMPROVANTE)
// ============================================
async function handleImageMessage(
  supabase: any, 
  message: WhatsAppMessage,
  wuzapiToken: string | null,
  userId: string | null
) {
  console.log('📸 [AFILIADO-FUNIL] Processando comprovante de:', message.from)

  try {
    // Verificar rate limit
    const rateLimit = await checkRateLimit(supabase, message.from)
    if (rateLimit >= 5) {
      await sendWhatsAppMessage(
        message.from,
        '⚠️ *Limite diário atingido!*\n\nVocê já recebeu 5 eBooks hoje.\n\nTente novamente amanhã! 😊',
        wuzapiToken
      )
      return
    }

    // Mensagem de aguardo
    await sendWhatsAppMessage(
      message.from,
      '⏳ *Analisando seu comprovante...*\n\nAguarde alguns segundos enquanto nossa IA valida sua compra...',
      wuzapiToken
    )

    // Log: comprovante recebido
    await logEvent(supabase, {
      evento: 'comprovante_recebido',
      cliente_phone: message.from,
      user_id: userId,
      metadata: { imageUrl: message.imageUrl }
    })

    // ANÁLISE COM GEMINI VISION
    const analysis = await analyzeComprovanteGemini(message.imageUrl!)
    console.log('🧠 [AFILIADO-FUNIL] Análise completa:', analysis)

    // VALIDAÇÃO ANTI-FRAUDE
    const validation = validateComprovante(analysis)

    if (!validation.valid) {
      await sendWhatsAppMessage(
        message.from,
        `❌ *Comprovante não validado*\n\n` +
        `📋 Motivo: ${validation.reason}\n\n` +
        `💡 *Dicas:*\n` +
        `• Tire uma foto mais nítida\n` +
        `• Valor mínimo: R$ 50\n` +
        `• Lojas aceitas: Amazon, Magazine Luiza, Mercado Livre\n\n` +
        `Tente novamente!`,
        wuzapiToken
      )

      await logEvent(supabase, {
        evento: 'comprovante_rejeitado',
        cliente_phone: message.from,
        loja: analysis.loja,
        valor: analysis.valor,
        motivo: validation.reason,
        confianca: analysis.confianca,
        user_id: userId
      })
      return
    }

    // COMPROVANTE VÁLIDO!
    console.log('✅ [AFILIADO-FUNIL] Comprovante validado:', analysis)

    // Calcular cashback (2%)
    const cashback = analysis.valor * 0.02

    // Atualizar saldo de cashback
    await addCashback(supabase, message.from, cashback, analysis)

    // Buscar eBooks da categoria
    const ebooks = getEbooksByCategory(analysis.categoria)

    // Salvar estado (aguardando escolha)
    await saveUserState(supabase, message.from, {
      status: 'aguardando_escolha',
      state: {
        comprovante_url: message.imageUrl,
        ebooks_disponiveis: ebooks,
        compra_info: analysis,
        user_id: userId
      }
    })

    // Montar mensagem
    let mensagem = `✅ *Comprovante validado!*\n\n`
    mensagem += `🏪 Loja: ${analysis.loja}\n`
    mensagem += `💰 Valor: R$ ${analysis.valor.toFixed(2)}\n`
    mensagem += `📦 Produto: ${analysis.produto}\n\n`
    mensagem += `💵 *CASHBACK: +R$ ${cashback.toFixed(2)}*\n\n`
    mensagem += `━━━━━━━━━━━━━━━━━━\n\n`
    mensagem += `🎁 *Escolha seu eBook GRÁTIS!*\n\n`
    mensagem += `Categoria: *${analysis.categoria}*\n\n`

    ebooks.forEach((ebook: any, index: number) => {
      mensagem += `*${index + 1}* - ${ebook.titulo}\n`
    })

    mensagem += `\n💬 Digite o *número* do eBook!`

    await sendWhatsAppMessage(message.from, mensagem, wuzapiToken)

    await logEvent(supabase, {
      evento: 'comprovante_validado',
      cliente_phone: message.from,
      loja: analysis.loja,
      valor: analysis.valor,
      categoria: analysis.categoria,
      user_id: userId
    })

  } catch (error) {
    console.error('❌ [AFILIADO-FUNIL] Erro ao processar comprovante:', error)
    await sendWhatsAppMessage(
      message.from,
      '❌ *Erro ao processar comprovante*\n\nTente novamente em alguns instantes.',
      wuzapiToken
    )
  }
}

// ============================================
// ADICIONAR CASHBACK
// ============================================
async function addCashback(
  supabase: any,
  phone: string,
  valor: number,
  compraInfo: any
) {
  const cleanPhone = phone.replace(/\D/g, '')

  // Buscar saldo atual
  const { data: cashbackData } = await supabase
    .from('afiliado_cashback')
    .select('*')
    .eq('phone', cleanPhone)
    .single()

  const saldoAnterior = cashbackData?.saldo_atual || 0
  const novoSaldo = saldoAnterior + valor

  // Atualizar saldo
  await supabase
    .from('afiliado_cashback')
    .upsert({
      phone: cleanPhone,
      saldo_atual: novoSaldo,
      total_acumulado: (cashbackData?.total_acumulado || 0) + valor,
      compras_total: (cashbackData?.compras_total || 0) + 1,
      valor_compras_total: (cashbackData?.valor_compras_total || 0) + compraInfo.valor
    }, { onConflict: 'phone' })

  // Registrar histórico
  await supabase
    .from('afiliado_cashback_historico')
    .insert({
      phone: cleanPhone,
      tipo: 'credito',
      valor: valor,
      saldo_anterior: saldoAnterior,
      saldo_novo: novoSaldo,
      descricao: `Cashback de compra: ${compraInfo.produto}`,
      metadata: { loja: compraInfo.loja, produto: compraInfo.produto }
    })

  console.log('✅ [AFILIADO-FUNIL] Cashback adicionado:', valor, 'para', cleanPhone)
}

// ============================================
// HANDLER: COMANDO DE CASHBACK
// ============================================
async function handleCashbackCommand(
  supabase: any,
  phone: string,
  wuzapiToken: string | null,
  userId: string | null
) {
  const cleanPhone = phone.replace(/\D/g, '')

  const { data: cashback } = await supabase
    .from('afiliado_cashback')
    .select('*')
    .eq('phone', cleanPhone)
    .single()

  let mensagem = `💰 *Seu Cashback*\n\n`
  
  if (!cashback) {
    mensagem += `Você ainda não tem saldo.\n\nEnvie um comprovante de compra para começar a acumular!`
  } else {
    mensagem += `💵 Saldo atual: *R$ ${(cashback.saldo_atual || 0).toFixed(2)}*\n`
    mensagem += `📊 Total acumulado: R$ ${(cashback.total_acumulado || 0).toFixed(2)}\n`
    mensagem += `🛒 Compras: ${cashback.compras_total || 0}\n`
    mensagem += `💳 Valor total em compras: R$ ${(cashback.valor_compras_total || 0).toFixed(2)}\n\n`
    mensagem += `━━━━━━━━━━━━━━━━━━\n\n`
    mensagem += `📸 Envie mais comprovantes para acumular!`
  }

  await sendWhatsAppMessage(phone, mensagem, wuzapiToken)
  await logEvent(supabase, { evento: 'comando_cashback', cliente_phone: phone, user_id: userId })
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
  const ebooks = userState.state.ebooks_disponiveis || []

  if (isNaN(escolha) || escolha < 1 || escolha > ebooks.length) {
    await sendWhatsAppMessage(
      message.from,
      `❌ *Escolha inválida!*\n\nDigite um número de *1* a *${ebooks.length}*`,
      wuzapiToken
    )
    return
  }

  const ebook = ebooks[escolha - 1]
  const compraInfo = userState.state.compra_info || {}

  // Enviar PDF
  await sendWhatsAppPDF(message.from, ebook.arquivo, ebook.titulo, wuzapiToken)

  // Mensagem de sucesso
  await sendWhatsAppMessage(
    message.from,
    `✅ *eBook enviado com sucesso!*\n\n` +
    `📚 ${ebook.titulo}\n\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `💡 Continue enviando comprovantes para:\n` +
    `• Acumular mais cashback\n` +
    `• Ganhar mais eBooks\n\n` +
    `Obrigado! 💙`,
    wuzapiToken
  )

  // Registrar entrega
  await logEbookDelivery(supabase, {
    phone: message.from,
    ebook_titulo: ebook.titulo,
    ebook_filename: ebook.arquivo,
    loja: compraInfo.loja,
    valor_compra: compraInfo.valor,
    categoria: compraInfo.categoria,
    comprovante_url: userState.state.comprovante_url,
    user_id: userId
  })

  await logEvent(supabase, {
    evento: 'ebook_entregue',
    cliente_phone: message.from,
    categoria: compraInfo.categoria,
    user_id: userId,
    metadata: { ebook: ebook.titulo }
  })

  // Voltar para aguardando comprovante
  await saveUserState(supabase, message.from, {
    status: 'aguardando_comprovante',
    state: { user_id: userId }
  })
}

// ============================================
// GEMINI VISION: ANÁLISE DE COMPROVANTE
// ============================================
async function analyzeComprovanteGemini(imageUrl: string): Promise<ComprovanteAnalysis> {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
  
  if (!GEMINI_API_KEY) {
    console.error('❌ [AFILIADO-FUNIL] GEMINI_API_KEY não configurada!')
    throw new Error('GEMINI_API_KEY não configurada')
  }

  try {
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw new Error(`Falha ao baixar imagem: ${imageResponse.status}`)
    }
    
    const imageBuffer = await imageResponse.arrayBuffer()
    const base64Image = btoa(
      new Uint8Array(imageBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    )

    const prompt = `Analise esta imagem de comprovante de compra e extraia as seguintes informações em formato JSON:

{
  "valido": true ou false,
  "loja": "Amazon" ou "Magazine Luiza" ou "Mercado Livre" ou "Outra",
  "valor": valor em número (ex: 150.50),
  "produto": "nome do produto principal",
  "data": "data da compra",
  "categoria": "Cozinha" ou "Beleza" ou "Fitness" ou "Bebê" ou "Tech" ou "Casa" ou "Pet" ou "Moda",
  "confianca": número de 0 a 100,
  "motivo_invalido": "razão se não for válido"
}

REGRAS: valido=true APENAS se for comprovante de e-commerce. Confiança deve ser honesta.
Retorne APENAS o JSON.`

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: 'image/jpeg', data: base64Image } }
            ]
          }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1024 }
        })
      }
    )

    const geminiData = await geminiResponse.json()
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

    let jsonText = responseText?.trim() || '{}'
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    }

    return JSON.parse(jsonText)

  } catch (error) {
    console.error('❌ [AFILIADO-FUNIL] Erro Gemini:', error)
    return {
      valido: false,
      loja: 'Não identificado',
      valor: 0,
      produto: '',
      data: '',
      categoria: 'Tech',
      confianca: 0,
      motivo_invalido: 'Erro ao processar imagem'
    }
  }
}

// ============================================
// VALIDAÇÃO ANTI-FRAUDE
// ============================================
function validateComprovante(analysis: ComprovanteAnalysis): { valid: boolean; reason?: string } {
  if (!analysis.valido) {
    return { valid: false, reason: analysis.motivo_invalido || 'Comprovante não reconhecido' }
  }
  if (analysis.confianca < 70) {
    return { valid: false, reason: 'Imagem não está clara. Tire outra foto mais nítida.' }
  }
  const lojasValidas = ['Amazon', 'Magazine Luiza', 'Mercado Livre']
  if (!lojasValidas.includes(analysis.loja)) {
    return { valid: false, reason: 'Loja não suportada. Aceitamos: Amazon, Magazine Luiza e Mercado Livre.' }
  }
  if (analysis.valor < 50) {
    return { valid: false, reason: 'Valor mínimo de compra: R$ 50,00' }
  }
  return { valid: true }
}

// ============================================
// EBOOKS POR CATEGORIA
// ============================================
function getEbooksByCategory(categoria: string): any[] {
  const ebooks: Record<string, any[]> = {
    'Cozinha': [
      { id: 1, titulo: '50 Receitas Airfryer', arquivo: 'ebook-airfryer-COMPLETO.pdf' },
      { id: 2, titulo: 'Guia Completo de Panelas', arquivo: 'cozinha-guia-panelas.pdf' },
    ],
    'Beleza': [
      { id: 11, titulo: 'Rotina Skincare Completa', arquivo: 'beleza-skincare-rotina.pdf' },
      { id: 12, titulo: 'Maquiagem para Iniciantes', arquivo: 'beleza-maquiagem-iniciante.pdf' },
    ],
    'Fitness': [
      { id: 21, titulo: 'Treino em Casa', arquivo: 'fitness-treino-casa.pdf' },
      { id: 22, titulo: 'Dieta Flexível', arquivo: 'fitness-dieta-flexivel.pdf' },
    ],
    'Bebê': [
      { id: 31, titulo: 'Primeiros 6 Meses do Bebê', arquivo: 'bebe-primeiros-meses.pdf' },
      { id: 32, titulo: 'Alimentação Infantil', arquivo: 'bebe-alimentacao.pdf' },
    ],
    'Tech': [
      { id: 41, titulo: '50 Apps Essenciais', arquivo: 'tech-apps-essenciais.pdf' },
      { id: 42, titulo: 'Produtividade Digital', arquivo: 'tech-produtividade.pdf' },
    ],
    'Casa': [
      { id: 51, titulo: 'Organização da Casa', arquivo: 'casa-organizacao.pdf' },
      { id: 52, titulo: 'Decoração com Pouco Dinheiro', arquivo: 'casa-decoracao.pdf' },
    ],
    'Pet': [
      { id: 61, titulo: 'Guia Cachorro Filhote', arquivo: 'pet-cachorro-guia.pdf' },
      { id: 62, titulo: 'Cuidados com Gatos', arquivo: 'pet-gato-cuidados.pdf' },
    ],
    'Moda': [
      { id: 71, titulo: 'Guarda-Roupa Cápsula', arquivo: 'moda-guarda-roupa-capsula.pdf' },
      { id: 72, titulo: 'Combinações Perfeitas', arquivo: 'moda-combinacoes.pdf' },
    ]
  }
  return ebooks[categoria] || ebooks['Tech']
}

// ============================================
// DATABASE HELPERS
// ============================================
async function getUserState(supabase: any, phone: string): Promise<UserState | null> {
  const { data } = await supabase
    .from('afiliado_user_states')
    .select('*')
    .eq('phone', phone)
    .single()
  return data
}

async function saveUserState(supabase: any, phone: string, stateData: Partial<UserState>) {
  await supabase
    .from('afiliado_user_states')
    .upsert({
      phone: phone,
      status: stateData.status || 'idle',
      state: stateData.state || {},
      updated_at: new Date().toISOString()
    }, { onConflict: 'phone' })
}

async function clearUserState(supabase: any, phone: string) {
  await supabase.from('afiliado_user_states').delete().eq('phone', phone)
}

async function checkBlacklist(supabase: any, phone: string): Promise<boolean> {
  const { data } = await supabase.rpc('verificar_blacklist_afiliado', { p_phone: phone })
  return data === true
}

async function checkRateLimit(supabase: any, phone: string): Promise<number> {
  const { data } = await supabase.rpc('verificar_rate_limit_afiliado', { p_phone: phone })
  return data || 0
}

async function logEvent(supabase: any, event: any) {
  await supabase.from('afiliado_analytics_ebooks').insert({
    evento: event.evento,
    cliente_phone: event.cliente_phone,
    loja: event.loja || null,
    valor: event.valor || null,
    categoria: event.categoria || null,
    user_id: event.user_id || null,
    motivo: event.motivo || null,
    confianca: event.confianca || null,
    metadata: event.metadata || {}
  })
}

async function logEbookDelivery(supabase: any, delivery: any) {
  await supabase.from('afiliado_ebook_deliveries').insert({
    phone: delivery.phone,
    ebook_titulo: delivery.ebook_titulo,
    ebook_filename: delivery.ebook_filename,
    loja: delivery.loja || null,
    valor_compra: delivery.valor_compra || null,
    categoria: delivery.categoria || null,
    comprovante_url: delivery.comprovante_url || null,
    user_id: delivery.user_id || null
  })
}

// ============================================
// WHATSAPP: SEND MESSAGE
// ============================================
async function sendWhatsAppMessage(to: string, message: string, customToken?: string | null) {
  const CONTABO_WUZAPI_URL = "https://api2.amzofertas.com.br"

  // Token do afiliado é obrigatório para garantir que a resposta saia do número correto (Contabo)
  if (!customToken) {
    console.error('❌ [AFILIADO-FUNIL] Token do afiliado ausente (customToken).')
    return
  }

  // Formatar número (apenas dígitos) e garantir +55 quando necessário
  let formattedPhone = to.replace(/\D/g, '')
  if (!formattedPhone.startsWith('55') && formattedPhone.length === 11) {
    formattedPhone = '55' + formattedPhone
  }

  try {
    const response = await fetch(`${CONTABO_WUZAPI_URL}/chat/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Token': customToken },
      body: JSON.stringify({ Phone: formattedPhone, Body: message })
    })

    const responseText = await response.text()

    if (!response.ok) {
      console.error('❌ [AFILIADO-FUNIL] Erro ao enviar mensagem:', responseText)
    } else {
      console.log('✅ [AFILIADO-FUNIL] Mensagem enviada para:', formattedPhone)
    }
  } catch (error) {
    console.error('❌ [AFILIADO-FUNIL] Erro:', error)
  }
}

// ============================================
// WHATSAPP: SEND PDF
// ============================================
async function sendWhatsAppPDF(to: string, filename: string, caption: string, customToken?: string | null) {
  const CONTABO_WUZAPI_URL = "https://api2.amzofertas.com.br"
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')

  if (!customToken || !SUPABASE_URL) return

  // Formatar número
  let formattedPhone = to.replace(/\D/g, '')
  if (!formattedPhone.startsWith('55') && formattedPhone.length === 11) {
    formattedPhone = '55' + formattedPhone
  }

  const pdfUrl = `${SUPABASE_URL}/storage/v1/object/public/ebooks/${filename}`

  try {
    const response = await fetch(`${CONTABO_WUZAPI_URL}/chat/send/file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Token': customToken },
      body: JSON.stringify({ Phone: formattedPhone, Url: pdfUrl, Caption: `📚 ${caption}` })
    })

    if (!response.ok) {
      console.log('⚠️ [AFILIADO-FUNIL] Fallback para link:', filename)
      await sendWhatsAppMessage(formattedPhone, `📚 *${caption}*\n\n📥 Baixe aqui: ${pdfUrl}`, customToken)
    } else {
      console.log('✅ [AFILIADO-FUNIL] PDF enviado:', filename)
    }
  } catch (error) {
    console.error('❌ [AFILIADO-FUNIL] Erro ao enviar PDF:', error)
    await sendWhatsAppMessage(formattedPhone, `📚 *${caption}*\n\n📥 Baixe aqui: ${pdfUrl}`, customToken)
  }
}


// ============================================
// MENSAGENS PADRÃO
// ============================================
function getMensagemBoasVindas(): string {
  return `🎉 *Bem-vindo(a) à AMZ Ofertas!*

Aqui você recebe:
✅ eBooks grátis
✅ 2% de cashback em compras
✅ Ofertas exclusivas

📝 *Para começar, qual é o seu nome?*`
}

function getMensagemAjuda(): string {
  return `📚 *Central de Ajuda - AMZ Ofertas*

*Comandos disponíveis:*
• *SALDO* - Ver seu cashback
• *AJUDA* - Esta mensagem
• *REINICIAR* - Recomeçar o cadastro

*Como funciona:*
1️⃣ Cadastre seu nome e nichos de interesse
2️⃣ Receba eBook grátis de boas-vindas
3️⃣ Envie comprovantes de compra
4️⃣ Ganhe 2% de cashback + eBooks

*Lojas aceitas:* Amazon, Magalu, Mercado Livre
*Valor mínimo:* R$ 50,00

Dúvidas? Fale conosco! 💙`
}
