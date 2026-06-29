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
    const { user_id, to, message, template_name, template_language, image_url } = body

    if (!user_id || !to) {
      throw new Error('user_id e to são obrigatórios')
    }

    // Buscar config do WhatsApp do cliente
    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('user_id', user_id)
      .eq('is_active', true)
      .single()

    if (configError || !config) {
      throw new Error('WhatsApp não configurado. Vá em WhatsApp → Configuração para conectar.')
    }

    const testAccessToken = Deno.env.get('WHATSAPP_TEST_ACCESS_TOKEN')
    const accessToken = config.phone_number_id === '1156251107576181' && testAccessToken
      ? testAccessToken
      : config.access_token

    if (!accessToken) {
      throw new Error('Token do WhatsApp não configurado')
    }

    const API_URL = `https://graph.facebook.com/v25.0/${config.phone_number_id}/messages`

    let messagePayload: any

    if (template_name) {
      messagePayload = {
        messaging_product: 'whatsapp',
        to: to.replace(/\D/g, ''),
        type: 'template',
        template: {
          name: template_name,
          language: { code: template_language || 'pt_BR' },
        }
      }
    } else if (image_url) {
      messagePayload = {
        messaging_product: 'whatsapp',
        to: to.replace(/\D/g, ''),
        type: 'image',
        image: {
          link: image_url,
          caption: message || '',
        }
      }
    } else {
      messagePayload = {
        messaging_product: 'whatsapp',
        to: to.replace(/\D/g, ''),
        type: 'text',
        text: { body: message },
      }
    }

    console.log('📱 Enviando WhatsApp para:', to)

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('❌ Erro WhatsApp API:', result)
      throw new Error(result.error?.message || 'Erro ao enviar mensagem')
    }

    console.log('✅ Mensagem enviada:', result.messages?.[0]?.id)

    return new Response(JSON.stringify({
      success: true,
      message_id: result.messages?.[0]?.id,
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
