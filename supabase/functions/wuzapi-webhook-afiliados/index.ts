// supabase/functions/wuzapi-webhook-afiliados/index.ts
// AMZ Ofertas - Assistente Virtual de Promoções e Ofertas
// Fluxo conversacional com IA + Cashback 2% + eBooks
//
// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  🔴 GOVERNANÇA: ARQUIVO PROTEGIDO - ALERTA VERMELHO 🔴                    ║
// ║                                                                            ║
// ║  Este arquivo NÃO pode ser modificado sem aprovação explícita do usuário. ║
// ║  Qualquer alteração deve ser:                                              ║
// ║    1. Mostrada ao usuário ANTES de implementar                             ║
// ║    2. Aprovada com "SIM" explícito                                         ║
// ║                                                                            ║
// ║  Funções críticas:                                                         ║
// ║    - ensureLeadExists() - Sincronização das 3 tabelas                      ║
// ║    - handleTextMessage() - Fluxo de captura nome/categorias                ║
// ║    - handleImageMessage() - Validação de comprovantes                      ║
// ║    - sendEbookBoasVindas() - Envio de eBook grátis                        ║
// ║                                                                            ║
// ║  Tabelas sincronizadas:                                                    ║
// ║    - leads_ebooks                                                          ║
// ║    - afiliado_clientes_ebooks                                              ║
// ║    - afiliado_cliente_preferencias                                         ║
// ╚════════════════════════════════════════════════════════════════════════════╝

import { createClient } from "npm:@supabase/supabase-js@2.75.0"

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

1. EBOOK GRÁTIS DE BOAS-VINDAS
- Todo mundo que entra no grupo ganha o eBook "50 Receitas Airfryer" de PRESENTE!
- É só me dizer seu nome que eu mando na hora!

2. CASHBACK 2%
- A cada compra pelo nosso link, você acumula 2% de volta
- Basta enviar o comprovante aqui que a gente credita
- Quando juntar R$30, você resgata via PIX (disponível após 35 dias da compra)

3. MAIS EBOOKS DE PRESENTE
- A cada compra validada, você ganha outros eBooks exclusivos
- Temos de beleza, fitness, bebê, casa, pet...
- É só mandar o comprovante!

4. OFERTAS PERSONALIZADAS
- Me conta o que você gosta e eu aviso quando tiver promoção
- Monitoro preços e te aviso quando baixar

COMO FUNCIONA:
1. Me diz seu nome e eu mando seu eBook grátis de boas-vindas!
2. Eu mando ofertas incríveis aqui no WhatsApp
3. Você clica no link e compra normal no site
4. Depois me manda o comprovante
5. Você ganha cashback + eBook de presente!

REGRAS DE RESPOSTA:
1. Se for primeira mensagem ou não conhece, PERGUNTE O NOME
2. Depois que souber o nome, avise sobre o eBook grátis
3. Responda APENAS o que foi perguntado
4. Se não souber, diga "Deixa eu verificar e te retorno!"
5. Se pedirem oferta específica, diga que vai procurar
6. NUNCA invente informações de produtos ou preços
7. Se a pessoa quer ver o saldo de cashback, diga que vai verificar
8. Se mandarem comprovante, informe que vai analisar e validar

INFORMAÇÕES IMPORTANTES:
- Somos do Rio de Janeiro, mas atendemos o Brasil todo
- Valor mínimo para resgate de cashback: R$30 (disponível após 35 dias)
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
// DETECÇÃO E CONVERSÃO DE LINKS DE MARKETPLACE
// ============================================
interface MarketplaceLinkResult {
  url: string
  marketplace: 'amazon' | 'magalu' | 'mercadolivre' | 'shopee' | 'outros'
}

