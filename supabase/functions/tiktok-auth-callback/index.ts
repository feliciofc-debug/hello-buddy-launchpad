import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TikTokTokenResponse {
  access_token?: string
  expires_in?: number
  open_id?: string
  refresh_expires_in?: number
  refresh_token?: string
  scope?: string
  token_type?: string
  data?: {
    access_token: string
    expires_in: number
    open_id: string
    refresh_expires_in: number
    refresh_token: string
    scope: string
    token_type: string
  }
  error?: {
    code: string
    message: string
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ===== Switch de ambiente: sandbox | producao =====
    // TIKTOK_ENV (secret) define qual par de credenciais usar.
    // Fallback: TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET (produção legado).
    const TIKTOK_ENV = (Deno.env.get('TIKTOK_ENV') || 'sandbox').toLowerCase()
    const isSandbox = TIKTOK_ENV !== 'producao' && TIKTOK_ENV !== 'production'

    const TIKTOK_CLIENT_KEY = isSandbox
      ? (Deno.env.get('TIKTOK_CLIENT_KEY_SANDBOX') || 'sbawx08s3trep7gfvg')
      : (Deno.env.get('TIKTOK_CLIENT_KEY') || 'aw2ouo90dyp4ju9w')

    const TIKTOK_CLIENT_SECRET = isSandbox
      ? Deno.env.get('TIKTOK_CLIENT_SECRET_SANDBOX')
      : Deno.env.get('TIKTOK_CLIENT_SECRET')

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

    console.log(`🌍 TikTok env: ${isSandbox ? 'sandbox' : 'producao'} | client_key: ${TIKTOK_CLIENT_KEY}`)

    if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
      console.error(`❌ Missing TikTok credentials for env=${isSandbox ? 'sandbox' : 'producao'}`)
      throw new Error(`Credenciais do TikTok ausentes para o ambiente ${isSandbox ? 'sandbox' : 'producao'}`)
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      throw new Error('Credenciais do backend ausentes')
    }

    const { code, state } = await req.json()
    const authorization = req.headers.get('Authorization')
    if (!authorization) {
      throw new Error('Sessão não autenticada')
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: authData, error: authError } = await authClient.auth.getUser()
    if (authError || !authData.user) {
      throw new Error('Sessão inválida ou expirada')
    }
    if (!state || state !== authData.user.id) {
      throw new Error('Estado OAuth inválido para esta sessão')
    }

    if (!code) {
      throw new Error('No authorization code provided')
    }

    console.log('🔄 Exchanging code for access token...')
    console.log('📍 Code recebido para a sessão autenticada')

    // Usar sempre o redirect_uri fixo (mesmo usado na autorização)
    const redirectUri = 'https://amzofertas.com.br/tiktok/callback'

    console.log('🔄 Redirect URI:', redirectUri)

    // Exchange code for access token
    const tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/'
    
    const tokenBody = new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY,
      client_secret: TIKTOK_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    })

    console.log('🔄 Requesting token from TikTok...')
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: tokenBody.toString(),
    })

    const tokenData: TikTokTokenResponse = await tokenResponse.json()
    console.log('📦 Token response:', JSON.stringify(tokenData, null, 2))

    if (tokenData.error) {
      console.error('❌ TikTok token error:', tokenData.error)
      throw new Error(tokenData.error.message || 'Failed to get TikTok token')
    }

    // TikTok API v2 pode retornar tokens no nível raiz OU dentro de data
    const tokenInfo = tokenData.data || tokenData
    
    if (!tokenInfo.access_token) {
      console.error('❌ No access_token found in response')
      throw new Error('No access token in response')
    }

    const { access_token, refresh_token, expires_in, open_id, scope } = tokenInfo

    console.log('✅ Got TikTok access token!')
    console.log('📍 Open ID:', open_id)
    console.log('📍 Scope:', scope)
    console.log('📍 Expires in:', expires_in, 'seconds')

    // Save to database
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in)

    console.log('📅 Token expira em:', expiresAt.toISOString())

    // Upsert integration record usando o usuário autenticado, nunca um state confiado sozinho
    const { error: upsertError } = await supabase
      .from('integrations')
      .upsert({
        user_id: authData.user.id,
        platform: 'tiktok',
        access_token: access_token,
        refresh_token: refresh_token,
        token_expires_at: expiresAt.toISOString(),
        meta_user_id: open_id, // TikTok open_id
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,platform'
      })

    if (upsertError) {
      console.error('❌ Database error:', upsertError)
      throw new Error(`Failed to save integration: ${upsertError.message}`)
    }

    console.log('✅ TikTok integration saved successfully!')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'TikTok connected successfully',
        open_id: open_id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('❌ TikTok auth callback error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
