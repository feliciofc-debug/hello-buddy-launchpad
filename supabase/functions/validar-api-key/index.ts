// [VALIDAR API KEY] Validates an X-API-Key header and returns owner info. Public (no JWT).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = req.headers.get("x-api-key") || req.headers.get("X-API-Key");
    if (!apiKey) {
      return new Response(JSON.stringify({ valid: false, error: "API Key não fornecida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const keyHash = await sha256(apiKey);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: keyRow, error } = await admin
      .from("api_keys")
      .select("id, user_id, nome, key_prefix, revoked_at")
      .eq("key_hash", keyHash)
      .is("revoked_at", null)
      .maybeSingle();

    if (error || !keyRow) {
      console.log(`[VALIDAR API KEY] Inválida prefix=${apiKey.substring(0, 16)}`);
      return new Response(JSON.stringify({ valid: false, error: "API Key inválida ou revogada" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);

    const { data: userData } = await admin.auth.admin.getUserById(keyRow.user_id);
    const userEmail = userData?.user?.email ?? null;

    console.log(`[VALIDAR API KEY] OK prefix=${keyRow.key_prefix} user=${keyRow.user_id}`);

    return new Response(JSON.stringify({
      valid: true,
      user_id: keyRow.user_id,
      user_email: userEmail,
      key_nome: keyRow.nome,
      key_prefix: keyRow.key_prefix,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[VALIDAR API KEY] Fatal:", err);
    return new Response(JSON.stringify({ valid: false, error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
