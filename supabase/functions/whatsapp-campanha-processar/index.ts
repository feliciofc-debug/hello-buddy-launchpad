import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  MAX_RECIPIENT_ATTEMPTS,
  normalizeCampaignPhone,
  runConservativeCampaignBatch,
} from "../_shared/whatsapp-marketing-campaign.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function dateKeySP(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function stillAuthorized(admin: any, userId: string, phone: string): Promise<boolean> {
  const { data: lists } = await admin
    .from("pj_listas_categoria")
    .select("id")
    .eq("user_id", userId);
  const ids = (lists ?? []).map((row: any) => row.id);
  if (!ids.length) return false;
  const { data: members } = await admin
    .from("pj_lista_membros")
    .select("telefone, opt_in_status")
    .in("lista_id", ids);
  let confirmed = false;
  let refused = false;
  for (const member of members ?? []) {
    if (normalizeCampaignPhone(member.telefone) !== phone) continue;
    confirmed ||= member.opt_in_status === "confirmado";
    refused ||= member.opt_in_status === "recusado";
  }
  return confirmed && !refused;
}

async function hasRecentInbound(admin: any, userId: string, phone: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const variants = [phone, phone.startsWith("55") ? phone.slice(2) : phone];
  const { data } = await admin
    .from("whatsapp_cloud_inbound_queue")
    .select("id")
    .eq("user_id", userId)
    .in("from_number", variants)
    .gte("created_at", cutoff)
    .limit(1);
  return Boolean(data?.length);
}

function variablesForRecipient(values: unknown, name: string | null): string[] {
  return (Array.isArray(values) ? values : []).map((value) =>
    String(value ?? "")
      .replace(/\{\{\s*nome\s*\}\}/gi, name || "Cliente")
      .slice(0, 1024)
  );
}

