import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  claimQueuedCampaignRecipient,
  classifyCampaignStop,
  MAX_RECIPIENT_ATTEMPTS,
  normalizeCampaignPhone,
  RATE_LIMIT_RESUME_MS,
  runConservativeCampaignBatch,
  STALE_SENDING_MS,
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

const PAGE_SIZE = 1_000;
const IN_FILTER_CHUNK = 150;

function chunks<T>(values: T[], size = IN_FILTER_CHUNK): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function loadAllPages<T>(
  load: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0;; from += PAGE_SIZE) {
    const { data, error } = await load(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
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
  const lists = await loadAllPages<any>((from, to) =>
    admin.from("pj_listas_categoria")
      .select("id")
      .eq("user_id", userId)
      .range(from, to)
  );
  const ids = lists.map((row: any) => row.id);
  if (!ids.length) return false;
  const suffix = phone.slice(-8);
  const formattedSuffix = `${suffix.slice(0, 4)}-${suffix.slice(4)}`;
  const members: any[] = [];
  for (const listChunk of chunks(ids)) {
    members.push(...await loadAllPages<any>((from, to) =>
      admin.from("pj_lista_membros")
        .select("telefone, opt_in_status")
        .in("lista_id", listChunk)
        .or(
          `telefone.ilike.%${suffix}%,telefone.ilike.%${formattedSuffix}%`,
        )
        .range(from, to)
    ));
  }
  let confirmed = false;
  let refused = false;
  for (const member of members) {
    if (normalizeCampaignPhone(member.telefone) !== phone) continue;
    confirmed ||= member.opt_in_status === "confirmado";
    refused ||= member.opt_in_status === "recusado";
  }
  return confirmed && !refused;
}

async function hasRecentInbound(admin: any, userId: string, phone: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const variants = [phone, phone.startsWith("55") ? phone.slice(2) : phone];
  for (const phoneChunk of chunks(variants)) {
    const { data, error } = await admin
      .from("whatsapp_cloud_inbound_queue")
      .select("id")
      .eq("user_id", userId)
      .in("from_number", phoneChunk)
      .gte("created_at", cutoff)
      .limit(1);
    if (error) throw error;
    if (data?.length) return true;
  }
  return false;
}

function variablesForRecipient(values: unknown, name: string | null): string[] {
  return (Array.isArray(values) ? values : []).map((value) =>
    String(value ?? "")
      .replace(/\{\{\s*nome\s*\}\}/gi, name || "Cliente")
      .slice(0, 1024)
  );
}

async function refreshCampaignCounts(admin: any, campaignId: string): Promise<void> {
  const rows = await loadAllPages<any>((from, to) =>
    admin.from("whatsapp_marketing_campaign_recipients")
      .select("status")
      .eq("campaign_id", campaignId)
      .range(from, to)
  );
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
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

async function failStaleSendingRecipients(
  admin: any,
  nowMs = Date.now(),
): Promise<void> {
  const cutoff = new Date(nowMs - STALE_SENDING_MS).toISOString();
  const stale = await loadAllPages<any>((from, to) =>
    admin.from("whatsapp_marketing_campaign_recipients")
      .select("id, campaign_id")
      .eq("status", "sending")
      .lt("updated_at", cutoff)
      .range(from, to)
  );
  if (!stale.length) return;
  const now = new Date(nowMs).toISOString();
  for (const staleChunk of chunks(stale)) {
    const { error } = await admin
      .from("whatsapp_marketing_campaign_recipients")
      .update({
        status: "failed",
        failure_reason: "estado_incerto_sem_comprovante",
        updated_at: now,
      })
      .in("id", staleChunk.map((recipient) => recipient.id))
      .eq("status", "sending")
      .lt("updated_at", cutoff);
    if (error) throw error;
  }
  for (
    const campaignId of new Set(
      stale.map((recipient) => String(recipient.campaign_id)),
    )
  ) {
    await refreshCampaignCounts(admin, campaignId);
  }
}

async function resumeRateLimitedCampaigns(
  admin: any,
  nowMs = Date.now(),
): Promise<void> {
  const cutoff = new Date(nowMs - RATE_LIMIT_RESUME_MS).toISOString();
  const campaigns = await loadAllPages<any>((from, to) =>
    admin.from("whatsapp_marketing_campaigns")
      .select("id")
      .eq("status", "paused")
      .eq("stop_reason", "rate_limit")
      .lte("updated_at", cutoff)
      .range(from, to)
  );
  const now = new Date(nowMs).toISOString();
  for (const campaign of campaigns) {
    const { data: resumed, error } = await admin
      .from("whatsapp_marketing_campaigns")
      .update({
        status: "scheduled",
        stop_reason: null,
        scheduled_at: now,
        updated_at: now,
      })
      .eq("id", campaign.id)
      .eq("status", "paused")
      .eq("stop_reason", "rate_limit")
      .lte("updated_at", cutoff)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!resumed) continue;
    await admin.from("whatsapp_marketing_campaign_recipients")
      .update({ next_attempt_at: now, updated_at: now })
      .eq("campaign_id", campaign.id)
      .eq("status", "queued");
  }
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
    await failStaleSendingRecipients(admin);
    await resumeRateLimitedCampaigns(admin);
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
          const claimed = await claimQueuedCampaignRecipient(
            admin,
            recipient.id,
            currentAttempts,
          );
          if (!claimed) {
            return {
              success: false,
              skipped: true,
              category: "claim_skipped",
            };
          }
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
          const stopReason = classifyCampaignStop({ category, reason });
          const rateLimited = stopReason === "rate_limit";
          const retryable = category === "rede"
            && currentAttempts < MAX_RECIPIENT_ATTEMPTS;
          await admin.from("whatsapp_marketing_campaign_recipients")
            .update({
              status: rateLimited || retryable ? "queued" : "failed",
              send_mode: sendMode,
              failure_reason: reason,
              next_attempt_at: rateLimited
                ? new Date(Date.now() + RATE_LIMIT_RESUME_MS).toISOString()
                : retryable
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
        const pausedAt = new Date();
        await admin.from("whatsapp_marketing_campaigns")
          .update({
            status: "paused",
            stop_reason: batch.stoppedBy,
            updated_at: pausedAt.toISOString(),
          })
          .eq("id", campaign.id);
        if (batch.stoppedBy === "rate_limit") {
          await admin.from("whatsapp_marketing_campaign_recipients")
            .update({
              next_attempt_at: new Date(
                pausedAt.getTime() + RATE_LIMIT_RESUME_MS,
              ).toISOString(),
              updated_at: pausedAt.toISOString(),
            })
            .eq("campaign_id", campaign.id)
            .eq("status", "queued");
        }
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
