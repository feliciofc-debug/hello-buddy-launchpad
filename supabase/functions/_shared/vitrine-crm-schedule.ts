import { normalizePhoneBR } from "./cloud-log.ts";
import {
  insertVitrineEvento,
  VITRINE_CONVERSION_EVENTS,
  VITRINE_WARM_EVENTS,
  type VitrineEvento,
} from "./vitrine-eventos.ts";
import {
  notifyLeadAoVivoIfDue,
  shouldScheduleLeadMornoForWarmEvent,
  type VitrineCrmNotifyEnv,
} from "./vitrine-crm-ao-vivo.ts";
import { loadVitrineCrmTenantConfig } from "./vitrine-crm-config.ts";

const LEAD_MORNO_DELAY_MS = 10 * 60 * 1000;
const RETOMADA_DELAY_MS = 2 * 60 * 60 * 1000;

export async function handleVitrineCrmAfterEvent(
  sb: { from: (t: string) => unknown },
  input: {
    userId: string;
    contactNumber: string;
    contactName?: string | null;
    evento: VitrineEvento;
    veiculoId?: string | null;
    vehicleLabel?: string | null;
    notifyEnv?: VitrineCrmNotifyEnv;
  },
): Promise<void> {
  try {
    await insertVitrineEvento(sb, {
      userId: input.userId,
      contactNumber: input.contactNumber,
      evento: input.evento,
      veiculoId: input.veiculoId,
    });

    const cfg = await loadVitrineCrmTenantConfig(sb, input.userId);
    if (!cfg.usesVehicleStock) return;

    const phone = normalizePhoneBR(input.contactNumber);
    if (!phone) return;
    const now = new Date().toISOString();
    const runLead = new Date(Date.now() + LEAD_MORNO_DELAY_MS).toISOString();
    const runRetomada = new Date(Date.now() + RETOMADA_DELAY_MS).toISOString();
    const name = String(input.contactName || "").trim() || null;
    const client = sb as {
      from: (t: string) => {
        upsert: (row: Record<string, unknown>, opts?: { onConflict?: string }) => Promise<{ error?: { message: string } | null }>;
        update: (row: Record<string, unknown>) => {
          eq: (c: string, v: string) => {
            eq: (c2: string, v2: string) => Promise<{ error?: { message: string } | null }>;
          };
        };
      };
    };

    if (shouldScheduleLeadMornoForWarmEvent({
      evento: input.evento,
      leadMornoAtivo: cfg.leadMornoAtivo,
      leadAoVivo: cfg.leadAoVivo,
    })) {
      await client.from("vitrine_lead_morno_agenda").upsert({
        user_id: input.userId,
        contact_number: phone,
        contact_name: name,
        run_at: runLead,
        status: "pending",
        updated_at: now,
      }, { onConflict: "user_id,contact_number" });
    }

    if (
      cfg.leadAoVivo &&
      VITRINE_WARM_EVENTS.has(input.evento) &&
      input.veiculoId &&
      input.notifyEnv
    ) {
      void notifyLeadAoVivoIfDue(sb, input.notifyEnv, {
        userId: input.userId,
        contactNumber: input.contactNumber,
        contactName: input.contactName,
        evento: input.evento,
        veiculoId: input.veiculoId,
        vehicleLabel: input.vehicleLabel,
      }).catch((e) => console.warn("[vitrine-crm] ao-vivo async:", (e as Error).message));
    }

    if (
      VITRINE_WARM_EVENTS.has(input.evento) &&
      cfg.retomadaAtiva &&
      input.veiculoId
    ) {
      await client.from("vitrine_retomada_agenda").upsert({
        user_id: input.userId,
        contact_number: phone,
        veiculo_id: input.veiculoId,
        contact_name: name,
        vehicle_label: input.vehicleLabel ?? null,
        run_at: runRetomada,
        status: "pending",
        updated_at: now,
      }, { onConflict: "user_id,contact_number,veiculo_id" });
    }

    if (VITRINE_CONVERSION_EVENTS.has(input.evento)) {
      await client.from("vitrine_lead_morno_agenda").upsert({
        user_id: input.userId,
        contact_number: phone,
        contact_name: name,
        run_at: runLead,
        status: "cancelled",
        updated_at: now,
      }, { onConflict: "user_id,contact_number" });

      await client.from("vitrine_retomada_agenda").update({
        status: "cancelled",
        updated_at: now,
      }).eq("user_id", input.userId).eq("contact_number", phone);
    }
  } catch (e) {
    console.warn("[vitrine-crm] after-event:", (e as Error).message);
  }
}

/** Opt-out de retomada — só frases exatas (comando inteiro). */
export async function setVitrineRetomadaOptOut(
  sb: { from: (t: string) => unknown },
  userId: string,
  contactNumber: string,
): Promise<void> {
  const phone = normalizePhoneBR(contactNumber);
  if (!phone) return;
  const client = sb as {
    from: (t: string) => {
      upsert: (row: Record<string, unknown>, opts?: { onConflict?: string }) => Promise<unknown>;
      update: (row: Record<string, unknown>) => {
        eq: (c: string, v: string) => {
          eq: (c2: string, v2: string) => Promise<unknown>;
        };
      };
    };
  };
  await client.from("vitrine_contato_prefs").upsert({
    user_id: userId,
    contact_number: phone,
    retomada_opt_out: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,contact_number" });
  await client.from("vitrine_retomada_agenda").update({
    status: "cancelled",
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId).eq("contact_number", phone);
}

const VITRINE_RETOMADA_OPT_OUT_EXACT = new Set([
  "parar",
  "pare",
  "stop",
  "nao quero mais",
  "sem interesse",
  "para de mandar",
  "nao me mande mais",
  "descadastrar",
]);

export function isVitrineRetomadaOptOutText(text: string): boolean {
  const v = String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/<<INTERACTIVE_ID:[^>]+>>/gi, "")
    .trim();
  if (!v) return false;
  return VITRINE_RETOMADA_OPT_OUT_EXACT.has(v);
}
