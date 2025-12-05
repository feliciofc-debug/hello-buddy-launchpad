import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const WUZAPI_URL = Deno.env.get('WUZAPI_URL')
    const WUZAPI_TOKEN = Deno.env.get('WUZAPI_TOKEN')
    
    console.log('🔍 Verificando status WhatsApp via Wuzapi...')
    
    // Wuzapi endpoint para verificar status
    const response = await fetch(`${WUZAPI_URL}/session/status`, {
      method: 'GET',
      headers: {
        'Token': WUZAPI_TOKEN!
      }
    })
    
    const responseData = await response.json()
    console.log('📱 Status Wuzapi:', JSON.stringify(responseData))
    
    // Wuzapi retorna: { code: 200, data: { connected: true, loggedIn: true, jid: "...", name: "..." }, success: true }
    const data = responseData.data || responseData
    
    let status = 'disconnected'
    let phone = null
    let name = null
    
    // Verificar se está conectado (data.connected ou data.loggedIn)
    if (data.connected === true || data.loggedIn === true) {
      status = 'connected'
      
      // Extrair número do jid (formato: "5521995379550:6@s.whatsapp.net")
      if (data.jid) {
        const jidParts = data.jid.split(':')[0]
        if (jidParts && jidParts.length >= 12) {
          phone = `+${jidParts.substring(0, 2)} (${jidParts.substring(2, 4)}) ${jidParts.substring(4, 9)}-${jidParts.substring(9)}`
        } else {
          phone = jidParts
        }
      }
      
      name = data.name || null
    }
    
    return new Response(JSON.stringify({
      success: true,
      status,
      phone,
      name,
      raw: responseData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error: any) {
    console.error('❌ Erro:', error)
    return new Response(JSON.stringify({
      success: false,
      status: 'error',
      error: error.message
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
