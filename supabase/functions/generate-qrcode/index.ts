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
    
    // Wuzapi endpoint para gerar QR Code
    const response = await fetch(`${WUZAPI_URL}/session/qr`, {
      method: 'GET',
      headers: {
        'Token': WUZAPI_TOKEN!
      }
    })
    
    const data = await response.json()
    console.log('📱 Resposta Wuzapi:', JSON.stringify(data))
    
    // Verificar se já está conectado
    if (data.Connected === true) {
      return new Response(JSON.stringify({
        success: true,
        connected: true,
        message: 'WhatsApp já está conectado!'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Se tem QR Code
    if (data.QRCode || data.qrcode || data.code) {
      const qrCode = data.QRCode || data.qrcode || data.code
      return new Response(JSON.stringify({
        success: true,
        qrcode: qrCode,
        message: 'Escaneie o QR Code com seu WhatsApp'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Tentar endpoint alternativo
    const connectResponse = await fetch(`${WUZAPI_URL}/session/connect`, {
      method: 'POST',
      headers: {
        'Token': WUZAPI_TOKEN!,
        'Content-Type': 'application/json'
      }
    })
    
    const connectData = await connectResponse.json()
    console.log('📱 Resposta connect:', JSON.stringify(connectData))
    
    if (connectData.QRCode || connectData.qrcode) {
      return new Response(JSON.stringify({
        success: true,
        qrcode: connectData.QRCode || connectData.qrcode,
        message: 'Escaneie o QR Code com seu WhatsApp'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: 'QR Code não disponível. Verifique se o Wuzapi está rodando.',
      debug: { qrResponse: data, connectResponse: connectData }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error: any) {
    console.error('❌ Erro:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200, // Sempre 200 para evitar requeue
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
