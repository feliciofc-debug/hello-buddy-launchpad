import { normalizePhoneBR } from "./cloud-log.ts";
import { dateKeySaoPaulo, shouldRunDailyResumoWindow, isRetomadaAllowedHour, nextRetomadaAllowedTime } from "./vitrine-crm-time.ts";
import { loadVitrineCrmTenantConfig } from "./vitrine-crm-config.ts";
import {
  buildLeadMornoOwnerMessage,
  pickWarmLeadVehicleIds,
} from "./vitrine-crm-lead-query.ts";
import {
  buildDailyResumoMessage,
  topVehiclesByViews,
  warmLeadsFromEventsByContact,
} from "./vitrine-crm-resumo.ts";
import type { VitrineEventoRow } from "./vitrine-eventos.ts";
import {
  sendVitrineCrmOwnerText,
  sendVitrineRetomadaCliente,
} from "./vitrine-crm-owner-notify.ts";
import { vehicleDisplayTitle, type VeiculoVitrineRow } from "./vehicle-stock-whatsapp.ts";
import { formatRecadoClienteLine } from "./vehicle-stock-cliente-nome.ts";

const PURGE_META_KEY = "last_purge_date_sp";
const EVENT_RETENTION_DAYS = 90;

function startOfDayIsoSaoPaulo(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 3, 0, 0)).toISOString();
}

export type VitrineCrmTickEnv = {
  supabaseUrl: string;
  serviceKey: string;
};

async function loadVehicleTitles(
  sb: any,
  userId: string,
  ids: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { data } = await sb.from("veiculos_estoque")
    .select("id,marca,modelo,versao,ano_fabricacao,ano_modelo,km,preco,cor,cambio,combustivel,portas,blindado,nivel_blindagem,opcionais,caracteristicas,descricao,fotos,status")
    .eq("user_id", userId)
    .in("id", ids);
  for (const row of (data ?? []) as VeiculoVitrineRow[]) {
    map.set(row.id, vehicleDisplayTitle(row));
  }
  return map;
}

async function hasRecentInbound24h(
  sb: any,
  userId: string,
  phone: string,
  now: Date,
): Promise<boolean> {
  const { data: conv } = await sb.from("whatsapp_cloud_conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("contact_number", phone)
    .maybeSingle();
  if (!conv?.id) return false;
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data: inbound } = await sb.from("whatsapp_cloud_messages")
    .select("id")
    .eq("conversation_id", conv.id)
    .eq("direction", "inbound")
    .gte("created_at", since)
    .limit(1);
  return (inbound?.length ?? 0) > 0;
}

