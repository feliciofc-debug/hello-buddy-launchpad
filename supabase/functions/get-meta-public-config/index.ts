// Endpoint público minúsculo: devolve config pública do Meta pro frontend
// (APP_ID e EMBEDDED_CONFIG_ID). Fonte única = secrets do projeto.
// Sem dados sensíveis: APP_ID e config_id são públicos por design.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      // Embedded Signup usa o app do WhatsApp quando ele existir (pode ser
      // diferente do app usado para Instagram/Facebook).
      app_id: Deno.env.get("WHATSAPP_APP_ID") ?? Deno.env.get("META_APP_ID") ?? null,
      meta_app_id: Deno.env.get("META_APP_ID") ?? null,
      embedded_config_id: Deno.env.get("WHATSAPP_EMBEDDED_CONFIG_ID") ?? null,
      graph_version: "v25.0",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
