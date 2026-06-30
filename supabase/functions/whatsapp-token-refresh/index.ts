// Fase 1.2 — Cron de refresh do token long-lived (60d)
// Roda 1x/dia via pg_cron. Varre TODOS os whatsapp_config ativos (não apenas
// os com conversas recentes — cliente inativo também tem que ser renovado).
//
// Janelas:
//   < 15d pra vencer → tenta refresh (fb_exchange_token).
//   < 5d  pra vencer e ainda válido → alert_status='reconnect_soon'.
//   refresh falhou 2x → is_active=false + alert_status='refresh_failed'.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const META_APP_ID = Deno.env.get("META_APP_ID")!;
const META_APP_SECRET = Deno.env.get("WHATSAPP_APP_SECRET") ?? Deno.env.get("META_APP_SECRET")!;
const GRAPH = "https://graph.facebook.com/v25.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = Date.now();
  const in15d = new Date(now + 15 * 24 * 60 * 60 * 1000).toISOString();
  const in5d = new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString();
  const stats = { scanned: 0, refreshed: 0, reconnect_soon: 0, failed: 0, deactivated: 0 };

  // 1) Buscar todos os ativos com token vencendo em <15d
  const { data: rows, error } = await admin
    .from("whatsapp_config")
    .select("id, user_id, access_token, token_expires_at, refresh_attempts")
    .eq("is_active", true)
    .lt("token_expires_at", in15d);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  for (const row of rows ?? []) {
    stats.scanned++;
    try {
      const r = await fetch(
        `${GRAPH}/oauth/access_token?` + new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: META_APP_ID,
          client_secret: META_APP_SECRET,
          fb_exchange_token: row.access_token,
        }),
      );
      const j = await r.json();
      if (r.ok && j.access_token) {
        const expiresInSec = (j.expires_in as number) ?? 60 * 24 * 60 * 60;
        await admin.from("whatsapp_config").update({
          access_token: j.access_token,
          token_expires_at: new Date(Date.now() + expiresInSec * 1000).toISOString(),
          last_refresh_at: new Date().toISOString(),
          refresh_attempts: 0,
          alert_status: "none",
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);
        stats.refreshed++;
        continue;
      }
      // refresh falhou
      const attempts = (row.refresh_attempts ?? 0) + 1;
      if (attempts >= 2) {
        await admin.from("whatsapp_config").update({
          refresh_attempts: attempts,
          is_active: false,
          alert_status: "refresh_failed",
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);
        stats.deactivated++;
      } else {
        // ainda dentro do prazo: marca "reconnect_soon" se <5d
        const soon = row.token_expires_at && row.token_expires_at < in5d;
        await admin.from("whatsapp_config").update({
          refresh_attempts: attempts,
          alert_status: soon ? "reconnect_soon" : "none",
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);
        if (soon) stats.reconnect_soon++;
        stats.failed++;
      }
    } catch (e) {
      stats.failed++;
    }
  }

  // 2) Marcar "reconnect_soon" pros que ainda não falharam mas estão <5d
  await admin
    .from("whatsapp_config")
    .update({ alert_status: "reconnect_soon", updated_at: new Date().toISOString() })
    .eq("is_active", true)
    .eq("alert_status", "none")
    .lt("token_expires_at", in5d);

  return new Response(JSON.stringify({ ok: true, stats }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
