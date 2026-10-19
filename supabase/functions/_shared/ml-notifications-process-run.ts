import { ML_API_BASE } from "./ml-config.ts";
import {
  buildMlLeadOwnerMessage,
  sendMlOwnerNotify,
  vehicleTitleFromRow,
} from "./ml-owner-notify.ts";
import { mlGetItem } from "./ml-api.ts";
import { runMlReconcile, runMlVehicleSync } from "./ml-vehicle-sync-run.ts";
import { getMlAccessTokenForMlUser, getMlAccessTokenForUser } from "./ml-token.ts";
import { assertMlItemOwnedByAmz } from "./ml-portal-ownership.ts";
import {
  mlLeadOrigemFromPortal,
  shouldNotifyMlLeadOnWhatsApp,
} from "./ml-lead-notify-policy.ts";

const RECONCILE_KEY = "last_ml_reconcile_at";
const RECONCILE_MS = 30 * 60 * 1000;

async function shouldRunReconcile(sb: any, now: Date): Promise<boolean> {
  const { data } = await sb.from("ml_crm_tick_meta").select("value").eq("key", RECONCILE_KEY).maybeSingle();
  if (!data?.value) return true;
  return now.getTime() - Date.parse(data.value) >= RECONCILE_MS;
}

async function markReconcile(sb: any, now: Date): Promise<void> {
  await sb.from("ml_crm_tick_meta").upsert({
    key: RECONCILE_KEY,
    value: now.toISOString(),
    updated_at: now.toISOString(),
  }, { onConflict: "key" });
}

