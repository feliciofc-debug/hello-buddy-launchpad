import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildGestaoFechamentoDia } from "../_shared/gestao-fechamento-dia.ts";
import { dateKeySaoPaulo } from "../_shared/vitrine-crm-time.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anon.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    const body = await req.json().catch(() => ({})) as {
      periodo?: "hoje" | "ontem";
    };
    const hoje = dateKeySaoPaulo(new Date());
    const base = new Date(`${hoje}T12:00:00Z`);
    if (body.periodo === "ontem") base.setUTCDate(base.getUTCDate() - 1);
    const dia = base.toISOString().slice(0, 10);

    const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const result = await buildGestaoFechamentoDia(sb, user.id, dia, {
      financeiroPermitido: true,
    });
    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.warn(
      "[gestao-fechamento-dia]",
      error instanceof Error ? error.message : "erro desconhecido",
    );
    return new Response(
      JSON.stringify({
        success: false,
        error: "Não foi possível gerar o fechamento",
      }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }
});
