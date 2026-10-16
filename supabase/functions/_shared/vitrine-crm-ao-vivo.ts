import { normalizePhoneBR } from "./cloud-log.ts";
import { formatRecadoClienteLine } from "./vehicle-stock-cliente-nome.ts";
import { sendVitrineCrmOwnerText } from "./vitrine-crm-owner-notify.ts";
import type { VitrineEvento } from "./vitrine-eventos.ts";
import { VITRINE_WARM_EVENTS } from "./vitrine-eventos.ts";

export const LEAD_AO_VIVO_DEDUP_MS = 30 * 60 * 1000;

export type VitrineCrmNotifyEnv = {
  supabaseUrl: string;
  serviceKey: string;
};

export function buildLeadAoVivoOwnerMessage(input: {
  contactName: string;
  vehicleLabel: string;
  fromNumber: string;
}): string {
  const perfil = String(input.contactName || "").trim() || "Cliente";
  const veiculo = String(input.vehicleLabel || "").trim() || "veículo";
  const clienteNome = perfil;
  return [
    `👀 Agora: ${perfil} está vendo o ${veiculo}.`,
    formatRecadoClienteLine({
      clienteNome,
      contactName: input.contactName,
      fromNumber: input.fromNumber,
    }),
  ].join("\n");
}

export function shouldScheduleLeadMornoForWarmEvent(input: {
  evento: VitrineEvento;
  leadMornoAtivo: boolean;
  leadAoVivo: boolean;
}): boolean {
  return VITRINE_WARM_EVENTS.has(input.evento) &&
    input.leadMornoAtivo &&
    !input.leadAoVivo;
}

export async function claimLeadAoVivoDedup(
  sb: { from: (t: string) => unknown },
  input: {
    userId: string;
    contactNumber: string;
    veiculoId: string;
    nowMs?: number;
  },
): Promise<boolean> {
  const phone = normalizePhoneBR(input.contactNumber);
  if (!phone) return false;
  const nowMs = input.nowMs ?? Date.now();
  const since = new Date(nowMs - LEAD_AO_VIVO_DEDUP_MS).toISOString();
  const client = sb as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (a: string, v: string) => {
          eq: (b: string, w: string) => {
            eq: (c2: string, z: string) => {
              maybeSingle: () => Promise<{ data: { sent_at: string } | null }>;
            };
          };
        };
      };
      upsert: (
        row: Record<string, unknown>,
        opts?: { onConflict?: string },
      ) => Promise<{ error?: { message: string } | null }>;
    };
  };
  const { data: prev } = await client.from("vitrine_lead_ao_vivo_enviados")
    .select("sent_at")
    .eq("user_id", input.userId)
    .eq("contact_number", phone)
    .eq("veiculo_id", input.veiculoId)
    .maybeSingle();
  if (prev?.sent_at && prev.sent_at >= since) return false;
  const sentAt = new Date(nowMs).toISOString();
  const { error } = await client.from("vitrine_lead_ao_vivo_enviados").upsert({
    user_id: input.userId,
    contact_number: phone,
    veiculo_id: input.veiculoId,
    sent_at: sentAt,
  }, { onConflict: "user_id,contact_number,veiculo_id" });
  if (error) return false;
  return true;
}

export async function notifyLeadAoVivoIfDue(
  sb: { from: (t: string) => unknown },
  env: VitrineCrmNotifyEnv,
  input: {
    userId: string;
    contactNumber: string;
    contactName?: string | null;
    evento: VitrineEvento;
    veiculoId: string;
    vehicleLabel?: string | null;
  },
  deps?: {
    sendOwner?: typeof sendVitrineCrmOwnerText;
    claimDedup?: typeof claimLeadAoVivoDedup;
  },
): Promise<boolean> {
  if (!VITRINE_WARM_EVENTS.has(input.evento)) return false;
  try {
    const claim = deps?.claimDedup ?? claimLeadAoVivoDedup;
    const okClaim = await claim(sb, {
      userId: input.userId,
      contactNumber: input.contactNumber,
      veiculoId: input.veiculoId,
    });
    if (!okClaim) return false;
    const phone = normalizePhoneBR(input.contactNumber);
    if (!phone) return false;
    const contactName = String(input.contactName || "").trim() || "Cliente";
    const message = buildLeadAoVivoOwnerMessage({
      contactName,
      vehicleLabel: String(input.vehicleLabel || "").trim() || "veículo",
      fromNumber: phone,
    });
    const sendOwner = deps?.sendOwner ?? sendVitrineCrmOwnerText;
    return await sendOwner(sb, {
      supabaseUrl: env.supabaseUrl,
      serviceKey: env.serviceKey,
      userId: input.userId,
      message,
    });
  } catch (e) {
    console.warn("[vitrine-crm] ao-vivo:", (e as Error).message);
    return false;
  }
}