async function leadMornoSentWithin24h(
  sb: any,
  userId: string,
  phone: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await sb.from("vitrine_lead_morno_enviados")
    .select("id")
    .eq("user_id", userId)
    .eq("contact_number", phone)
    .gte("sent_at", since)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function runEventPurgeIfNeeded(sb: any, now: Date): Promise<void> {
  const today = dateKeySaoPaulo(now);
  const { data: meta } = await sb.from("vitrine_crm_tick_meta")
    .select("value")
    .eq("key", PURGE_META_KEY)
    .maybeSingle();
  if (meta?.value === today) return;
  const cutoff = new Date(now.getTime() - EVENT_RETENTION_DAYS * 86400000).toISOString();
  await sb.from("vitrine_eventos").delete().lt("created_at", cutoff);
  await sb.from("vitrine_crm_tick_meta").upsert({
    key: PURGE_META_KEY,
    value: today,
    updated_at: now.toISOString(),
  }, { onConflict: "key" });
}

async function claimLeadMornoDue(sb: any, now: Date): Promise<Record<string, unknown>[]> {
  const ts = now.toISOString();
  const { data } = await sb.from("vitrine_lead_morno_agenda")
    .update({ status: "processing", updated_at: ts })
    .eq("status", "pending")
    .lte("run_at", ts)
    .select("*")
    .limit(40);
  return (data ?? []) as Record<string, unknown>[];
}

async function processLeadMornoDue(
  sb: any,
  env: VitrineCrmTickEnv,
  now: Date,
): Promise<number> {
  const due = await claimLeadMornoDue(sb, now);
  let sent = 0;
  for (const row of due) {
    const cfg = await loadVitrineCrmTenantConfig(sb, row.user_id);
    if (!cfg.usesVehicleStock || !cfg.leadMornoAtivo) {
      await sb.from("vitrine_lead_morno_agenda").update({
        status: "cancelled",
        updated_at: now.toISOString(),
      }).eq("user_id", row.user_id).eq("contact_number", row.contact_number);
      continue;
    }
    const phone = normalizePhoneBR(row.contact_number);
    if (await leadMornoSentWithin24h(sb, row.user_id, phone)) {
      await sb.from("vitrine_lead_morno_agenda").update({
        status: "done",
        updated_at: now.toISOString(),
      }).eq("user_id", row.user_id).eq("contact_number", row.contact_number);
      continue;
    }
    const since = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const { data: events } = await sb.from("vitrine_eventos")
      .select("veiculo_id, evento, created_at")
      .eq("user_id", row.user_id)
      .eq("contact_number", phone)
      .gte("created_at", since)
      .order("created_at", { ascending: true });
    const vehicleIds = pickWarmLeadVehicleIds((events ?? []) as VitrineEventoRow[], 3);
    if (!vehicleIds.length) {
      await sb.from("vitrine_lead_morno_agenda").update({
        status: "done",
        updated_at: now.toISOString(),
      }).eq("user_id", row.user_id).eq("contact_number", row.contact_number);
      continue;
    }
    const titles = await loadVehicleTitles(sb, row.user_id, vehicleIds);
    const vehicleTitles = vehicleIds.map((id) => titles.get(id) ?? "Veículo");
    const contactName = String(row.contact_name || "").trim() || "Cliente";
    const msg = [
      buildLeadMornoOwnerMessage({ contactName, vehicleTitles }),
      formatRecadoClienteLine({
        clienteNome: contactName,
        contactName,
        fromNumber: phone,
      }),
    ].join("\n");
    const ok = await sendVitrineCrmOwnerText(sb, {
      supabaseUrl: env.supabaseUrl,
      serviceKey: env.serviceKey,
      userId: row.user_id,
      message: msg,
    });
    if (!ok) {
      console.warn(
        "[vitrine-crm] lead morno owner send failed (ex.: janela 24h Meta); agenda marcada done",
        { userId: row.user_id, contact: phone },
      );
      await sb.from("vitrine_lead_morno_agenda").update({
        status: "done",
        updated_at: now.toISOString(),
      }).eq("user_id", row.user_id).eq("contact_number", row.contact_number);
      continue;
    }
    await sb.from("vitrine_lead_morno_enviados").insert({
      user_id: row.user_id,
      contact_number: phone,
    });
    await sb.from("vitrine_lead_morno_agenda").update({
      status: "done",
      updated_at: now.toISOString(),
    }).eq("user_id", row.user_id).eq("contact_number", row.contact_number);
    sent += 1;
  }
  return sent;
}

async function claimRetomadaDue(sb: any, now: Date): Promise<Record<string, unknown>[]> {
  const ts = now.toISOString();
  const { data } = await sb.from("vitrine_retomada_agenda")
    .update({ status: "processing", updated_at: ts })
    .eq("status", "pending")
    .lte("run_at", ts)
    .select("*")
    .limit(40);
  return (data ?? []) as Record<string, unknown>[];
}

async function processRetomadaDue(
  sb: any,
  env: VitrineCrmTickEnv,
  now: Date,
): Promise<number> {
  const due = await claimRetomadaDue(sb, now);
  let sent = 0;
  for (const row of due) {
    const cfg = await loadVitrineCrmTenantConfig(sb, row.user_id);
    if (!cfg.usesVehicleStock || !cfg.retomadaAtiva) {
      await sb.from("vitrine_retomada_agenda").update({
        status: "cancelled",
        updated_at: now.toISOString(),
      }).eq("user_id", row.user_id).eq("contact_number", row.contact_number).eq("veiculo_id", row.veiculo_id);
      continue;
    }
    const phone = normalizePhoneBR(row.contact_number);
    const { data: pref } = await sb.from("vitrine_contato_prefs")
      .select("retomada_opt_out")
      .eq("user_id", row.user_id)
      .eq("contact_number", phone)
      .maybeSingle();
    if (pref?.retomada_opt_out === true) {
      await sb.from("vitrine_retomada_agenda").update({
        status: "cancelled",
        updated_at: now.toISOString(),
      }).eq("user_id", row.user_id).eq("contact_number", phone).eq("veiculo_id", row.veiculo_id);
      continue;
    }
    if (!isRetomadaAllowedHour(now)) {
      const next = nextRetomadaAllowedTime(now);
      await sb.from("vitrine_retomada_agenda").update({
        run_at: next.toISOString(),
        updated_at: now.toISOString(),
      }).eq("user_id", row.user_id).eq("contact_number", phone).eq("veiculo_id", row.veiculo_id);
      continue;
    }
    if (!(await hasRecentInbound24h(sb, row.user_id, phone, now))) {
      await sb.from("vitrine_retomada_agenda").update({
        status: "cancelled",
        updated_at: now.toISOString(),
      }).eq("user_id", row.user_id).eq("contact_number", phone).eq("veiculo_id", row.veiculo_id);
      continue;
    }
    const { data: already } = await sb.from("vitrine_retomada_enviados")
      .select("veiculo_id")
      .eq("user_id", row.user_id)
      .eq("contact_number", phone)
      .eq("veiculo_id", row.veiculo_id)
      .maybeSingle();
    if (already) {
      await sb.from("vitrine_retomada_agenda").update({
        status: "done",
        updated_at: now.toISOString(),
      }).eq("user_id", row.user_id).eq("contact_number", phone).eq("veiculo_id", row.veiculo_id);
      continue;
    }
    let vehicleLabel = String(row.vehicle_label || "").trim();
    if (!vehicleLabel) {
      const titles = await loadVehicleTitles(sb, row.user_id, [row.veiculo_id]);
      vehicleLabel = titles.get(row.veiculo_id) ?? "esse veículo";
    }
    const firstName = (String(row.contact_name || "").trim() || "Cliente").split(/\s+/)[0];
    const body = `Oi, ${firstName}! Vi que você gostou do ${vehicleLabel}. Quer agendar um test drive ou ver condições? 🙂`;
    const ok = await sendVitrineRetomadaCliente({
      supabaseUrl: env.supabaseUrl,
      serviceKey: env.serviceKey,
      userId: row.user_id,
      to: phone,
      body,
      vehicleId: row.veiculo_id,
    });
    if (!ok) continue;
    await sb.from("vitrine_retomada_enviados").upsert({
      user_id: row.user_id,
      contact_number: phone,
      veiculo_id: row.veiculo_id,
      sent_at: now.toISOString(),
    }, { onConflict: "user_id,contact_number,veiculo_id" });
    await sb.from("vitrine_retomada_agenda").update({
      status: "done",
      updated_at: now.toISOString(),
    }).eq("user_id", row.user_id).eq("contact_number", phone).eq("veiculo_id", row.veiculo_id);
    sent += 1;
  }
  return sent;
}

async function processDailyResumos(
  sb: any,
  env: VitrineCrmTickEnv,
  now: Date,
): Promise<number> {
  const { data: tenants } = await sb.from("empresa_config")
    .select("user_id, vitrine_resumo_diario_ativo, vitrine_resumo_ultimo_dia_sp")
    .eq("vitrine_resumo_diario_ativo", true);
  let sent = 0;
  const today = dateKeySaoPaulo(now);
  for (const t of tenants ?? []) {
    const userId = String(t.user_id);
    const cfg = await loadVitrineCrmTenantConfig(sb, userId);
    if (!cfg.usesVehicleStock || !cfg.resumoDiarioAtivo) continue;
    if (!shouldRunDailyResumoWindow(now, cfg.resumoUltimoDiaSp)) continue;

    const dayStart = startOfDayIsoSaoPaulo(today);
    const { data: events } = await sb.from("vitrine_eventos")
      .select("contact_number, veiculo_id, evento, created_at")
      .eq("user_id", userId)
      .gte("created_at", dayStart);
    const rows = (events ?? []) as Array<VitrineEventoRow & { contact_number: string }>;
    if (!rows.length) {
      await sb.from("empresa_config").update({
        vitrine_resumo_ultimo_dia_sp: today,
      }).eq("user_id", userId);
      continue;
    }
    const contacts = new Set(rows.map((r) => r.contact_number));
    const vehicleIds = [...new Set(rows.map((r) => String(r.veiculo_id || "")).filter(Boolean))];
    const titles = await loadVehicleTitles(sb, userId, vehicleIds);
    const top = topVehiclesByViews(rows, titles, 5);
    const warm = warmLeadsFromEventsByContact(
      rows.map((r) => ({ ...r, contact_name: null })),
      titles,
    );
    const msg = buildDailyResumoMessage({
      totalContacts: contacts.size,
      topVehicles: top,
      warmLeads: warm,
    });
    if (!msg) continue;
    const ok = await sendVitrineCrmOwnerText(sb, {
      supabaseUrl: env.supabaseUrl,
      serviceKey: env.serviceKey,
      userId,
      message: msg,
    });
    if (!ok) {
      console.warn(
        "[vitrine-crm] resumo diário owner send failed (ex.: janela 24h Meta); não re-tenta hoje",
        { userId },
      );
      await sb.from("empresa_config").update({
        vitrine_resumo_ultimo_dia_sp: today,
      }).eq("user_id", userId);
      continue;
    }
    await sb.from("empresa_config").update({
      vitrine_resumo_ultimo_dia_sp: today,
    }).eq("user_id", userId);
    sent += 1;
  }
  return sent;
}

export async function runVitrineCrmTick(
  sb: any,
  env: VitrineCrmTickEnv,
): Promise<{ leadMorno: number; retomada: number; resumos: number }> {
  const now = new Date();
  await runEventPurgeIfNeeded(sb, now);
  const leadMorno = await processLeadMornoDue(sb, env, now);
  const retomada = await processRetomadaDue(sb, env, now);
  const resumos = await processDailyResumos(sb, env, now);
  return { leadMorno, retomada, resumos };
}
