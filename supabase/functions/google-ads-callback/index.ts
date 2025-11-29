import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI') || 
  `https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/google-ads-callback`
const APP_URL = Deno.env.get('APP_URL') || 'https://jibpvpqgplmahjhswiza.lovable.app'

serve(async (req) => {
  console.log('🔄 Google Ads Callback - Recebido')

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const userId = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) {
    console.error('❌ Erro OAuth:', error)
    return Response.redirect(`${APP_URL}/google-ads?error=${error}`)
  }

  if (!code || !userId) {
    console.error('❌ Code ou state ausentes')
    return Response.redirect(`${APP_URL}/google-ads?error=missing_params`)
  }

  try {
    console.log('📝 Trocando code por tokens...')

    // Trocar code por tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    })

    const tokens = await tokenResponse.json()

    if (!tokens.access_token) {
      console.error('❌ Falha ao obter access_token:', tokens)
      throw new Error('Failed to get access token')
    }

    console.log('✅ Tokens obtidos')

    // Buscar email do usuário
    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      }
    )
    const userInfo = await userInfoResponse.json()
    console.log('📧 Email:', userInfo.email)

    // Usar Customer ID fixo configurado
    const customerId = '6553038395'
    console.log('🏢 Customer ID configurado:', customerId)

    // Salvar no Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokens.expires_in || 3600))

    const { error: dbError } = await supabase.from('google_ads_config').upsert({
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expiresAt.toISOString(),
      customer_id: customerId,
      account_email: userInfo.email,
      connected_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    })

    if (dbError) {
      console.error('❌ Erro ao salvar no banco:', dbError)
      throw dbError
    }

    console.log('✅ Configuração salva com sucesso!')

    // Redirecionar para o app
    return Response.redirect(`${APP_URL}/google-ads?success=true`)

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('❌ Erro no callback:', errorMessage)
    return Response.redirect(`${APP_URL}/google-ads?error=${encodeURIComponent(errorMessage)}`)
  }
})
