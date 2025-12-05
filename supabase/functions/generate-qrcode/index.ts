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
    
    console.log('🔐 Gerando QR Code via Wuzapi...')
    console.log('URL:', WUZAPI_URL)
    
    // Primeiro verificar se já está conectado
    const statusResponse = await fetch(`${WUZAPI_URL}/session/status`, {
      method: 'GET',
      headers: {
        'Token': WUZAPI_TOKEN!
      }
    })
    
    const statusResult = await statusResponse.json()
    console.log('📱 Status atual:', JSON.stringify(statusResult))
    
    // Wuzapi retorna { code: 200, data: { connected: true, ... }, success: true }
    const statusData = statusResult.data || statusResult
    
    // Se já está conectado
    if (statusData.connected === true || statusData.loggedIn === true) {
      // Extrair número do jid
      let phone = null
      if (statusData.jid) {
        const jidParts = statusData.jid.split(':')[0]
        if (jidParts && jidParts.length >= 12) {
          phone = `+${jidParts.substring(0, 2)} (${jidParts.substring(2, 4)}) ${jidParts.substring(4, 9)}-${jidParts.substring(9)}`
        } else {
          phone = jidParts
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        connected: true,
        message: 'WhatsApp já está conectado!',
        phone,
        name: statusData.name || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Se não está conectado, gerar QR Code
    const qrResponse = await fetch(`${WUZAPI_URL}/session/qr`, {
      method: 'GET',
      headers: {
        'Token': WUZAPI_TOKEN!
      }
    })
    
    const qrResult = await qrResponse.json()
    console.log('📱 Resposta QR:', JSON.stringify(qrResult))
    
    // Tratar "already logged in" como conectado
    if (qrResult.error === 'already logged in') {
      return new Response(JSON.stringify({
        success: true,
        connected: true,
        message: 'WhatsApp já está conectado!'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Verificar se tem QR Code na resposta
    const qrData = qrResult.data || qrResult
    const qrCode = qrData.QRCode || qrData.qrcode || qrData.code || qrData.Code || qrResult.QRCode || qrResult.qrcode
    
    if (qrCode) {
      return new Response(JSON.stringify({
        success: true,
        qrcode: String(qrCode),
        message: 'Escaneie o QR Code com seu WhatsApp'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: 'QR Code não disponível. Verifique se o Wuzapi está rodando.',
      debug: { statusResult, qrResult }
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
