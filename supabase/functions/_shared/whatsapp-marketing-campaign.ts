import { brazilianPhoneKey } from "./owner-phone.ts";

export const WHATSAPP_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_CAMPAIGN_PACE_MS = 1_200;
export const MAX_RECIPIENT_ATTEMPTS = 2;
export const STALE_SENDING_MS = 15 * 60 * 1000;
export const RATE_LIMIT_RESUME_MS = 30 * 60 * 1000;

export type AudienceRow = {
  phone: string;
  name?: string | null;
  optInStatus?: string | null;
};

export type EligibleAudience = {
  recipients: Array<{ phone: string; name: string | null }>;
  ignoredWithoutOptIn: number;
  duplicates: number;
};

export function campaignTenantId(
  authenticatedUserId: string,
  _untrustedRequestedUserId?: unknown,
): string {
  return authenticatedUserId;
}

export function normalizeCampaignPhone(raw: string): string | null {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export function filterAuthorizedAudience(rows: AudienceRow[]): EligibleAudience {
  const grouped = new Map<string, {
    phone: string;
    name: string | null;
    confirmed: boolean;
    refused: boolean;
    count: number;
  }>();
  let invalid = 0;
  for (const row of rows) {
    const phone = normalizeCampaignPhone(row.phone);
    if (!phone) {
      invalid++;
      continue;
    }
    const phoneKey = brazilianPhoneKey(phone) || phone;
    const current = grouped.get(phoneKey) ?? {
      phone,
      name: null,
      confirmed: false,
      refused: false,
      count: 0,
    };
    current.count++;
    current.name ||= String(row.name || "").trim() || null;
    if (phone.length > current.phone.length) current.phone = phone;
    current.confirmed ||= row.optInStatus === "confirmado";
    current.refused ||= row.optInStatus === "recusado";
    grouped.set(phoneKey, current);
  }
  const recipients: EligibleAudience["recipients"] = [];
  let ignoredWithoutOptIn = invalid;
  let duplicates = 0;
  for (const entry of grouped.values()) {
    duplicates += Math.max(0, entry.count - 1);
    if (!entry.confirmed || entry.refused) {
      ignoredWithoutOptIn++;
      continue;
    }
    recipients.push({ phone: entry.phone, name: entry.name });
  }
  return { recipients, ignoredWithoutOptIn, duplicates };
}

export function filterSelectedAuthorizedAudience(
  rows: AudienceRow[],
  selectedPhones: unknown[],
): EligibleAudience {
  const selected = new Set<string>();
  for (const raw of selectedPhones) {
    const phone = normalizeCampaignPhone(String(raw ?? ""));
    if (!phone) throw new Error("telefone_selecionado_invalido");
    selected.add(brazilianPhoneKey(phone) || phone);
  }
  if (!selected.size) {
    return { recipients: [], ignoredWithoutOptIn: 0, duplicates: 0 };
  }

  const memberPhones = new Set(
    rows
      .map((row) => normalizeCampaignPhone(row.phone))
      .map((phone) => phone ? (brazilianPhoneKey(phone) || phone) : null)
      .filter((phone): phone is string => Boolean(phone)),
  );
  for (const phone of selected) {
    if (!memberPhones.has(phone)) {
      throw new Error("contato_nao_pertence_a_lista");
    }
  }

  const selectedRows = rows.filter((row) => {
    const phone = normalizeCampaignPhone(row.phone);
    return Boolean(phone && selected.has(brazilianPhoneKey(phone) || phone));
  });
  const eligible = filterAuthorizedAudience(selectedRows);
  const eligiblePhones = new Set(
    eligible.recipients.map((recipient) =>
      brazilianPhoneKey(recipient.phone) || recipient.phone
    ),
  );
  for (const phone of selected) {
    if (!eligiblePhones.has(phone)) {
      throw new Error("contato_sem_autorizacao");
    }
  }
  return eligible;
}

export function isInsideWhatsAppWindow(
  lastInboundAt: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!lastInboundAt) return false;
  const timestamp = new Date(lastInboundAt).getTime();
  const age = now - timestamp;
  return Number.isFinite(age) && age >= 0 && age < WHATSAPP_SESSION_WINDOW_MS;
}

export function isCampaignDue(
  scheduledAt: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!scheduledAt) return false;
  const timestamp = new Date(scheduledAt).getTime();
  return Number.isFinite(timestamp) && timestamp <= now;
}

