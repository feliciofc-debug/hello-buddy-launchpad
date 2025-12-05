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
    
    const statusData = await statusResponse.json()
    console.log('📱 Status atual:', JSON.stringify(statusData))
    
    // Se já está conectado (Connected ou "already logged in")
    if (statusData.Connected === true || statusData.error === 'already logged in') {
      return new Response(JSON.stringify({
        success: true,
        connected: true,
        message: 'WhatsApp já está conectado!',
        phone: statusData.Phone || statusData.Jid || null
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
    
    const qrData = await qrResponse.json()
    console.log('📱 Resposta QR:', JSON.stringify(qrData))
    
    // Tratar "already logged in" como conectado
    if (qrData.error === 'already logged in') {
      return new Response(JSON.stringify({
        success: true,
        connected: true,
        message: 'WhatsApp já está conectado!'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Se tem QR Code
    const qrCode = qrData.QRCode || qrData.qrcode || qrData.code || qrData.Code
    if (qrCode) {
      return new Response(JSON.stringify({
        success: true,
        qrcode: String(qrCode), // Garantir que é string
        message: 'Escaneie o QR Code com seu WhatsApp'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: 'QR Code não disponível',
      debug: { statusData, qrData }
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
