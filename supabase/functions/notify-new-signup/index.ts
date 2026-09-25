import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveTenantOwner } from "../_shared/amz-context.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const AMZ_TENANT_USER_ID =
  Deno.env.get("AMZ_SIGNUP_TENANT_USER_ID") ?? "b7af0118-c506-4f87-8ac3-a0a11fd621fe";

const PLAN_NAMES: Record<string, string> = {
  essencial: "Essencial — R$ 597/mês",
  profissional: "Profissional — R$ 997/mês",
  avancado: "Avançado com IA — R$ 1.597/mês",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!SERVICE_ROLE_KEY || token !== SERVICE_ROLE_KEY) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const body = await req.json().catch(() => ({}));
  const userId = typeof body?.user_id === "string" ? body.user_id : "";
  if (!userId) return json({ error: "user_id_required" }, 400);

  try {
    const [{ data: profile, error: profileError }, authResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("nome, whatsapp, plano_solicitado, cadastro_notificado_em")
        .eq("id", userId)
        .single(),
      supabase.auth.admin.getUserById(userId),
    ]);
    if (profileError) throw profileError;
    if (authResult.error) throw authResult.error;
    if (profile.cadastro_notificado_em) {
      return json({ success: true, reused: true });
    }

    const owner = await resolveTenantOwner(supabase, AMZ_TENANT_USER_ID);
    if (!owner.phone) throw new Error("owner_phone_not_configured");

    const email = authResult.data.user?.email ?? "não informado";
    const plan = PLAN_NAMES[profile.plano_solicitado] ?? profile.plano_solicitado ?? "não informado";
    const message = [
      "🟢 *Novo cadastro na AMZ*",
      "",
      `Nome: ${profile.nome || "não informado"}`,
      `E-mail: ${email}`,
      `WhatsApp: ${profile.whatsapp || "não informado"}`,
      `Plano: ${plan}`,
      "",
      "Status: aguardando confirmação manual do pagamento.",
    ].join("\n");

    const response = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        user_id: AMZ_TENANT_USER_ID,
        to: owner.phone,
        message,
      }),
    });
    const responseText = await response.text();
    if (!response.ok) throw new Error(`whatsapp_send_${response.status}: ${responseText.slice(0, 200)}`);
    const sent = JSON.parse(responseText);
    const wamid = sent?.message_id ?? sent?.wamid ?? null;
    if (sent?.success !== true || !wamid) throw new Error("whatsapp_delivery_receipt_missing");

    const { data: existingConversation } = await supabase
      .from("whatsapp_cloud_conversations")
      .select("id")
      .eq("user_id", AMZ_TENANT_USER_ID)
      .eq("contact_number", owner.phone)
      .maybeSingle();
    let conversationId = existingConversation?.id;
    if (!conversationId) {
      const { data: created, error: conversationError } = await supabase
        .from("whatsapp_cloud_conversations")
        .insert({
          user_id: AMZ_TENANT_USER_ID,
          contact_number: owner.phone,
          contact_name: owner.name ?? "Dono",
          status: "active",
          last_message_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (conversationError) throw conversationError;
      conversationId = created.id;
    }

    await supabase.from("whatsapp_cloud_messages").insert({
      conversation_id: conversationId,
      user_id: AMZ_TENANT_USER_ID,
      direction: "outbound",
      sender: "agent",
      content: message,
      message_type: "text",
      wamid,
    });
    await supabase
      .from("profiles")
      .update({
        cadastro_notificado_em: new Date().toISOString(),
        cadastro_notificacao_erro: null,
      })
      .eq("id", userId);

    return json({ success: true, reused: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase
      .from("profiles")
      .update({ cadastro_notificacao_erro: message.slice(0, 500) })
      .eq("id", userId);
    console.error("[notify-new-signup]", message);
    return json({ success: false, error: message }, 502);
  }
});
