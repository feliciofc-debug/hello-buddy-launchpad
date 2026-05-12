import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  try {
    const { image_url, user_id, link_sticker } = await req.json()
    if (!image_url) throw new Error('image_url é obrigatório')
    if (!user_id) throw new Error('user_id é obrigatório')

    const { data: conn } = await supabase
      .from('meta_connections')
      .select('ig_account_id, page_access_token')
      .eq('user_id', user_id)
      .eq('is_active', true)
      .single()

    if (!conn?.page_access_token || !conn?.ig_account_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Instagram não conectado. Vá em Configurações → Redes Sociais.'
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const token = conn.page_access_token
    const igId = conn.ig_account_id

    // 1) Verifica account_type (Business/Creator)
    const acctRes = await fetch(`https://graph.facebook.com/v25.0/${igId}?fields=account_type,followers_count,is_published&access_token=${token}`)
    const acct = await acctRes.json()
    if (acct.error) {
      return new Response(JSON.stringify({
        success: false,
        error: `Falha ao validar conta IG: ${acct.error.message}`
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const accountType: string = acct.account_type || ''
    if (accountType === 'PERSONAL') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Sua conta Instagram precisa ser Business ou Creator para postar Stories.'
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 2) Decide se inclui link_sticker (>=10k followers ou verificada)
    const followers: number = Number(acct.followers_count || 0)
    const elegivelLink = followers >= 10000
    const warnings: string[] = []

    // 3) Cria container
    const containerBody: Record<string, any> = {
      media_type: 'STORIES',
      image_url,
      access_token: token,
    }
    if (link_sticker && elegivelLink) {
      containerBody.link_sticker = JSON.stringify({ link: link_sticker })
    } else if (link_sticker && !elegivelLink) {
      warnings.push('link_sticker omitido — conta não elegível (precisa 10k+ seguidores ou verificada)')
    }

    const createRes = await fetch(`https://graph.facebook.com/v25.0/${igId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(containerBody),
    })
    const createData = await createRes.json()
    if (createData.error) {
      return new Response(JSON.stringify({
        success: false,
        error: `IG Story container: ${createData.error.message}`,
        warnings,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const creationId = createData.id

    // 4) Polling status — max 60s (10x6s)
    let ready = false
    let lastStatus = ''
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 6000))
      const sRes = await fetch(`https://graph.facebook.com/v25.0/${creationId}?fields=status_code&access_token=${token}`)
      const sData = await sRes.json()
      lastStatus = sData.status_code || ''
      if (lastStatus === 'FINISHED') { ready = true; break }
      if (lastStatus === 'ERROR') {
        return new Response(JSON.stringify({
          success: false,
          error: 'IG Story: erro processando imagem (verifique formato 9:16 e URL pública).',
          warnings,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }
    if (!ready) {
      return new Response(JSON.stringify({
        success: false,
        error: `IG Story: timeout no processamento (60s). Último status: ${lastStatus || 'desconhecido'}.`,
        warnings,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 5) Publica
    const pubRes = await fetch(`https://graph.facebook.com/v25.0/${igId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: creationId, access_token: token }),
    })
    const pubData = await pubRes.json()
    if (pubData.error) {
      return new Response(JSON.stringify({
        success: false,
        error: `IG Story publish: ${pubData.error.message}`,
        warnings,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      success: true,
      story_id: pubData.id,
      account_type: accountType,
      followers_count: followers,
      link_sticker_aplicado: !!(link_sticker && elegivelLink),
      warnings,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    return new Response(JSON.stringify({
      success: false,
      error: err?.message || 'Erro desconhecido'
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
