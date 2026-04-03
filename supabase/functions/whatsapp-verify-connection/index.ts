import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const body = await req.json()
    const { user_id, phone_number_id, waba_id, access_token, display_phone } = body

    if (!user_id || !phone_number_id || !access_token) {
      throw new Error('user_id, phone_number_id e access_token são obrigatórios')
    }

    // Verificar se o token é válido
    const verifyResponse = await fetch(
      `https://graph.facebook.com/v25.0/${phone_number_id}?access_token=${access_token}`
    )
    const verifyData = await verifyResponse.json()

    if (verifyData.error) {
      throw new Error(`Token inválido ou Phone Number ID incorreto: ${verifyData.error.message}`)
    }

    console.log('✅ Phone Number verificado:', verifyData.display_phone_number || verifyData.verified_name)

    // Buscar nome do negócio
    let businessName = ''
    if (waba_id) {
      const businessResponse = await fetch(
        `https://graph.facebook.com/v25.0/${waba_id}?fields=name&access_token=${access_token}`
      )
      const businessData = await businessResponse.json()
      businessName = businessData.name || ''
    }

    // Salvar/atualizar na tabela whatsapp_config
    const { error: upsertError } = await supabase
      .from('whatsapp_config')
      .upsert({
        user_id,
        phone_number_id,
        waba_id: waba_id || null,
        access_token,
        display_phone: display_phone || verifyData.display_phone_number || '',
        business_name: businessName || verifyData.verified_name || '',
        is_active: true,
        is_verified: true,
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (upsertError) {
      throw new Error(`Erro ao salvar configuração: ${upsertError.message}`)
    }

    console.log('✅ WhatsApp Config salvo para user:', user_id)

    return new Response(JSON.stringify({
      success: true,
      business_name: businessName || verifyData.verified_name || '',
      display_phone: display_phone || verifyData.display_phone_number || '',
      verified_name: verifyData.verified_name || '',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Erro:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
