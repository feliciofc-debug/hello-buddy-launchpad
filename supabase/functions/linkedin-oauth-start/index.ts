import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { LINKEDIN_SCOPES, linkedinRedirectUri } from '../_shared/linkedin.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const clientId = Deno.env.get('LINKEDIN_CLIENT_ID');
    if (!clientId) throw new Error('LINKEDIN_CLIENT_ID não configurado');

    const authHeader = req.headers.get('Authorization') || '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let redirectTo = '/linkedin';
    try {
      const body = await req.json();
      if (typeof body?.redirect_to === 'string' && body.redirect_to.startsWith('/')) {
        redirectTo = body.redirect_to;
      }
    } catch (_) { /* sem body */ }

    const state = crypto.randomUUID();
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { error } = await admin.from('linkedin_oauth_states')
      .insert({ state, user_id: user.id, redirect_to: redirectTo });
    if (error) throw new Error(error.message);

    const url = new URL('https://www.linkedin.com/oauth/v2/authorization');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', linkedinRedirectUri());
    url.searchParams.set('state', state);
    url.searchParams.set('scope', LINKEDIN_SCOPES);

    return new Response(JSON.stringify({ success: true, auth_url: url.toString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('linkedin-oauth-start:', err);
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