async function refreshCampaignCounts(admin: any, campaignId: string): Promise<void> {
  const { data: rows } = await admin
    .from("whatsapp_marketing_campaign_recipients")
    .select("status")
    .eq("campaign_id", campaignId);
  const counts = new Map<string, number>();
  for (const row of rows ?? []) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  const queued = (counts.get("queued") ?? 0) + (counts.get("sending") ?? 0);
  const { data: campaign } = await admin
    .from("whatsapp_marketing_campaigns")
    .select("status, total_ignored_without_opt_in")
    .eq("id", campaignId)
    .maybeSingle();
  const terminal = queued === 0 && campaign?.status !== "paused" && campaign?.status !== "cancelled";
  await admin.from("whatsapp_marketing_campaigns")
    .update({
      total_sent: (counts.get("sent") ?? 0)
        + (counts.get("delivered") ?? 0)
        + (counts.get("read") ?? 0),
      total_delivered: counts.get("delivered") ?? 0,
      total_read: counts.get("read") ?? 0,
      total_failed: counts.get("failed") ?? 0,
      total_skipped: Number(campaign?.total_ignored_without_opt_in || 0)
        + (counts.get("skipped") ?? 0)
        + (counts.get("cancelled") ?? 0),
      ...(terminal ? { status: "completed", completed_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!serviceKey || bearer !== serviceKey) return json({ success: false, error: "unauthorized" }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
      auth: { persistSession: false },
    });
    const now = new Date().toISOString();
    let campaignQuery = admin
      .from("whatsapp_marketing_campaigns")
      .select("*")
      .in("status", ["scheduled", "processing"])
      .lte("scheduled_at", now)
      .order("scheduled_at")
      .limit(10);
    if (body?.campaign_id) campaignQuery = campaignQuery.eq("id", body.campaign_id);
    const { data: campaigns, error: campaignError } = await campaignQuery;
    if (campaignError) throw campaignError;
    const batchLimit = Math.max(1, Math.min(25, Number(body?.batch_limit) || 25));
    const summaries: unknown[] = [];

    for (const campaign of campaigns ?? []) {
      await admin.from("whatsapp_marketing_campaigns")
        .update({
          status: "processing",
          started_at: campaign.started_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign.id)
        .in("status", ["scheduled", "processing"]);
      const { data: recipients, error: recipientsError } = await admin
        .from("whatsapp_marketing_campaign_recipients")
        .select("*")
        .eq("campaign_id", campaign.id)
        .eq("status", "queued")
        .lte("next_attempt_at", now)
        .order("created_at")
        .limit(batchLimit);
      if (recipientsError) throw recipientsError;

      const batch = await runConservativeCampaignBatch({
        recipients: recipients ?? [],
        paceMs: 1_200,
        send: async (recipient: any) => {
          const currentAttempts = Number(recipient.attempts || 0) + 1;
          await admin.from("whatsapp_marketing_campaign_recipients")
            .update({ status: "sending", attempts: currentAttempts, updated_at: new Date().toISOString() })
            .eq("id", recipient.id)
            .eq("status", "queued");
          if (!await stillAuthorized(admin, campaign.user_id, recipient.phone)) {
            await admin.from("whatsapp_marketing_campaign_recipients")
              .update({
                status: "skipped",
                failure_reason: "opt_in_ausente_ou_descadastrado",
                updated_at: new Date().toISOString(),
              })
              .eq("id", recipient.id);
            return { success: false, category: "numero", reason: "opt_in_ausente_ou_descadastrado" };
          }

          const insideWindow = await hasRecentInbound(admin, campaign.user_id, recipient.phone);
          const sendMode = insideWindow ? "session" : "template";
          if (!insideWindow && !campaign.template_id) {
            await admin.from("whatsapp_marketing_campaign_recipients")
              .update({
                status: "failed",
                send_mode: sendMode,
                failure_reason: "template_aprovado_obrigatorio_fora_da_janela",
                updated_at: new Date().toISOString(),
              })
              .eq("id", recipient.id);
            return { success: false, category: "template", reason: "template_aprovado_obrigatorio_fora_da_janela" };
          }

          let result: any = null;
          let invokeError: any = null;
          if (insideWindow) {
            const invoked = await admin.functions.invoke("whatsapp-send-message", {
              body: {
                user_id: campaign.user_id,
                to: recipient.phone,
                message: campaign.message,
                image_url: campaign.image_url || undefined,
              },
            });
            result = invoked.data;
            invokeError = invoked.error;
          } else {
            const invoked = await admin.functions.invoke("whatsapp-cloud-send-template", {
              body: {
                user_id: campaign.user_id,
                to: recipient.phone,
                template_id: campaign.template_id,
                variaveis: variablesForRecipient(campaign.template_variables, recipient.contact_name),
                campanha_id: campaign.id,
                tipo: "ia_marketing",
                imagem_url: campaign.image_url || undefined,
              },
            });
            result = invoked.data;
            invokeError = invoked.error;
          }
          const success = !invokeError && result?.success === true && result?.message_id;
          const reason = String(
            result?.motivo || invokeError?.message || (success ? "" : "envio_sem_comprovante"),
          ).slice(0, 1000);
          const category = String(result?.categoria || (invokeError ? "rede" : "")).toLowerCase();
          if (success) {
            await admin.from("whatsapp_marketing_campaign_recipients")
              .update({
                status: "sent",
                send_mode: sendMode,
                message_id: result.message_id,
                failure_reason: null,
                sent_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", recipient.id);
            if (insideWindow) {
              await admin.from("historico_envios").insert({
                user_id: campaign.user_id,
                campanha_id: campaign.id,
                whatsapp: recipient.phone,
                tipo: "ia_marketing",
                mensagem: campaign.message,
                sucesso: true,
                envio_dia_sp: dateKeySP(),
                canal: "meta_cloud",
                message_id: result.message_id,
                delivery_status: "sent",
              });
            }
            return { success: true };
          }
          const retryable = category === "rede" && currentAttempts < MAX_RECIPIENT_ATTEMPTS;
          await admin.from("whatsapp_marketing_campaign_recipients")
            .update({
              status: retryable ? "queued" : "failed",
              send_mode: sendMode,
              failure_reason: reason,
              next_attempt_at: retryable
                ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
                : recipient.next_attempt_at,
              updated_at: new Date().toISOString(),
            })
            .eq("id", recipient.id);
          if (insideWindow) {
            await admin.from("historico_envios").insert({
              user_id: campaign.user_id,
              campanha_id: campaign.id,
              whatsapp: recipient.phone,
              tipo: "ia_marketing",
              mensagem: campaign.message,
              sucesso: false,
              erro: reason,
              envio_dia_sp: dateKeySP(),
              canal: "meta_cloud",
            });
          }
          return { success: false, category, reason };
        },
      });

      if (batch.stoppedBy) {
        await admin.from("whatsapp_marketing_campaigns")
          .update({
            status: "paused",
            stop_reason: batch.stoppedBy,
            updated_at: new Date().toISOString(),
          })
          .eq("id", campaign.id);
      }
      await refreshCampaignCounts(admin, campaign.id);
      summaries.push({ campaign_id: campaign.id, ...batch });
    }

    return json({ success: true, campaigns: summaries });
  } catch (error) {
    console.error("[whatsapp-campanha-processar]", error);
    return json({ success: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
