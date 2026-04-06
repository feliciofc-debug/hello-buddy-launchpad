import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { platform, video_url, caption, user_id } = await req.json()

    if (!video_url) throw new Error('video_url é obrigatório')
    if (!caption) throw new Error('caption é obrigatório')
    if (!user_id) throw new Error('user_id é obrigatório')
    if (!platform || !['facebook', 'instagram'].includes(platform)) {
      throw new Error('platform deve ser "facebook" ou "instagram"')
    }

    const credentials = await getMetaCredentials(supabase, user_id, platform)

    const result = platform === 'facebook'
      ? await publishFacebookReels(credentials.token, credentials.pageId!, video_url, caption)
      : await publishInstagramReels(credentials.token, credentials.igId!, video_url, caption)

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Erro Reels:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function getMetaCredentials(
  supabase: any,
  userId: string,
  platform: 'facebook' | 'instagram'
): Promise<{ token: string, pageId?: string, igId?: string }> {
  const { data: metaConn } = await supabase
    .from('meta_connections')
    .select('page_id, ig_account_id, page_access_token')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (!metaConn?.page_access_token) {
    throw new Error('Conta Meta não conectada. Vá em Configurações → Redes Sociais e conecte sua conta.')
  }

  if (platform === 'facebook' && !metaConn?.page_id) {
    throw new Error('Página do Facebook não conectada para este cliente.')
  }

  if (platform === 'instagram' && !metaConn?.ig_account_id) {
    throw new Error('Instagram não conectado para este cliente.')
  }

  return {
    token: metaConn.page_access_token,
    pageId: metaConn.page_id,
    igId: metaConn.ig_account_id,
  }
}

async function publishFacebookReels(
  pageToken: string,
  pageId: string,
  videoUrl: string,
  caption: string
): Promise<{ post_id: string }> {
  console.log('📹 Publicando Facebook Reels...', { pageId })

  const initResponse = await fetch(
    `https://graph.facebook.com/v25.0/${pageId}/video_reels`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_phase: 'start',
        access_token: pageToken
      })
    }
  )

  const initResult = await initResponse.json()
  if (initResult.error) throw new Error(`FB Reels init: ${initResult.error.message}`)

  const videoId = initResult.video_id

  const uploadResponse = await fetch(
    `https://rupload.facebook.com/video-upload/v25.0/${videoId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `OAuth ${pageToken}`,
        'file_url': videoUrl,
      }
    }
  )

  const uploadResult = await uploadResponse.json()
  if (uploadResult.error) throw new Error(`FB Reels upload: ${uploadResult.error.message}`)

  const publishResponse = await fetch(
    `https://graph.facebook.com/v25.0/${pageId}/video_reels`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_phase: 'finish',
        video_id: videoId,
        video_state: 'PUBLISHED',
        description: caption,
        access_token: pageToken
      })
    }
  )

  const publishResult = await publishResponse.json()
  if (publishResult.error) throw new Error(`FB Reels publish: ${publishResult.error.message}`)

  return { post_id: publishResult.video_id || videoId }
}

async function publishInstagramReels(
  pageToken: string,
  igAccountId: string,
  videoUrl: string,
  caption: string
): Promise<{ post_id: string }> {
  console.log('📹 Publicando Instagram Reels...', { igAccountId })

  const containerResponse = await fetch(
    `https://graph.facebook.com/v25.0/${igAccountId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: videoUrl,
        caption,
        access_token: pageToken
      })
    }
  )

  const containerResult = await containerResponse.json()
  if (containerResult.error) throw new Error(`IG Reels container: ${containerResult.error.message}`)

  const creationId = containerResult.id
  let containerReady = false
  let attempts = 0

  while (!containerReady && attempts < 30) {
    await new Promise((resolve) => setTimeout(resolve, 3000))

    const statusResponse = await fetch(
      `https://graph.facebook.com/v25.0/${creationId}?fields=status_code&access_token=${pageToken}`
    )
    const statusResult = await statusResponse.json()

    if (statusResult.status_code === 'FINISHED') {
      containerReady = true
    } else if (statusResult.status_code === 'ERROR') {
      throw new Error('IG Reels: Erro ao processar vídeo. Verifique formato e tamanho.')
    }

    attempts++
  }

  if (!containerReady) throw new Error('IG Reels: Timeout ao processar vídeo')

  const publishResponse = await fetch(
    `https://graph.facebook.com/v25.0/${igAccountId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: pageToken
      })
    }
  )

  const publishResult = await publishResponse.json()
  if (publishResult.error) throw new Error(`IG Reels publish: ${publishResult.error.message}`)

  return { post_id: publishResult.id }
}
