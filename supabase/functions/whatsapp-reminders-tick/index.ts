// Verifica lembretes vencidos e envia notificações escalonadas via WhatsApp Cloud.
// Lógica: T-30min avisa e reagenda a cada 10min; nos últimos 10min, reduz para próximo bloco;
// na hora exata (ou depois) envia "AGORA" e marca como done.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function fmtSP(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

async function sendWa(user_id: string, to: string, message: string) {
  await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "apikey": SERVICE_KEY,
    },
    body: JSON.stringify({ user_id, to, message }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const now = new Date();
  const { data: due, error } = await sb
    .from("whatsapp_reminders")
    .select("*")
    .eq("status", "active")
    .lte("next_notify_at", now.toISOString())
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  for (const r of due ?? []) {
    try {
      const meetingMs = new Date(r.meeting_at).getTime();
      const nowMs = now.getTime();
      const diffMin = Math.round((meetingMs - nowMs) / 60000);

      let msg: string;
      let nextStatus = "active";
      let nextNotify = new Date(nowMs + 10 * 60000);

      if (diffMin <= 0) {
        msg = `⏰ *AGORA:* ${r.titulo}\n\nÉ a hora combinada. Bora!`;
        nextStatus = "done";
      } else if (diffMin <= 10) {
        msg = `⏰ Faltam *${diffMin} min* para: *${r.titulo}*\n🕒 ${fmtSP(r.meeting_at)}`;
        // próximo tick: exatamente na hora do meeting
        nextNotify = new Date(meetingMs);
      } else {
        msg = `⏰ Faltam *${diffMin} min* para: *${r.titulo}*\n🕒 ${fmtSP(r.meeting_at)}`;
        // próximo em 10min, mas nunca depois do meeting
        if (nextNotify.getTime() > meetingMs) nextNotify = new Date(meetingMs);
      }

      await sendWa(r.user_id, r.contact_number, msg);

      await sb.from("whatsapp_reminders").update({
        status: nextStatus,
        next_notify_at: nextNotify.toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", r.id);

      results.push({ id: r.id, diffMin, nextStatus });
    } catch (e) {
      console.error("[reminders-tick]", r.id, e);
      results.push({ id: r.id, error: String(e) });
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
