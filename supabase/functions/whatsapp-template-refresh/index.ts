// Fase 2 · Bloco A — Sincroniza status de templates com a Meta.
// Input: { template_id } (um só) OU { all: true } (todos do usuário).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRAPH_VERSION = "v25.0";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mapStatus(metaStatus: string | undefined | null): { status_meta: string } {
  const s = (metaStatus ?? "").toUpperCase();
  if (s === "APPROVED") return { status_meta: "aprovado" };
  if (s === "REJECTED") return { status_meta: "rejeitado" };
  if (s === "PAUSED" || s === "DISABLED") return { status_meta: "pausado" };
  return { status_meta: "pendente" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { error: "Missing Authorization" });

  const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: "Unauthorized" });
  const userId = userData.user.id;

  let payload: any = {};
  try {
    payload = await req.json();
  } catch { /* ok */ }

  const { data: cfg } = await supabaseAdmin
    .from("whatsapp_config")
    .select("waba_id, access_token")
    .eq("user_id", userId)
    .maybeSingle();
  if (!cfg?.waba_id || !cfg?.access_token) {
    return json(400, { error: "Conecte o WhatsApp Cloud antes (waba_id/access_token ausentes)." });
  }

  // Templates alvo
  let query = supabaseAdmin.from("whatsapp_templates").select("*").eq("user_id", userId);
  if (payload?.template_id) query = query.eq("id", payload.template_id);
  else if (!payload?.all) return json(400, { error: "Informe template_id ou all:true" });

  const { data: templates, error: tplErr } = await query;
  if (tplErr) return json(500, { error: tplErr.message });
  if (!templates || templates.length === 0) return json(200, { success: true, updated: 0 });

  const results: any[] = [];
  for (const tpl of templates) {
    if (!tpl.nome_meta) continue;
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${cfg.waba_id}/message_templates?name=${encodeURIComponent(tpl.nome_meta)}`;
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${cfg.access_token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.error) {
        results.push({ id: tpl.id, ok: false, error: j?.error?.message ?? "Erro Meta" });
        continue;
      }
      const arr = Array.isArray(j?.data) ? j.data : [];
      // Prioriza mesmo idioma se houver
      const match = arr.find((t: any) => t.language === tpl.idioma) ?? arr[0];
      if (!match) {
        results.push({ id: tpl.id, ok: false, error: "Template não encontrado na Meta" });
        continue;
      }
      const { status_meta } = mapStatus(match.status);
      const motivo = match.rejected_reason ?? match.reason ?? null;
      await supabaseAdmin
        .from("whatsapp_templates")
        .update({
          status_meta,
          motivo_rejeicao_meta: motivo,
          meta_template_id: match.id ? String(match.id) : tpl.meta_template_id,
        })
        .eq("id", tpl.id);
      results.push({ id: tpl.id, ok: true, status_meta });
    } catch (e) {
      results.push({ id: tpl.id, ok: false, error: String(e) });
    }
  }

  return json(200, { success: true, results });
});
