import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { assertSafePublicUrl } from "../_shared/brand-site-identity.ts";
import {
  filterAuthorizedAudience,
  isInsideWhatsAppWindow,
  normalizeCampaignPhone,
  templateSupportsImage,
} from "../_shared/whatsapp-marketing-campaign.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function authenticatedUser(req: Request): Promise<{ id: string } | null> {
  const authorization = req.headers.get("authorization") || "";
  if (!authorization) return null;
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authorization } } },
  );
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : { id: data.user.id };
}

async function tenantListIds(admin: any, userId: string): Promise<string[]> {
  const { data, error } = await admin
    .from("pj_listas_categoria")
    .select("id")
    .eq("user_id", userId);
  if (error) throw new Error(`listas_indisponiveis:${error.message}`);
  return (data ?? []).map((row: any) => String(row.id));
}

async function approvedTemplates(admin: any, userId: string, hasImage: boolean) {
  const { data, error } = await admin
    .from("whatsapp_templates")
    .select("id, nome_meta, idioma, body_text, variaveis_map, header, categoria_meta, status_meta")
    .eq("user_id", userId)
    .eq("status_meta", "aprovado")
    .eq("categoria_meta", "MARKETING")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`templates_indisponiveis:${error.message}`);
  return (data ?? []).filter((template: any) =>
    !hasImage || templateSupportsImage(template.header)
  );
}

async function loadInboundWindowPhones(
  admin: any,
  userId: string,
  phones: string[],
  now = Date.now(),
): Promise<Set<string>> {
  if (!phones.length) return new Set();
  const cutoff = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const variants = [...new Set(phones.flatMap((phone) => {
    const normalized = normalizeCampaignPhone(phone);
    if (!normalized) return [];
    return [normalized, normalized.startsWith("55") ? normalized.slice(2) : normalized];
  }))].slice(0, 2_000);
  const { data, error } = await admin
    .from("whatsapp_cloud_inbound_queue")
    .select("from_number, created_at")
    .eq("user_id", userId)
    .in("from_number", variants)
    .gte("created_at", cutoff);
  if (error) throw new Error(`janela_whatsapp_indisponivel:${error.message}`);
  const open = new Set<string>();
  for (const row of data ?? []) {
    if (isInsideWhatsAppWindow(row.created_at, now)) {
      const normalized = normalizeCampaignPhone(row.from_number);
      if (normalized) open.add(normalized);
    }
  }
  return open;
}

type Destination =
  | { type: "list"; list_id: string }
  | { type: "individual"; contact_id: string };

async function resolveAudience(
  admin: any,
  userId: string,
  destination: Destination,
): Promise<{
  recipients: Array<{ phone: string; name: string | null; send_mode: "session" | "template" }>;
  inside_window: number;
  need_template: number;
  ignored_without_opt_in: number;
  duplicates: number;
}> {
  const listIds = await tenantListIds(admin, userId);
  let rows: any[] = [];
  if (destination.type === "list") {
    if (!listIds.includes(String(destination.list_id))) throw new Error("lista_nao_encontrada");
    const { data, error } = await admin
      .from("pj_lista_membros")
      .select("telefone, nome, opt_in_status")
      .eq("lista_id", destination.list_id);
    if (error) throw new Error(`membros_indisponiveis:${error.message}`);
    rows = data ?? [];
  } else {
    const { data, error } = await admin
      .from("pj_lista_membros")
      .select("id, telefone, nome, opt_in_status, lista_id")
      .eq("id", destination.contact_id)
      .in("lista_id", listIds.length ? listIds : ["00000000-0000-0000-0000-000000000000"])
      .maybeSingle();
    if (error || !data) throw new Error("contato_nao_encontrado");
    rows = [data];
  }
  const filtered = filterAuthorizedAudience(rows.map((row: any) => ({
    phone: row.telefone,
    name: row.nome,
    optInStatus: row.opt_in_status,
  })));
  const open = await loadInboundWindowPhones(
    admin,
    userId,
    filtered.recipients.map((recipient) => recipient.phone),
  );
  const recipients = filtered.recipients.map((recipient) => ({
    ...recipient,
    send_mode: open.has(recipient.phone) ? "session" as const : "template" as const,
  }));
  return {
    recipients,
    inside_window: recipients.filter((recipient) => recipient.send_mode === "session").length,
    need_template: recipients.filter((recipient) => recipient.send_mode === "template").length,
    ignored_without_opt_in: filtered.ignoredWithoutOptIn,
    duplicates: filtered.duplicates,
  };
}