function detectMarketplaceLink(text: string): MarketplaceLinkResult | null {
  const urlRegex = /(https?:\/\/[^\s]+)/gi
  const matches = text.match(urlRegex)
  if (!matches?.length) return null

  const url = matches[0]

  try {
    const { hostname } = new URL(url)
    const host = hostname.toLowerCase().replace(/^www\./, '')

    // Magalu / Magazine Você (DEVE vir ANTES de Amazon para evitar conflito com 'a.co' em 'luiza.co')
    if (
      host.endsWith('magazineluiza.com.br') ||
      host.endsWith('magazinevoce.com.br') ||
      host === 'magalu.com' ||
      host.endsWith('magalu.com.br')
    ) return { url, marketplace: 'magalu' }

    // Amazon (domínio real ou encurtadores exatos)
    if (
      host === 'amzn.to' ||
      host === 'a.co' ||
      host.endsWith('amazon.com.br') ||
      host.endsWith('amazon.com')
    ) return { url, marketplace: 'amazon' }

    // Mercado Livre
    if (host.endsWith('mercadolivre.com.br') || host.endsWith('mercadolibre.com'))
      return { url, marketplace: 'mercadolivre' }

    // Shopee
    if (host.endsWith('shopee.com.br')) return { url, marketplace: 'shopee' }

    return null
  } catch {
    return null
  }
}

function extractAsinFromUrl(url: string): string | null {
  // Padrões para extrair ASIN da Amazon
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /\/d\/([A-Z0-9]{10})/i,
    /asin=([A-Z0-9]{10})/i
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1].toUpperCase()
    }
  }
  
  return null
}

function convertToAffiliateLink(url: string, marketplace: string, amazonTag: string): string {
  switch (marketplace) {
    case 'amazon':
      const asin = extractAsinFromUrl(url)
      if (asin) {
        return `https://www.amazon.com.br/dp/${asin}?tag=${amazonTag}`
      }
      // Se não conseguiu extrair ASIN, adiciona tag ao final
      if (url.includes('?')) {
        return `${url}&tag=${amazonTag}`
      }
      return `${url}?tag=${amazonTag}`
      
    case 'magalu':
      // Magazine Você: troca domínio e MANTÉM query params (ex: seller_id)
      try {
        const u = new URL(url)
        const pathAndQuery = `${u.pathname}${u.search}`
        return `https://www.magazinevoce.com.br/magazineamzofertas${pathAndQuery}`
      } catch {
        const base = url.split('#')[0]
        return base
          .replace('www.magazineluiza.com.br', 'www.magazinevoce.com.br/magazineamzofertas')
          .replace('magazineluiza.com.br', 'magazinevoce.com.br/magazineamzofertas')
      }
      
    case 'mercadolivre':
    case 'shopee':
      // Para esses, retornar link original (já devem vir convertidos ou usam outro sistema)
      return url
      
    default:
      return url
  }
}

