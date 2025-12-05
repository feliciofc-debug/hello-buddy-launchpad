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
    console.log('URL:', WUZAPI_URL)
    
    // 1. Primeiro tentar logout
    console.log('📱 Tentando logout...')
    const logoutResponse = await fetch(`${WUZAPI_URL}/session/logout`, {
      method: 'POST',
      headers: {
        'Token': WUZAPI_TOKEN!,
        'Content-Type': 'application/json'
      }
    })
    
    // Pegar texto bruto primeiro (pode não ser JSON)
    const logoutText = await logoutResponse.text()
    console.log('📱 Resposta logout (texto):', logoutText)
    
    // 2. Depois tentar disconnect para garantir
    console.log('📱 Tentando disconnect...')
    const disconnectResponse = await fetch(`${WUZAPI_URL}/session/disconnect`, {
      method: 'POST',
      headers: {
        'Token': WUZAPI_TOKEN!,
        'Content-Type': 'application/json'
      }
    })
    
    const disconnectText = await disconnectResponse.text()
    console.log('📱 Resposta disconnect (texto):', disconnectText)
    
    // Verificar se realmente desconectou
    console.log('🔍 Verificando status após desconexão...')
    const statusResponse = await fetch(`${WUZAPI_URL}/session/status`, {
      method: 'GET',
      headers: {
        'Token': WUZAPI_TOKEN!
      }
    })
    
    const statusText = await statusResponse.text()
    console.log('📱 Status após desconexão:', statusText)
    
    let connected = false
    try {
      const statusJson = JSON.parse(statusText)
      connected = statusJson?.data?.connected === true || statusJson?.data?.loggedIn === true
    } catch (e) {
      // Se não é JSON, assume desconectado
      connected = false
    }
    
    if (connected) {
      console.log('⚠️ Ainda conectado, status inesperado')
      return new Response(JSON.stringify({
        success: false,
        error: 'WhatsApp ainda está conectado. Tente novamente ou desconecte manualmente no celular.',
        debug: { logoutText, disconnectText, statusText }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    console.log('✅ Desconectado com sucesso!')
    return new Response(JSON.stringify({
      success: true,
      message: 'WhatsApp desconectado! Clique em "Conectar WhatsApp" para gerar novo QR Code.'
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
