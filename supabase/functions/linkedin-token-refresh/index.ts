import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Renova tokens do LinkedIn que expiram em menos de 10 dias (access token dura ~60 dias,
 * refresh token ~365 dias). Roda via cron. Marca alert_status quando exige reconexão.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const clientId = Deno.env.get('LINKEDIN_CLIENT_ID');
  const clientSecret = Deno.env.get('LINKEDIN_CLIENT_SECRET');
  const resultados: any[] = [];

  try {
    if (!clientId || !clientSecret) throw new Error('Credenciais do LinkedIn não configuradas');

    const limite = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const { data: conns } = await admin.from('linkedin_connections')
      .select('*').eq('is_active', true).lte('token_expires_at', limite);

    for (const conn of conns || []) {
      try {
        if (!conn.refresh_token) {
          await admin.from('linkedin_connections')
            .update({ alert_status: 'reconectar', updated_at: new Date().toISOString() })
            .eq('id', conn.id);
          resultados.push({ user_id: conn.user_id, ok: false, motivo: 'sem refresh_token' });
          continue;
        }

        const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: conn.refresh_token,
            client_id: clientId,
            client_secret: clientSecret,
          }),
        });

        if (!res.ok) {
          const texto = await res.text();
          console.error(`Refresh falhou (${conn.user_id}) [${res.status}]: ${texto}`);
          await admin.from('linkedin_connections')
            .update({ alert_status: 'reconectar', updated_at: new Date().toISOString() })
            .eq('id', conn.id);
          resultados.push({ user_id: conn.user_id, ok: false, status: res.status });
          continue;
        }

        const token = await res.json();
        const agora = Date.now();
        await admin.from('linkedin_connections').update({
          access_token: token.access_token,
          refresh_token: token.refresh_token || conn.refresh_token,
          token_expires_at: new Date(agora + (Number(token.expires_in) || 0) * 1000).toISOString(),
          refresh_expires_at: token.refresh_token_expires_in
            ? new Date(agora + Number(token.refresh_token_expires_in) * 1000).toISOString()
            : conn.refresh_expires_at,
          alert_status: 'ok',
          updated_at: new Date().toISOString(),
        }).eq('id', conn.id);

        resultados.push({ user_id: conn.user_id, ok: true });
      } catch (e) {
        resultados.push({ user_id: conn.user_id, ok: false, erro: e instanceof Error ? e.message : 'erro' });
      }
    }

    return new Response(JSON.stringify({ success: true, processados: resultados.length, resultados }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Erro' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