async function validatePublicImage(rawUrl: string): Promise<void> {
  const url = await assertSafePublicUrl(rawUrl);
  const response = await fetch(url, {
    method: "HEAD",
    signal: AbortSignal.timeout(10_000),
    redirect: "follow",
  });
  if (!response.ok) throw new Error("A imagem não está publicamente acessível.");
  const type = response.headers.get("content-type") || "";
  if (type && !type.startsWith("image/")) throw new Error("A URL informada não é uma imagem pública.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const user = await authenticatedUser(req);
    if (!user) return json({ success: false, error: "Sua sessão expirou. Entre novamente." }, 401);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "bootstrap");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    if (action === "bootstrap") {
      const listIds = await tenantListIds(admin, user.id);
      const [{ data: lists, error: listsError }, templates, { data: members, error: membersError }] =
        await Promise.all([
          admin.from("pj_listas_categoria")
            .select("id, nome")
            .eq("user_id", user.id)
            .eq("ativa", true)
            .order("nome"),
          approvedTemplates(admin, user.id, Boolean(body?.has_image)),
          listIds.length
            ? admin.from("pj_lista_membros")
              .select("lista_id, telefone, opt_in_status")
              .in("lista_id", listIds)
            : Promise.resolve({ data: [], error: null }),
        ]);
      if (listsError || membersError) throw new Error("Não consegui carregar seus contatos agora.");
      const counts = new Map<string, { total: number; confirmed: number; ignored: number }>();
      for (const member of members ?? []) {
        const count = counts.get(member.lista_id) ?? { total: 0, confirmed: 0, ignored: 0 };
        count.total++;
        if (member.opt_in_status === "confirmado") count.confirmed++;
        else count.ignored++;
        counts.set(member.lista_id, count);
      }
      return json({
        success: true,
        lists: (lists ?? []).map((list: any) => ({ ...list, ...(counts.get(list.id) ?? { total: 0, confirmed: 0, ignored: 0 }) })),
        templates,
      });
    }

    if (action === "search_contacts") {
      const query = String(body?.query || "").replace(/[%(),]/g, "").trim();
      if (query.length < 2) return json({ success: true, contacts: [] });
      const ids = await tenantListIds(admin, user.id);
      if (!ids.length) return json({ success: true, contacts: [] });
      const { data, error } = await admin
        .from("pj_lista_membros")
        .select("id, nome, telefone, opt_in_status, lista_id")
        .in("lista_id", ids)
        .or(`nome.ilike.%${query}%,telefone.ilike.%${query}%`)
        .limit(20);
      if (error) throw new Error("Não consegui buscar contatos agora.");
      return json({ success: true, contacts: data ?? [] });
    }

    if (action === "preview") {
      const summary = await resolveAudience(admin, user.id, body.destination as Destination);
      return json({ success: true, summary });
    }

    if (action === "create") {
      const destination = body.destination as Destination;
      const message = String(body?.message || "").trim();
      const imageUrl = String(body?.image_url || "").trim() || null;
      if (!message) throw new Error("A legenda da campanha está vazia.");
      if (!destination || !["list", "individual"].includes(destination.type)) {
        throw new Error("Escolha um destino válido.");
      }
      if (imageUrl) await validatePublicImage(imageUrl);
      const summary = await resolveAudience(admin, user.id, destination);
      if (!summary.recipients.length) throw new Error("Nenhum contato com autorização foi encontrado.");
      const templateId = String(body?.template_id || "").trim() || null;
      if (summary.need_template > 0 && !templateId) {
        throw new Error(`${summary.need_template} contato(s) estão fora da janela de 24 horas e exigem um modelo MARKETING aprovado.`);
      }
      if (templateId) {
        const templates = await approvedTemplates(admin, user.id, Boolean(imageUrl));
        if (!templates.some((template: any) => template.id === templateId)) {
          throw new Error("O modelo escolhido não está aprovado ou não aceita a imagem deste post.");
        }
      }
      const scheduledAt = body?.scheduled_at ? new Date(body.scheduled_at) : new Date();
      if (!Number.isFinite(scheduledAt.getTime())) throw new Error("Data de agendamento inválida.");
      const { data: campaign, error: campaignError } = await admin
        .from("whatsapp_marketing_campaigns")
        .insert({
          user_id: user.id,
          name: String(body?.name || "IA Marketing").slice(0, 120),
          destination_type: destination.type,
          list_id: destination.type === "list" ? destination.list_id : null,
          message,
          image_url: imageUrl,
          template_id: templateId,
          template_variables: Array.isArray(body?.template_variables) ? body.template_variables : [],
          scheduled_at: scheduledAt.toISOString(),
          status: "scheduled",
          total_recipients: summary.recipients.length,
          total_skipped: summary.ignored_without_opt_in,
        })
        .select("id, status, scheduled_at")
        .single();
      if (campaignError || !campaign) throw new Error(`Não consegui criar a campanha: ${campaignError?.message || "sem retorno"}`);
      const { error: recipientsError } = await admin
        .from("whatsapp_marketing_campaign_recipients")
        .insert(summary.recipients.map((recipient) => ({
          campaign_id: campaign.id,
          user_id: user.id,
          phone: recipient.phone,
          contact_name: recipient.name,
          send_mode: recipient.send_mode,
          next_attempt_at: scheduledAt.toISOString(),
        })));
      if (recipientsError) {
        await admin.from("whatsapp_marketing_campaigns").delete().eq("id", campaign.id);
        throw new Error(`Não consegui montar a fila: ${recipientsError.message}`);
      }
      if (scheduledAt.getTime() <= Date.now() + 30_000) {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-campanha-processar`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ campaign_id: campaign.id, batch_limit: 10 }),
        }).catch((error) => console.error("[whatsapp-campaign] worker trigger:", error));
      }
      return json({ success: true, campaign, summary });
    }

    if (action === "status") {
      const campaignId = String(body?.campaign_id || "");
      const { data: campaign } = await admin
        .from("whatsapp_marketing_campaigns")
        .select("*")
        .eq("id", campaignId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!campaign) return json({ success: false, error: "Campanha não encontrada." }, 404);
      const { data: recipients } = await admin
        .from("whatsapp_marketing_campaign_recipients")
        .select("phone, contact_name, send_mode, status, failure_reason, message_id, updated_at")
        .eq("campaign_id", campaignId)
        .eq("user_id", user.id)
        .order("created_at");
      return json({ success: true, campaign, recipients: recipients ?? [] });
    }

    if (action === "cancel") {
      const campaignId = String(body?.campaign_id || "");
      const { data: campaign } = await admin
        .from("whatsapp_marketing_campaigns")
        .select("id, status")
        .eq("id", campaignId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!campaign) return json({ success: false, error: "Campanha não encontrada." }, 404);
      if (["completed", "cancelled"].includes(campaign.status)) {
        return json({ success: false, error: "Esta campanha não possui envios pendentes." }, 409);
      }
      await admin.from("whatsapp_marketing_campaigns")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", campaignId);
      await admin.from("whatsapp_marketing_campaign_recipients")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("campaign_id", campaignId)
        .eq("status", "queued");
      return json({ success: true });
    }

    return json({ success: false, error: "Ação inválida." }, 400);
  } catch (error) {
    console.error("[whatsapp-campanha-enviar]", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Erro inesperado na campanha.",
    }, 400);
  }
});
