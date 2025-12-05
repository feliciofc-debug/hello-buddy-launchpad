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
    
    const data = await response.json()
    console.log('📱 Status Wuzapi:', JSON.stringify(data))
    
    // Mapear status do Wuzapi
    let status = 'disconnected'
    let phone = null
    
    if (data.Connected === true || data.connected === true) {
      status = 'connected'
      phone = data.Phone || data.phone || data.Jid || data.jid || null
      
      // Formatar número se existir
      if (phone && phone.includes('@')) {
        phone = phone.split('@')[0]
        phone = `+${phone.substring(0, 2)} (${phone.substring(2, 4)}) ${phone.substring(4, 9)}-${phone.substring(9)}`
      }
    } else if (data.LoggedIn === false) {
      status = 'disconnected'
    }
    
    return new Response(JSON.stringify({
      success: true,
      status,
      phone,
      raw: data
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
