import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod';
import { textoIncompleto } from '../_shared/video-motion.ts';

const BodySchema = z.object({
  action: z.enum(['connections', 'publish']).default('publish'),
  media_type: z.enum(['image', 'video']).optional(),
  media_url: z.string().url().optional(),
  image_urls: z.array(z.string().url()).max(10).optional(),
  caption: z.string().max(63206).optional(),
  link_url: z.string().url().optional().nullable(),
  networks: z.array(z.enum(['facebook', 'instagram', 'tiktok', 'linkedin'])).max(4).optional(),
});

type Network = 'facebook' | 'instagram' | 'tiktok' | 'linkedin';
type NetworkResult = {
  network: Network;
  status: 'published' | 'draft' | 'not_connected' | 'unsupported' | 'failed';
  format: string;
  message: string;
  id?: string | null;
};

const LIMITS: Record<Network, number> = {
  facebook: 63206,
  instagram: 2200,
  tiktok: 2200,
  linkedin: 3000,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ success: false, error: 'Não autenticado' }, 401);

    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceKey) return json({ success: false, error: 'Configuração indisponível' }, 500);

    const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsError || typeof userId !== 'string') return json({ success: false, error: 'Sessão inválida' }, 401);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ success: false, error: parsed.error.flatten().fieldErrors }, 400);
    const body = parsed.data;
    const admin = createClient(url, serviceKey);
    const now = Date.now();

    const [{ data: meta }, { data: tiktok }, { data: linkedin }] = await Promise.all([
      admin.from('meta_connections').select('page_id, ig_account_id, is_active, token_expires_at').eq('user_id', userId).maybeSingle(),
      admin.from('integrations').select('is_active, token_expires_at').eq('user_id', userId).eq('platform', 'tiktok').maybeSingle(),
      admin.from('linkedin_connections').select('is_active, token_expires_at').eq('user_id', userId).maybeSingle(),
    ]);

    const validUntil = (value?: string | null) => !value || new Date(value).getTime() > now;
    const connections: Record<Network, boolean> = {
      facebook: Boolean(meta?.is_active && meta?.page_id && validUntil(meta?.token_expires_at)),
      instagram: Boolean(meta?.is_active && meta?.ig_account_id && validUntil(meta?.token_expires_at)),
      tiktok: Boolean(tiktok?.is_active && validUntil(tiktok?.token_expires_at)),
      linkedin: Boolean(linkedin?.is_active && validUntil(linkedin?.token_expires_at)),
    };

    if (body.action === 'connections') {
      return json({ success: true, connections, limits: LIMITS });
    }

    if (!body.media_type || !body.media_url || !body.caption?.trim()) {
      return json({ success: false, error: 'Mídia e legenda são obrigatórias' }, 400);
    }

    const networks = body.networks?.length ? body.networks : (Object.keys(connections) as Network[]);
    const images = body.image_urls?.length ? body.image_urls : [body.media_url];
    const caption = body.caption.trim();

    // Nada de frase cortada indo ao ar na rede do cliente.
    const defeito = textoIncompleto(caption);
    if (defeito) {
      return json({
        success: false,
        error: `A legenda está incompleta (${defeito}). Complete o texto antes de publicar.`,
      }, 400);
    }
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' };

    const publish = async (network: Network): Promise<NetworkResult> => {
      const format = body.media_type === 'video'
        ? (network === 'tiktok' ? 'Rascunho' : network === 'linkedin' ? 'Vídeo' : 'Reels')
        : (network === 'instagram' || network === 'facebook') && images.length > 1 ? 'Carrossel' : 'Feed';

      if (!connections[network]) return { network, status: 'not_connected', format, message: 'Conta não conectada ou expirada.' };
      if (caption.length > LIMITS[network]) {
        return { network, status: 'failed', format, message: `A legenda excede o limite em ${caption.length - LIMITS[network]} caracteres.` };
      }
      if (network === 'tiktok' && body.media_type !== 'video') {
        return { network, status: 'unsupported', format: 'Rascunho', message: 'O rascunho do TikTok aceita vídeo. Gere um vídeo deste produto para enviar.' };
      }

      let functionName = '';
      let payload: Record<string, unknown> = {};
      if (network === 'facebook') {
        functionName = body.media_type === 'video' ? 'meta-publish-reels' : 'meta-publish-post';
        payload = body.media_type === 'video'
          ? { platform: 'facebook', video_url: body.media_url, caption, user_id: userId }
          : { user_id: userId, message: caption, image_url: images[0], image_urls: images.length > 1 ? images : undefined, link_url: body.link_url || undefined };
      } else if (network === 'instagram') {
        functionName = body.media_type === 'video' ? 'meta-publish-reels' : images.length > 1 ? 'meta-publish-carousel' : 'meta-publish-instagram';
        payload = body.media_type === 'video'
          ? { platform: 'instagram', video_url: body.media_url, caption, user_id: userId }
          : { user_id: userId, caption, image_url: images[0], image_urls: images.length > 1 ? images : undefined };
      } else if (network === 'tiktok') {
        functionName = 'tiktok-post-content';
        payload = { user_id: userId, content_type: 'video', content_url: body.media_url, title: caption, post_mode: 'draft', source: 'scheduled' };
      } else {
        functionName = 'linkedin-publish';
        payload = { user_id: userId, texto: caption, image_url: body.media_type === 'image' ? images[0] : undefined, video_url: body.media_type === 'video' ? body.media_url : undefined, link_url: body.link_url || undefined };
      }

      try {
        const response = await fetch(`${url}/functions/v1/${functionName}`, { method: 'POST', headers, body: JSON.stringify(payload) });
        const text = await response.text();
        let data: Record<string, unknown> = {};
        try { data = JSON.parse(text); } catch { data = { error: text }; }
        if (!response.ok || data.success === false) {
          return { network, status: 'failed', format, message: String(data.error || data.message || `Falha ${response.status}`) };
        }
        if (network === 'tiktok') {
          return {
            network,
            status: 'draft',
            format,
            message: 'Enviado para seus rascunhos — finalize a publicação pelo app do TikTok.',
            id: typeof data.publish_id === 'string' ? data.publish_id : null,
          };
        }
        return {
          network,
          status: 'published',
          format,
          message: 'Publicado com sucesso.',
          id: typeof data.post_id === 'string' ? data.post_id : typeof data.post_urn === 'string' ? data.post_urn : null,
        };
      } catch (error) {
        return { network, status: 'failed', format, message: error instanceof Error ? error.message : 'Falha ao publicar.' };
      }
    };

    const settled = await Promise.allSettled(networks.map(publish));
    const results = settled.map((item, index): NetworkResult => item.status === 'fulfilled'
      ? item.value
      : { network: networks[index], status: 'failed', format: 'Indisponível', message: String(item.reason || 'Falha inesperada.') });

    return json({ success: results.some((item) => item.status === 'published' || item.status === 'draft'), connections, results });
  } catch (error) {
    console.error('publicar-todas-redes:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Erro interno' }, 200);
  }
});