import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TikTokTokenResponse {
  data: {
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
    const TIKTOK_CLIENT_KEY = Deno.env.get('TIKTOK_CLIENT_KEY')
    const TIKTOK_CLIENT_SECRET = Deno.env.get('TIKTOK_CLIENT_SECRET')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
      console.error('❌ Missing TikTok credentials')
      throw new Error('Missing TikTok API credentials')
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase credentials')
    }

    const { code, state } = await req.json()

    if (!code) {
      throw new Error('No authorization code provided')
    }

    console.log('🔄 Exchanging code for access token...')
    console.log('📍 Code:', code.substring(0, 20) + '...')
    console.log('📍 State (user_id):', state)

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

    if (!tokenData.data?.access_token) {
      throw new Error('No access token in response')
    }

    const { access_token, refresh_token, expires_in, open_id, scope } = tokenData.data

    console.log('✅ Got TikTok access token!')
    console.log('📍 Open ID:', open_id)
    console.log('📍 Scope:', scope)
    console.log('📍 Expires in:', expires_in, 'seconds')

    // Save to database
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in)

    console.log('📅 Token expira em:', expiresAt.toISOString())

    // Upsert integration record - usando user_id do state
    const { error: upsertError } = await supabase
      .from('integrations')
      .upsert({
        user_id: state, // state contém o user_id
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
