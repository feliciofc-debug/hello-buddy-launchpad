import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { adicionarLinkNoCorpo, comentarNoPost, criarPost, separarLink } from '../_shared/linkedin.ts';


/**
 * Publica no perfil pessoal do LinkedIn do tenant.
 * Body: { user_id?, texto, image_url?, video_url?, link_no_primeiro_comentario?, comentario?, queue_id? }
 * Se não vier user_id, usa o usuário do JWT.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json();
    let userId: string | null = typeof body.user_id === 'string' ? body.user_id : null;

    const authHeader = req.headers.get('Authorization') || '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const isService = authHeader === `Bearer ${serviceKey}`;

    if (!isService) {
      const client = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await client.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ success: false, error: 'Não autenticado' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = user.id; // isolamento: usuário só publica na própria conta
    }

    if (!userId) throw new Error('user_id ausente');
    const texto = (body.texto || '').toString().trim();
    if (!texto) throw new Error('texto do post é obrigatório');

    const { data: conn } = await admin.from('linkedin_connections')
      .select('*').eq('user_id', userId).maybeSingle();
    if (!conn || !conn.is_active) throw new Error('LinkedIn não conectado para este usuário');
    if (conn.token_expires_at && new Date(conn.token_expires_at).getTime() < Date.now()) {
      throw new Error('Token do LinkedIn expirado — reconecte a conta');
    }

    const linkNoComentario = body.link_no_primeiro_comentario !== false;
    const { corpo, link } = linkNoComentario ? separarLink(texto) : { corpo: texto, link: null };

    const postUrn = await criarPost({
      accessToken: conn.access_token,
      authorUrn: conn.member_urn,
      texto: corpo || texto,
      imageUrl: body.image_url || null,
      videoUrl: body.video_url || null,
    });

    let comentarioOk = false;
    let comentarioErro: string | null = null;
    let linkNoCorpo = false;
    const linkFinal = link || (typeof body.link_url === 'string' ? body.link_url : null);
    if (linkNoComentario && linkFinal) {
      const mensagem = (body.comentario && String(body.comentario).trim())
        ? String(body.comentario).trim()
        : `Link: ${linkFinal}`;
      try {
        await comentarNoPost(conn.access_token, conn.member_urn, postUrn, mensagem);
        comentarioOk = true;
      } catch (e) {
        comentarioErro = e instanceof Error ? e.message : 'erro no comentário';
        console.error('Comentário falhou:', comentarioErro);
        // Fallback: nunca deixar o post sem o link. Reescreve o corpo do post.
        try {
          const corpoFinal = posicionarLinkLinkedIn(corpo || texto, linkFinal);
          await adicionarLinkNoCorpo(conn.access_token, postUrn, corpoFinal);
          linkNoCorpo = true;
          console.log('Link adicionado ao corpo do post (fallback)');
        } catch (e2) {
          const msg2 = e2 instanceof Error ? e2.message : 'erro ao editar o post';
          console.error('Fallback de link no corpo falhou:', msg2);
          comentarioErro = `${comentarioErro} | fallback (link no corpo) também falhou: ${msg2}`;
        }
      }
    }

    if (body.queue_id) {
      await admin.from('social_posts_queue').update({
        status: 'publicado',
        linkedin_post_urn: postUrn,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: comentarioErro
          ? (linkNoCorpo
            ? `post ok, comentário falhou (link movido para o corpo): ${comentarioErro}`
            : `post ok SEM LINK, comentário falhou: ${comentarioErro}`)
          : null,
      }).eq('id', body.queue_id).eq('user_id', userId);
    }

    return new Response(JSON.stringify({
      success: true,
      post_urn: postUrn,
      comentario_publicado: comentarioOk,
      comentario_erro: comentarioErro,
      link_no_corpo: linkNoCorpo,
      link_ausente: Boolean(linkFinal) && !comentarioOk && !linkNoCorpo,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('linkedin-publish:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
