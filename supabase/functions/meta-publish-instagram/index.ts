import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const IG_ACCOUNT_ID = '17841477660295647'

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
        .eq('platform', 'instagram')
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
    } else if (body.caption && body.image_url) {
      const pageToken = await getPageToken(supabase, body.user_id)
      const result = await publishToInstagram(pageToken, body.caption, body.image_url)
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else if (!body.image_url && body.caption) {
      throw new Error('Instagram requer uma imagem para publicação. Selecione uma imagem do produto.')
    }

    console.log(`📸 Processando ${posts.length} posts para Instagram...`)
    const results: any[] = []

    for (const post of posts) {
      try {
        if (!post.image_url) {
          throw new Error('Instagram requer image_url para publicação')
        }

        await supabase.from('social_posts_queue')
          .update({ status: 'publicando', updated_at: new Date().toISOString() })
          .eq('id', post.id)

        const pageToken = await getPageToken(supabase, post.user_id)
        const result = await publishToInstagram(pageToken, post.post_text, post.image_url)

        await supabase.from('social_posts_queue')
          .update({
            status: 'publicado',
            fb_post_id: result.post_id,
            published_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', post.id)

        console.log('✅ Publicado no Instagram:', result.post_id)
        results.push({ id: post.id, success: true, ig_post_id: result.post_id })

      } catch (postError) {
        const errorMsg = postError instanceof Error ? postError.message : 'Erro desconhecido'
        console.error('❌ Erro no post Instagram', post.id, ':', errorMsg)

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
    console.error('❌ Erro geral Instagram:', error)
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

  throw new Error('Page token não encontrado. Configure META_PAGE_ACCESS_TOKEN.')
}

async function publishToInstagram(
  pageToken: string,
  caption: string,
  imageUrl: string
): Promise<{ post_id: string }> {

  console.log('📸 Passo 1: Criando container no Instagram...')
  console.log('Image URL:', imageUrl)

  // Passo 1: Criar container de mídia
  const containerResponse = await fetch(
    `https://graph.facebook.com/v25.0/${IG_ACCOUNT_ID}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: imageUrl,
        caption: caption,
        access_token: pageToken
      })
    }
  )

  const containerResult = await containerResponse.json()

  if (containerResult.error) {
    console.error('❌ Erro ao criar container:', containerResult.error)
    throw new Error(`Instagram API (container): ${containerResult.error.message}`)
  }

  const creationId = containerResult.id
  console.log('✅ Container criado:', creationId)

  // Aguardar o Instagram processar a imagem
  await new Promise(resolve => setTimeout(resolve, 3000))

  // Verificar status do container antes de publicar
  let containerReady = false
  let attempts = 0
  const maxAttempts = 10

  while (!containerReady && attempts < maxAttempts) {
    const statusResponse = await fetch(
      `https://graph.facebook.com/v25.0/${creationId}?fields=status_code&access_token=${pageToken}`
    )
    const statusResult = await statusResponse.json()
    console.log(`📋 Status do container (tentativa ${attempts + 1}):`, statusResult.status_code)

    if (statusResult.status_code === 'FINISHED') {
      containerReady = true
    } else if (statusResult.status_code === 'ERROR') {
      throw new Error('Instagram: Erro ao processar imagem. Verifique se a URL da imagem é pública e acessível.')
    } else {
      attempts++
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  if (!containerReady) {
    throw new Error('Instagram: Timeout ao processar imagem. Tente novamente.')
  }

  // Passo 2: Publicar o container
  console.log('📸 Passo 2: Publicando no Instagram...')

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

  if (publishResult.error) {
    console.error('❌ Erro ao publicar:', publishResult.error)
    throw new Error(`Instagram API (publish): ${publishResult.error.message}`)
  }

  console.log('✅ Publicado no Instagram! Post ID:', publishResult.id)
  return { post_id: publishResult.id }
}