export function templateSupportsImage(header: unknown): boolean {
  if (!header) return false;
  const serialized = typeof header === "string" ? header : JSON.stringify(header);
  return /(?:image|imagem)/i.test(serialized);
}

export function templateMatchesCampaignMedia(
  header: unknown,
  hasImage: boolean,
): boolean {
  return templateSupportsImage(header) === hasImage;
}

export type CampaignDeliveryStatus =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

const DELIVERY_RANK: Partial<Record<CampaignDeliveryStatus, number>> = {
  queued: 0,
  sending: 1,
  sent: 2,
  delivered: 3,
  read: 4,
};

export function nextCampaignDeliveryStatus(
  current: string | null | undefined,
  incoming: CampaignDeliveryStatus,
): CampaignDeliveryStatus | null {
  const currentStatus = String(current || "") as CampaignDeliveryStatus;
  if (incoming === "failed") {
    return !currentStatus || ["queued", "sending", "sent"].includes(currentStatus)
      ? "failed"
      : null;
  }
  if (currentStatus === "failed") return null;
  if (currentStatus && DELIVERY_RANK[currentStatus] === undefined) return null;
  const currentRank = DELIVERY_RANK[currentStatus] ?? -1;
  const incomingRank = DELIVERY_RANK[incoming] ?? -1;
  return incomingRank >= currentRank ? incoming : null;
}

export function isRecipientSendingStale(
  updatedAt: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!updatedAt) return false;
  const timestamp = new Date(updatedAt).getTime();
  return Number.isFinite(timestamp)
    && timestamp <= now - STALE_SENDING_MS;
}

export function isRateLimitAutoResumeDue(
  stopReason: string | null | undefined,
  updatedAt: string | null | undefined,
  now = Date.now(),
): boolean {
  if (stopReason !== "rate_limit" || !updatedAt) return false;
  const timestamp = new Date(updatedAt).getTime();
  return Number.isFinite(timestamp)
    && timestamp <= now - RATE_LIMIT_RESUME_MS;
}

export async function claimQueuedCampaignRecipient(
  admin: any,
  recipientId: string,
  attempts: number,
  nowIso = new Date().toISOString(),
): Promise<boolean> {
  const { data, error } = await admin
    .from("whatsapp_marketing_campaign_recipients")
    .update({
      status: "sending",
      attempts,
      updated_at: nowIso,
    })
    .eq("id", recipientId)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.id);
}

export function classifyCampaignStop(input: {
  category?: string | null;
  reason?: string | null;
}): "rate_limit" | "template_paused" | "quality" | "structural" | null {
  const category = String(input.category || "").toLowerCase();
  const reason = String(input.reason || "").toLowerCase();
  if (category === "rate_limit" || /\b429\b|rate.?limit|too many/.test(reason)) return "rate_limit";
  if (category === "quality" || /quality|qualidade|131048|131049/.test(reason)) return "quality";
  if (
    category === "template"
    && /paus|disabled|132015|not approved|nao_aprovado|não aprovado/.test(reason)
  ) return "template_paused";
  if (["token", "template", "config"].includes(category)) return "structural";
  return null;
}

export type BatchSendResult = {
  success: boolean;
  skipped?: boolean;
  category?: string | null;
  reason?: string | null;
};

export async function runConservativeCampaignBatch<T>(input: {
  recipients: T[];
  send: (recipient: T, index: number) => Promise<BatchSendResult>;
  paceMs?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{
  processed: number;
  sent: number;
  failed: number;
  stoppedBy: ReturnType<typeof classifyCampaignStop>;
}> {
  const sleep = input.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let sent = 0;
  let failed = 0;
  let processed = 0;
  let stoppedBy: ReturnType<typeof classifyCampaignStop> = null;
  for (let index = 0; index < input.recipients.length; index++) {
    const result = await input.send(input.recipients[index], index);
    if (result.skipped) continue;
    processed++;
    if (result.success) sent++;
    else failed++;
    stoppedBy = classifyCampaignStop({
      category: result.category,
      reason: result.reason,
    });
    if (stoppedBy) break;
    if (index < input.recipients.length - 1) {
      await sleep(Math.max(DEFAULT_CAMPAIGN_PACE_MS, input.paceMs ?? DEFAULT_CAMPAIGN_PACE_MS));
    }
  }
  return { processed, sent, failed, stoppedBy };
}
