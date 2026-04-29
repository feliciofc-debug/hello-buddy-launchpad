// Cron wrapper: dispara régua de cobrança para clientes ativos
// baseado em dia_vencimento e tipo (D-5, D-2, D-0, D+1, D+5).
// Invocado por pg_cron diariamente às 11h (horário SP).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIPOS = [
  { tipo: "D-5", offset: -5 },
  { tipo: "D-2", offset: -2 },
  { tipo: "D-0", offset: 0 },
  { tipo: "D+1", offset: 1 },
  { tipo: "D+5", offset: 5 },
] as const;

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const BILLING_PWD = Deno.env.get("BILLING_ADMIN_PASSWORD") || "";
    if (!BILLING_PWD) return json({ success: false, error: "BILLING_ADMIN_PASSWORD não configurado" }, 500);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Hoje em SP
    const agoraSp = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hoje = new Date(Date.UTC(agoraSp.getFullYear(), agoraSp.getMonth(), agoraSp.getDate()));

    const resultados: any[] = [];

    for (const { tipo, offset } of TIPOS) {
      // D-5 (offset=-5) = vence em 5 dias → alvo = hoje + 5
      // D+1 (offset=1)  = venceu há 1 dia → alvo = hoje - 1
      const alvo = new Date(hoje);
      alvo.setUTCDate(alvo.getUTCDate() + Math.abs(offset) * (offset <= 0 ? 1 : -1));
      const diaVencAlvo = alvo.getUTCDate();
      const dataVencISO = alvo.toISOString().slice(0, 10);

      // 1) Tenta match preciso por next_billing_date (data exata YYYY-MM-DD)
      // 2) Fallback: dia_vencimento = dia do mês alvo
      const { data: subsExact } = await supabase
        .from("billing_subscriptions")
        .select("customer_id, dia_vencimento, next_billing_date")
        .eq("status", "active")
        .eq("next_billing_date", dataVencISO);

      const { data: subsByDay, error } = await supabase
        .from("billing_subscriptions")
        .select("customer_id, dia_vencimento, next_billing_date")
        .eq("status", "active")
        .eq("dia_vencimento", diaVencAlvo)
        .is("next_billing_date", null);

      const subs = [...(subsExact || []), ...(subsByDay || [])];

      if (error) {
        resultados.push({ tipo, error: error.message });
        continue;
      }

      for (const s of subs || []) {
        try {
          const r = await fetch(`${SUPABASE_URL}/functions/v1/pietro-cobranca-disparar`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-billing-token": BILLING_PWD,
            },
            body: JSON.stringify({ cliente_id: s.customer_id, tipo }),
          });
          const txt = await r.text();
          resultados.push({ tipo, customer_id: s.customer_id, status: r.status, body: txt.slice(0, 200) });
        } catch (e) {
          resultados.push({ tipo, customer_id: s.customer_id, error: (e as Error).message });
        }
      }

      if (!subs || subs.length === 0) {
        resultados.push({ tipo, dataVencISO, diaVencAlvo, info: "nenhum cliente" });
      }
    }

    return json({ success: true, executado_em: new Date().toISOString(), resultados });
  } catch (e) {
    console.error("[pietro-cobranca-cron] FATAL", e);
    return json({ success: false, error: (e as Error).message }, 200);
  }
});
