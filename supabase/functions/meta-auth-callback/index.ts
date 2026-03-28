import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    const REDIRECT_URI = 'https://www.amzofertas.com.br/auth/callback/meta'
    const SITE_URL = 'https://www.amzofertas.com.br'

    if (!META_APP_ID || !META_APP_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables')
    }

    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    if (error) {
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, 'Location': `${SITE_URL}/configuracoes?error=true&message=${encodeURIComponent('Permissão negada pelo usuário.')}` }
      })
    }

    if (!code) throw new Error('No authorization code provided')

    // 1. Trocar código por token curto
    const tokenUrl = new URL('https://graph.facebook.com/v25.0/oauth/access_token')
    tokenUrl.searchParams.set('client_id', META_APP_ID)
    tokenUrl.searchParams.set('client_secret', META_APP_SECRET)
    tokenUrl.searchParams.set('redirect_uri', REDIRECT_URI)
    tokenUrl.searchParams.set('code', code)

    console.log('🔄 Trocando código por token...')
    const tokenResponse = await fetch(tokenUrl.toString())
    if (!tokenResponse.ok) throw new Error(`Token exchange failed: ${await tokenResponse.text()}`)
    const tokenData = await tokenResponse.json()
    const shortLivedToken = tokenData.access_token
    console.log('✅ Token curto obtido')

    // 2. Trocar por token longo (User)
    const longLivedUrl = new URL('https://graph.facebook.com/v25.0/oauth/access_token')
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token')
    longLivedUrl.searchParams.set('client_id', META_APP_ID)
    longLivedUrl.searchParams.set('client_secret', META_APP_SECRET)
    longLivedUrl.searchParams.set('fb_exchange_token', shortLivedToken)

    const longLivedResponse = await fetch(longLivedUrl.toString())
    if (!longLivedResponse.ok) throw new Error(`Long-lived token failed: ${await longLivedResponse.text()}`)
    const longLivedData = await longLivedResponse.json()
    const longLivedUserToken = longLivedData.access_token
    console.log('✅ Token longo do usuário obtido')

    // 3. Dados do usuário
    const userResponse = await fetch(`https://graph.facebook.com/v25.0/me?fields=id,name,email&access_token=${longLivedUserToken}`)
    const userData = await userResponse.json()
    console.log('✅ Usuário:', userData.name)

    // 3.5 Verificar permissões do token
    const permissionsResponse = await fetch(`https://graph.facebook.com/v25.0/me/permissions?access_token=${longLivedUserToken}`)
    const permissionsData = await permissionsResponse.json()
    console.log('🔑 Permissões do token:', JSON.stringify(permissionsData))

    // 4. Buscar Pages + Page Tokens
    const pagesUrl = `https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token,category,tasks&access_token=${longLivedUserToken}`
    console.log('📡 Buscando páginas...')
    const pagesResponse = await fetch(pagesUrl)
    const pagesData = await pagesResponse.json()
    console.log('📡 Resposta /me/accounts completa:', JSON.stringify(pagesData))
    const pages = pagesData.data || []
    console.log('✅ Páginas encontradas:', pages.length)

    // 5. Salvar tudo no banco
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + (longLivedData.expires_in || 5184000))

    // Salvar user token
    const { error: upsertError } = await supabase.from('integrations').upsert({
      user_id: state,
      platform: 'meta',
      access_token: longLivedUserToken,
      meta_user_id: userData.id,
      meta_user_name: userData.name,
      meta_user_email: userData.email || null,
      token_expires_at: expiresAt.toISOString(),
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,platform' })

    if (upsertError) console.error('❌ Erro salvando user token:', upsertError)

    // Salvar cada Page Token
    for (const page of pages) {
      const { error: pageError } = await supabase.from('integrations').upsert({
        user_id: state,
        platform: `meta_page_${page.id}`,
        access_token: page.access_token,
        meta_user_id: page.id,
        meta_user_name: page.name,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,platform' })

      if (pageError) console.error('❌ Erro salvando page token:', page.name, pageError)
      else console.log('✅ Page token salvo:', page.name)
    }

    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, 'Location': `${SITE_URL}/configuracoes?success=true&platform=meta&pages=${pages.length}` }
    })

  } catch (error) {
    console.error('❌ Meta auth callback error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, 'Location': `https://www.amzofertas.com.br/configuracoes?error=true&message=${encodeURIComponent(errorMessage)}` }
    })
  }
})
