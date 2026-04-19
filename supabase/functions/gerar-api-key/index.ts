// [GERAR API KEY] Generates a new API key for the authenticated user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `amz_sk_live_${hex}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.log("[GERAR API KEY] Auth failed:", authError?.message);
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: { nome?: string } = {};
    try { body = await req.json(); } catch { /* empty body OK */ }

    const apiKey = generateKey();
    const keyHash = await sha256(apiKey);
    const keyPrefix = apiKey.substring(0, 16);
    const nome = body.nome?.trim() || `API Key ${new Date().toLocaleDateString("pt-BR")}`;

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await adminClient
      .from("api_keys")
      .insert({ user_id: user.id, key_hash: keyHash, key_prefix: keyPrefix, nome })
      .select("id, nome, key_prefix, created_at")
      .single();

    if (error) {
      console.log("[GERAR API KEY] Insert error:", error.message);
      return new Response(JSON.stringify({ error: "Erro ao salvar chave" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[GERAR API KEY] Created key id=${data.id} prefix=${keyPrefix} user=${user.id}`);

    return new Response(JSON.stringify({
      success: true,
      api_key: apiKey,
      id: data.id,
      nome: data.nome,
      key_prefix: data.key_prefix,
      created_at: data.created_at,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[GERAR API KEY] Fatal:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
