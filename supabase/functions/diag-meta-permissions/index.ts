// Diagnóstico temporário: confere o nível de acesso (Standard vs Advanced)
// das permissões do app do Meta usando app access token.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const APP_ID = Deno.env.get("META_APP_ID")!;
const GRAPH = "https://graph.facebook.com/v25.0";

const CANDIDATES: Array<[string, string | undefined]> = [
  ["META_APP_SECRET", Deno.env.get("META_APP_SECRET")],
  ["WHATSAPP_APP_SECRET", Deno.env.get("WHATSAPP_APP_SECRET")],
  ["FACEBOOK_APP_SECRET", Deno.env.get("FACEBOOK_APP_SECRET")],
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const results: Record<string, unknown> = { app_id: APP_ID };
  for (const [name, secret] of CANDIDATES) {
    if (!secret) { results[name] = "absent"; continue; }
    const appToken = `${APP_ID}|${secret}`;
    try {
      const r = await fetch(`${GRAPH}/${APP_ID}/permissions?access_token=${appToken}`);
      const j = await r.json();
      results[name] = j;
    } catch (e) { results[name] = String(e); }
  }
  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
