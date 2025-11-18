import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FacebookTokenResponse {
  access_token: string
  token_type: string
  expires_in?: number
}

interface FacebookLongLivedTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface FacebookUserResponse {
  id: string
  name: string
  email?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const META_APP_ID = Deno.env.get('META_APP_ID')
    const META_APP_SECRET = Deno.env.get('META_APP_SECRET')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    // Get the origin from the request or use a default
    const origin = req.headers.get('origin') || req.headers.get('referer') || 'https://249fa690-d3a6-4362-93a4-ec3d247f30f3.lovableproject.com'
    const siteUrl = new URL(origin).origin
    const REDIRECT_URI = `${siteUrl}/auth/callback/meta`
    const SITE_URL = siteUrl
    
    console.log('🔍 Using redirect URI:', REDIRECT_URI)

    if (!META_APP_ID || !META_APP_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables')
    }

    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    if (error) {
      console.error('Facebook OAuth error:', error)
      const redirectUrl = `${SITE_URL}/configuracoes?error=true&message=${encodeURIComponent('Permissão negada pelo usuário.')}`
      return new Response(null, { status: 302, headers: { ...corsHeaders, 'Location': redirectUrl } })
    }

    if (!code) {
      throw new Error('No authorization code provided')
    }

    const tokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token')
    tokenUrl.searchParams.set('client_id', META_APP_ID)
    tokenUrl.searchParams.set('client_secret', META_APP_SECRET)
    tokenUrl.searchParams.set('redirect_uri', REDIRECT_URI)
    tokenUrl.searchParams.set('code', code)

    console.log('🔄 Trocando código por token de curta duração...')
    const tokenResponse = await fetch(tokenUrl.toString())
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('❌ Erro ao trocar código:', errorData)
      throw new Error(`Failed to exchange code for token: ${errorData}`)
    }
    const tokenData: FacebookTokenResponse = await tokenResponse.json()
    const shortLivedToken = tokenData.access_token
    console.log('✅ Token de curta duração obtido')

    const longLivedTokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token')
    longLivedTokenUrl.searchParams.set('grant_type', 'fb_exchange_token')
    longLivedTokenUrl.searchParams.set('client_id', META_APP_ID)
    longLivedTokenUrl.searchParams.set('client_secret', META_APP_SECRET)
    longLivedTokenUrl.searchParams.set('fb_exchange_token', shortLivedToken)

    console.log('🔄 Trocando por token de longa duração...')
    const longLivedResponse = await fetch(longLivedTokenUrl.toString())
    if (!longLivedResponse.ok) {
      const errorData = await longLivedResponse.text()
      console.error('❌ Erro ao obter token de longa duração:', errorData)
      throw new Error(`Failed to get long-lived token: ${errorData}`)
    }
    const longLivedData: FacebookLongLivedTokenResponse = await longLivedResponse.json()
    const longLivedToken = longLivedData.access_token
    const expiresIn = longLivedData.expires_in
    console.log('✅ Token de longa duração obtido (expira em', expiresIn, 'segundos)')

    const userInfoUrl = new URL('https://graph.facebook.com/v18.0/me')
    userInfoUrl.searchParams.set('fields', 'id,name,email')
    userInfoUrl.searchParams.set('access_token', longLivedToken)

    console.log('🔄 Obtendo informações do usuário...')
    const userInfoResponse = await fetch(userInfoUrl.toString())
    if (!userInfoResponse.ok) {
      const errorData = await userInfoResponse.text()
      console.error('❌ Erro ao obter informações do usuário:', errorData)
      throw new Error(`Failed to get user info: ${errorData}`)
    }
    const userData: FacebookUserResponse = await userInfoResponse.json()
    console.log('✅ Informações do usuário obtidas:', userData.id, userData.name)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn)

    console.log('🔄 Salvando integração no banco de dados...')
    const { error: insertError } = await supabase
      .from('integrations')
      .upsert({
        user_id: state,
        platform: 'meta',
        access_token: longLivedToken,
        meta_user_id: userData.id,
        meta_user_name: userData.name,
        meta_user_email: userData.email,
        token_expires_at: expiresAt.toISOString(),
        is_active: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,platform'
      })

    if (insertError) {
      console.error('❌ Erro ao salvar no banco:', insertError)
      throw new Error(`Failed to save to database: ${insertError.message}`)
    }
    console.log('✅ Integração salva com sucesso!')

    const redirectUrl = `${SITE_URL}/configuracoes?success=true&platform=meta`
    return new Response(null, { status: 302, headers: { ...corsHeaders, 'Location': redirectUrl } })

  } catch (error) {
    console.error('❌ Meta auth callback error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const redirectUrl = `https://www.amzofertas.com.br/configuracoes?error=true&message=${encodeURIComponent(errorMessage)}`
    return new Response(null, { status: 302, headers: { ...corsHeaders, 'Location': redirectUrl } })
  }
})
