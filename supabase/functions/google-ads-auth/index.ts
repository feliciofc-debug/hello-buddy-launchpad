import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI') || 
  `https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/google-ads-callback`

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log('🔐 Google Ads Auth - Iniciando...')

  try {
    const { userId } = await req.json()

    if (!userId) {
      throw new Error('userId é obrigatório')
    }

    if (!GOOGLE_CLIENT_ID) {
      throw new Error('GOOGLE_CLIENT_ID não configurado')
    }

    // Gerar URL de autorização OAuth
    const scope = encodeURIComponent('https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/userinfo.email')
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${GOOGLE_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${userId}`

    console.log('✅ URL de autorização gerada')

    return new Response(JSON.stringify({ 
      authUrl,
      success: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('❌ Erro:', errorMessage)
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
