import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { LINKEDIN_SCOPES, linkedinRedirectUri } from '../_shared/linkedin.ts';

const APP_URL = Deno.env.get('APP_URL') || 'https://www.amzofertas.com.br';

const redirecionar = (path: string, params: Record<string, string>) => {
  const url = new URL(path, APP_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
};

Deno.serve(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const erroOAuth = searchParams.get('error_description') || searchParams.get('error');

    if (erroOAuth) return redirecionar('/linkedin', { linkedin: 'erro', motivo: erroOAuth });
    if (!code || !state) return redirecionar('/linkedin', { linkedin: 'erro', motivo: 'code/state ausente' });

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: stateRow } = await admin.from('linkedin_oauth_states')
      .select('*').eq('state', state).maybeSingle();
    if (!stateRow) return redirecionar('/linkedin', { linkedin: 'erro', motivo: 'state inválido' });
    await admin.from('linkedin_oauth_states').delete().eq('state', state);

    const clientId = Deno.env.get('LINKEDIN_CLIENT_ID');
    const clientSecret = Deno.env.get('LINKEDIN_CLIENT_SECRET');
    if (!clientId || !clientSecret) throw new Error('Credenciais do LinkedIn não configuradas');

    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: linkedinRedirectUri(),
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error('Token exchange falhou:', tokenRes.status, body);
      return redirecionar(stateRow.redirect_to || '/linkedin', { linkedin: 'erro', motivo: 'token' });
    }
    const token = await tokenRes.json();

    const meRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!meRes.ok) {
      console.error('userinfo falhou:', meRes.status, await meRes.text());
      return redirecionar(stateRow.redirect_to || '/linkedin', { linkedin: 'erro', motivo: 'perfil' });
    }
    const me = await meRes.json();

    const agora = Date.now();
    const { error } = await admin.from('linkedin_connections').upsert({
      user_id: stateRow.user_id,
      member_urn: `urn:li:person:${me.sub}`,
      nome: me.name || null,
      avatar_url: me.picture || null,
      access_token: token.access_token,
      refresh_token: token.refresh_token || null,
      token_expires_at: new Date(agora + (Number(token.expires_in) || 0) * 1000).toISOString(),
      refresh_expires_at: token.refresh_token_expires_in
        ? new Date(agora + Number(token.refresh_token_expires_in) * 1000).toISOString()
        : null,
      scopes: token.scope || LINKEDIN_SCOPES,
      is_active: true,
      alert_status: 'ok',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw new Error(error.message);

    return redirecionar(stateRow.redirect_to || '/linkedin', { linkedin: 'conectado' });
  } catch (err) {
    console.error('linkedin-oauth-callback:', err);
    return redirecionar('/linkedin', { linkedin: 'erro', motivo: 'inesperado' });
  }
});
