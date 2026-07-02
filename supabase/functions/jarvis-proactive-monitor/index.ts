// Jarvis Proactive Monitor — roda de hora em hora e alerta o Felicio no WhatsApp
// Alertas: estoque crítico, autopilot/edge functions falhando, novos leads/vendas, inadimplência AMZ
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OWNER_PHONE = "5521967520706";
const ADMIN_USER_ID = Deno.env.get("ADMIN_AMZ_USER_ID") || "b7af0118-c506-4f87-8ac3-a0a11fd621fe";

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEDUP_HOURS = 6; // não repete o mesmo alerta em menos de 6h

async function sendWA(message: string) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "apikey": SERVICE_KEY,
    },
    body: JSON.stringify({ user_id: ADMIN_USER_ID, to: OWNER_PHONE, message }),
  });
  return { ok: r.ok, txt: await r.text() };
}

async function shouldSend(key: string): Promise<boolean> {
  const { data } = await sb
    .from("jarvis_alerts_state")
    .select("last_sent_at")
    .eq("alert_key", key)
    .maybeSingle();
  if (!data) return true;
  const ageH = (Date.now() - new Date(data.last_sent_at).getTime()) / 3_600_000;
  return ageH >= DEDUP_HOURS;
}

async function markSent(key: string, payload: Record<string, unknown> = {}) {
  await sb.from("jarvis_alerts_state").upsert({
    alert_key: key,
    last_sent_at: new Date().toISOString(),
    payload,
  });
}

// ---------- Checks ----------

async function checkStock(): Promise<string | null> {
  const { data, count } = await sb
    .from("products_stock")
    .select("name, qty", { count: "exact" })
    .eq("user_id", ADMIN_USER_ID)
    .eq("active", true)
    .lte("qty", 0)
    .limit(5);
  if (!count || count === 0) return null;
  const list = (data ?? []).map((p: any) => `• ${p.name}`).join("\n");
  return `📦 *Estoque zerado* (${count} produto${count > 1 ? "s" : ""})\n${list}${count > 5 ? `\n… +${count - 5}` : ""}`;
}

async function checkPlataforma(): Promise<string | null> {
  const { data } = await sb
    .from("edge_functions_health")
    .select("function_name, status, consecutive_failures, is_critical")
    .neq("status", "healthy")
    .neq("status", "online")
    .order("consecutive_failures", { ascending: false })
    .limit(10);
  const problemas = data ?? [];
  const criticas = problemas.filter((p: any) => p.is_critical);
  if (criticas.length === 0 && problemas.length < 3) return null;
  const alvo = criticas.length ? criticas : problemas.slice(0, 3);
  const list = alvo.map((p: any) => `• ${p.function_name} (${p.consecutive_failures || 0} falhas)`).join("\n");
  return `🛠 *Plataforma com problema*\n${list}`;
}

async function checkAutopilot(): Promise<string | null> {
  // Autopilot travado: config ativa mas sem post recente nas últimas 24h
  const { data: cfgs } = await sb
    .from("autopilot_config")
    .select("user_id, ativo, ultima_execucao")
    .eq("ativo", true);
  const travados = (cfgs ?? []).filter((c: any) => {
    if (!c.ultima_execucao) return false;
    const ageH = (Date.now() - new Date(c.ultima_execucao).getTime()) / 3_600_000;
    return ageH > 24;
  });
  if (travados.length === 0) return null;
  return `🤖 *Autopilot travado*\n• ${travados.length} conta${travados.length > 1 ? "s" : ""} sem publicar há +24h`;
}

async function checkNovosLeads(): Promise<string | null> {
  const since = new Date(Date.now() - 3_600_000).toISOString(); // última 1h
  const [{ count: b2b }, { count: b2c }] = await Promise.all([
    sb.from("leads_b2b").select("*", { count: "exact", head: true }).gte("created_at", since),
    sb.from("leads_b2c").select("*", { count: "exact", head: true }).gte("created_at", since),
  ]);
  const total = (b2b || 0) + (b2c || 0);
  if (total === 0) return null;
  return `🎯 *Novos leads (última 1h)*\n• B2B: ${b2b || 0} • B2C: ${b2c || 0}`;
}

async function checkVendas(): Promise<string | null> {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { data } = await sb
    .from("billing_transactions")
    .select("amount")
    .eq("status", "approved")
    .gte("payment_date", since);
  if (!data || data.length === 0) return null;
  const total = data.reduce((s, t: any) => s + Number(t.amount || 0), 0);
  return `💰 *Vendas AMZ (última 1h)*\n• ${data.length} pagamento${data.length > 1 ? "s" : ""} • ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
}

async function checkInadimplencia(): Promise<string | null> {
  const { count } = await sb
    .from("billing_subscriptions")
    .select("*", { count: "exact", head: true })
    .or("status.eq.overdue,payment_fail_count.gte.1");
  if (!count || count === 0) return null;
  // Só alerta se subir vs último snapshot
  const { data: prev } = await sb
    .from("jarvis_alerts_state")
    .select("payload")
    .eq("alert_key", "amz_inadimplencia_snapshot")
    .maybeSingle();
  const prevCount = (prev?.payload as any)?.count ?? 0;
  await sb.from("jarvis_alerts_state").upsert({
    alert_key: "amz_inadimplencia_snapshot",
    last_sent_at: new Date().toISOString(),
    payload: { count },
  });
  if (count <= prevCount) return null;
  return `⚠️ *Inadimplência AMZ*\n• ${count} contratos em atraso (+${count - prevCount} desde a última checagem)`;
}

// ---------- Runner ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const checks: Array<{ key: string; run: () => Promise<string | null> }> = [
      { key: "stock_zero", run: checkStock },
      { key: "plataforma_falha", run: checkPlataforma },
      { key: "autopilot_travado", run: checkAutopilot },
      { key: "novos_leads", run: checkNovosLeads },
      { key: "vendas_amz", run: checkVendas },
      { key: "inadimplencia_amz", run: checkInadimplencia },
    ];

    const partes: string[] = [];
    const enviados: string[] = [];

    for (const c of checks) {
      try {
        const msg = await c.run();
        if (!msg) continue;
        // vendas e leads são "boas notícias" — mandamos toda hora se houver
        const alwaysSend = c.key === "vendas_amz" || c.key === "novos_leads";
        if (!alwaysSend && !(await shouldSend(c.key))) continue;
        partes.push(msg);
        enviados.push(c.key);
      } catch (e) {
        console.error(`check ${c.key} falhou:`, e);
      }
    }

    if (partes.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: false, reason: "nada novo" }), {
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    const hora = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
    const msg = `🔔 *Monitor Jarvis — ${hora}*\n\n${partes.join("\n\n")}`;
    const r = await sendWA(msg);
    await Promise.all(enviados.filter((k) => k !== "vendas_amz" && k !== "novos_leads").map((k) => markSent(k)));

    return new Response(JSON.stringify({ ok: r.ok, sent: true, alerts: enviados, preview: msg.slice(0, 200) }), {
      headers: { "Content-Type": "application/json", ...cors },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }
});
