// supabase/functions/wuzapi-webhook-afiliados/index.ts
// FASE 3: Webhook com Gemini Vision para validação automática de comprovantes
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
// GEMINI VISION: ANÁLISE DE COMPROVANTE
// ============================================
async function analyzeComprovanteGemini(imageUrl: string): Promise<ComprovanteAnalysis> {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
  
  if (!GEMINI_API_KEY) {
    console.error('❌ [AFILIADO-EBOOK] GEMINI_API_KEY não configurada!')
    throw new Error('GEMINI_API_KEY não configurada')
  }

  console.log('🧠 [AFILIADO-EBOOK] Analisando comprovante com Gemini Vision...')
  console.log('🖼️ [AFILIADO-EBOOK] URL da imagem:', imageUrl)

  try {
    // Download da imagem
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

    console.log('📥 [AFILIADO-EBOOK] Imagem baixada, tamanho:', imageBuffer.byteLength, 'bytes')

    // Prompt estruturado para Gemini
    const prompt = `Analise esta imagem de comprovante de compra e extraia as seguintes informações em formato JSON:

{
  "valido": true ou false,
  "loja": "Amazon" ou "Magazine Luiza" ou "Mercado Livre" ou "Outra" ou "Não identificado",
  "valor": valor em número (ex: 150.50),
  "produto": "nome do produto principal",
  "data": "data da compra no formato DD/MM/YYYY",
  "categoria": "Cozinha" ou "Beleza" ou "Fitness" ou "Bebê" ou "Tech" ou "Casa" ou "Pet" ou "Moda" ou "Livros" ou "Jardim",
  "confianca": número de 0 a 100 (quão confiante você está na análise),
  "motivo_invalido": "razão se não for válido"
}

REGRAS DE VALIDAÇÃO:
- valido = true APENAS SE for claramente um comprovante de compra de e-commerce
- loja deve ser identificada pelo logo ou texto
- valor deve ser o total da compra
- categoria baseada no produto principal
- confianca deve ser honesta (70+ = muito confiante, 50-70 = confiante, <50 = duvidoso)
- Se não conseguir ler claramente, marque valido=false

Retorne APENAS o JSON, sem texto adicional.`

    // Chamada para Gemini 1.5 Pro Vision
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64Image
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024
          }
        })
      }
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('❌ [AFILIADO-EBOOK] Erro Gemini:', errorText)
      throw new Error(`Gemini API error: ${geminiResponse.status}`)
    }

    const geminiData = await geminiResponse.json()
    console.log('📥 [AFILIADO-EBOOK] Resposta Gemini recebida')

    // Extrair texto da resposta
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    
    if (!responseText) {
      console.error('❌ [AFILIADO-EBOOK] Resposta Gemini vazia:', JSON.stringify(geminiData))
      throw new Error('Resposta Gemini vazia')
    }

    console.log('📝 [AFILIADO-EBOOK] Resposta Gemini:', responseText)

    // Parse JSON (remover markdown se houver)
    let jsonText = responseText.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '')
    }

    const analysis: ComprovanteAnalysis = JSON.parse(jsonText)
    console.log('✅ [AFILIADO-EBOOK] Análise extraída:', analysis)

    return analysis

  } catch (error) {
    console.error('❌ [AFILIADO-EBOOK] Erro na análise Gemini:', error)
    // Retornar análise inválida em caso de erro
    return {
      valido: false,
      loja: 'Não identificado',
      valor: 0,
      produto: '',
      data: '',
      categoria: 'Tech',
      confianca: 0,
      motivo_invalido: error instanceof Error ? error.message : 'Erro ao processar imagem'
    }
  }
}

