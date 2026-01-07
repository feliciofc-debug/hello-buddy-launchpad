// supabase/functions/wuzapi-webhook-afiliados/index.ts
// AMZ Ofertas - Assistente Virtual de Promoções e Ofertas
// Fluxo conversacional com IA + Cashback 2% + eBooks

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

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
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
// KNOWLEDGE BASE - AMZ OFERTAS
// ============================================
const SYSTEM_PROMPT = `Você é a assistente virtual da AMZ Ofertas, um canal de promoções e ofertas imperdíveis.

PERSONALIDADE:
- Simpática, animada mas não exagerada
- Respostas CURTAS e diretas (máximo 3 linhas quando possível)
- Use emojis com moderação (1-2 por mensagem)
- Fale como uma amiga que manja de compras online
- NUNCA pareça robô ou use linguagem corporativa

SOBRE A AMZ OFERTAS:
Somos um canal que garimpamos as melhores ofertas da internet pra você. Trabalhamos com os maiores marketplaces:
- 🛒 Amazon
- 🛒 Magazine Luiza (Magalu)
- 🛒 Mercado Livre
- 🛒 Shopee
- 🛒 Netshoes
- 💄 O Boticário
- 💄 L'Occitane

BENEFÍCIOS EXCLUSIVOS:

1. CASHBACK 2%
- A cada compra pelo nosso link, você acumula 2% de volta
- Basta enviar o comprovante aqui que a gente credita
- Quando juntar, você resgata via PIX

2. EBOOKS DE PRESENTE
- A cada compra validada, você ganha um eBook exclusivo
- Temos de receitas de Airfryer, organização, finanças...
- É só mandar o comprovante!

3. OFERTAS PERSONALIZADAS
- Me conta o que você gosta e eu aviso quando tiver promoção
- Monitoro preços e te aviso quando baixar

COMO FUNCIONA:
1. Eu mando ofertas incríveis aqui no WhatsApp
2. Você clica no link e compra normal no site
3. Depois me manda o comprovante
4. Você ganha cashback + eBook de presente!

CATEGORIAS DISPONÍVEIS:
- Eletrônicos e celulares
- Casa e cozinha (Airfryer, panelas, etc)
- Beleza e perfumaria
- Moda e acessórios
- Esportes e fitness
- Bebês e crianças
- Games e consoles
- Livros
- Pet shop
- Ferramentas
- Automotivo

PERGUNTAS FREQUENTES:

"Como ganho cashback?"
→ Compra pelo meu link, manda o comprovante, e eu credito 2% na sua conta!

"Demora pra cair o cashback?"
→ Valido rapidinho! Geralmente no mesmo dia 😊

"Posso resgatar quanto?"
→ A partir de R$20 você já pode pedir o PIX!

"As ofertas são confiáveis?"
→ 100%! São dos sites oficiais, só garantimos o melhor preço 🔒

"Vocês vendem alguma coisa?"
→ Não vendemos nada! Só garimpamos ofertas e você compra direto no site oficial

"Como recebo as ofertas?"
→ Fica ligado aqui! Mando as melhores todo dia. Quer que eu priorize alguma categoria?

"Posso devolver se não gostar?"
→ Claro! A troca/devolução é direto com a loja, normal como qualquer compra

REGRAS DE RESPOSTA:
1. Sempre cumprimente se for primeira mensagem
2. Responda APENAS o que foi perguntado
3. Se não souber, diga "Deixa eu verificar e te retorno!"
4. Sempre ofereça ajuda adicional no final
5. Se pedirem oferta específica, diga que vai procurar
6. NUNCA invente informações de produtos ou preços
7. Se a pessoa quer ver o saldo de cashback, diga que vai verificar
8. Se mandarem comprovante, informe que vai analisar e validar

INFORMAÇÕES IMPORTANTES:
- Somos do Rio de Janeiro, mas atendemos o Brasil todo
- Valor mínimo para resgate de cashback: R$20
- Lojas aceitas para comprovante: Amazon, Magalu, Mercado Livre, Shopee, Netshoes, Boticário, L'Occitane`

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
    console.log('🔔 [AMZ-OFERTAS] Webhook recebido!')
    
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
      console.log('📦 [AMZ-OFERTAS] Raw body (non-json):', rawBody.slice(0, 2000))
    }

    console.log('📨 [AMZ-OFERTAS] Payload:', JSON.stringify(payload, null, 2))

    // Extrair mensagem do payload Wuzapi
    const message = parseWuzapiPayload(payload)
    console.log('💬 [AMZ-OFERTAS] Mensagem processada:', message)

    if (!message.from) {
      console.log('⚠️ [AMZ-OFERTAS] Mensagem sem remetente, ignorando')
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
      console.log('🚫 [AMZ-OFERTAS] Token do afiliado não encontrado. Abortando envio para evitar PJ.')
      return new Response(
        JSON.stringify({ success: true, message: 'Ignorado - token afiliado ausente' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }


    // Verificar blacklist
    const isBlacklisted = await checkBlacklist(supabase, message.from)
    if (isBlacklisted) {
      console.log('🚫 [AMZ-OFERTAS] Número bloqueado:', message.from)
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
      console.log(`⏭️ [AMZ-OFERTAS] Tipo não suportado ignorado: ${message.type}`)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Processado' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('❌ [AMZ-OFERTAS] Erro no webhook:', error)
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

  // 2) Quando vier instanceName (ex: "AMZ-Ofertas 01", "Afiliado-01"), buscar por wuzapi_instance_id
  // Busca flexível: exata OU contém parte do nome (normalizado sem espaços/hífens)
  const normalizedRaw = raw.toLowerCase().replace(/[\s\-_]/g, '')
  
  const { data: allAffiliates } = await supabase
    .from('clientes_afiliados')
    .select('id, user_id, wuzapi_token, wuzapi_jid, wuzapi_instance_id')
    .not('wuzapi_token', 'is', null)

  if (allAffiliates && allAffiliates.length > 0) {
    // Busca exata primeiro
    let found = allAffiliates.find((a: any) => a.wuzapi_instance_id === raw)
    
    // Se não encontrou, busca normalizada
    if (!found) {
      found = allAffiliates.find((a: any) => {
        if (!a.wuzapi_instance_id) return false
        const normalizedId = a.wuzapi_instance_id.toLowerCase().replace(/[\s\-_]/g, '')
        return normalizedId === normalizedRaw || 
               normalizedId.includes(normalizedRaw) || 
               normalizedRaw.includes(normalizedId)
      })
    }
    
    if (found) {
      console.log(`✅ [AMZ-OFERTAS] Afiliado encontrado: ${found.wuzapi_instance_id} para input: ${raw}`)
      return found
    }
  }

  console.log('ℹ️ [AMZ-OFERTAS] Afiliado não encontrado para:', raw)
  return null
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
      console.log('⏭️ [AMZ-OFERTAS] Ignorando mensagem enviada por nós (IsFromMe=true)')
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

    console.log(`📱 [AMZ-OFERTAS] Contabo format - From: ${from}, To: ${to}, Text: ${text.slice(0,50)}`)

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
// HANDLER: MENSAGEM DE TEXTO (COM IA)
// ============================================
async function handleTextMessage(
  supabase: any, 
  message: WhatsAppMessage, 
  wuzapiToken: string | null,
  userId: string | null
) {
  const text = message.text!.trim()
  const textLower = text.toLowerCase()
  console.log('💬 [AMZ-OFERTAS] Processando texto:', text)

  // ========== COMANDOS ESPECIAIS (bypass IA) ==========
  
  // Comando SALDO / CASHBACK
  if (textLower === 'saldo' || textLower === 'cashback' || textLower === 'meu saldo') {
    await handleCashbackCommand(supabase, message.from, wuzapiToken, userId)
    return
  }

  // Comando AJUDA / HELP
  if (textLower === 'ajuda' || textLower === 'help' || textLower === 'menu') {
    await sendWhatsAppMessage(message.from, getMensagemAjuda(), wuzapiToken)
    await logEvent(supabase, { evento: 'comando_ajuda', cliente_phone: message.from, user_id: userId })
    return
  }

  // Comando CANCELAR / SAIR
  if (textLower === 'cancelar' || textLower === 'sair' || textLower === 'parar') {
    await sendWhatsAppMessage(
      message.from,
      'Sem problemas! Se quiser voltar, é só me chamar. Obrigada por ter ficado com a gente! 💜',
      wuzapiToken
    )
    await logEvent(supabase, { evento: 'cancelamento', cliente_phone: message.from, user_id: userId })
    return
  }

  // ========== FLUXO COM IA ==========
  
  // Buscar histórico de conversa
  const conversationHistory = await getConversationHistory(supabase, message.from)
  
  // Buscar info de cashback para contexto
  const cashbackInfo = await getCashbackInfo(supabase, message.from)
  
  // Construir contexto adicional
  let additionalContext = ''
  if (cashbackInfo) {
    additionalContext = `\n\nINFO DO CLIENTE (use se perguntarem sobre saldo):
- Saldo atual: R$ ${(cashbackInfo.saldo_atual || 0).toFixed(2)}
- Total acumulado: R$ ${(cashbackInfo.total_acumulado || 0).toFixed(2)}
- Total de compras: ${cashbackInfo.compras_total || 0}`
  }

  // Gerar resposta com IA
  const aiResponse = await generateAIResponse(
    text, 
    conversationHistory,
    additionalContext
  )

  // Salvar conversa
  await saveConversation(supabase, message.from, text, aiResponse)

  // Enviar resposta
  await sendWhatsAppMessage(message.from, aiResponse, wuzapiToken)

  // Log evento
  await logEvent(supabase, {
    evento: 'conversa_ia',
    cliente_phone: message.from,
    user_id: userId,
    metadata: { pergunta: text.slice(0, 100), resposta: aiResponse.slice(0, 100) }
  })
}

// ============================================
// GERAR RESPOSTA COM IA (LOVABLE AI)
// ============================================
async function generateAIResponse(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  additionalContext: string = ''
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  
  if (!LOVABLE_API_KEY) {
    console.error('❌ [AMZ-OFERTAS] LOVABLE_API_KEY não configurada!')
    return 'Oi! 👋 Estou aqui pra te ajudar com as melhores ofertas. Como posso te ajudar?'
  }

  try {
    const systemPrompt = SYSTEM_PROMPT + additionalContext

    // Montar mensagens para a IA
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-6), // Últimas 6 mensagens para contexto
      { role: 'user', content: userMessage }
    ]

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        max_tokens: 300,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ [AMZ-OFERTAS] Erro na API:', response.status, errorText)
      
      if (response.status === 429) {
        return 'Opa, estou com muitas mensagens agora! Me manda de novo em alguns segundos? 😅'
      }
      
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    const aiMessage = data.choices?.[0]?.message?.content || ''
    
    console.log('🤖 [AMZ-OFERTAS] Resposta IA:', aiMessage.slice(0, 100))
    
    return aiMessage.trim() || 'Oi! 👋 Como posso te ajudar hoje?'

  } catch (error) {
    console.error('❌ [AMZ-OFERTAS] Erro ao gerar resposta:', error)
    return 'Oi! 👋 Bem-vinda à AMZ Ofertas! Posso te ajudar com alguma coisa?'
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
  console.log('📸 [AMZ-OFERTAS] Processando comprovante de:', message.from)

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
      '⏳ Deixa eu dar uma olhada no seu comprovante... 🔍',
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
    console.log('🧠 [AMZ-OFERTAS] Análise completa:', analysis)

    // VALIDAÇÃO ANTI-FRAUDE
    const validation = validateComprovante(analysis)

    if (!validation.valid) {
      await sendWhatsAppMessage(
        message.from,
        `❌ Não consegui validar esse comprovante 😕\n\n` +
        `📋 Motivo: ${validation.reason}\n\n` +
        `💡 Dica: Tire uma foto mais nítida com valor e loja bem visíveis!`,
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
    console.log('✅ [AMZ-OFERTAS] Comprovante validado:', analysis)

    // Calcular cashback (2%)
    const cashback = analysis.valor * 0.02

    // Atualizar saldo de cashback
    await addCashback(supabase, message.from, cashback, analysis)

    // Buscar ou criar lead
    await ensureLeadExists(supabase, message.from, userId)

    // Buscar eBooks da categoria
    const ebooks = getEbooksByCategory(analysis.categoria)
    const ebookEscolhido = ebooks[0] // Enviar o primeiro automaticamente

    // Enviar confirmação
    let mensagem = `✅ *Comprovante validado!*\n\n`
    mensagem += `🏪 Loja: ${analysis.loja}\n`
    mensagem += `💰 Valor: R$ ${analysis.valor.toFixed(2)}\n`
    mensagem += `📦 Produto: ${analysis.produto}\n\n`
    mensagem += `💵 *+R$ ${cashback.toFixed(2)} de cashback!* 🎉\n\n`
    mensagem += `🎁 Estou enviando seu eBook de presente...`

    await sendWhatsAppMessage(message.from, mensagem, wuzapiToken)

    // Enviar eBook
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
    const ebookHtmlUrl = `${SUPABASE_URL}/functions/v1/ebook-airfryer`
    
    // Enviar link HTML
    await sendWhatsAppMessage(
      message.from,
      `📚 *${ebookEscolhido.titulo}*\n\n👉 Acesse aqui: ${ebookHtmlUrl}\n\nAproveite! 💙`,
      wuzapiToken
    )

    // Tentar enviar PDF também
    await sendWhatsAppPDF(message.from, ebookEscolhido.arquivo, ebookEscolhido.titulo, wuzapiToken)

    // Registrar entrega
    await logEbookDelivery(supabase, {
      phone: message.from,
      ebook_titulo: ebookEscolhido.titulo,
      ebook_filename: ebookEscolhido.arquivo,
      loja: analysis.loja,
      valor_compra: analysis.valor,
      categoria: analysis.categoria,
      comprovante_url: message.imageUrl,
      user_id: userId
    })

    await logEvent(supabase, {
      evento: 'comprovante_validado',
      cliente_phone: message.from,
      loja: analysis.loja,
      valor: analysis.valor,
      categoria: analysis.categoria,
      user_id: userId
    })

  } catch (error) {
    console.error('❌ [AMZ-OFERTAS] Erro ao processar comprovante:', error)
    await sendWhatsAppMessage(
      message.from,
      '❌ Ops, deu um errinho aqui! Tenta mandar o comprovante de novo? 🙏',
      wuzapiToken
    )
  }
}

// ============================================
// GARANTIR QUE LEAD EXISTE
// ============================================
async function ensureLeadExists(
  supabase: any,
  phone: string,
  userId: string | null
): Promise<void> {
  const cleanPhone = phone.replace(/\D/g, '')
  
  // Verificar se já existe
  const { data: existing } = await supabase
    .from('leads_ebooks')
    .select('id')
    .eq('phone', cleanPhone)
    .single()

  if (existing) return

  // Criar lead
  await supabase
    .from('leads_ebooks')
    .insert({
      phone: cleanPhone,
      nome: 'Cliente',
      origem: 'comprovante',
      origem_detalhe: 'whatsapp',
      cashback_ativo: true,
      user_id: userId
    })

  // Ativar cashback
  await supabase
    .from('afiliado_cashback')
    .upsert({
      phone: cleanPhone,
      saldo_atual: 0,
      total_acumulado: 0,
      total_resgatado: 0,
      compras_total: 0,
      valor_compras_total: 0
    }, { onConflict: 'phone' })

  console.log('✅ [AMZ-OFERTAS] Novo lead criado:', cleanPhone)
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

  console.log('✅ [AMZ-OFERTAS] Cashback adicionado:', valor, 'para', cleanPhone)
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
  const cashback = await getCashbackInfo(supabase, phone)

  let mensagem = `💰 *Seu Cashback*\n\n`
  
  if (!cashback) {
    mensagem += `Você ainda não tem saldo 😊\n\nEnvia um comprovante de compra que eu credito 2% pra você!`
  } else {
    mensagem += `💵 Saldo: *R$ ${(cashback.saldo_atual || 0).toFixed(2)}*\n`
    mensagem += `📊 Total acumulado: R$ ${(cashback.total_acumulado || 0).toFixed(2)}\n`
    mensagem += `🛒 Compras: ${cashback.compras_total || 0}\n\n`
    
    if ((cashback.saldo_atual || 0) >= 20) {
      mensagem += `✅ Você já pode resgatar via PIX! Me chama pra solicitar 😊`
    } else {
      const falta = 20 - (cashback.saldo_atual || 0)
      mensagem += `💡 Faltam R$ ${falta.toFixed(2)} pra resgatar (mínimo R$20)`
    }
  }

  await sendWhatsAppMessage(phone, mensagem, wuzapiToken)
  await logEvent(supabase, { evento: 'comando_cashback', cliente_phone: phone, user_id: userId })
}

// ============================================
// BUSCAR INFO DE CASHBACK
// ============================================
async function getCashbackInfo(supabase: any, phone: string): Promise<any> {
  const cleanPhone = phone.replace(/\D/g, '')
  const { data } = await supabase
    .from('afiliado_cashback')
    .select('*')
    .eq('phone', cleanPhone)
    .single()
  return data
}

// ============================================
// HISTÓRICO DE CONVERSA
// ============================================
async function getConversationHistory(supabase: any, phone: string): Promise<ConversationMessage[]> {
  const cleanPhone = phone.replace(/\D/g, '')
  
  const { data } = await supabase
    .from('afiliado_conversas')
    .select('role, content')
    .eq('phone', cleanPhone)
    .order('created_at', { ascending: false })
    .limit(10)

  if (!data) return []
  
  // Reverter para ordem cronológica
  return data.reverse()
}

async function saveConversation(supabase: any, phone: string, userMessage: string, assistantMessage: string) {
  const cleanPhone = phone.replace(/\D/g, '')
  
  // Salvar mensagem do usuário e resposta
  await supabase
    .from('afiliado_conversas')
    .insert([
      { phone: cleanPhone, role: 'user', content: userMessage },
      { phone: cleanPhone, role: 'assistant', content: assistantMessage }
    ])
}

// ============================================
// GEMINI VISION: ANÁLISE DE COMPROVANTE
// ============================================
async function analyzeComprovanteGemini(imageUrl: string): Promise<ComprovanteAnalysis> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  
  if (!LOVABLE_API_KEY) {
    console.error('❌ [AMZ-OFERTAS] LOVABLE_API_KEY não configurada!')
    throw new Error('LOVABLE_API_KEY não configurada')
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
  "loja": "Amazon" ou "Magazine Luiza" ou "Mercado Livre" ou "Shopee" ou "Netshoes" ou "O Boticário" ou "L'Occitane" ou "Outra",
  "valor": valor em número (ex: 150.50),
  "produto": "nome do produto principal",
  "data": "data da compra",
  "categoria": "Cozinha" ou "Beleza" ou "Fitness" ou "Bebê" ou "Tech" ou "Casa" ou "Pet" ou "Moda",
  "confianca": número de 0 a 100,
  "motivo_invalido": "razão se não for válido"
}

REGRAS: valido=true APENAS se for comprovante de e-commerce. Confiança deve ser honesta.
Retorne APENAS o JSON.`

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
          }
        ],
        max_tokens: 1024,
        temperature: 0.2
      })
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    const responseText = data.choices?.[0]?.message?.content || '{}'

    let jsonText = responseText.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    }

    return JSON.parse(jsonText)

  } catch (error) {
    console.error('❌ [AMZ-OFERTAS] Erro Gemini:', error)
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
  const lojasValidas = ['Amazon', 'Magazine Luiza', 'Mercado Livre', 'Shopee', 'Netshoes', 'O Boticário', "L'Occitane"]
  if (!lojasValidas.includes(analysis.loja)) {
    return { valid: false, reason: `Loja "${analysis.loja}" não suportada ainda.` }
  }
  if (analysis.valor < 30) {
    return { valid: false, reason: 'Valor mínimo de compra: R$ 30,00' }
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
  return ebooks[categoria] || ebooks['Cozinha']
}

// ============================================
// DATABASE HELPERS
// ============================================
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
    console.error('❌ [AMZ-OFERTAS] Token do afiliado ausente (customToken).')
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
      console.error('❌ [AMZ-OFERTAS] Erro ao enviar mensagem:', responseText)
    } else {
      console.log('✅ [AMZ-OFERTAS] Mensagem enviada para:', formattedPhone)
    }
  } catch (error) {
    console.error('❌ [AMZ-OFERTAS] Erro:', error)
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
      console.log('⚠️ [AMZ-OFERTAS] Fallback para link:', filename)
      await sendWhatsAppMessage(formattedPhone, `📚 *${caption}*\n\n📥 Baixe aqui: ${pdfUrl}`, customToken)
    } else {
      console.log('✅ [AMZ-OFERTAS] PDF enviado:', filename)
    }
  } catch (error) {
    console.error('❌ [AMZ-OFERTAS] Erro ao enviar PDF:', error)
    await sendWhatsAppMessage(formattedPhone, `📚 *${caption}*\n\n📥 Baixe aqui: ${pdfUrl}`, customToken)
  }
}


// ============================================
// MENSAGENS PADRÃO
// ============================================
function getMensagemAjuda(): string {
  return `📚 *Central de Ajuda - AMZ Ofertas*

*Comandos rápidos:*
• *SALDO* - Ver seu cashback
• *AJUDA* - Esta mensagem
• *CANCELAR* - Parar de receber mensagens

*Como funciona:*
1️⃣ Eu mando ofertas incríveis aqui
2️⃣ Você compra pelo link (site oficial)
3️⃣ Me manda o comprovante
4️⃣ Ganha 2% de cashback + eBook! 🎁

*Lojas aceitas:* Amazon, Magalu, Mercado Livre, Shopee, Netshoes, Boticário, L'Occitane

*Resgate:* A partir de R$20 via PIX

Dúvidas? É só perguntar! 💙`
}
