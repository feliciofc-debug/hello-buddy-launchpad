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
    
    // LOGOUT = Desconecta E finaliza a sessão (requer novo QR code)
    console.log('📱 Chamando /session/logout...')
    
    const logoutResponse = await fetch(`${WUZAPI_URL}/session/logout`, {
      method: 'POST',
      headers: {
        'Token': WUZAPI_TOKEN!
      }
    })
    
    console.log('📱 Status HTTP logout:', logoutResponse.status)
    
    // Pegar texto bruto (pode não ser JSON válido)
    const logoutText = await logoutResponse.text()
    console.log('📱 Resposta logout:', logoutText)
    
    // Tentar parsear JSON se possível
    let logoutSuccess = false
    try {
      const logoutJson = JSON.parse(logoutText)
      logoutSuccess = logoutJson?.success === true || logoutJson?.code === 200
      console.log('📱 Logout JSON:', logoutJson)
    } catch (e) {
      // Resposta não é JSON - verificar se contém "logged out" ou similar
      logoutSuccess = logoutText.toLowerCase().includes('logged') || 
                      logoutText.toLowerCase().includes('success') ||
                      logoutResponse.status === 200
      console.log('📱 Logout não-JSON, assumindo sucesso pelo status HTTP')
    }
    
    // Aguardar um pouco para o Wuzapi processar
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Verificar status para confirmar desconexão
    console.log('🔍 Verificando status após logout...')
    const statusResponse = await fetch(`${WUZAPI_URL}/session/status`, {
      method: 'GET',
      headers: {
        'Token': WUZAPI_TOKEN!
      }
    })
    
    const statusText = await statusResponse.text()
    console.log('📱 Status após logout:', statusText)
    
    let isConnected = false
    let isLoggedIn = false
    try {
      const statusJson = JSON.parse(statusText)
      isConnected = statusJson?.data?.connected === true || statusJson?.data?.Connected === true
      isLoggedIn = statusJson?.data?.loggedIn === true || statusJson?.data?.LoggedIn === true
      console.log('📱 Connected:', isConnected, 'LoggedIn:', isLoggedIn)
    } catch (e) {
      console.log('📱 Status não é JSON')
    }
    
    // Se ainda está logado, informar usuário para desconectar manualmente
    if (isLoggedIn) {
      return new Response(JSON.stringify({
        success: false,
        stillConnected: true,
        error: 'Sessão ainda ativa. Por favor, vá no seu celular → WhatsApp → Aparelhos conectados → e remova este dispositivo manualmente.',
        debug: { logoutText, statusText }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Sessão encerrada! Clique em "Conectar WhatsApp" para gerar novo QR Code.'
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
