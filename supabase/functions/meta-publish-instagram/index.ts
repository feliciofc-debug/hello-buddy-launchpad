import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { prepareImageForInstagramSafe } from "../_shared/prepareImageForInstagram.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const SUPABASE_URL_ENV = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY_ENV = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

/**
 * Garante URL compatível com Instagram (não-AVIF, hospedada em CDN confiável).
 * Estratégia em camadas:
 *  1) Se URL já é uma URL do nosso Storage (produtos bucket) → retorna direto
 *  2) Se NÃO é AVIF → retorna sem alteração (Meta aceita)
 *  3) Se é AVIF (Shopee) ou já wrapped em wsrv.nl:
 *     a) Tenta `prepareImageForInstagramSafe` (baixa + decode + reencode JPEG + upload Storage)
 *     b) Se falhar, usa wsrv.nl como último recurso
 */
async function ensureInstagramCompatibleImageUrl(url: string, userId: string): Promise<string> {
  if (!url) return url
  try {
    const lower = url.toLowerCase()
    // Se já é do nosso Storage, OK
    if (lower.includes('/storage/v1/object/public/produtos/')) {
      return url
    }

    // Detecta AVIF (direto ou já dentro de wrapper wsrv.nl)
    const isAvif =
      lower.endsWith('.avif') ||
      lower.includes('.avif?') ||
      lower.includes('format=avif') ||
      lower.includes('.avif&') ||
      lower.includes('%2eavif') ||
      (lower.includes('wsrv.nl') && lower.includes('.avif'))

    if (!isAvif) return url

    // Se é wsrv.nl wrapped, extrair URL original AVIF
    let originalUrl = url
    if (lower.includes('wsrv.nl/?url=')) {
      try {
        const urlObj = new URL(url)
        const inner = urlObj.searchParams.get('url')
        if (inner) originalUrl = decodeURIComponent(inner)
      } catch (_) {
        // ignore
      }
    }

    console.log('🔄 [AVIF] Convertendo via Storage helper:', originalUrl.substring(0, 100))
    const result = await prepareImageForInstagramSafe(
      originalUrl,
      userId,
      SUPABASE_URL_ENV,
      SUPABASE_SERVICE_ROLE_KEY_ENV,
    )

    if (result.converted) {
      console.log('✅ [AVIF] Convertida e armazenada:', result.url.substring(0, 100))
      return result.url
    }

    // Helper falhou → fallback wsrv.nl
    console.warn('⚠️ [AVIF] Helper não converteu, usando wsrv.nl como fallback')
    return `https://wsrv.nl/?url=${encodeURIComponent(originalUrl)}&output=jpg&q=90`
  } catch (e) {
    console.warn('⚠️ ensureInstagramCompatibleImageUrl falhou, usando URL original:', e)
    return url
  }
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
    const sanitizedCaption = sanitizePublishText(body.caption)

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
    } else if (body.video_url && body.caption) {
      // Publicação direta de vídeo (Reels)
      const { igId, token } = await getIgAccountId(supabase, body.user_id)
      const result = await publishReelsToInstagram(token, igId, sanitizedCaption, body.video_url, body.cover_url)
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else if (body.caption && body.image_url) {
      const { igId, token } = await getIgAccountId(supabase, body.user_id)
      const result = await publishImageToInstagram(token, igId, sanitizedCaption, body.image_url)
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else if (!body.image_url && !body.video_url && body.caption) {
      throw new Error('Instagram requer uma imagem ou vídeo para publicação.')
    }

    console.log(`📸 Processando ${posts.length} posts para Instagram...`)
    const results: any[] = []

    for (const post of posts) {
      try {
        if (!post.image_url && !post.video_url) {
          throw new Error('Instagram requer image_url ou video_url para publicação')
        }

        const sanitizedPostText = sanitizePublishText(post.post_text)

        await supabase.from('social_posts_queue')
          .update({ status: 'publicando', post_text: sanitizedPostText, updated_at: new Date().toISOString() })
          .eq('id', post.id)

        const { igId, token } = await getIgAccountId(supabase, post.user_id)
        
        let result: { post_id: string }
        
        if (post.video_url) {
          // Publicar como Reels
          result = await publishReelsToInstagram(token, igId, sanitizedPostText, post.video_url)
        } else {
          // Publicar como imagem
          result = await publishImageToInstagram(token, igId, sanitizedPostText, post.image_url)
        }

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
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function getIgAccountId(supabase: any, userId: string): Promise<{ igId: string, token: string }> {
  // 1. Buscar da meta_connections (multi-cliente)
  const { data: metaConn } = await supabase
    .from('meta_connections')
    .select('ig_account_id, page_access_token')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (metaConn?.ig_account_id && metaConn?.page_access_token) {
    console.log('✅ IG Account do cliente encontrado via meta_connections:', metaConn.ig_account_id)
    return { igId: metaConn.ig_account_id, token: metaConn.page_access_token }
  }

  // 2. Sem fallback legado/admin - cada cliente publica só na própria conta conectada
  throw new Error('Instagram não conectado. Vá em Configurações → Redes Sociais e conecte sua conta.')
}

// === PUBLICAR IMAGEM ===
async function publishImageToInstagram(
  pageToken: string,
  igAccountId: string,
  caption: string,
  imageUrl: string
): Promise<{ post_id: string }> {

  console.log('📸 Publicando IMAGEM no Instagram...', { igAccountId })

  // CORREÇÃO: Instagram não aceita AVIF (Shopee usa AVIF). Reroteia via wsrv.nl.
  const safeImageUrl = ensureInstagramCompatibleImageUrl(imageUrl)

  // Passo 1: Criar container de mídia
  const containerResponse = await fetch(
    `https://graph.facebook.com/v25.0/${igAccountId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: safeImageUrl,
        caption: caption,
        access_token: pageToken
      })
    }
  )

  const containerResult = await containerResponse.json()
  if (containerResult.error) {
    throw new Error(`Instagram API (container): ${containerResult.error.message}`)
  }

  const creationId = containerResult.id
  console.log('✅ Container criado:', creationId)

  // Aguardar processamento
  await waitForContainer(creationId, pageToken)

  // Passo 2: Publicar
  return await publishContainer(igAccountId, creationId, pageToken)
}

// === PUBLICAR VÍDEO (REELS) ===
async function publishReelsToInstagram(
  pageToken: string,
  igAccountId: string,
  caption: string,
  videoUrl: string,
  coverUrl?: string
): Promise<{ post_id: string }> {

  console.log('🎬 Publicando REELS no Instagram...', { igAccountId, videoUrl })

  // CORREÇÃO: cover_url também não pode ser AVIF
  const safeCoverUrl = coverUrl ? ensureInstagramCompatibleImageUrl(coverUrl) : undefined

  // Passo 1: Criar container de vídeo (Reels)
  const containerBody: Record<string, string> = {
    media_type: 'REELS',
    video_url: videoUrl,
    caption: caption || '',
    access_token: pageToken
  }
  
  if (safeCoverUrl) {
    containerBody.cover_url = safeCoverUrl
  }

  const containerResponse = await fetch(
    `https://graph.facebook.com/v25.0/${igAccountId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(containerBody)
    }
  )

  const containerResult = await containerResponse.json()
  if (containerResult.error) {
    console.error('❌ Erro ao criar container Reels:', containerResult.error)
    throw new Error(`Instagram Reels API (container): ${containerResult.error.message}`)
  }

  const creationId = containerResult.id
  console.log('✅ Container Reels criado:', creationId)

  // Aguardar processamento (vídeo demora mais)
  await waitForContainer(creationId, pageToken, 30, 5000)

  // Passo 2: Publicar
  return await publishContainer(igAccountId, creationId, pageToken)
}

// === HELPERS ===
async function waitForContainer(
  creationId: string, 
  pageToken: string, 
  maxAttempts = 10, 
  intervalMs = 3000
): Promise<void> {
  // Aguardar inicial
  await new Promise(resolve => setTimeout(resolve, intervalMs))

  let attempts = 0
  while (attempts < maxAttempts) {
    const statusResponse = await fetch(
      `https://graph.facebook.com/v25.0/${creationId}?fields=status_code,status&access_token=${pageToken}`
    )
    const statusResult = await statusResponse.json()
    console.log(`📋 Status do container (tentativa ${attempts + 1}):`, statusResult.status_code)

    if (statusResult.status_code === 'FINISHED') {
      return
    } else if (statusResult.status_code === 'ERROR') {
      const errorMsg = statusResult.status || 'Erro ao processar mídia'
      throw new Error(`Instagram: ${errorMsg}. Verifique se a URL é pública e acessível.`)
    } else {
      attempts++
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }
  }

  throw new Error('Instagram: Timeout ao processar mídia. Tente novamente.')
}

async function publishContainer(
  igAccountId: string,
  creationId: string,
  pageToken: string
): Promise<{ post_id: string }> {
  console.log('📤 Publicando container no Instagram...')

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
  if (publishResult.error) {
    console.error('❌ Erro ao publicar:', publishResult.error)
    throw new Error(`Instagram API (publish): ${publishResult.error.message}`)
  }

  console.log('✅ Publicado no Instagram! Post ID:', publishResult.id)
  return { post_id: publishResult.id }
}
