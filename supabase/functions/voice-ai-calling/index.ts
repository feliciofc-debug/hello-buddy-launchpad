import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { lead_id, lead_type, campanha_id } = await req.json()
    
    console.log('🎯 Iniciando chamada de voz:', { lead_id, lead_type, campanha_id })

    // Buscar dados do lead
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const leadTable = lead_type === 'b2b' ? 'leads_b2b' : 'leads_b2c'
    const nomeField = lead_type === 'b2b' ? 'razao_social' : 'nome_completo'
    
    const leadResponse = await fetch(`${SUPABASE_URL}/rest/v1/${leadTable}?id=eq.${lead_id}`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      }
    })
    
    const leads = await leadResponse.json()
    const lead = leads[0]
    
    if (!lead) {
      throw new Error('Lead não encontrado')
    }

    console.log('📞 Telefone:', lead.telefone)

    // Configuração Twilio
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER')

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error('Credenciais Twilio não configuradas')
    }

    // Buscar script de voz da campanha
    const campanhaResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/campanhas_prospeccao?id=eq.${campanha_id}`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        }
      }
    )
    
    const campanhas = await campanhaResponse.json()
    const campanha = campanhas[0]

    // Script padrão caso não exista configurado
    const scriptIntro = `Olá, aqui é da ${campanha?.nome || 'nossa empresa'}. 
      Estamos entrando em contato porque identificamos que você pode ter interesse em nossas soluções.
      Você tem alguns minutos para conversar?`

    // Criar registro da chamada no Supabase
    const callRecord = {
      lead_id,
      lead_type,
      campanha_id,
      status: 'initiated',
      created_at: new Date().toISOString()
    }

    const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/voice_calls`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(callRecord)
    })

    const [insertedCall] = await insertResponse.json()
    console.log('✅ Registro de chamada criado:', insertedCall?.id)

    // Iniciar chamada via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`
    
    const callbackUrl = `${SUPABASE_URL}/functions/v1/voice-ai-callback?call_id=${insertedCall?.id}`
    
    const formData = new URLSearchParams({
      To: lead.telefone,
      From: TWILIO_PHONE_NUMBER,
      Url: 'http://demo.twilio.com/docs/voice.xml', // TwiML padrão para teste
      StatusCallback: callbackUrl,
      StatusCallbackEvent: 'initiated,ringing,answered,completed'
    })

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    })

    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text()
      throw new Error(`Erro Twilio: ${errorText}`)
    }

    const twilioCall = await twilioResponse.json()
    console.log('📞 Chamada Twilio iniciada:', twilioCall.sid)

    // Atualizar registro com call_sid
    await fetch(`${SUPABASE_URL}/rest/v1/voice_calls?id=eq.${insertedCall?.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        call_sid: twilioCall.sid,
        status: 'ringing',
        started_at: new Date().toISOString()
      })
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        call_id: insertedCall?.id,
        call_sid: twilioCall.sid,
        lead_nome: lead[nomeField],
        telefone: lead.telefone
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: any) {
    console.error('❌ Erro ao iniciar chamada:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
