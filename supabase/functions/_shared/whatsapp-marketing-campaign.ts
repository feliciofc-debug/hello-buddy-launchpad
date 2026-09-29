export const WHATSAPP_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_CAMPAIGN_PACE_MS = 1_200;
export const MAX_RECIPIENT_ATTEMPTS = 2;

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

export function normalizeCampaignPhone(raw: string): string | null {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export function filterAuthorizedAudience(rows: AudienceRow[]): EligibleAudience {
  const grouped = new Map<string, { name: string | null; confirmed: boolean; refused: boolean; count: number }>();
  let invalid = 0;
  for (const row of rows) {
    const phone = normalizeCampaignPhone(row.phone);
    if (!phone) {
      invalid++;
      continue;
    }
    const current = grouped.get(phone) ?? {
      name: null,
      confirmed: false,
      refused: false,
      count: 0,
    };
    current.count++;
    current.name ||= String(row.name || "").trim() || null;
    current.confirmed ||= row.optInStatus === "confirmado";
    current.refused ||= row.optInStatus === "recusado";
    grouped.set(phone, current);
  }
  const recipients: EligibleAudience["recipients"] = [];
  let ignoredWithoutOptIn = invalid;
  let duplicates = 0;
  for (const [phone, entry] of grouped) {
    duplicates += Math.max(0, entry.count - 1);
    if (!entry.confirmed || entry.refused) {
      ignoredWithoutOptIn++;
      continue;
    }
    recipients.push({ phone, name: entry.name });
  }
  return { recipients, ignoredWithoutOptIn, duplicates };
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
