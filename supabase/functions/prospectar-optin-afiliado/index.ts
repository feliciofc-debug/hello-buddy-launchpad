// supabase/functions/prospectar-optin-afiliado/index.ts
// Sistema de Prospecção AMZ Ofertas - Pietro Eugenio
// Envia convites para contatos opt-in entrarem no grupo de ofertas
//
// Configuração:
// - Envio via número 21995379550 (wuzapi_token do Felicio)
// - Limite: ~220 mensagens/dia (7 dias = ~1540 mensagens)
// - Delay humanizado entre mensagens

import { createClient } from "npm:@supabase/supabase-js@2.75.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configurações de segurança
const MAX_ENVIOS_POR_EXECUCAO = 30 // Máximo por chamada da função
const DELAY_ENTRE_MENSAGENS_MS = 8000 // 8 segundos entre mensagens
const DELAY_VARIACAO_MS = 4000 // Variação aleatória de 0-4 segundos

// Mensagem de prospecção
const MENSAGENS_PROSPECCAO = [
  `🎉 *Ei! Descobri um jeito de você ganhar dinheiro de volta nas suas compras!*

Sou o Pietro da AMZ Ofertas 👋

A gente tem um grupo no WhatsApp onde:
💸 Você recebe ofertas exclusivas todo dia
💰 Ganha *2% de cashback* nas compras
📚 Ganha eBooks grátis de presente!

Quer participar? É grátis!
👉 https://chat.whatsapp.com/Cfops2yRnHGK1tM7A4W0PK

Qualquer dúvida, só me chamar! 😊`,

  `👋 Opa! Tudo bem?

Sou o Pietro, da *AMZ Ofertas* 🛒

Passei pra te convidar pro nosso grupo de ofertas no WhatsApp!

✅ Ofertas das melhores lojas (Amazon, Magalu, Shopee...)
✅ *Cashback de 2%* em todas as compras
✅ eBooks grátis de presente! 🎁

É simples: comprou pelo link, mandou o comprovante = cashback na conta!

Bora? O link tá aqui:
👉 https://chat.whatsapp.com/Cfops2yRnHGK1tM7A4W0PK`,

  `Oii! 💜

Tô passando pra te convidar pro grupo *AMZ Ofertas Cashback*!

Lá você recebe:
🛒 Promoções incríveis todo dia
💰 2% de cashback nas compras
📚 eBooks grátis quando comprar!

E quando juntar R$30, você resgata via PIX! 🤑

Entra no grupo, é gratuito:
👉 https://chat.whatsapp.com/Cfops2yRnHGK1tM7A4W0PK

Qualquer dúvida, me chama! Sou o Pietro 😊`,
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 [PROSPECÇÃO] Iniciando envio de convites opt-in...')
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar token do Pietro Eugenio (21995379550)
    const { data: afiliadoData, error: afiliadoError } = await supabase
      .from('clientes_afiliados')
      .select('id, user_id, wuzapi_token, wuzapi_jid, telefone')
      .eq('telefone', '21995379550')
      .single()

    if (afiliadoError || !afiliadoData?.wuzapi_token) {
      console.error('❌ [PROSPECÇÃO] Token não encontrado para 21995379550')
      return new Response(
        JSON.stringify({ success: false, error: 'Token não configurado para Pietro Eugenio' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const wuzapiToken = afiliadoData.wuzapi_token
    const userId = afiliadoData.user_id
    console.log('✅ [PROSPECÇÃO] Token encontrado para Pietro Eugenio')

    // Verificar quantos já foram enviados hoje
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    
    const { count: enviadosHoje } = await supabase
      .from('prospecao_optin_log')
      .select('*', { count: 'exact', head: true })
      .gte('enviado_em', hoje.toISOString())

    console.log(`📊 [PROSPECÇÃO] Enviados hoje: ${enviadosHoje || 0}`)

    // Limite diário de ~220 mensagens
    const LIMITE_DIARIO = 220
    if ((enviadosHoje || 0) >= LIMITE_DIARIO) {
      console.log('⚠️ [PROSPECÇÃO] Limite diário atingido')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Limite diário atingido',
          enviadosHoje: enviadosHoje || 0,
          limite: LIMITE_DIARIO
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar contatos opt-in que AINDA NÃO receberam convite
    const { data: contatosOptin, error: optinError } = await supabase
      .from('cadastros')
      .select('id, nome, whatsapp')
      .eq('opt_in', true)
      .not('whatsapp', 'is', null)
      .order('created_at', { ascending: true })
      .limit(MAX_ENVIOS_POR_EXECUCAO * 2) // Buscar mais para ter margem

    if (optinError) {
      console.error('❌ [PROSPECÇÃO] Erro ao buscar opt-in:', optinError)
      throw optinError
    }

    console.log(`📋 [PROSPECÇÃO] Total opt-in encontrados: ${contatosOptin?.length || 0}`)

    // Filtrar os que já receberam
    const { data: jaEnviados } = await supabase
      .from('prospecao_optin_log')
      .select('phone')

    const phonesJaEnviados = new Set((jaEnviados || []).map((j: any) => j.phone))
    
    const contatosParaEnviar = (contatosOptin || []).filter((c: any) => {
      const phoneClean = (c.whatsapp || '').replace(/\D/g, '')
      return phoneClean.length >= 10 && !phonesJaEnviados.has(phoneClean)
    }).slice(0, MAX_ENVIOS_POR_EXECUCAO)

    console.log(`🎯 [PROSPECÇÃO] Contatos para enviar agora: ${contatosParaEnviar.length}`)

    if (contatosParaEnviar.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Todos os contatos opt-in já foram prospectados!',
          totalOptIn: contatosOptin?.length || 0,
          jaEnviados: phonesJaEnviados.size
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Enviar mensagens
    const wuzapiUrl = Deno.env.get('WUZAPI_BASE_URL') || 'https://api2.amzofertas.com.br'
    let enviados = 0
    let erros = 0
    const resultados: any[] = []

    for (const contato of contatosParaEnviar) {
      const phoneClean = (contato.whatsapp || '').replace(/\D/g, '')
      
      // Formatar número brasileiro
      let phoneFormatado = phoneClean
      if (!phoneFormatado.startsWith('55')) {
        phoneFormatado = '55' + phoneFormatado
      }

      // Escolher mensagem aleatória
      const mensagem = MENSAGENS_PROSPECCAO[Math.floor(Math.random() * MENSAGENS_PROSPECCAO.length)]

      try {
        // Enviar via WuzAPI
        const response = await fetch(`${wuzapiUrl}/chat/send/text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Token': wuzapiToken
          },
          body: JSON.stringify({
            Phone: phoneFormatado,
            Body: mensagem
          })
        })

        const result = await response.json()
        console.log(`📤 [PROSPECÇÃO] Enviado para ${phoneFormatado}:`, result?.success ? 'OK' : 'ERRO')

        // Registrar no log
        await supabase.from('prospecao_optin_log').insert({
          phone: phoneClean,
          cadastro_id: contato.id,
          status: result?.success ? 'enviado' : 'erro',
          mensagem_enviada: mensagem.slice(0, 200),
          wuzapi_response: result,
          user_id: userId
        })

        if (result?.success) {
          enviados++
          resultados.push({ phone: phoneFormatado, status: 'enviado' })
        } else {
          erros++
          resultados.push({ phone: phoneFormatado, status: 'erro', error: result })
        }

      } catch (err: any) {
        console.error(`❌ [PROSPECÇÃO] Erro ao enviar para ${phoneFormatado}:`, err)
        erros++
        
        await supabase.from('prospecao_optin_log').insert({
          phone: phoneClean,
          cadastro_id: contato.id,
          status: 'erro',
          mensagem_enviada: mensagem.slice(0, 200),
          wuzapi_response: { error: err.message },
          user_id: userId
        })

        resultados.push({ phone: phoneFormatado, status: 'erro', error: err.message })
      }

      // Delay humanizado entre mensagens
      const delayTotal = DELAY_ENTRE_MENSAGENS_MS + Math.floor(Math.random() * DELAY_VARIACAO_MS)
      await new Promise(r => setTimeout(r, delayTotal))
    }

    console.log(`✅ [PROSPECÇÃO] Concluído: ${enviados} enviados, ${erros} erros`)

    return new Response(
      JSON.stringify({
        success: true,
        enviados,
        erros,
        totalProcessados: contatosParaEnviar.length,
        enviadosHojeTotal: (enviadosHoje || 0) + enviados,
        limiteRestante: LIMITE_DIARIO - (enviadosHoje || 0) - enviados,
        resultados
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ [PROSPECÇÃO] Erro geral:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
