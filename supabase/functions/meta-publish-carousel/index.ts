const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, image_urls, caption } = await req.json()
    const sanitizedCaption = sanitizePublishText(caption)
    if (!user_id || !image_urls?.length) {
      return new Response(JSON.stringify({ error: 'user_id e image_urls são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Resolve IG account credentials with fallback chain (same as meta-publish-instagram)
    const { igId, token } = await getIgCredentials(supabase, user_id)

    const graphUrl = 'https://graph.facebook.com/v25.0'

    console.log(`📸 Criando carrossel com ${image_urls.length} imagens para IG ${igId}`)

    // Step 1: Create carousel item containers (with retry for transient errors)
    const childrenIds: string[] = []
    for (let i = 0; i < image_urls.length; i++) {
      const imageUrl = image_urls[i]
      console.log(`📸 [${i+1}/${image_urls.length}] Criando container para: ${imageUrl.substring(0, 100)}`)
      
      let data: any = null
      for (let retry = 0; retry < 3; retry++) {
        if (retry > 0) {
          console.log(`🔄 Retry ${retry}/2 para imagem ${i+1}...`)
          await new Promise(r => setTimeout(r, 3000 * retry))
        }
        const res = await fetch(`${graphUrl}/${igId}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: imageUrl,
            is_carousel_item: true,
            access_token: token,
          }),
        })
        data = await res.json()
        if (!data.error) break
        if (data.error.is_transient) {
          console.warn(`⚠️ Erro transiente (tentativa ${retry+1}):`, data.error.message)
          continue
        }
        break // non-transient error, don't retry
      }
      
      if (data.error) {
        console.error(`❌ Erro ao criar item ${i+1}:`, JSON.stringify(data.error))
        throw new Error(`Erro ao criar item ${i+1}: ${data.error.message}`)
      }
      console.log(`✅ Container ${i+1} criado: ${data.id}`)
      childrenIds.push(data.id)
      
      // Small delay between items to avoid rate limiting
      if (i < image_urls.length - 1) {
        await new Promise(r => setTimeout(r, 1500))
      }
    }

    // Step 2: Create carousel container
    console.log(`📸 Criando container do carrossel com ${childrenIds.length} filhos...`)
    const carouselRes = await fetch(`${graphUrl}/${igId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'CAROUSEL',
        children: childrenIds.join(','),
        caption: sanitizedCaption || '',
        access_token: token,
      }),
    })
    const carouselData = await carouselRes.json()
    if (carouselData.error) {
      console.error('❌ Erro ao criar carrossel:', JSON.stringify(carouselData.error))
      throw new Error(`Erro ao criar carrossel: ${carouselData.error.message}`)
    }
    console.log(`✅ Carrossel container criado: ${carouselData.id}`)

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Check status before publishing
    let containerReady = false
    let attempts = 0
    while (!containerReady && attempts < 10) {
      const statusRes = await fetch(
        `${graphUrl}/${carouselData.id}?fields=status_code&access_token=${token}`
      )
      const statusData = await statusRes.json()
      console.log(`📋 Status do carrossel (tentativa ${attempts + 1}): ${statusData.status_code}`)
      
      if (statusData.status_code === 'FINISHED') {
        containerReady = true
      } else if (statusData.status_code === 'ERROR') {
        throw new Error('Instagram: Erro ao processar imagens do carrossel.')
      } else {
        attempts++
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    if (!containerReady) {
      throw new Error('Instagram: Timeout ao processar carrossel.')
    }

    // Step 3: Publish
    console.log('📸 Publicando carrossel...')
    const publishRes = await fetch(`${graphUrl}/${igId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: carouselData.id,
        access_token: token,
      }),
    })
    const publishData = await publishRes.json()
    if (publishData.error) {
      console.error('❌ Erro ao publicar:', JSON.stringify(publishData.error))
      throw new Error(`Erro ao publicar: ${publishData.error.message}`)
    }

    console.log('✅ Carrossel publicado! ID:', publishData.id)
    return new Response(JSON.stringify({ success: true, id: publishData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function getIgCredentials(supabase: any, userId: string): Promise<{ igId: string, token: string }> {
  // 1. meta_connections (multi-tenant)
  const { data: metaConn } = await supabase
    .from('meta_connections')
    .select('ig_account_id, page_access_token')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (metaConn?.ig_account_id && metaConn?.page_access_token) {
    console.log('✅ IG Account via meta_connections:', metaConn.ig_account_id)
    return { igId: metaConn.ig_account_id, token: metaConn.page_access_token }
  }

  // 2. Sem fallback legado/admin - cada cliente publica só na própria conta conectada
  throw new Error('Instagram não conectado. Vá em Configurações → Redes Sociais e conecte sua conta.')
}
