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

    const body = await req.json()
    const isScheduler = body.source === 'scheduler'

    let posts: any[] = []

    if (isScheduler) {
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('social_posts_queue')
        .select('*')
        .eq('status', 'pendente')
        .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
        .limit(10)

      if (error) throw new Error(`Erro buscando posts: ${error.message}`)
      posts = data || []
    } else if (body.post_id) {
      const { data, error } = await supabase
        .from('social_posts_queue')
        .select('*')
        .eq('id', body.post_id)
        .single()

      if (error || !data) throw new Error('Post não encontrado')
      posts = [data]
    } else if (body.message) {
      const pageToken = await getPageToken(supabase, body.user_id, body.page_id || '855785300949909')
      const result = await publishToFacebook(pageToken, body.page_id || '855785300949909', body.message, body.image_url, body.link_url)
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`📤 Processando ${posts.length} posts...`)
    const results: any[] = []

    for (const post of posts) {
      try {
        await supabase.from('social_posts_queue')
          .update({ status: 'publicando', updated_at: new Date().toISOString() })
          .eq('id', post.id)

        const pageToken = await getPageToken(supabase, post.user_id, post.page_id)

        const result = await publishToFacebook(pageToken, post.page_id, post.post_text, post.image_url, post.link_url)

        await supabase.from('social_posts_queue')
          .update({
            status: 'publicado',
            fb_post_id: result.post_id,
            published_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', post.id)

        console.log('✅ Publicado:', result.post_id)
        results.push({ id: post.id, success: true, fb_post_id: result.post_id })

      } catch (postError) {
        const errorMsg = postError instanceof Error ? postError.message : 'Erro desconhecido'
        console.error('❌ Erro no post', post.id, ':', errorMsg)

        await supabase.from('social_posts_queue')
          .update({
            status: 'erro',
            error_message: errorMsg,
            updated_at: new Date().toISOString()
          })
          .eq('id', post.id)

        results.push({ id: post.id, success: false, error: errorMsg })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Erro geral:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function getPageToken(supabase: any, userId: string, pageId: string): Promise<string> {
  const { data } = await supabase
    .from('integrations')
    .select('access_token')
    .eq('user_id', userId)
    .eq('platform', `meta_page_${pageId}`)
    .eq('is_active', true)
    .single()

  if (data?.access_token) return data.access_token

  const fallback = Deno.env.get('META_PAGE_ACCESS_TOKEN')
  if (fallback) return fallback

  throw new Error(`Page token não encontrado para page ${pageId}`)
}

async function publishToFacebook(
  pageToken: string,
  pageId: string,
  message?: string,
  imageUrl?: string,
  linkUrl?: string
): Promise<{ post_id: string }> {

  let endpoint: string
  const postBody: Record<string, string> = {}

  if (imageUrl) {
    endpoint = `https://graph.facebook.com/v25.0/${pageId}/photos`
    postBody.url = imageUrl
    if (message) postBody.caption = message
  } else {
    endpoint = `https://graph.facebook.com/v25.0/${pageId}/feed`
    if (message) postBody.message = message
    if (linkUrl) postBody.link = linkUrl
  }

  postBody.access_token = pageToken

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(postBody)
  })

  const result = await response.json()

  if (result.error) {
    throw new Error(`Facebook API: ${result.error.message}`)
  }

  return { post_id: result.id || result.post_id }
}
