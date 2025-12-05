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
    
    console.log('🔌 Desconectando WhatsApp via Wuzapi...')
    
    // Wuzapi endpoint para logout/desconectar
    const logoutResponse = await fetch(`${WUZAPI_URL}/session/logout`, {
      method: 'POST',
      headers: {
        'Token': WUZAPI_TOKEN!,
        'Content-Type': 'application/json'
      }
    })
    
    const logoutResult = await logoutResponse.json()
    console.log('📱 Resposta logout:', JSON.stringify(logoutResult))
    
    // Se logout falhar, tentar disconnect
    if (!logoutResult.success && logoutResult.error !== 'not logged in') {
      console.log('🔄 Tentando disconnect...')
      const disconnectResponse = await fetch(`${WUZAPI_URL}/session/disconnect`, {
        method: 'POST',
        headers: {
          'Token': WUZAPI_TOKEN!,
          'Content-Type': 'application/json'
        }
      })
      
      const disconnectResult = await disconnectResponse.json()
      console.log('📱 Resposta disconnect:', JSON.stringify(disconnectResult))
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'WhatsApp desconectado! Agora você pode conectar um novo número.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error: any) {
    console.error('❌ Erro:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
