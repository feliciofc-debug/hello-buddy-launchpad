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
    if (!state) throw new Error('No user state provided')

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

    // 4. Buscar Pages + Page Tokens (FRESH - sem fallback para dados antigos)
    const pagesUrl = `https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token,category,tasks&access_token=${longLivedUserToken}&limit=100`
    console.log('📡 Buscando páginas via /me/accounts...')
    const pagesResponse = await fetch(pagesUrl)
    const pagesData = await pagesResponse.json()
    console.log('📡 Resposta /me/accounts completa:', JSON.stringify(pagesData))
    let pages: any[] = pagesData.data || []
    console.log('✅ Páginas encontradas via /me/accounts:', pages.length)

    // 4.1 FALLBACK: Se /me/accounts retornou vazio, buscar via Business Manager
    // (cobre casos onde o usuário gerencia páginas SOMENTE pelo Business Manager,
    // sem vínculo direto com o perfil pessoal)
    if (pages.length === 0) {
      console.log('🔄 Tentando fallback via Business Manager...')
      try {
        const bizResponse = await fetch(
          `https://graph.facebook.com/v25.0/me/businesses?fields=id,name&access_token=${longLivedUserToken}&limit=50`
        )
        const bizData = await bizResponse.json()
        console.log('📡 Businesses encontradas:', JSON.stringify(bizData))
        const businesses = bizData.data || []

        const collectedPages = new Map<string, any>()

        for (const biz of businesses) {
          // owned_pages
          try {
            const ownedRes = await fetch(
              `https://graph.facebook.com/v25.0/${biz.id}/owned_pages?fields=id,name,access_token,category,tasks&access_token=${longLivedUserToken}&limit=100`
            )
            const ownedData = await ownedRes.json()
            console.log(`📡 owned_pages do business ${biz.name}:`, JSON.stringify(ownedData))
            for (const p of (ownedData.data || [])) {
              if (p.access_token) collectedPages.set(p.id, p)
            }
          } catch (e) {
            console.error('⚠️ Erro owned_pages:', e)
          }

          // client_pages
          try {
            const clientRes = await fetch(
              `https://graph.facebook.com/v25.0/${biz.id}/client_pages?fields=id,name,access_token,category,tasks&access_token=${longLivedUserToken}&limit=100`
            )
            const clientData = await clientRes.json()
            console.log(`📡 client_pages do business ${biz.name}:`, JSON.stringify(clientData))
            for (const p of (clientData.data || [])) {
              if (p.access_token) collectedPages.set(p.id, p)
            }
          } catch (e) {
            console.error('⚠️ Erro client_pages:', e)
          }
        }

        // Para páginas sem access_token, tentar gerar via /{page-id}?fields=access_token
        for (const [pageId, page] of collectedPages.entries()) {
          if (!page.access_token) {
            try {
              const ptRes = await fetch(
                `https://graph.facebook.com/v25.0/${pageId}?fields=access_token,name,category&access_token=${longLivedUserToken}`
              )
              const ptData = await ptRes.json()
              if (ptData.access_token) {
                collectedPages.set(pageId, { ...page, ...ptData })
              }
            } catch (e) {
              console.error('⚠️ Erro buscando page token individual:', e)
            }
          }
        }

        pages = Array.from(collectedPages.values()).filter(p => p.access_token)
        console.log('✅ Páginas encontradas via Business Manager:', pages.length)
      } catch (bizErr) {
        console.error('⚠️ Erro no fallback Business Manager:', bizErr)
      }
    }

    // 5. Salvar tudo no banco - LIMPAR DADOS ANTIGOS PRIMEIRO
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // CRITICAL: Delete ALL old records for this user before saving new ones
    console.log('🧹 Limpando dados antigos do usuário:', state)
    
    const { error: delMetaConn } = await supabase.from('meta_connections')
      .delete().eq('user_id', state)
    if (delMetaConn) console.error('⚠️ Erro limpando meta_connections:', delMetaConn)
    
    const { error: delIntegrations } = await supabase.from('integrations')
      .delete().eq('user_id', state).like('platform', 'meta%')
    if (delIntegrations) console.error('⚠️ Erro limpando integrations:', delIntegrations)
    
    console.log('✅ Dados antigos limpos')

    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + (longLivedData.expires_in || 5184000))

    // Salvar user token na tabela integrations (legado - manter compatibilidade)
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

    // Salvar cada Page Token na tabela integrations (legado)
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

    // ===== Salvar dados estruturados na meta_connections =====
    if (pages.length > 0) {
      const mainPage = pages[0]
      
      // Buscar Instagram Business Account vinculado à página
      let igAccountId: string | null = null
      let igUsername: string | null = null
      
      try {
        const igResponse = await fetch(
          `https://graph.facebook.com/v25.0/${mainPage.id}?fields=instagram_business_account&access_token=${mainPage.access_token}`
        )
        const igData = await igResponse.json()
        
        if (igData.instagram_business_account?.id) {
          igAccountId = igData.instagram_business_account.id
          
          const igInfoResponse = await fetch(
            `https://graph.facebook.com/v25.0/${igAccountId}?fields=username&access_token=${mainPage.access_token}`
          )
          const igInfo = await igInfoResponse.json()
          igUsername = igInfo.username || null
          console.log('✅ Instagram Business Account:', igAccountId, igUsername)
        } else {
          console.log('⚠️ Instagram Business Account não encontrado para página', mainPage.name)
        }
      } catch (igError) {
        console.error('⚠️ Erro ao buscar Instagram Business Account:', igError)
      }
      
      const grantedPermissions = permissionsData?.data
        ?.filter((p: any) => p.status === 'granted')
        ?.map((p: any) => p.permission) || []
      
      const { error: metaConnError } = await supabase.from('meta_connections').insert({
        user_id: state,
        meta_user_id: userData.id,
        meta_user_name: userData.name,
        meta_user_email: userData.email || null,
        user_access_token: longLivedUserToken,
        page_id: mainPage.id,
        page_name: mainPage.name,
        page_access_token: mainPage.access_token,
        ig_account_id: igAccountId,
        ig_username: igUsername,
        permissions: grantedPermissions,
        is_active: true,
        token_expires_at: null, // Page token permanente
        last_verified_at: new Date().toISOString(),
        connection_error: null,
        updated_at: new Date().toISOString(),
      })
      
      if (metaConnError) {
        console.error('❌ Erro salvando meta_connections:', metaConnError)
      } else {
        console.log('✅ meta_connections salvo para', userData.name, '| Page:', mainPage.name, '| IG:', igUsername)
      }
    } else {
      console.log('❌ NENHUMA PÁGINA ENCONTRADA via /me/accounts')
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
