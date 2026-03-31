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

    const now = new Date()
    const results: any[] = []

    // ============================
    // PARTE 0: Executar Autopilot (agenda posts novos)
    // ============================
    try {
      console.log('🤖 Executando autopilot...')
      const autopilotResponse = await fetch(`${SUPABASE_URL}/functions/v1/autopilot-social`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ source: 'cron' })
      })
      const autopilotResult = await autopilotResponse.json()
      console.log('🤖 Autopilot resultado:', autopilotResult.processed, 'configs processadas')
    } catch (autopilotError) {
      console.error('⚠️ Erro no autopilot (não bloqueia publicação):', autopilotError)
    }

    // ============================
    // PARTE 1: Publicar posts pendentes da social_posts_queue
    // ============================
    const { data: pendingPosts, error: fetchError } = await supabase
      .from('social_posts_queue')
      .select('*')
      .eq('status', 'pendente')
      .or(`scheduled_at.is.null,scheduled_at.lte.${now.toISOString()}`)
      .limit(10)

    if (fetchError) {
      console.error('❌ Erro buscando posts pendentes:', fetchError)
    }

    if (pendingPosts && pendingPosts.length > 0) {
      console.log(`📤 Encontrados ${pendingPosts.length} posts pendentes para publicar`)

      for (const post of pendingPosts) {
        try {
          if (post.produto_id && post.produto_source === 'produtos') {
            const { data: produto, error: produtoError } = await supabase
              .from('produtos')
              .select('id, user_id, nome')
              .eq('id', post.produto_id)
              .maybeSingle()

            if (produtoError) {
              throw new Error(`Erro ao validar produto ${post.produto_id}: ${produtoError.message}`)
            }

            if (!produto) {
              throw new Error(`Produto ${post.produto_id} não encontrado para validar publicação`)
            }

            if (produto.user_id !== post.user_id) {
              throw new Error(`Produto ${post.produto_id} pertence a outro usuário e foi bloqueado`)
            }

            console.log(`🔐 Produto validado para post ${post.id}: ${produto.nome}`)
          }

          await supabase.from('social_posts_queue')
            .update({ status: 'publicando', updated_at: now.toISOString() })
            .eq('id', post.id)

          let publishResult: any

          if (post.platform === 'facebook') {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/meta-publish-post`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message: post.post_text,
                page_id: post.page_id || '855785300949909',
                user_id: post.user_id,
                image_url: post.image_url || undefined,
              })
            })
            publishResult = await response.json()
          } else if (post.platform === 'instagram') {
            if (!post.image_url) {
              throw new Error('Instagram requer imagem')
            }
            const response = await fetch(`${SUPABASE_URL}/functions/v1/meta-publish-instagram`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                caption: post.post_text,
                image_url: post.image_url,
                user_id: post.user_id,
              })
            })
            publishResult = await response.json()
          }

          if (publishResult?.success || publishResult?.post_id) {
            await supabase.from('social_posts_queue')
              .update({
                status: 'publicado',
                fb_post_id: publishResult.post_id || publishResult.id,
                published_at: now.toISOString(),
                updated_at: now.toISOString()
              })
              .eq('id', post.id)

            console.log(`✅ Post ${post.id} publicado no ${post.platform}`)
            results.push({ id: post.id, platform: post.platform, success: true })
          } else {
            throw new Error(publishResult?.error || 'Erro desconhecido na publicação')
          }

        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido'
          console.error(`❌ Erro publicando post ${post.id}:`, errorMsg)

          await supabase.from('social_posts_queue')
            .update({
              status: 'erro',
              error_message: errorMsg,
              updated_at: now.toISOString()
            })
            .eq('id', post.id)

          results.push({ id: post.id, platform: post.platform, success: false, error: errorMsg })
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      timestamp: now.toISOString(),
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
