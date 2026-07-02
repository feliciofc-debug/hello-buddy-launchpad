// Jarvis Daily Brief — dispara às 8h SP no WhatsApp do Felicio
// Cron: 0 11 * * * (11h UTC = 8h São Paulo)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OWNER_PHONE = "5521967520706";
const ADMIN_AMZ_USER_ID = Deno.env.get("ADMIN_AMZ_USER_ID") || "";

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendWA(to: string, message: string) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send-message`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY },
    body: JSON.stringify({ user_id: ADMIN_AMZ_USER_ID, to, message }),
  });
  return { ok: r.ok, txt: await r.text() };
}

async function getMetrics() {
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const yStart = new Date(Date.now() - 86400000); yStart.setUTCHours(0, 0, 0, 0);
  const yEnd = new Date(yStart.getTime() + 86400000);
  const [{ count: totalC }, { count: ativas }, { count: overdue }, mesR, ontemR] = await Promise.all([
    sb.from("billing_customers").select("*", { count: "exact", head: true }),
    sb.from("billing_subscriptions").select("*", { count: "exact", head: true }).eq("status", "authorized"),
    sb.from("billing_subscriptions").select("*", { count: "exact", head: true }).or("status.eq.overdue,payment_fail_count.gte.1"),
    sb.from("billing_transactions").select("amount").eq("status", "approved").gte("payment_date", monthStart.toISOString()),
    sb.from("billing_transactions").select("amount").eq("status", "approved").gte("payment_date", yStart.toISOString()).lt("payment_date", yEnd.toISOString()),
  ]);
  const faturMes = (mesR.data ?? []).reduce((s, t: any) => s + Number(t.amount || 0), 0);
  const faturOntem = (ontemR.data ?? []).reduce((s, t: any) => s + Number(t.amount || 0), 0);
  return { totalC, ativas, overdue, faturMes, faturOntem };
}

async function getClima() {
  try {
    const { data: loc } = await sb.from("whatsapp_user_locations").select("latitude,longitude,address").eq("contact_number", OWNER_PHONE).maybeSingle();
    const lat = loc?.latitude ?? -22.9068, lng = loc?.longitude ?? -43.1729;
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America/Sao_Paulo&forecast_days=1`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const d = await r.json();
    return { t: d.current?.temperature_2m, max: d.daily?.temperature_2m_max?.[0], min: d.daily?.temperature_2m_min?.[0], chuva: d.daily?.precipitation_probability_max?.[0], local: loc?.address ?? "Rio de Janeiro" };
  } catch { return null; }
}

async function getPlataforma() {
  const { data } = await sb.from("edge_functions_health").select("function_name, status, is_critical").order("consecutive_failures", { ascending: false }).limit(30);
  const probl = (data ?? []).filter((f: any) => f.status !== "healthy" && f.status !== "online");
  return { total: data?.length ?? 0, problemas: probl.length, criticas: probl.filter((p: any) => p.is_critical).map((p: any) => p.function_name) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const [m, clima, plat] = await Promise.all([getMetrics(), getClima(), getPlataforma()]);
    const dataSP = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "long" });
    const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    let msg = `☀️ *Bom dia, chefe.* ${dataSP}\n\n`;
    msg += `💰 *AMZ*\n• Ontem: ${brl(m.faturOntem)}\n• Mês: ${brl(m.faturMes)}\n• Ativos: ${m.ativas}/${m.totalC} • Inadimplentes: ${m.overdue}\n\n`;
    if (clima) msg += `🌤 *Clima* (${clima.local})\n• Agora ${clima.t}°C • Max ${clima.max}° / Min ${clima.min}° • Chuva ${clima.chuva}%\n\n`;
    msg += `🛡 *Plataforma*\n• ${m.totalC ? plat.total : plat.total} funções • ${plat.problemas} com aviso${plat.criticas.length ? ` • CRÍTICAS: ${plat.criticas.slice(0, 3).join(", ")}` : ""}\n\n`;
    msg += `Bom dia produtivo. Me chama se precisar de algo.`;
    const r = await sendWA(OWNER_PHONE, msg);
    return new Response(JSON.stringify({ ok: r.ok, preview: msg.slice(0, 200) }), { headers: { "Content-Type": "application/json", ...cors } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), { status: 500, headers: { "Content-Type": "application/json", ...cors } });
  }
});
