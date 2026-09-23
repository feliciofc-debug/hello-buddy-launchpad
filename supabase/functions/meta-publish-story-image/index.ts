import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { prepareImageForStorySafe } from '../_shared/prepareImageForStory.ts'
import { InstagramContainerTimeoutError, waitForInstagramContainer } from '../_shared/instagram-container.ts'

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
    const { image_url, user_id, link_sticker, creation_id, queue_row_id } = await req.json()
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

    // Story é 9:16. Qualquer outra proporção o Instagram ESTICA — então
    // encaixamos a foto inteira num quadro 1080x1920 antes de publicar.
    const preparada = await prepareImageForStorySafe(image_url, user_id, SUPABASE_URL, SERVICE_KEY)
    const storyImageUrl = preparada.url
    console.log(`[story-image] proporcao=${preparada.reason} convertida=${preparada.converted}`)

    // 1) Busca metadata da conta IG (apenas campos suportados na Graph v25)
    // Nota: `account_type` foi removido da Graph API — se a conta foi conectada
    // via FB Page, já é Business/Creator por definição.
    let followers = 0
    let accountType = 'BUSINESS'
    try {
      const acctRes = await fetch(`https://graph.facebook.com/v25.0/${igId}?fields=username,followers_count&access_token=${token}`)
      const acct = await acctRes.json()
      if (!acct.error) {
        followers = Number(acct.followers_count || 0)
      }
    } catch (_) {
      // não bloqueia o envio se a chamada de metadata falhar
    }

    // 2) Decide se inclui link_sticker (>=10k followers ou verificada)
    const elegivelLink = followers >= 10000
    const warnings: string[] = []

    // 3) Cria container, ou reutiliza o que ficou pronto após timeout anterior.
    let creationId = String(creation_id || '').trim()
    if (!creationId) {
      const containerBody: Record<string, any> = {
        media_type: 'STORIES',
        image_url: storyImageUrl,
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
      creationId = createData.id
      if (queue_row_id) {
        const { error: saveError } = await supabase.from('social_posts_queue').update({
          instagram_creation_id: creationId,
          instagram_container_status: 'IN_PROGRESS',
          updated_at: new Date().toISOString(),
        }).eq('id', queue_row_id).eq('user_id', user_id).eq('platform', 'instagram')
        if (saveError) throw new Error(`Não consegui guardar creation_id do Instagram: ${saveError.message}`)
      }
    } else {
      console.log('[story-image] reutilizando creation_id:', creationId)
    }

    // 4) Polling progressivo por até ~5 minutos.
    await waitForInstagramContainer(creationId, token, 'story-image')

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
    const timeout = err instanceof InstagramContainerTimeoutError
    return new Response(JSON.stringify({
      success: false,
      error: err?.message || 'Erro desconhecido',
      retryable: timeout,
      creation_id: timeout ? err.creationId : undefined,
      container_status: timeout ? err.lastStatus : undefined,
    }), { status: timeout ? 202 : 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
