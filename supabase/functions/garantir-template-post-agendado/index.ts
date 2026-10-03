import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const TEMPLATE_NAME = "amz_post_agendado_resultado";
const TEMPLATE_BODY = "Atualização do seu agendamento: o post programado para {{1}} teve o seguinte resultado: {{2}}. Para ver os próximos agendamentos, responda meus agendamentos.";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { success: false, error: "Method Not Allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const payload = await req.json().catch(() => ({}));
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  let userId = "";
  if (bearer === serviceKey) {
    userId = String(payload?.user_id || "");
  } else if (bearer) {
    const authed = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false },
    });
    const { data } = await authed.auth.getUser();
    userId = data.user?.id || "";
    if (payload?.user_id && payload.user_id !== userId) {
      return json(403, { success: false, error: "user_id não pertence ao usuário autenticado" });
    }
  }
  if (!userId) return json(401, { success: false, error: "user_id obrigatório" });

  const { data: existing, error: lookupError } = await admin
    .from("whatsapp_templates")
    .select("*")
    .eq("user_id", userId)
    .eq("nome_meta", TEMPLATE_NAME)
    .eq("idioma", "pt_BR")
    .maybeSingle();
  if (lookupError) return json(500, { success: false, error: lookupError.message });
  if (existing && ["pendente", "aprovado"].includes(existing.status_meta)) {
    return json(200, {
      success: true,
      submitted: false,
      template_id: existing.id,
      status_meta: existing.status_meta,
    });
  }

  const templateValues = {
    user_id: userId,
    nome_meta: TEMPLATE_NAME,
    tipo_uso: "transacional",
    categoria_meta: "UTILITY",
    idioma: "pt_BR",
    body_text: TEMPLATE_BODY,
    variaveis_map: {
      "1": { exemplo: "sexta-feira, 03/10, às 10:00" },
      "2": { exemplo: "publicado no Facebook e Instagram" },
    },
    status_meta: "rascunho",
    motivo_rejeicao_meta: null,
  };
  const templateQuery = existing
    ? admin.from("whatsapp_templates").update(templateValues).eq("id", existing.id).select("id").single()
    : admin.from("whatsapp_templates").insert(templateValues).select("id").single();
  const { data: template, error: saveError } = await templateQuery;
  if (saveError || !template?.id) return json(500, { success: false, error: saveError?.message || "template não foi salvo" });

  const submitResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-template-submit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, template_id: template.id }),
  });
  const submitted = await submitResponse.json().catch(() => ({}));
  if (!submitResponse.ok || submitted?.success !== true) {
    return json(200, {
      success: false,
      template_id: template.id,
      status_meta: "rascunho",
      error: submitted?.error || "falha ao submeter template",
    });
  }
  return json(200, {
    success: true,
    submitted: true,
    template_id: template.id,
    status_meta: submitted.status_meta,
  });
});
