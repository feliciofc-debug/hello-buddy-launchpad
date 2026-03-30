import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const PAGE_ID = '855785300949909'
const IG_ACCOUNT_ID = '17841477660295647'

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
    if (!platform || !['facebook', 'instagram'].includes(platform)) {
      throw new Error('platform deve ser "facebook" ou "instagram"')
    }

    const pageToken = await getPageToken(supabase, user_id)

    let result: any

    if (platform === 'facebook') {
      result = await publishFacebookReels(pageToken, video_url, caption)
    } else {
      result = await publishInstagramReels(pageToken, video_url, caption)
    }

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

async function getPageToken(supabase: any, userId: string): Promise<string> {
  if (userId) {
    const { data } = await supabase
      .from('integrations')
      .select('access_token')
      .eq('user_id', userId)
      .eq('platform', 'meta_page_855785300949909')
      .eq('is_active', true)
      .single()
    if (data?.access_token) return data.access_token
  }
  const fallback = Deno.env.get('META_PAGE_ACCESS_TOKEN')
  if (fallback) return fallback
  throw new Error('Page token não encontrado')
}

async function publishFacebookReels(
  pageToken: string,
  videoUrl: string,
  caption: string
): Promise<{ post_id: string }> {
  console.log('📹 Publicando Facebook Reels...')

  // Step 1: Init upload
  const initResponse = await fetch(
    `https://graph.facebook.com/v25.0/${PAGE_ID}/video_reels`,
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
  console.log('📹 Video ID:', videoId)

  // Step 2: Upload video via URL
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

  console.log('📹 Upload concluído:', uploadResult.success)

  // Step 3: Publish
  const publishResponse = await fetch(
    `https://graph.facebook.com/v25.0/${PAGE_ID}/video_reels`,
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

  console.log('✅ Facebook Reels publicado:', publishResult)
  return { post_id: publishResult.video_id || videoId }
}

async function publishInstagramReels(
  pageToken: string,
  videoUrl: string,
  caption: string
): Promise<{ post_id: string }> {
  console.log('📹 Publicando Instagram Reels...')

  // Step 1: Create Reels container
  const containerResponse = await fetch(
    `https://graph.facebook.com/v25.0/${IG_ACCOUNT_ID}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: videoUrl,
        caption: caption,
        access_token: pageToken
      })
    }
  )

  const containerResult = await containerResponse.json()
  if (containerResult.error) throw new Error(`IG Reels container: ${containerResult.error.message}`)

  const creationId = containerResult.id
  console.log('📹 Container criado:', creationId)

  // Step 2: Wait for processing
  let containerReady = false
  let attempts = 0
  const maxAttempts = 30

  while (!containerReady && attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 3000))

    const statusResponse = await fetch(
      `https://graph.facebook.com/v25.0/${creationId}?fields=status_code&access_token=${pageToken}`
    )
    const statusResult = await statusResponse.json()
    console.log(`📋 Status Reels (tentativa ${attempts + 1}):`, statusResult.status_code)

    if (statusResult.status_code === 'FINISHED') {
      containerReady = true
    } else if (statusResult.status_code === 'ERROR') {
      throw new Error('IG Reels: Erro ao processar vídeo. Verifique formato e tamanho.')
    }
    attempts++
  }

  if (!containerReady) throw new Error('IG Reels: Timeout ao processar vídeo')

  // Step 3: Publish
  const publishResponse = await fetch(
    `https://graph.facebook.com/v25.0/${IG_ACCOUNT_ID}/media_publish`,
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

  console.log('✅ Instagram Reels publicado:', publishResult.id)
  return { post_id: publishResult.id }
}
