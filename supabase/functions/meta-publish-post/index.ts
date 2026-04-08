import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function sanitizePublishText(text?: string | null) {
  if (!text) return ''

  const lines = text
    .replace(/```json\s*/gi, '')
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```/g, '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())

  const skipPatterns = [
    /^(aqui está|aqui esta|segue|claro|certo|ok|entendido|com certeza)\b/i,
    /^(contexto|prompt|descrição|descricao|brief|objetivo|importante|formato)\s*:?\s*$/i,
    /^analise esta imagem\b/i,
    /^crie posts?\b/i,
    /^crie um post\b/i,
    /^gere \d+\s+variações\b/i,
    /^retorne apenas\b/i,
    /^responda somente\b/i,
    /^nunca inclua\b/i,
    /^todos os textos devem\b/i,
    /^você é um especialista\b/i,
    /^voce é um especialista\b/i,
    /^lead(?:\s*\(|\s*:|\b)/i,
    /^(produto\/serviço|produto\/servico|rede social)\s*:?\s*$/i,
    /^sem\s+["“”']?post:?/i,
    /^-?\s*(nome|profissão|profissao|especialidade|cidade)\s*:/i,
    /^-?\s*(o post será publicado|o post sera publicado|o lead verá|o lead vera|deve ser orgânico|deve ser organico|tom\s*:|máximo\s+\d+\s+caracteres|maximo\s+\d+\s+caracteres|foco no valor)\b/i,
    /^\d+\.\s*(aborde|mencione|gere|termine|use|cite|ensine|inclua)\b/i,
  ]

  return lines
    .filter((line) => {
      if (!line) return false

      const normalized = line.toLowerCase()
      if (
        normalized.includes('contexto resumido') ||
        normalized.includes('idioma obrigatório') ||
        normalized.includes('idioma obrigatorio') ||
        normalized.includes('schema json') ||
        normalized.includes('conteúdo final do post') ||
        normalized.includes('conteudo final do post')
      ) {
        return false
      }

      return !skipPatterns.some((pattern) => pattern.test(line))
    })
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/^[\s,:;\-"“”]+/, '')
    .replace(/[\s"“”]+$/, '')
    .trim()
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
    const sanitizedBodyMessage = sanitizePublishText(body.message)

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
    } else if (body.image_urls && Array.isArray(body.image_urls) && body.image_urls.length > 1) {
      // Multi-photo (carousel) post on Facebook
      const { token: pageToken, actualPageId } = await getPageToken(supabase, body.user_id, body.page_id || '')
      const result = await publishMultiPhotoToFacebook(pageToken, actualPageId, sanitizedBodyMessage, body.image_urls)
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else if (body.message || body.video_url) {
      const { token: pageToken, actualPageId } = await getPageToken(supabase, body.user_id, body.page_id || '')
      const result = await publishToFacebook(pageToken, actualPageId, sanitizedBodyMessage, body.image_url, body.link_url, body.video_url)
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

        const { token: pageToken, actualPageId } = await getPageToken(supabase, post.user_id, post.page_id || '')
        const result = await publishToFacebook(pageToken, actualPageId, sanitizePublishText(post.post_text), post.image_url, post.link_url, post.video_url)

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

async function getPageToken(supabase: any, userId: string, pageId: string): Promise<{ token: string, actualPageId: string }> {
  // 1. Buscar da meta_connections (novo sistema multi-cliente)
  const { data: metaConn } = await supabase
    .from('meta_connections')
    .select('page_access_token, page_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (metaConn?.page_access_token) {
    console.log('✅ Token do cliente encontrado via meta_connections')
    return { token: metaConn.page_access_token, actualPageId: metaConn.page_id }
  }

  // 2. Fallback: buscar da tabela integrations (compatibilidade)
  if (pageId) {
    const { data: integration } = await supabase
      .from('integrations')
      .select('access_token')
      .eq('user_id', userId)
      .eq('platform', `meta_page_${pageId}`)
      .eq('is_active', true)
      .single()

    if (integration?.access_token) {
      console.log('✅ Token encontrado via integrations (legado)')
      return { token: integration.access_token, actualPageId: pageId }
    }
  }

  // 3. Sem fallback admin - cada cliente deve ter sua própria conexão
  throw new Error('Conta Meta não conectada. Vá em Configurações → Redes Sociais e conecte sua conta do Facebook.')

  throw new Error('Conta Meta não conectada. Vá em Configurações → Redes Sociais e conecte sua conta do Facebook.')
}

async function publishToFacebook(
  pageToken: string,
  pageId: string,
  message?: string,
  imageUrl?: string,
  linkUrl?: string,
  videoUrl?: string
): Promise<{ post_id: string }> {

  // === VÍDEO ===
  if (videoUrl) {
    console.log('🎬 Publicando VÍDEO no Facebook...', { pageId, videoUrl })
    
    const endpoint = `https://graph.facebook.com/v25.0/${pageId}/videos`
    const postBody: Record<string, string> = {
      file_url: videoUrl,
      access_token: pageToken
    }
    if (message) postBody.description = message

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postBody)
    })

    const result = await response.json()

    if (result.error) {
      console.error('❌ Facebook Video API Error:', result.error)
      throw new Error(`Facebook Video API: ${result.error.message}`)
    }

    console.log('✅ Vídeo publicado no Facebook! ID:', result.id)
    return { post_id: result.id }
  }

  // === IMAGEM ===
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

async function publishMultiPhotoToFacebook(
  pageToken: string,
  pageId: string,
  message: string,
  imageUrls: string[]
): Promise<{ post_id: string }> {
  console.log(`📸 Publicando ${imageUrls.length} fotos no Facebook como multi-photo post...`)
  
  // Step 1: Upload each photo as unpublished
  const photoIds: string[] = []
  for (let i = 0; i < imageUrls.length; i++) {
    const res = await fetch(`https://graph.facebook.com/v25.0/${pageId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: imageUrls[i],
        published: false,
        access_token: pageToken,
      }),
    })
    const data = await res.json()
    if (data.error) {
      console.error(`❌ Erro ao upload foto ${i+1}:`, data.error.message)
      throw new Error(`Erro ao upload foto ${i+1}: ${data.error.message}`)
    }
    console.log(`✅ Foto ${i+1} uploaded: ${data.id}`)
    photoIds.push(data.id)
  }

  // Step 2: Create feed post with attached_media
  const attachedMedia: Record<string, string> = {}
  photoIds.forEach((id, i) => {
    attachedMedia[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })
  })

  const params = new URLSearchParams({
    message: message || '',
    access_token: pageToken,
    ...attachedMedia,
  })

  const res = await fetch(`https://graph.facebook.com/v25.0/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  const result = await res.json()
  if (result.error) {
    throw new Error(`Facebook Multi-Photo API: ${result.error.message}`)
  }

  console.log('✅ Multi-photo post publicado! ID:', result.id)
  return { post_id: result.id }
}
