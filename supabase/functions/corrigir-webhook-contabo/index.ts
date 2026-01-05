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
    logs.push(msg)
    console.log(msg)
  }

  try {
    const CONTABO_URL = Deno.env.get('CONTABO_WUZAPI_URL') || ''
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
    const AFILIADO_TOKEN = 'FDjUTGXYOt6Bp3TtYjSsjZlWOAPuxnPY'
    
    const baseUrl = CONTABO_URL.replace(/\/$/, '')
    const webhookCorreto = `${SUPABASE_URL}/functions/v1/wuzapi-webhook-afiliados`
    
    log(`📡 Contabo URL: ${baseUrl}`)
    log(`🎯 Configurando webhook para: ${webhookCorreto}`)
    
    // Tentar múltiplos endpoints para configurar webhook
    const endpoints = [
      { url: `${baseUrl}/admin/setwebhook`, method: 'POST' },
      { url: `${baseUrl}/webhook`, method: 'POST' },
      { url: `${baseUrl}/api/webhook`, method: 'POST' },
      { url: `${baseUrl}/session/setwebhook`, method: 'POST' },
    ]
    
    let success = false
    let responseData: any = {}
    
    for (const endpoint of endpoints) {
      log(`\n🔄 Tentando: ${endpoint.url}`)
      
      try {
        const response = await fetch(endpoint.url, {
          method: endpoint.method,
          headers: {
            'Token': AFILIADO_TOKEN,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            webhookURL: webhookCorreto,
            webhook: webhookCorreto,
            events: ['All']
          })
        })
        
        const responseText = await response.text()
        log(`📬 Status ${response.status}: ${responseText.substring(0, 200)}`)
        
        if (response.ok) {
          try {
            responseData = JSON.parse(responseText)
            success = true
            log(`✅ Sucesso com endpoint: ${endpoint.url}`)
            break
          } catch {
            // Continue tentando
          }
        }
      } catch (err: any) {
        log(`❌ Erro: ${err.message}`)
      }
    }
    
    // Verificar status atual
    log('\n═══ STATUS ATUAL ═══')
    const statusResponse = await fetch(`${baseUrl}/session/status`, {
      method: 'GET',
      headers: {
        'Token': AFILIADO_TOKEN,
        'Content-Type': 'application/json'
      }
    })
    
    const statusData = JSON.parse(await statusResponse.text())
    const webhookAtual = statusData.data?.webhook || ''
    
    log(`📌 Webhook atual: ${webhookAtual}`)
    log(`📌 JID: ${statusData.data?.jid}`)
    log(`📌 Connected: ${statusData.data?.connected}`)
    
    return new Response(
      JSON.stringify({
        success,
        webhookConfigurado: webhookCorreto,
        webhookAtual,
        statusData: statusData.data,
        response: responseData,
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
