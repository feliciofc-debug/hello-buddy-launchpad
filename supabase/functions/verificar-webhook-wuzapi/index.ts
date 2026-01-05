import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const logs: string[] = []
  const log = (msg: string) => {
    const time = new Date().toLocaleTimeString()
    logs.push(`[${time}] ${msg}`)
    console.log(msg)
  }

  try {
    const WUZAPI_URL = Deno.env.get('WUZAPI_URL') || ''
    const WUZAPI_TOKEN = Deno.env.get('WUZAPI_TOKEN') || ''
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
    
    log(`📡 WUZAPI_URL: ${WUZAPI_URL}`)
    log(`🔑 Token existe: ${!!WUZAPI_TOKEN}`)
    
    // ===== 1. VERIFICAR STATUS DA SESSÃO =====
    log('\n═══ 1. STATUS DA SESSÃO ═══')
    const statusResponse = await fetch(`${WUZAPI_URL}/session/status`, {
      method: 'GET',
      headers: {
        'Token': WUZAPI_TOKEN,
        'Content-Type': 'application/json'
      }
    })
    
    const statusData = await statusResponse.json()
    log(`Status: ${JSON.stringify(statusData, null, 2)}`)
    
    const webhookAtual = statusData.data?.webhook || statusData.webhook || 'NÃO CONFIGURADO'
    const events = statusData.data?.events || statusData.events || 'NÃO CONFIGURADO'
    
    log(`📌 Webhook atual: ${webhookAtual}`)
    log(`📌 Events: ${events}`)
    
    // ===== 2. VERIFICAR SE WEBHOOK ESTÁ CORRETO =====
    const webhookEsperado = `${SUPABASE_URL}/functions/v1/wuzapi-webhook`
    const webhookOk = webhookAtual === webhookEsperado
    
    log('\n═══ 2. VALIDAÇÃO DO WEBHOOK ═══')
    log(`Esperado: ${webhookEsperado}`)
    log(`Atual: ${webhookAtual}`)
    log(`Status: ${webhookOk ? '✅ CORRETO' : '❌ INCORRETO'}`)
    
    // ===== 3. SE WEBHOOK INCORRETO, CONFIGURAR =====
    let webhookConfigurado = false
    if (!webhookOk) {
      log('\n═══ 3. CONFIGURANDO WEBHOOK ═══')
      
      // Primeiro tentar com /webhook
      const configResponse = await fetch(`${WUZAPI_URL}/webhook`, {
        method: 'POST',
        headers: {
          'Token': WUZAPI_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          webhookURL: webhookEsperado,
          events: ['All']
        })
      })
      
      const configText = await configResponse.text()
      log(`Resposta config: ${configResponse.status} - ${configText}`)
      
      if (configResponse.ok) {
        webhookConfigurado = true
        log('✅ Webhook configurado com sucesso!')
      } else {
        // Tentar formato alternativo
        const config2Response = await fetch(`${WUZAPI_URL}/session/webhook`, {
          method: 'POST',
          headers: {
            'Token': WUZAPI_TOKEN,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: webhookEsperado,
            events: 'All'
          })
        })
        
        const config2Text = await config2Response.text()
        log(`Resposta config2: ${config2Response.status} - ${config2Text}`)
        
        if (config2Response.ok) {
          webhookConfigurado = true
          log('✅ Webhook configurado via /session/webhook!')
        }
      }
    }
    
    // ===== 4. VERIFICAR NOVAMENTE =====
    if (webhookConfigurado || !webhookOk) {
      log('\n═══ 4. VERIFICAÇÃO FINAL ═══')
      const status2Response = await fetch(`${WUZAPI_URL}/session/status`, {
        method: 'GET',
        headers: {
          'Token': WUZAPI_TOKEN,
          'Content-Type': 'application/json'
        }
      })
      
      const status2Data = await status2Response.json()
      const webhookFinal = status2Data.data?.webhook || status2Data.webhook || 'NÃO CONFIGURADO'
      log(`Webhook final: ${webhookFinal}`)
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        webhookEsperado,
        webhookAtual,
        webhookOk,
        webhookConfigurado,
        status: statusData,
        logs
      }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error: any) {
    log(`❌ Erro: ${error.message}`)
    return new Response(
      JSON.stringify({ success: false, error: error.message, logs }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