// ============================================
// MAIN HANDLER
// ============================================
Deno.serve(async (req) => {
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
        return normalizedId === normalizedRaw || normalizedId.includes(normalizedRaw) || normalizedRaw.includes(normalizedId)
      })
    }

    // Se ainda não encontrou, tenta casar por sufixo numérico (ex: Afiliado-01 <-> AMZ-Ofertas 01)
    if (!found) {
      const rawSuffix = (raw.match(/(\d+)$/)?.[1] || '').replace(/^0+/, '')
      if (rawSuffix) {
        found = allAffiliates.find((a: any) => {
          if (!a.wuzapi_instance_id) return false
          const idSuffix = (String(a.wuzapi_instance_id).match(/(\d+)$/)?.[1] || '').replace(/^0+/, '')
          return idSuffix && idSuffix === rawSuffix
        })
      }
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

  // Comando REINICIAR (zera estado e começa do zero)
  if (textLower === 'reiniciar' || textLower === 'recomeçar' || textLower === 'novo' || textLower === 'começar') {
    const cleanPhone = message.from.replace(/\D/g, '')
    
    // Deletar TODOS os dados para reinício completo
    await supabase.from('afiliado_user_states').delete().eq('phone', cleanPhone)
    await supabase.from('leads_ebooks').delete().eq('phone', cleanPhone)
    await supabase.from('afiliado_ebook_deliveries').delete().eq('phone', cleanPhone)
    await supabase.from('afiliado_conversas').delete().eq('phone', cleanPhone)
    
    await sendWhatsAppMessage(
      message.from,
      `Pronto! Vamos começar do zero! 🎉\n\n` +
      `Olá! Eu sou a assistente virtual da *AMZ Ofertas* 🛒💜\n\n` +
      `Pra te mandar ofertas e eBooks do seu interesse, me conta:\n\n` +
      `*Quais categorias você mais curte?*\n\n` +
      `1️⃣ Casa\n` +
      `2️⃣ Cozinha\n` +
      `3️⃣ Bebê\n` +
      `4️⃣ Tech\n` +
      `5️⃣ Gamer\n` +
      `6️⃣ Beleza\n` +
      `7️⃣ Fitness\n` +
      `8️⃣ Ferramentas\n` +
      `9️⃣ Pet\n` +
      `🔟 Moda\n\n` +
      `_Pode mandar mais de uma! Ex: "1, 2, 6" ou "Cozinha, Beleza, Pet"_`,
      wuzapiToken
    )
    
    // Criar estado aguardando categorias (nome vem depois)
    await supabase.from('afiliado_user_states').insert({
      phone: cleanPhone,
      status: 'aguardando_categorias',
      state: { origem: 'reinicio', user_id: userId }
    })
    
    await logEvent(supabase, { evento: 'conversa_reiniciada', cliente_phone: message.from, user_id: userId })
    return
  }

  // Comando EBOOK / PRESENTE (reenviar eBook grátis)
  if (textLower === 'ebook' || textLower === 'presente' || textLower === 'receitas') {
    const cleanPhone = message.from.replace(/\D/g, '')
    const { data: leadData } = await supabase
      .from('leads_ebooks')
      .select('nome, nichos')
      .eq('phone', cleanPhone)
      .single()
    
    const nome = leadData?.nome || 'Amigo(a)'
    const nichos = (leadData?.nichos as string[]) || ['cozinha']
    
    await sendWhatsAppMessage(
      message.from,
      `📚 Reenviando seu eBook grátis, ${nome.split(' ')[0]}! Aguarda...`,
      wuzapiToken
    )
    await new Promise(r => setTimeout(r, 1500))
    await sendWhatsAppPDF(
      message.from,
      '50-receitas-airfryer.pdf',
      '50 Receitas Airfryer - Seu presente! 🍟',
      wuzapiToken
    )
    await logEvent(supabase, { evento: 'ebook_reenviado', cliente_phone: message.from, user_id: userId })
    return
  }

  // ========== DETECÇÃO E CONVERSÃO DE LINKS DE MARKETPLACE ==========
  const linkResult = detectMarketplaceLink(text)
  if (linkResult) {
    console.log('🔗 [AMZ-OFERTAS] Link de marketplace detectado:', linkResult)
    
    // Buscar amazon_affiliate_tag do afiliado
    const { data: afiliadoData } = await supabase
      .from('clientes_afiliados')
      .select('amazon_affiliate_tag')
      .eq('user_id', userId)
      .single()
    
    const amazonTag = afiliadoData?.amazon_affiliate_tag || 'amzofertas03-20'
    const linkConvertido = convertToAffiliateLink(linkResult.url, linkResult.marketplace, amazonTag)
    
    // Buscar nome do cliente
    const cleanPhoneLink = message.from.replace(/\D/g, '')
    const { data: leadInfo } = await supabase
      .from('leads_ebooks')
      .select('nome')
      .eq('phone', cleanPhoneLink)
      .single()
    
    const nomeCliente = leadInfo?.nome?.split(' ')[0] || 'amigo(a)'
    
    // Enviar link convertido
    await sendWhatsAppMessage(
      message.from,
      `Opa, ${nomeCliente}! Que achado! 🤩\n\n` +
      `Aqui está seu link com *2% de cashback*:\n\n` +
      `👉 ${linkConvertido}\n\n` +
      `Depois que comprar, me manda o comprovante e eu credito seu cashback + te dou um eBook de presente! 🎁`,
      wuzapiToken
    )
    
    await logEvent(supabase, { 
      evento: 'link_convertido', 
      cliente_phone: message.from, 
      user_id: userId,
      metadata: { 
        marketplace: linkResult.marketplace, 
        link_original: linkResult.url,
        link_convertido: linkConvertido 
      }
    })
    return
  }

  // ========== FLUXO DE BOAS-VINDAS + EBOOK GRÁTIS ==========
  const cleanPhone = message.from.replace(/\D/g, '')
  
  // Verificar estado atual da conversa
  const { data: userState } = await supabase
    .from('afiliado_user_states')
    .select('status, state')
    .eq('phone', cleanPhone)
    .single()
  
  // Verificar se já recebeu o eBook de boas-vindas (grátis)
  const { data: ebookRecebido } = await supabase
    .from('afiliado_ebook_deliveries')
    .select('id')
    .eq('phone', cleanPhone)
    .eq('ebook_titulo', '50 Receitas Airfryer')
    .single()

  // Verificar se temos o nome e categorias do cliente
  const { data: leadInfo } = await supabase
    .from('leads_ebooks')
    .select('id, nome, categorias')
    .eq('phone', cleanPhone)
    .single()

  // Se estamos aguardando CATEGORIAS (novo fluxo: categorias primeiro)
  if (userState?.status === 'aguardando_categorias') {
    const categoriasEncontradas = parseCategoriasFromText(text)
    
    if (categoriasEncontradas.length > 0) {
      // Salvar categorias e pedir nome
      await supabase.from('afiliado_user_states').update({
        status: 'aguardando_nome',
        state: { ...userState.state, categorias: categoriasEncontradas }
      }).eq('phone', cleanPhone)
      
      await sendWhatsAppMessage(
        message.from,
        `Ótimo! Anotei: *${categoriasEncontradas.join(', ')}* 📝\n\n` +
        `Agora me diz: *qual é o seu nome?* 😊`,
        wuzapiToken
      )
      await logEvent(supabase, { evento: 'categorias_capturadas', cliente_phone: message.from, user_id: userId, metadata: { categorias: categoriasEncontradas } })
      return
    }
    
    // Não reconheceu categorias, pedir de novo
    await sendWhatsAppMessage(
      message.from,
      `Hmm, não entendi. 🤔\n\n` +
      `Escolhe pelo número ou nome:\n\n` +
      `1️⃣ Casa\n` +
      `2️⃣ Cozinha\n` +
      `3️⃣ Bebê\n` +
      `4️⃣ Tech\n` +
      `5️⃣ Gamer\n` +
      `6️⃣ Beleza\n` +
      `7️⃣ Fitness\n` +
      `8️⃣ Ferramentas\n` +
      `9️⃣ Pet\n` +
      `🔟 Moda\n\n` +
      `_Ex: "1, 2, 6" ou "Cozinha, Beleza, Pet"_`,
      wuzapiToken
    )
    return
  }
  
  // Se estamos aguardando NOME (após categorias)
  if (userState?.status === 'aguardando_nome') {
    const pareceNome = /^[a-zA-ZÀ-ÿ\s]{2,50}$/.test(text.trim())
    
    if (pareceNome) {
      const nomeCliente = text.trim()
      const categoriasDoState = (userState.state as any)?.categorias || ['Casa']
      
      // Criar lead com nome e categorias
      await supabase.from('leads_ebooks').upsert({
        phone: cleanPhone,
        nome: nomeCliente,
        categorias: categoriasDoState,
        user_id: userId
      }, { onConflict: 'phone' })
      
      // ======= SINCRONIZAR COM afiliado_clientes_ebooks =======
      await supabase.from('afiliado_clientes_ebooks').upsert({
        phone: cleanPhone,
        nome: nomeCliente,
        categorias_preferidas: categoriasDoState,
        user_id: userId
      }, { onConflict: 'phone' })
      
      // ======= SINCRONIZAR COM afiliado_cliente_preferencias =======
      await supabase.from('afiliado_cliente_preferencias').upsert({
        phone: cleanPhone,
        categorias_ativas: categoriasDoState,
        freq_ofertas: 'diaria'
      }, { onConflict: 'phone' })
      
      console.log(`✅ [AMZ-OFERTAS] Cliente salvo: ${nomeCliente}, categorias: ${categoriasDoState.join(', ')}`)
      
      // Atualizar estado
      await supabase.from('afiliado_user_states').update({
        status: 'aguardando_comprovante',
        state: { ...userState.state, nome: nomeCliente }
      }).eq('phone', cleanPhone)
      
      // Enviar eBook grátis
      await sendEbookBoasVindas(supabase, message.from, nomeCliente, categoriasDoState, wuzapiToken, userId)
      await logEvent(supabase, { evento: 'nome_capturado', cliente_phone: message.from, user_id: userId, metadata: { nome: nomeCliente, categorias: categoriasDoState } })
      return
    }
    
    // Não parece nome
    await sendWhatsAppMessage(
      message.from,
      `Por favor, me diz seu nome! 😊\n\nPode ser só o primeiro nome mesmo.`,
      wuzapiToken
    )
    return
  }

  // Se NÃO recebeu eBook grátis ainda e NÃO está em fluxo → Iniciar fluxo
  if (!ebookRecebido && !userState) {
    // Primeiro contato - perguntar categorias primeiro
    await supabase.from('afiliado_user_states').insert({
      phone: cleanPhone,
      status: 'aguardando_categorias',
      state: { origem: 'whatsapp', user_id: userId }
    })
    
    await sendWhatsAppMessage(
      message.from,
      `Pronto! Vamos começar do zero! 🎉\n\n` +
      `Olá! Eu sou a assistente virtual da *AMZ Ofertas* 🛒💜\n\n` +
      `Pra te mandar ofertas e eBooks do seu interesse, me conta:\n\n` +
      `*Quais categorias você mais curte?*\n\n` +
      `1️⃣ Casa\n` +
      `2️⃣ Cozinha\n` +
      `3️⃣ Bebê\n` +
      `4️⃣ Tech\n` +
      `5️⃣ Gamer\n` +
      `6️⃣ Beleza\n` +
      `7️⃣ Fitness\n` +
      `8️⃣ Ferramentas\n` +
      `9️⃣ Pet\n` +
      `🔟 Moda\n\n` +
      `_Pode mandar mais de uma! Ex: "1, 2, 6" ou "Cozinha, Beleza, Pet"_`,
      wuzapiToken
    )
    await logEvent(supabase, { evento: 'primeiro_contato', cliente_phone: message.from, user_id: userId })
    return
  }

  // ========== FLUXO COM IA (já recebeu eBook grátis) ==========
  console.log('🤖 [AMZ-OFERTAS] Entrando no fluxo IA para:', message.from)
  
  // Buscar histórico de conversa
  const conversationHistory = await getConversationHistory(supabase, message.from)
  console.log('📜 [AMZ-OFERTAS] Histórico carregado, qtd:', conversationHistory.length)
  
  // Buscar info de cashback para contexto
  const cashbackInfo = await getCashbackInfo(supabase, message.from)
  console.log('💰 [AMZ-OFERTAS] Cashback info:', cashbackInfo ? 'encontrado' : 'não encontrado')
  
  // Construir contexto adicional
  let additionalContext = ''
  if (cashbackInfo) {
    additionalContext = `\n\nINFO DO CLIENTE (use se perguntarem sobre saldo):
- Saldo atual: R$ ${(cashbackInfo.saldo_atual || 0).toFixed(2)}
- Total acumulado: R$ ${(cashbackInfo.total_acumulado || 0).toFixed(2)}
- Total de compras: ${cashbackInfo.compras_total || 0}`
  }
  
  // Nome do cliente para contexto
  const nomeCliente = leadInfo?.nome?.split(' ')[0] || 'amiga'
  additionalContext += `\n\nNOME DO CLIENTE: ${nomeCliente} (use para personalizar a conversa)`
  console.log('👤 [AMZ-OFERTAS] Nome cliente:', nomeCliente)

  // Gerar resposta com IA
  console.log('🧠 [AMZ-OFERTAS] Chamando generateAIResponse...')
  const aiResponse = await generateAIResponse(
    text, 
    conversationHistory,
    additionalContext
  )
  console.log('✅ [AMZ-OFERTAS] Resposta IA recebida:', aiResponse?.slice(0, 50))

  // Salvar conversa
  await saveConversation(supabase, message.from, text, aiResponse)
  console.log('💾 [AMZ-OFERTAS] Conversa salva')

  // Enviar resposta
  console.log('📤 [AMZ-OFERTAS] Enviando resposta para:', message.from)
  await sendWhatsAppMessage(message.from, aiResponse, wuzapiToken)
  console.log('✅ [AMZ-OFERTAS] Resposta enviada com sucesso!')

  // Log evento
  await logEvent(supabase, {
    evento: 'conversa_ia',
    cliente_phone: message.from,
    user_id: userId,
    metadata: { pergunta: text.slice(0, 100), resposta: aiResponse.slice(0, 100) }
  })
}