// ============================================
// VALIDAÇÃO ANTI-FRAUDE
// ============================================
function validateComprovante(analysis: ComprovanteAnalysis): { valid: boolean; reason?: string } {
  console.log('🔍 [AFILIADO-EBOOK] Validando comprovante...')

  // Regra 1: Gemini marcou como inválido
  if (!analysis.valido) {
    return {
      valid: false,
      reason: analysis.motivo_invalido || 'Comprovante não reconhecido'
    }
  }

  // Regra 2: Confiança muito baixa
  if (analysis.confianca < 70) {
    return {
      valid: false,
      reason: 'Imagem não está clara o suficiente. Tire outra foto mais nítida.'
    }
  }

  // Regra 3: Loja não suportada
  const lojasValidas = ['Amazon', 'Magazine Luiza', 'Mercado Livre']
  if (!lojasValidas.includes(analysis.loja)) {
    return {
      valid: false,
      reason: 'Loja não suportada. Aceitamos: Amazon, Magazine Luiza e Mercado Livre.'
    }
  }

  // Regra 4: Valor muito baixo (mínimo R$ 50)
  if (analysis.valor < 50) {
    return {
      valid: false,
      reason: 'Valor mínimo de compra: R$ 50,00'
    }
  }

  // Regra 5: Categoria não identificada - usar padrão
  const categoriasValidas = [
    'Cozinha', 'Beleza', 'Fitness', 'Bebê', 'Tech',
    'Casa', 'Pet', 'Moda', 'Livros', 'Jardim'
  ]
  if (!categoriasValidas.includes(analysis.categoria)) {
    analysis.categoria = 'Tech' // Categoria padrão
  }

  console.log('✅ [AFILIADO-EBOOK] Comprovante válido!')
  return { valid: true }
}

