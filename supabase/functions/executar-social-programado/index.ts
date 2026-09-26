import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { normalizeImageUrls } from '../_shared/social-schedule.ts'
import { buildScheduledPostNotification } from '../_shared/social-post-notification.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const RESULT_TEMPLATE_NAME = 'amz_post_agendado_resultado'

async function hasRecentInbound(supabase: any, userId: string, phone: string, now: Date): Promise<boolean> {
  const { data: conversation } = await supabase
    .from('whatsapp_cloud_conversations')
    .select('id')
    .eq('user_id', userId)
    .eq('contact_number', phone)
    .maybeSingle()
  if (!conversation?.id) return false
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const { data: inbound } = await supabase
    .from('whatsapp_cloud_messages')
    .select('id')
    .eq('conversation_id', conversation.id)
    .eq('direction', 'inbound')
    .gte('created_at', since)
    .limit(1)
  return (inbound?.length ?? 0) > 0
}

async function notifyScheduledSocialToken(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  token: string,
  now: Date,
) {
  const { data: rows, error } = await supabase
    .from('social_posts_queue')
    .select('id, platform, status, scheduled_at, error_message, fb_post_id, notificado_em, solicitante_telefone')
    .eq('user_id', userId)
    .eq('approval_token', token)
  if (error || !rows?.length) return

  const notification = buildScheduledPostNotification(rows)
  if (!notification) return

  const claimedAt = new Date().toISOString()
  const ids = rows.map((row: any) => row.id)
  const { data: claimed, error: claimError } = await supabase
    .from('social_posts_queue')
    .update({ notificado_em: claimedAt, updated_at: claimedAt })
    .in('id', ids)
    .is('notificado_em', null)
    .select('id')
  if (claimError || (claimed?.length ?? 0) !== ids.length) return

  const phone = String(rows.find((row: any) => row.solicitante_telefone)?.solicitante_telefone || '')
  let deliveredOrHandled = false
  try {
    if (!phone) {
      console.warn('[social-notify][sem_solicitante]', { userId, token })
      deliveredOrHandled = true
      return
    }

    if (await hasRecentInbound(supabase, userId, phone, now)) {
      const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-message`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, to: phone, message: notification.text }),
      })
      const result = await response.json().catch(() => ({}))
      deliveredOrHandled = response.ok && result?.success !== false
      if (!deliveredOrHandled) console.error('[social-notify][falha_texto_livre]', { userId, token, motivo: result?.motivo })
      return
    }

    const { data: template } = await supabase
      .from('whatsapp_templates')
      .select('id')
      .eq('user_id', userId)
      .eq('nome_meta', RESULT_TEMPLATE_NAME)
      .eq('idioma', 'pt_BR')
      .eq('status_meta', 'aprovado')
      .maybeSingle()
    if (!template?.id) {
      console.warn('[social-notify][sem_template_fora_janela]', { userId, token })
      deliveredOrHandled = true
      return
    }
    const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-cloud-send-template`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        to: phone,
        template_id: template.id,
        variaveis: [notification.scheduledDateText, notification.templateResult],
        tipo: 'social_post_agendado_resultado',
        registrar: true,
      }),
    })
    const result = await response.json().catch(() => ({}))
    deliveredOrHandled = response.ok && result?.success === true
    if (!deliveredOrHandled) console.error('[social-notify][falha_template]', { userId, token, motivo: result?.motivo })
  } catch (notifyError) {
    console.error('[social-notify][erro]', { userId, token, error: (notifyError as Error).message })
  } finally {
    if (!deliveredOrHandled) {
      await supabase.from('social_posts_queue')
        .update({ notificado_em: null })
        .in('id', ids)
        .eq('notificado_em', claimedAt)
    }
  }
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
              .select('id, user_id, nome, ig_product_id')
              .eq('id', post.produto_id)
              .maybeSingle()

            if (produtoError) {
              throw new Error(`Erro ao validar produto ${post.produto_id}: ${produtoError.message}`)
            }

            // CORREÇÃO: produto deletado → cancelar post (não gera erro repetidamente)
            if (!produto) {
              console.log(`⚠️ Produto ${post.produto_id} deletado, cancelando post ${post.id}`)
              await supabase.from('social_posts_queue')
                .update({
                  status: 'cancelado',
                  error_message: 'produto_deletado',
                  updated_at: now.toISOString()
                })
                .eq('id', post.id)
              results.push({ id: post.id, platform: post.platform, success: false, cancelled: true, reason: 'produto_deletado' })
              continue
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
          const imageUrls = normalizeImageUrls(post.image_urls)

          if (post.platform === 'facebook') {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/meta-publish-post`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message: post.post_text,
                page_id: post.page_id || '',
                user_id: post.user_id,
                ...(imageUrls.length >= 2
                  ? { image_urls: imageUrls }
                  : post.video_url
                  ? { video_url: post.video_url }
                  : { image_url: post.image_url || undefined }),
              })
            })
            publishResult = await response.json()
          } else if (post.platform === 'instagram') {
            if (!post.image_url && !post.video_url && imageUrls.length < 2) {
              throw new Error('Instagram requer imagem, vídeo ou carrossel')
            }
            const isCarousel = imageUrls.length >= 2
            const response = await fetch(`${SUPABASE_URL}/functions/v1/${isCarousel ? 'meta-publish-carousel' : 'meta-publish-instagram'}`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
               body: JSON.stringify({
                 caption: post.post_text,
                 user_id: post.user_id,
                 produto_id: post.produto_id || undefined,
                 ...(isCarousel
                   ? { image_urls: imageUrls }
                   : post.video_url
                   ? {
                     video_url: post.video_url,
                     creation_id: post.instagram_creation_id || undefined,
                     queue_row_id: post.id,
                   }
                   : { image_url: post.image_url }),
               })
            })
            publishResult = await response.json()
          } else if (post.platform === 'linkedin') {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/linkedin-publish`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                user_id: post.user_id,
                texto: post.post_text_linkedin || post.post_text,
                image_url: post.image_url || undefined,
                video_url: post.video_url || undefined,
                link_url: post.link_url || undefined,
                link_no_primeiro_comentario: post.link_no_primeiro_comentario !== false,
              })
            })
            publishResult = await response.json()
            if (publishResult?.success && publishResult?.post_urn) {
              await supabase.from('social_posts_queue')
                .update({ linkedin_post_urn: publishResult.post_urn })
                .eq('id', post.id)
            }
          } else {
            throw new Error(`Plataforma não suportada pelo executor: ${post.platform}`)
          }

          if (
            post.platform === 'instagram'
            && publishResult?.retryable === true
            && typeof publishResult?.creation_id === 'string'
          ) {
            await supabase.from('social_posts_queue')
              .update({
                status: 'pendente',
                error_message: publishResult.error || 'Instagram ainda está processando o vídeo',
                instagram_creation_id: publishResult.creation_id,
                instagram_container_status: publishResult.container_status || 'IN_PROGRESS',
                updated_at: new Date().toISOString(),
              })
              .eq('id', post.id)
            results.push({
              id: post.id,
              platform: post.platform,
              success: false,
              retryable: true,
              creation_id: publishResult.creation_id,
            })
            continue
          }

          if (publishResult?.success || publishResult?.post_id) {
            await supabase.from('social_posts_queue')
              .update({
                status: 'publicado',
                fb_post_id: publishResult.post_id || publishResult.id,
                published_at: now.toISOString(),
                updated_at: now.toISOString(),
                ...(post.platform === 'instagram'
                  ? {
                    instagram_creation_id: null,
                    instagram_container_status: 'PUBLISHED',
                  }
                  : {}),
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

      const notificationGroups = new Map<string, string>()
      for (const post of pendingPosts) {
        if (post.approval_token) notificationGroups.set(String(post.approval_token), String(post.user_id))
      }
      for (const [token, userId] of notificationGroups) {
        try {
          await notifyScheduledSocialToken(supabase, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, userId, token, now)
        } catch (notifyError) {
          console.error('[social-notify][nao_bloqueia_executor]', { userId, token, error: (notifyError as Error).message })
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
