// Endpoint público minúsculo: devolve config pública do Meta pro frontend
// (APP_ID e EMBEDDED_CONFIG_ID). Fonte única = secrets do projeto.
// Sem dados sensíveis: APP_ID e config_id são públicos por design.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { parseNumericEnvFileKey } from "../_shared/env-file-key.ts";

const EMBEDDED_CONFIG_KEY = "WHATSAPP_EMBEDDED_CONFIG_ID";
let cachedEmbeddedConfigId: string | null = null;

function lerChaveDoArquivo(path: string, key: string): string | null {
  if (key !== EMBEDDED_CONFIG_KEY) return null;
  if (cachedEmbeddedConfigId) return cachedEmbeddedConfigId;
  try {
    const value = parseNumericEnvFileKey(Deno.readTextFileSync(path), key);
    if (value) cachedEmbeddedConfigId = value;
    return value;
  } catch {
    return null;
  }
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({
      // Embedded Signup usa o app do WhatsApp quando ele existir (pode ser
      // diferente do app usado para Instagram/Facebook).
      app_id: Deno.env.get("WHATSAPP_APP_ID") ?? Deno.env.get("META_APP_ID") ??
        null,
      meta_app_id: Deno.env.get("META_APP_ID") ?? null,
      embedded_config_id: Deno.env.get(EMBEDDED_CONFIG_KEY) ??
        lerChaveDoArquivo("/root/amz-functions.env", EMBEDDED_CONFIG_KEY) ??
        null,
      graph_version: "v25.0",
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
