// Helper temporário: dispara um envio Pietro pra um cliente_id usando o BILLING_ADMIN_PASSWORD do ambiente.
// NÃO requer autenticação externa — pra ser removido após validação.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const cliente_id = body?.cliente_id || "b33dabb2-8faf-449f-89f5-94a30c9b2dfa";
    const tipo = body?.tipo || "D-5";

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const BILLING_PWD = Deno.env.get("BILLING_ADMIN_PASSWORD")!;

    const r = await fetch(`${SUPABASE_URL}/functions/v1/pietro-cobranca-disparar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-billing-token": BILLING_PWD },
      body: JSON.stringify({ cliente_id, tipo }),
    });
    const j = await r.json().catch(() => ({}));
    return new Response(JSON.stringify({ status: r.status, response: j }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