// ============================================
// SISTEMA DE EBOOKS POR CATEGORIA
// ============================================
function getEbooksByCategory(categoria: string): any[] {
  const ebooks: Record<string, any[]> = {
    'Cozinha': [
      { id: 1, titulo: '50 Receitas Airfryer', arquivo: 'cozinha-receitas-airfryer.pdf' },
      { id: 2, titulo: 'Guia Completo de Panelas', arquivo: 'cozinha-guia-panelas.pdf' },
      { id: 3, titulo: 'Técnicas de Corte Profissional', arquivo: 'cozinha-tecnicas-corte.pdf' }
    ],
    'Beleza': [
      { id: 11, titulo: 'Rotina Skincare Completa', arquivo: 'beleza-skincare-rotina.pdf' },
      { id: 12, titulo: 'Maquiagem para Iniciantes', arquivo: 'beleza-maquiagem-iniciante.pdf' },
      { id: 13, titulo: 'Cabelos: Guia Definitivo', arquivo: 'beleza-cabelos-guia.pdf' }
    ],
    'Fitness': [
      { id: 21, titulo: 'Treino em Casa Sem Equipamentos', arquivo: 'fitness-treino-casa.pdf' },
      { id: 22, titulo: 'Dieta Flexível: Guia Completo', arquivo: 'fitness-dieta-flexivel.pdf' },
      { id: 23, titulo: 'Alongamentos Diários', arquivo: 'fitness-alongamentos.pdf' }
    ],
    'Bebê': [
      { id: 31, titulo: 'Primeiros 6 Meses do Bebê', arquivo: 'bebe-primeiros-meses.pdf' },
      { id: 32, titulo: 'Alimentação Infantil Saudável', arquivo: 'bebe-alimentacao.pdf' },
      { id: 33, titulo: 'Sono do Bebê: Guia Prático', arquivo: 'bebe-sono-guia.pdf' }
    ],
    'Tech': [
      { id: 41, titulo: '50 Apps Essenciais', arquivo: 'tech-apps-essenciais.pdf' },
      { id: 42, titulo: 'Produtividade Digital', arquivo: 'tech-produtividade.pdf' },
      { id: 43, titulo: 'Fotografia com Celular', arquivo: 'tech-fotografia-celular.pdf' }
    ],
    'Casa': [
      { id: 51, titulo: 'Organização da Casa: Marie Kondo', arquivo: 'casa-organizacao.pdf' },
      { id: 52, titulo: 'Decoração com Pouco Dinheiro', arquivo: 'casa-decoracao.pdf' },
      { id: 53, titulo: 'Limpeza Profunda: Checklist', arquivo: 'casa-limpeza.pdf' }
    ],
    'Pet': [
      { id: 61, titulo: 'Guia Completo: Cachorro Filhote', arquivo: 'pet-cachorro-guia.pdf' },
      { id: 62, titulo: 'Cuidados com Gatos', arquivo: 'pet-gato-cuidados.pdf' },
      { id: 63, titulo: 'Adestramento Positivo', arquivo: 'pet-adestramento.pdf' }
    ],
    'Moda': [
      { id: 71, titulo: 'Guarda-Roupa Cápsula', arquivo: 'moda-guarda-roupa-capsula.pdf' },
      { id: 72, titulo: 'Combinações Perfeitas', arquivo: 'moda-combinacoes.pdf' },
      { id: 73, titulo: 'Estilo Pessoal: Descubra o Seu', arquivo: 'moda-estilo-pessoal.pdf' }
    ],
    'Livros': [
      { id: 81, titulo: 'Top 50 Livros Clássicos', arquivo: 'livros-top-50-classicos.pdf' },
      { id: 82, titulo: 'Como Ler Mais: Técnicas', arquivo: 'livros-ler-mais.pdf' },
      { id: 83, titulo: 'Resumos: Best Sellers 2024', arquivo: 'livros-resumos-bestsellers.pdf' }
    ],
    'Jardim': [
      { id: 91, titulo: 'Horta Caseira: 10 Plantas Fáceis', arquivo: 'jardim-horta-caseira.pdf' },
      { id: 92, titulo: 'Jardinagem para Iniciantes', arquivo: 'jardim-iniciantes.pdf' },
      { id: 93, titulo: 'Plantas de Interior', arquivo: 'jardim-plantas-interior.pdf' }
    ]
  }

  return ebooks[categoria] || ebooks['Tech']
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
// HANDLER: MENSAGEM DE IMAGEM (COM GEMINI VISION)
// ============================================
async function handleImageMessage(
  supabase: any, 
  message: WhatsAppMessage,
  wuzapiToken: string | null,
  userId: string | null
) {
  console.log('📸 [AFILIADO-EBOOK] Processando comprovante de:', message.from)

  try {
    // Salvar estado inicial
    await saveUserState(supabase, message.from, {
      status: 'processando',
      state: {
        comprovante_url: message.imageUrl,
        recebido_em: new Date().toISOString(),
        user_id: userId
      }
    })

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
    console.log('🧠 [AFILIADO-EBOOK] Análise completa:', analysis)

    // VALIDAÇÃO ANTI-FRAUDE
    const validation = validateComprovante(analysis)

    if (!validation.valid) {
      // COMPROVANTE INVÁLIDO
      await sendWhatsAppMessage(
        message.from,
        `❌ *Comprovante não validado*\n\n` +
        `📋 Motivo: ${validation.reason}\n\n` +
        `💡 *Dicas:*\n` +
        `• Tire uma foto mais nítida\n` +
        `• Certifique-se que é um comprovante de compra\n` +
        `• Valor mínimo: R$ 50\n` +
        `• Lojas aceitas: Amazon, Magazine Luiza, Mercado Livre\n\n` +
        `Tente novamente!`,
        wuzapiToken
      )

      // Log: comprovante rejeitado
      await logEvent(supabase, {
        evento: 'comprovante_rejeitado',
        cliente_phone: message.from,
        loja: analysis.loja,
        valor: analysis.valor,
        motivo: validation.reason,
        confianca: analysis.confianca,
        user_id: userId,
        metadata: analysis
      })

      // Limpar estado
      await clearUserState(supabase, message.from)
      return
    }

    // COMPROVANTE VÁLIDO!
    console.log('✅ [AFILIADO-EBOOK] Comprovante validado:', analysis)

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

    // Montar mensagem com opções de eBooks
    let mensagem = `✅ *Comprovante validado!*\n\n`
    mensagem += `🏪 Loja: ${analysis.loja}\n`
    mensagem += `💰 Valor: R$ ${analysis.valor.toFixed(2)}\n`
    mensagem += `📦 Produto: ${analysis.produto}\n`
    mensagem += `📊 Confiança: ${analysis.confianca}%\n\n`
    mensagem += `━━━━━━━━━━━━━━━━━━\n\n`
    mensagem += `🎁 *Escolha seu eBook GRÁTIS!*\n\n`
    mensagem += `Categoria: *${analysis.categoria}*\n\n`

    ebooks.forEach((ebook: any, index: number) => {
      mensagem += `*${index + 1}* - ${ebook.titulo}\n`
    })

    mensagem += `\n━━━━━━━━━━━━━━━━━━\n\n`
    mensagem += `💬 Digite o *número* do eBook que deseja!\n\n`
    mensagem += `Exemplo: *1*`

    await sendWhatsAppMessage(message.from, mensagem, wuzapiToken)

    // Log: comprovante validado
    await logEvent(supabase, {
      evento: 'comprovante_validado',
      cliente_phone: message.from,
      loja: analysis.loja,
      valor: analysis.valor,
      categoria: analysis.categoria,
      produto: analysis.produto,
      confianca: analysis.confianca,
      user_id: userId,
      metadata: analysis
    })

  } catch (error) {
    console.error('❌ [AFILIADO-EBOOK] Erro ao processar comprovante:', error)

    await sendWhatsAppMessage(
      message.from,
      '❌ *Erro ao processar comprovante*\n\n' +
      'Tente novamente em alguns instantes.\n\n' +
      'Se o problema persistir, entre em contato com suporte.',
      wuzapiToken
    )

    await logEvent(supabase, {
      evento: 'erro_processamento',
      cliente_phone: message.from,
      user_id: userId,
      metadata: { erro: error instanceof Error ? error.message : 'Erro desconhecido' }
    })

    await clearUserState(supabase, message.from)
  }
}

// ============================================
// HANDLER: ESCOLHA DE EBOOK (VERSÃO FINAL)
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
    `Aproveite seu eBook exclusivo!\n\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `💡 *Faça mais compras e ganhe mais eBooks!*\n\n` +
    `🎁 A cada compra validada, você escolhe um novo eBook.\n\n` +
    `⭐ Após 5 compras, você se torna VIP e recebe benefícios exclusivos!\n\n` +
    `Obrigado por comprar conosco! 💙`,
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

  // Log evento
  await logEvent(supabase, {
    evento: 'ebook_entregue',
    cliente_phone: message.from,
    loja: compraInfo.loja,
    valor: compraInfo.valor,
    categoria: compraInfo.categoria,
    user_id: userId,
    metadata: { ebook: ebook.titulo, arquivo: ebook.arquivo }
  })

  // Limpar estado
  await clearUserState(supabase, message.from)

  // Verificar se virou VIP
  const { data: clienteData } = await supabase
    .from('afiliado_clientes_ebooks')
    .select('total_compras')
    .eq('phone', message.from)
    .single()

  if (clienteData && clienteData.total_compras >= 5) {
    await sendWhatsAppMessage(
      message.from,
      `🌟 *PARABÉNS! VOCÊ É VIP!*\n\n` +
      `Você fez 5+ compras e agora tem benefícios exclusivos:\n\n` +
      `✅ Acesso prioritário a novos eBooks\n` +
      `✅ eBooks premium exclusivos\n` +
      `✅ Suporte VIP\n\n` +
      `Obrigado pela confiança! 💙`,
      wuzapiToken
    )
  }
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
