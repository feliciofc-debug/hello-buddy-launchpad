import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function safeReadJson(res: Response): Promise<{ json: any | null; text: string }> {
  const text = await res.text();
  if (!text) return { json: null, text: '' };

  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
}

function normalizeBrazilianPhone(phone: string): string {
  let clean = phone.replace(/\D/g, '');

  // remove 55 se já vier com país
  if (clean.startsWith('55') && clean.length >= 12) {
    clean = clean.substring(2);
  }

  // DDD + 8 dígitos (10) => injeta 9
  if (clean.length === 10) {
    const ddd = clean.substring(0, 2);
    const numero = clean.substring(2);
    if (['9', '8', '7', '6'].includes(numero[0])) {
      clean = ddd + '9' + numero;
    }
  }

  if (!clean.startsWith('55')) clean = '55' + clean;
  return clean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const WUZAPI_URL = Deno.env.get('WUZAPI_URL')
  const WUZAPI_TOKEN = Deno.env.get('WUZAPI_TOKEN')

  try {
    const { phone } = await req.json()

    if (!WUZAPI_URL) {
      return new Response(JSON.stringify({
        valid: false,
        error: 'WUZAPI_URL não configurado'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Normalizar número
    const cleanPhone = normalizeBrazilianPhone(phone)
    
    if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 12) {
      return new Response(JSON.stringify({
        valid: false,
        reason: 'Número inválido - menos de 10 dígitos'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log(`🔍 Validando WhatsApp: ${cleanPhone}`)

    // Verificar se número existe no WhatsApp via Wuzapi
    const response = await fetch(`${WUZAPI_URL.replace(/\/+$/, '')}/chat/presence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Token': WUZAPI_TOKEN || ''
      },
      body: JSON.stringify({
        Phone: cleanPhone,
        // Algumas builds exigem explicitamente um estado
        State: 'available'
      })
    })

    const { json: result, text: raw } = await safeReadJson(response)
    console.log(`📱 Resultado Wuzapi (raw):`, raw)
    if (result) console.log(`📱 Resultado Wuzapi (json):`, result)

    // Wuzapi retorna informações de presença se o número existe
    // Se a API retornou JSON, usamos isso; se veio texto, tratamos como resposta desconhecida.
    const isValid = response.ok && !!result && !result.error

    return new Response(JSON.stringify({
      valid: isValid,
      phone: cleanPhone,
      formatted: isValid ? `${cleanPhone}@s.whatsapp.net` : null,
      http_status: response.status,
      raw_response: result,
      raw_text: result ? null : raw
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
