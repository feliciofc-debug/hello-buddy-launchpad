// Diagnóstico temporário: confere o nível de acesso (Standard vs Advanced)
// das permissões do app do Meta usando app access token.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const APP_ID = Deno.env.get("META_APP_ID")!;
const APP_SECRET = Deno.env.get("WHATSAPP_APP_SECRET") ?? Deno.env.get("META_APP_SECRET")!;
const GRAPH = "https://graph.facebook.com/v25.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const appToken = `${APP_ID}|${APP_SECRET}`;
  const out: Record<string, unknown> = { app_id: APP_ID };
  try {
    const r = await fetch(`${GRAPH}/${APP_ID}/permissions?access_token=${appToken}`);
    out.permissions = await r.json();
  } catch (e) { out.permissions_error = String(e); }
  try {
    const r = await fetch(`${GRAPH}/${APP_ID}?fields=id,name,app_type,link&access_token=${appToken}`);
    out.app = await r.json();
  } catch (e) { out.app_error = String(e); }
  return new Response(JSON.stringify(out), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