// ============================================
// PARSER DE CATEGORIAS DO TEXTO
// ============================================
function parseCategoriasFromText(text: string): string[] {
  const textLower = text.toLowerCase().trim()
  const categorias: string[] = []
  
  // Mapeamento de números para categorias
  const numerosParaCategorias: Record<string, string> = {
    '1': 'casa',
    '2': 'cozinha',
    '3': 'bebe',
    '4': 'tech',
    '5': 'gamer',
    '6': 'beleza',
    '7': 'fitness',
    '8': 'ferramentas',
    '9': 'pet',
    '10': 'moda'
  }
  
  // Primeiro, tentar parsear números (1, 2, 6 ou 1 2 6 ou 1,2,6)
  const numerosEncontrados = text.match(/\b(\d{1,2})\b/g)
  if (numerosEncontrados && numerosEncontrados.length > 0) {
    for (const num of numerosEncontrados) {
      const categoria = numerosParaCategorias[num]
      if (categoria && !categorias.includes(categoria)) {
        categorias.push(categoria)
      }
    }
    if (categorias.length > 0) {
      return categorias
    }
  }
  
  const mapeamento: Record<string, string> = {
    'casa': 'casa',
    'cozinha': 'cozinha',
    'airfryer': 'cozinha',
    'air fryer': 'cozinha',
    'panela': 'cozinha',
    'bebe': 'bebe',
    'bebê': 'bebe',
    'criança': 'bebe',
    'tech': 'tech',
    'tecnologia': 'tech',
    'celular': 'tech',
    'eletronico': 'tech',
    'eletrônico': 'tech',
    'gamer': 'gamer',
    'game': 'gamer',
    'jogo': 'gamer',
    'beleza': 'beleza',
    'maquiagem': 'beleza',
    'skincare': 'beleza',
    'perfume': 'beleza',
    'fitness': 'fitness',
    'academia': 'fitness',
    'treino': 'fitness',
    'esporte': 'fitness',
    'ferramenta': 'ferramentas',
    'ferramentas': 'ferramentas',
    'pet': 'pet',
    'cachorro': 'pet',
    'gato': 'pet',
    'animal': 'pet',
    'moda': 'moda',
    'roupa': 'moda',
    'decoracao': 'decoracao',
    'decoração': 'decoracao',
    'automotivo': 'automotivo',
    'carro': 'automotivo'
  }
  
  for (const [palavra, categoria] of Object.entries(mapeamento)) {
    if (textLower.includes(palavra) && !categorias.includes(categoria)) {
      categorias.push(categoria)
    }
  }
  
  return categorias
}

