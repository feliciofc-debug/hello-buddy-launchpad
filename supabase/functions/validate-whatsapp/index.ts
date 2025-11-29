import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const WUZAPI_URL = Deno.env.get('WUZAPI_URL')
  const WUZAPI_TOKEN = Deno.env.get('WUZAPI_TOKEN')

  try {
    const { phone } = await req.json()

    // Limpar número
    let cleanPhone = phone.replace(/\D/g, '')
    
    if (!cleanPhone || cleanPhone.length < 10) {
      return new Response(JSON.stringify({
        valid: false,
        reason: 'Número inválido - menos de 10 dígitos'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Normalizar para formato brasileiro com 55
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = '55' + cleanPhone
    }

    console.log(`🔍 Validando WhatsApp: ${cleanPhone}`)

    // Verificar se número existe no WhatsApp via Wuzapi
    const response = await fetch(`${WUZAPI_URL}/chat/presence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Token': WUZAPI_TOKEN || ''
      },
      body: JSON.stringify({
        Phone: cleanPhone
      })
    })

    const result = await response.json()
    console.log(`📱 Resultado Wuzapi:`, result)

    // Wuzapi retorna informações de presença se o número existe
    const isValid = response.ok && !result.error

    return new Response(JSON.stringify({
      valid: isValid,
      phone: cleanPhone,
      formatted: isValid ? `${cleanPhone}@s.whatsapp.net` : null,
      raw_response: result
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error) {
    console.error('❌ Erro ao validar WhatsApp:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(JSON.stringify({
      valid: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
