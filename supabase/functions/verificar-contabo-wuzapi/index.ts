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
    // ===== INFRAESTRUTURA SEPARADA =====
    // CONTABO (Afiliados): api2.amzofertas.com.br - usa token individual por afiliado
    // LOCAWEB (PJ): wuzapi_instances - usa WUZAPI_URL/TOKEN
    
    const CONTABO_URL = Deno.env.get('CONTABO_WUZAPI_URL') || ''
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
    
    // Token do afiliado conectado (21967520706)
    // Este token vem da tabela clientes_afiliados.wuzapi_token
    const AFILIADO_TOKEN = 'FDjUTGXYOt6Bp3TtYjSsjZlWOAPuxnPY'
    
    log(`📡 CONTABO_URL (Afiliados): ${CONTABO_URL}`)
    log(`🔑 Token do Afiliado (primeiros 10): ${AFILIADO_TOKEN.substring(0, 10)}...`)
    log(`📌 JID esperado: 5521967520706:77@s.whatsapp.net`)
    
    if (!CONTABO_URL) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'CONTABO_WUZAPI_URL não configurado',
          logs 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // ===== VERIFICAR STATUS COM TOKEN DO AFILIADO =====
    log('\n═══ STATUS DA SESSÃO CONTABO (AFILIADO) ═══')
    
    const baseUrl = CONTABO_URL.replace(/\/$/, '')
    
    log(`Tentando: ${baseUrl}/session/status`)
    const statusResponse = await fetch(`${baseUrl}/session/status`, {
      method: 'GET',
      headers: {
        'Token': AFILIADO_TOKEN,
        'Content-Type': 'application/json'
      }
    })
    
    const statusText = await statusResponse.text()
    log(`Status ${statusResponse.status}: ${statusText}`)
    
    let statusData: any = {}
    try {
      statusData = JSON.parse(statusText)
    } catch {
      log('Resposta não é JSON válido')
    }
    
    // ===== VERIFICAR WEBHOOK =====
    // IMPORTANTE: Webhook de afiliados deve apontar para wuzapi-webhook-afiliados
    const webhookEsperadoAfiliados = `${SUPABASE_URL}/functions/v1/wuzapi-webhook-afiliados`
    const webhookAtual = statusData.data?.webhook || statusData.webhook || 'NÃO IDENTIFICADO'
    
    log('\n═══ WEBHOOK AFILIADOS ═══')
    log(`Esperado: ${webhookEsperadoAfiliados}`)
    log(`Atual: ${webhookAtual}`)
    log(`JID: ${statusData.data?.jid || statusData.jid || 'NÃO IDENTIFICADO'}`)
    log(`Conectado: ${statusData.data?.connected || statusData.connected || 'NÃO IDENTIFICADO'}`)
    
    const webhookCorreto = webhookAtual === webhookEsperadoAfiliados
    
    return new Response(
      JSON.stringify({
        success: statusResponse.ok,
        infraestrutura: 'CONTABO (Afiliados)',
        contaboUrl: CONTABO_URL,
        webhookEsperado: webhookEsperadoAfiliados,
        webhookAtual,
        webhookCorreto,
        jid: statusData.data?.jid || statusData.jid,
        connected: statusData.data?.connected || statusData.connected,
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
