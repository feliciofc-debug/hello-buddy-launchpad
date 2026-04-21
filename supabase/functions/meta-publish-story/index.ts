import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

type Channel = 'facebook' | 'instagram'

interface Credentials {
  token: string
  pageId?: string | null
  igId?: string | null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { video_url, user_id, canais } = await req.json()

    if (!video_url) throw new Error('video_url é obrigatório')
    if (!user_id) throw new Error('user_id é obrigatório')
    if (!Array.isArray(canais) || canais.length === 0) {
      throw new Error('canais deve ser um array com "facebook" e/ou "instagram"')
    }

    const credentials = await getMetaCredentials(supabase, user_id)

    const tasks: Promise<{ channel: Channel; result: any }>[] = []

    if (canais.includes('facebook')) {
      tasks.push(
        publishFacebookStory(credentials.token, credentials.pageId!, video_url)
          .then((result) => ({ channel: 'facebook' as Channel, result: { ok: true, story_id: result.story_id } }))
          .catch((err) => ({ channel: 'facebook' as Channel, result: { ok: false, error: err?.message || String(err) } }))
      )
    }

    if (canais.includes('instagram')) {
      tasks.push(
        publishInstagramStory(credentials.token, credentials.igId!, video_url)
          .then((result) => ({ channel: 'instagram' as Channel, result: { ok: true, story_id: result.story_id } }))
          .catch((err) => ({ channel: 'instagram' as Channel, result: { ok: false, error: err?.message || String(err) } }))
      )
    }

    const settled = await Promise.all(tasks)
    const response: Record<string, any> = { success: true }
    for (const { channel, result } of settled) {
      response[channel] = result
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('❌ Erro Story:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function getMetaCredentials(supabase: any, userId: string): Promise<Credentials> {
  const { data: metaConn } = await supabase
    .from('meta_connections')
    .select('page_id, ig_account_id, page_access_token')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (!metaConn?.page_access_token) {
    throw new Error('Conta Meta não conectada. Vá em Configurações → Redes Sociais e conecte sua conta.')
  }

  return {
    token: metaConn.page_access_token,
    pageId: metaConn.page_id,
    igId: metaConn.ig_account_id,
  }
}

async function publishFacebookStory(
  pageToken: string,
  pageId: string,
  videoUrl: string
): Promise<{ story_id: string }> {
  if (!pageId) throw new Error('Página do Facebook não conectada para este cliente.')
  console.log('📖 Publicando Facebook Story...', { pageId })

  // Fase 1: start (obtém upload_url e video_id)
  const initResponse = await fetch(
    `https://graph.facebook.com/v25.0/${pageId}/video_stories`,
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
  if (initResult.error) throw new Error(`FB Story init: ${initResult.error.message}`)

  const videoId = initResult.video_id

  // Fase 2: upload via file_url
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
  if (uploadResult.error) throw new Error(`FB Story upload: ${uploadResult.error.message}`)

  // Fase 3: finish
  const publishResponse = await fetch(
    `https://graph.facebook.com/v25.0/${pageId}/video_stories`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        upload_phase: 'finish',
        video_id: videoId,
        video_state: 'PUBLISHED',
        access_token: pageToken
      })
    }
  )
  const publishResult = await publishResponse.json()
  if (publishResult.error) throw new Error(`FB Story publish: ${publishResult.error.message}`)

  return { story_id: publishResult.post_id || publishResult.video_id || videoId }
}

async function publishInstagramStory(
  pageToken: string,
  igAccountId: string,
  videoUrl: string
): Promise<{ story_id: string }> {
  if (!igAccountId) throw new Error('Instagram não conectado para este cliente.')
  console.log('📖 Publicando Instagram Story...', { igAccountId })

  // Container
  const containerResponse = await fetch(
    `https://graph.facebook.com/v25.0/${igAccountId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'STORIES',
        video_url: videoUrl,
        access_token: pageToken
      })
    }
  )
  const containerResult = await containerResponse.json()
  if (containerResult.error) throw new Error(`IG Story container: ${containerResult.error.message}`)

  const creationId = containerResult.id

  // Polling status
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
      throw new Error('IG Story: Erro ao processar vídeo. Verifique formato (9:16) e duração (até 60s).')
    }
    attempts++
  }

  if (!containerReady) throw new Error('IG Story: Timeout ao processar vídeo')

  // Publish
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
  if (publishResult.error) throw new Error(`IG Story publish: ${publishResult.error.message}`)

  return { story_id: publishResult.id }
}
