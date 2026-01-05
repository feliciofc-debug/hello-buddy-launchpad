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
    // ===== CONFIGURAÇÕES CONTABO =====
    const CONTABO_URL = Deno.env.get('CONTABO_WUZAPI_URL') || ''
    const CONTABO_TOKEN = Deno.env.get('CONTABO_WUZAPI_ADMIN_TOKEN') || ''
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
    
    log(`📡 CONTABO_URL: ${CONTABO_URL}`)
    log(`🔑 Token existe: ${!!CONTABO_TOKEN}`)
    log(`🔑 Token (primeiros 10 chars): ${CONTABO_TOKEN?.substring(0, 10)}...`)
    
    if (!CONTABO_URL || !CONTABO_TOKEN) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'CONTABO_WUZAPI_URL ou CONTABO_WUZAPI_ADMIN_TOKEN não configurados',
          logs 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // ===== 1. VERIFICAR STATUS DA SESSÃO =====
    log('\n═══ 1. STATUS DA SESSÃO CONTABO ═══')
    
    // Tentar diferentes formatos de URL
    const baseUrl = CONTABO_URL.replace(/\/$/, '') // remover / final
    
    // Formato 1: /session/status com header Token
    log(`Tentando: ${baseUrl}/session/status`)
    const statusResponse = await fetch(`${baseUrl}/session/status`, {
      method: 'GET',
      headers: {
        'Token': CONTABO_TOKEN,
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
    
    // Se falhou, tentar outros endpoints
    if (!statusResponse.ok) {
      log('\n═══ 2. TENTANDO /api/sessions ═══')
      const sessionsResponse = await fetch(`${baseUrl}/api/sessions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${CONTABO_TOKEN}`,
          'Content-Type': 'application/json'
        }
      })
      
      const sessionsText = await sessionsResponse.text()
      log(`Status ${sessionsResponse.status}: ${sessionsText}`)
      
      // Tentar /api/users
      log('\n═══ 3. TENTANDO /api/users ═══')
      const usersResponse = await fetch(`${baseUrl}/api/users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${CONTABO_TOKEN}`,
          'Content-Type': 'application/json'
        }
      })
      
      const usersText = await usersResponse.text()
      log(`Status ${usersResponse.status}: ${usersText}`)
    }
    
    // ===== VERIFICAR WEBHOOK =====
    const webhookEsperado = `${SUPABASE_URL}/functions/v1/wuzapi-webhook`
    const webhookAtual = statusData.data?.webhook || statusData.webhook || 'NÃO IDENTIFICADO'
    
    log('\n═══ WEBHOOK ═══')
    log(`Esperado: ${webhookEsperado}`)
    log(`Atual: ${webhookAtual}`)
    log(`JID: ${statusData.data?.jid || statusData.jid || 'NÃO IDENTIFICADO'}`)
    log(`Conectado: ${statusData.data?.connected || statusData.connected || 'NÃO IDENTIFICADO'}`)
    
    return new Response(
      JSON.stringify({
        success: true,
        contaboUrl: CONTABO_URL,
        webhookEsperado,
        webhookAtual,
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