async function fetchLeadDetail(accessToken: string, leadId: string, contactType?: string) {
  if (contactType === "contact_request" || contactType === "reservation") {
    const res = await fetch(`${ML_API_BASE}/leads/${leadId}/details`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return await res.json();
  }
  const res = await fetch(`${ML_API_BASE}/vis/leads/${leadId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return await res.json();
}

async function processVisLead(
  sb: any,
  env: { supabaseUrl: string; serviceKey: string },
  userId: string,
  accessToken: string,
  leadId: string,
  actions?: string[],
): Promise<void> {
  const contactType = actions?.[0] ?? "whatsapp";
  const detail = await fetchLeadDetail(accessToken, leadId, contactType);
  if (!detail) return;

  const itemId = String(detail.item_id ?? "");
  const { data: portal } = await sb.from("veiculos_portais")
    .select("veiculo_id, permalink")
    .eq("user_id", userId)
    .eq("portal", "mercadolivre")
    .eq("external_id", itemId)
    .maybeSingle();

  const hasAmzPortal = !!portal?.veiculo_id;
  const origem = mlLeadOrigemFromPortal(hasAmzPortal);

  const { data: cfg } = await sb.from("empresa_config")
    .select("ml_whatsapp_leads_all_ads")
    .eq("user_id", userId)
    .maybeSingle();
  const notifyWhatsapp = shouldNotifyMlLeadOnWhatsApp({
    hasAmzPortal,
    whatsappLeadsAllAds: cfg?.ml_whatsapp_leads_all_ads === true,
  });

  let vehicleTitle = "veículo";
  if (portal?.veiculo_id) {
    const { data: v } = await sb.from("veiculos_estoque").select("*").eq("id", portal.veiculo_id).maybeSingle();
    if (v) vehicleTitle = vehicleTitleFromRow(v);
  }

  const mlLeadId = String(detail.id ?? leadId);
  const { data: existing } = await sb.from("ml_leads")
    .select("id, owner_notified_at")
    .eq("user_id", userId)
    .eq("ml_lead_id", mlLeadId)
    .maybeSingle();
  if (existing?.owner_notified_at) return;

  const isGuest = !detail.name && !detail.buyer_id;
  const msg = buildMlLeadOwnerMessage({
    buyerName: detail.name,
    contactType: String(detail.contact_type ?? contactType),
    vehicleTitle,
    permalink: portal?.permalink,
    buyerPhone: detail.phone,
    buyerEmail: detail.email,
    isGuest,
  });

  await sb.from("ml_leads").upsert({
    user_id: userId,
    ml_lead_id: mlLeadId,
    item_id: itemId,
    veiculo_id: portal?.veiculo_id ?? null,
    origem,
    contact_type: String(detail.contact_type ?? contactType),
    buyer_name: detail.name ?? null,
    buyer_phone: detail.phone ?? null,
    buyer_email: detail.email ?? null,
    is_guest: isGuest,
    permalink: portal?.permalink ?? detail.permalink ?? null,
    raw: detail,
  }, { onConflict: "user_id,ml_lead_id" });

  if (!notifyWhatsapp) return;

  const ok = await sendMlOwnerNotify(sb, {
    supabaseUrl: env.supabaseUrl,
    serviceKey: env.serviceKey,
    userId,
    message: msg,
  });
  if (ok) {
    await sb.from("ml_leads").update({ owner_notified_at: new Date().toISOString() })
      .eq("user_id", userId).eq("ml_lead_id", mlLeadId);
  }
}

async function processQuestion(
  sb: any,
  userId: string,
  accessToken: string,
  questionId: string,
): Promise<void> {
  const res = await fetch(`${ML_API_BASE}/questions/${questionId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return;
  const q = await res.json();
  const itemId = String(q.item_id ?? "");
  const { data: portal } = await sb.from("veiculos_portais")
    .select("veiculo_id, permalink")
    .eq("user_id", userId)
    .eq("external_id", itemId)
    .maybeSingle();
  await sb.from("ml_questions").upsert({
    user_id: userId,
    question_id: Number(q.id),
    item_id: itemId,
    veiculo_id: portal?.veiculo_id ?? null,
    text: String(q.text ?? ""),
    status: String(q.status ?? ""),
    permalink: portal?.permalink ?? null,
    raw: q,
  }, { onConflict: "user_id,question_id" });
}

async function processItemTopic(
  sb: any,
  userId: string,
  accessToken: string,
  itemId: string,
): Promise<void> {
  if (!(await assertMlItemOwnedByAmz(sb, userId, itemId))) return;
  const item = await mlGetItem(accessToken, itemId);
  if (!item) return;
  const st = String(item.status ?? "active");
  let portalStatus = "published";
  if (st === "closed") portalStatus = "closed";
  else if (st === "paused") portalStatus = "paused";
  await sb.from("veiculos_portais").update({
    status: portalStatus,
    permalink: item.permalink ?? undefined,
    last_synced_at: new Date().toISOString(),
  }).eq("user_id", userId).eq("portal", "mercadolivre").eq("external_id", itemId);
}

export async function runMlNotificationsProcess(
  sb: any,
  env: { supabaseUrl: string; serviceKey: string },
): Promise<{ processed: number; reconcile: boolean }> {
  const now = new Date();
  let reconcile = false;
  if (await shouldRunReconcile(sb, now)) {
    await runMlReconcile(sb, env);
    await markReconcile(sb, now);
    reconcile = true;
  }

  const { data: batch } = await sb.from("ml_notification_inbox")
    .update({ status: "processing" })
    .eq("status", "pending")
    .select("*")
    .limit(30);

  let processed = 0;
  for (const row of batch ?? []) {
    try {
      const userId = row.user_id as string;
      const { accessToken } = await getMlAccessTokenForUser(sb, userId);
      const topic = String(row.topic);
      const resource = String(row.resource);
      const payload = row.payload as { actions?: string[] };

      if (topic === "vis_leads") {
        const leadId = resource.split("/").pop()!;
        await processVisLead(sb, env, userId, accessToken, leadId, payload?.actions);
      } else if (topic === "questions") {
        const qid = resource.split("/").pop()!;
        await processQuestion(sb, userId, accessToken, qid);
      } else if (topic === "items") {
        const iid = resource.replace(/^\/items\//, "").split("/")[0];
        await processItemTopic(sb, userId, accessToken, iid);
      }
      // messages / quotations: apenas registrado na inbox

      await sb.from("ml_notification_inbox").update({
        status: "done",
        processed_at: new Date().toISOString(),
      }).eq("id", row.id);
      processed += 1;
    } catch (e) {
      await sb.from("ml_notification_inbox").update({
        status: "failed",
        attempts: Number(row.attempts ?? 0) + 1,
        last_error: (e as Error).message.slice(0, 500),
      }).eq("id", row.id);
    }
  }
  return { processed, reconcile };
}

export async function resolveUserIdForMlNotification(
  sb: any,
  mlUserId: number,
): Promise<string | null> {
  const { data } = await sb.from("ml_contas")
    .select("user_id, status")
    .eq("ml_user_id", mlUserId)
    .maybeSingle();
  if (!data || data.status === "revoked") return null;
  return data.user_id as string;
}