// ============================================
// ENVIAR EBOOK GRÁTIS DE BOAS-VINDAS (PDF ANEXADO)
// ============================================
async function sendEbookBoasVindas(
  supabase: any,
  phone: string,
  nome: string,
  categorias: string[],
  wuzapiToken: string | null,
  userId: string | null
) {
  const cleanPhone = phone.replace(/\D/g, '')
  const primeiroNome = nome.split(' ')[0]

  console.log('🎁 [AMZ-OFERTAS] Enviando eBook GRÁTIS (PDF) para:', nome, phone, categorias)

  // Formatar categorias bonitas
  const iconesCat: Record<string, string> = {
    'casa': '🏠', 'cozinha': '🍳', 'bebe': '👶', 'tech': '📱', 'gamer': '🎮',
    'beleza': '💄', 'fitness': '💪', 'ferramentas': '🔧', 'pet': '🐾', 'moda': '👗',
    'decoracao': '🎨', 'automotivo': '🚗'
  }
  const categoriasFormatadas = categorias.map(c => `${iconesCat[c] || '•'} ${c.charAt(0).toUpperCase() + c.slice(1)}`).join('\n')

  // Mensagem de confirmação
  await sendWhatsAppMessage(
    phone,
    `Perfeito, ${primeiroNome}! 🎉\n\n` +
    `Suas categorias favoritas:\n${categoriasFormatadas}\n\n` +
    `Vou te enviar as melhores ofertas dessas categorias! 🔥\n\n` +
    `Aguarda que já te mando seu presente... 🎁`,
    wuzapiToken
  )

  // Pequena pausa
  await new Promise(r => setTimeout(r, 2000))

  // Enviar PDF do eBook como anexo (aparece bonito no WhatsApp)
  await sendWhatsAppPDF(
    phone,
    '50-receitas-airfryer.pdf',
    '50 Receitas Airfryer - Seu presente! 🍟',
    wuzapiToken
  )

  // Pequena pausa
  await new Promise(r => setTimeout(r, 2500))

  // Mensagem de boas-vindas à comunidade
  await sendWhatsAppMessage(
    phone,
    `🎉 *Agora você está conectada com a AMZ Ofertas!*\n\n` +
    `Aguarde que em breve você já vai começar a receber nossas promoções da *Magalu*, *Shopee*, *Amazon* e *Mercado Livre*! 🛒🔥\n\n` +
    `Fique de olho aqui! 👀`,
    wuzapiToken
  )

  // Pequena pausa
  await new Promise(r => setTimeout(r, 3000))

  // Dica sobre cashback com links próprios
  await sendWhatsAppMessage(
    phone,
    `💡 *Dica pra você:*\n\n` +
    `Você sabia que também pode escolher um produto nos marketplaces que ainda não ofertamos?\n\n` +
    `É só colar o link aqui e você também ganha *2% de cashback* + mais um *eBook de presente*! 🎁💰\n\n` +
    `Aproveita seu eBook de receitas! 🍟`,
    wuzapiToken
  )

  // Pequena pausa
  await new Promise(r => setTimeout(r, 2500))

  // Redes sociais
  await sendWhatsAppMessage(
    phone,
    `📱 *Segue a gente nas redes sociais!*\n\n` +
    `📸 Instagram: @amzofertas\n` +
    `👍 Facebook: AMZ Ofertas\n\n` +
    `Lá tem dicas, promoções e novidades quentinhas! 🔥`,
    wuzapiToken
  )

  // Registrar entrega
  await logEbookDelivery(supabase, {
    phone: cleanPhone,
    ebook_titulo: '50 Receitas Airfryer',
    ebook_filename: 'ebook-airfryer-COMPLETO.pdf',
    loja: 'GRATUITO',
    valor_compra: 0,
    categoria: 'Cozinha',
    comprovante_url: null,
    user_id: userId
  })

  await logEvent(supabase, {
    evento: 'ebook_gratuito_enviado',
    cliente_phone: phone,
    categoria: 'Cozinha',
    user_id: userId,
    metadata: { nome, categorias, ebook: '50 Receitas Airfryer' }
  })

  console.log('✅ [AMZ-OFERTAS] eBook grátis enviado para:', nome, categorias)
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
// GARANTIR QUE LEAD EXISTE E SINCRONIZAR TODAS AS TABELAS
// ⚠️ GOVERNANÇA: ARQUIVO PROTEGIDO - NÃO MODIFICAR SEM APROVAÇÃO ⚠️
// ============================================
async function ensureLeadExists(
  supabase: any,
  phone: string,
  userId: string | null,
  nome?: string,
  categorias?: string[]
): Promise<void> {
  const cleanPhone = phone.replace(/\D/g, '')
  
  // ======= BUSCAR DADOS DO STATE SE NÃO FORAM PASSADOS =======
  let nomeReal = nome
  let categoriasReais = categorias
  
  if (!nomeReal || !categoriasReais) {
    const { data: userState } = await supabase
      .from('afiliado_user_states')
      .select('state')
      .eq('phone', cleanPhone)
      .single()
    
    if (userState?.state) {
      const state = userState.state as any
      if (!nomeReal && state.nome) {
        nomeReal = state.nome
      }
      if (!categoriasReais && state.categorias && state.categorias.length > 0) {
        categoriasReais = state.categorias
      }
    }
  }
  
  // Verificar se já existe em leads_ebooks
  const { data: existing } = await supabase
    .from('leads_ebooks')
    .select('id, nome, categorias')
    .eq('phone', cleanPhone)
    .single()

  if (existing) {
    // Atualizar nome se fornecido e diferente do padrão
    if (nomeReal && existing.nome !== nomeReal && (existing.nome === 'Cliente' || !existing.nome)) {
      await supabase
        .from('leads_ebooks')
        .update({ nome: nomeReal })
        .eq('id', existing.id)
        
      // Também sincronizar afiliado_clientes_ebooks
      await supabase.from('afiliado_clientes_ebooks').upsert({
        phone: cleanPhone,
        nome: nomeReal,
        user_id: userId
      }, { onConflict: 'phone' })
      
      console.log('✅ [AMZ-OFERTAS] Lead atualizado com nome do state:', nomeReal)
    }
    
    // Atualizar categorias se existem no state mas não no lead
    if (categoriasReais && (!existing.categorias || existing.categorias.length === 0 || (existing.categorias.length === 1 && existing.categorias[0] === 'Casa'))) {
      await supabase
        .from('leads_ebooks')
        .update({ categorias: categoriasReais })
        .eq('id', existing.id)
      
      await supabase.from('afiliado_clientes_ebooks').upsert({
        phone: cleanPhone,
        categorias_preferidas: categoriasReais,
        user_id: userId
      }, { onConflict: 'phone' })
      
      await supabase.from('afiliado_cliente_preferencias').upsert({
        phone: cleanPhone,
        categorias_ativas: categoriasReais,
        freq_ofertas: 'diaria'
      }, { onConflict: 'phone' })
      
      console.log('✅ [AMZ-OFERTAS] Lead atualizado com categorias do state:', categoriasReais)
    }
    return
  }

  const nomeParaSalvar = nomeReal || 'Cliente'
  const categoriasParaSalvar = categoriasReais || ['Casa']

  // Criar lead em leads_ebooks
  await supabase
    .from('leads_ebooks')
    .insert({
      phone: cleanPhone,
      nome: nomeParaSalvar,
      categorias: categoriasParaSalvar,
      origem: 'ebook_gratuito',
      origem_detalhe: 'whatsapp',
      cashback_ativo: true,
      user_id: userId
    })

  // ======= SINCRONIZAR COM afiliado_clientes_ebooks =======
  await supabase.from('afiliado_clientes_ebooks').upsert({
    phone: cleanPhone,
    nome: nomeParaSalvar,
    categorias_preferidas: categoriasParaSalvar,
    user_id: userId
  }, { onConflict: 'phone' })

  // ======= SINCRONIZAR COM afiliado_cliente_preferencias =======
  await supabase.from('afiliado_cliente_preferencias').upsert({
    phone: cleanPhone,
    categorias_ativas: categoriasParaSalvar,
    freq_ofertas: 'diaria'
  }, { onConflict: 'phone' })

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

  console.log('✅ [AMZ-OFERTAS] Novo lead criado e sincronizado:', cleanPhone, nomeParaSalvar, categoriasParaSalvar)
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
  
  // URL pública do PDF hospedado no domínio customizado
  const APP_BASE_URL = "https://amzofertas.com.br"

  if (!customToken) return

  // Formatar número
  let formattedPhone = to.replace(/\D/g, '')
  if (!formattedPhone.startsWith('55') && formattedPhone.length === 11) {
    formattedPhone = '55' + formattedPhone
  }

  // Usar URL pública do app (pasta public/ebooks/)
  const pdfUrl = `${APP_BASE_URL}/ebooks/${filename}`

  try {
    const response = await fetch(`${CONTABO_WUZAPI_URL}/chat/send/document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Token': customToken },
      body: JSON.stringify({ 
        Phone: formattedPhone, 
        Document: pdfUrl, 
        FileName: filename,
        Caption: `📚 ${caption}` 
      })
    })

    const result = await response.json()
    console.log('📄 [AMZ-OFERTAS] Resposta envio PDF:', JSON.stringify(result))

    if (!response.ok || result?.success === false) {
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
