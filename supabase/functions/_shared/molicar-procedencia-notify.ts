import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveTenantOwner } from "./amz-context.ts";

export type MolicarProcedenciaRow = {
  id?: string;
  user_id?: string;
  placa?: string | null;
  veiculo_id?: string | null;
  troca_id?: string | null;
  solicitacao_id?: string | null;
  notificar_whatsapp?: boolean;
  whatsapp_notificado_em?: string | null;
  servicos: string[];
  status: string;
  provider_status?: string | null;
  resultado?: unknown;
  erro?: string | null;
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function valueCi(source: unknown, names: string[]): unknown {
  const row = object(source);
  for (const [key, value] of Object.entries(row)) {
    if (names.some((name) => key.toLowerCase() === name.toLowerCase())) {
      return value;
    }
  }
  for (const nested of Object.values(row)) {
    if (nested && typeof nested === "object") {
      const found = valueCi(nested, names);
      if (found != null) return found;
    }
  }
  return null;
}

function money(value: unknown): string | null {
  const number = typeof value === "number"
    ? value
    : Number(String(value ?? "").replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(number) && number > 0
    ? number.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
    : null;
}

function summarizeDebts(row: MolicarProcedenciaRow): string {
  if (row.erro === "fonte_indisponivel") {
    return "⏳ Débitos: o Detran não respondeu agora.";
  }
  if (row.status !== "concluida") {
    return "⚠️ Débitos: não foi possível concluir a consulta.";
  }
  const details = valueCi(row.resultado, ["Details"]);
  const detailRows = Array.isArray(details) ? details : [];
  const totals = detailRows
    .map((item) => money(valueCi(item, ["Total", "SubTotal", "Value"])))
    .filter((value): value is string => !!value);
  if (detailRows.length) {
    return `⚠️ Débitos: ${detailRows.length} registro(s)${
      totals.length ? `; valores ${totals.slice(0, 3).join(", ")}` : ""
    }.`;
  }
  return "✅ Débitos: nada consta.";
}

function gravameStatus(value: unknown): "active" | "inactive" | "unknown" {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "unknown";
  if (
    /inactive|inativ[oa]\b|baixad|baix\b|cancelad|encerrad|liberad/.test(
      normalized,
    )
  ) {
    return "inactive";
  }
  if (
    /^active$|^ativo$|^vigente$|^incluso$/.test(normalized) ||
    /gravame\s+ativo/.test(normalized) ||
    /alienacao\s+fiduciaria/.test(normalized) ||
    /\b(active|ativo|vigente|incluso)\b/.test(normalized)
  ) {
    return "active";
  }
  return "unknown";
}

function year(value: unknown): string | null {
  const match = String(value ?? "").match(/\b(19|20)\d{2}\b/);
  return match?.[0] ?? null;
}

function summarizeGravame(row: MolicarProcedenciaRow): string[] {
  if (row.status !== "concluida") {
    return ["⚠️ Gravame: não foi possível concluir a consulta."];
  }
  const entries = valueCi(row.resultado, ["Gravame"]);
  if (Array.isArray(entries) && entries.length) {
    let needsOrientation = false;
    const lines = entries.map((entry) => {
      const status = gravameStatus(valueCi(entry, ["Status", "Situacao"]));
      if (status !== "inactive") needsOrientation = true;
      const agent = String(valueCi(entry, ["AgentName", "Credor"]) ?? "").trim();
      const contractYear = year(valueCi(entry, ["ContractDate", "DataContrato"]));
      const yearPart = contractYear ? ` (contrato de ${contractYear})` : "";
      if (status === "inactive") {
        return `✅ Gravame baixado (não impede a transferência)${
          agent ? ` — ${agent}` : ""
        }${yearPart}.`;
      }
      if (status === "active") {
        return `⚠️ Gravame ATIVO${agent ? ` — ${agent}` : ""}${yearPart}.`;
      }
      const credorPart = agent ? ` — ${agent}` : "";
      return `⚠️ Gravame${credorPart}${yearPart}: situação a confirmar no Detran.`;
    });
    if (needsOrientation) {
      lines.push(
        "→ Antes de comprar ou aceitar na troca, peça a carta de quitação e a baixa do gravame.",
      );
    }
    return lines;
  }
  return ["✅ Gravame: nada consta."];
}

function summarizeRestrictions(row: MolicarProcedenciaRow): string {
  if (row.status !== "concluida") {
    return "⚠️ Renajud: não foi possível concluir a consulta.";
  }
  const entries = valueCi(row.resultado, ["Renajud"]);
  if (Array.isArray(entries)) {
    if (!entries.length) return "✅ Renajud: nada consta.";
    const details = entries.map((entry) => {
      const type = String(
        valueCi(entry, [
          "Restriction",
          "RestrictionType",
          "Type",
          "Tipo",
          "Restricao",
        ]) ?? "",
      ).trim();
      const agency = String(
        valueCi(entry, ["Agency", "Organ", "Authority", "Orgao"]) ?? "",
      ).trim();
      return [type, agency].filter(Boolean).join(" — ");
    }).filter(Boolean);
    return `⚠️ Renajud: ${entries.length} restrição(ões)${
      details.length ? ` — ${details.join("; ")}` : ""
    }.`;
  }
  return "⚠️ Renajud: não foi possível confirmar o resultado.";
}

export function buildMolicarProcedenciaWhatsAppSummary(
  rows: MolicarProcedenciaRow[],
  context: { vehicleLabel?: string | null } = {},
): string {
  const byService = new Map<string, MolicarProcedenciaRow>();
  for (const row of rows) {
    const service = row.servicos?.[0];
    if (service && !byService.has(service)) byService.set(service, row);
  }
  const plate = rows.map((row) => row.placa).find(Boolean) ?? "placa informada";
  const header = `🔎 Procedência — ${plate}${
    context.vehicleLabel ? ` (${context.vehicleLabel})` : ""
  }`;
  const lines = [header];
  const debts = byService.get("debts");
  if (debts) lines.push(summarizeDebts(debts));
  const gravame = byService.get("gravame");
  if (gravame) lines.push(...summarizeGravame(gravame));
  const renajud = byService.get("renajud");
  if (renajud) lines.push(summarizeRestrictions(renajud));
  if (debts?.erro === "fonte_indisponivel") {
    lines.push("Responda TENTAR DÉBITOS para consultar de novo.");
  }
  return lines.join("\n");
}

export function molicarProcedenciaRetryButtons(
  rows: MolicarProcedenciaRow[],
): { body: string; buttons: { id: string; title: string }[] } | undefined {
  const debt = rows.find((row) =>
    row.servicos?.[0] === "debts" &&
    row.erro === "fonte_indisponivel" &&
    !!row.id
  );
  return debt
    ? {
      body: "O Detran não respondeu. Deseja tentar apenas os débitos de novo?",
      buttons: [{
        id: `proc_debitos_retry:${debt.id}`,
        title: "Tentar débitos",
      }],
    }
    : undefined;
}

async function vehicleLabel(
  db: SupabaseClient,
  userId: string,
  rows: MolicarProcedenciaRow[],
): Promise<string | null> {
  const vehicleId = rows.map((row) => row.veiculo_id).find(Boolean);
  const plate = rows.map((row) => row.placa).find(Boolean);
  if (!vehicleId && !plate) return null;
  let query = db.from("veiculos_estoque").select("marca,modelo")
    .eq("user_id", userId);
  query = vehicleId ? query.eq("id", vehicleId) : query.eq("placa", plate);
  const { data } = await query.maybeSingle();
  const label = [data?.marca, data?.modelo].map((item) => String(item ?? "").trim())
    .filter(Boolean).join(" ");
  return label || null;
}

export async function maybeNotifyMolicarProcedenciaOwner(
  db: SupabaseClient,
  userId: string,
  requestId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const { data, error } = await db.from("molicar_procedencia")
    .select(
      "id,user_id,placa,veiculo_id,troca_id,solicitacao_id,notificar_whatsapp,whatsapp_notificado_em,servicos,status,provider_status,resultado,erro,solicitado_em",
    )
    .eq("user_id", userId)
    .eq("solicitacao_id", requestId)
    .order("solicitado_em", { ascending: false })
    .limit(3);
  if (error) throw error;
  const rows = (data ?? []) as MolicarProcedenciaRow[];
  if (
    !rows.length ||
    !rows.every((row) => row.notificar_whatsapp === true) ||
    rows.some((row) => !!row.whatsapp_notificado_em)
  ) return false;
  if (rows.some((row) => row.status === "pendente")) return false;

  const owner = await resolveTenantOwner(db, userId, { fresh: true });
  if (!owner.phone) return false;
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return false;
  const response = await fetchImpl(
    `${supabaseUrl}/functions/v1/whatsapp-send-message`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({
        user_id: userId,
        to: owner.phone,
        message: buildMolicarProcedenciaWhatsAppSummary(rows, {
          vehicleLabel: await vehicleLabel(db, userId, rows),
        }),
        interactive_buttons: molicarProcedenciaRetryButtons(rows),
        log_sender: "agent",
      }),
    },
  );
  if (!response.ok) return false;
  const payload = await response.json().catch(() => ({}));
  if (payload?.success !== true) return false;
  const { error: markError } = await db.from("molicar_procedencia").update({
    whatsapp_notificado_em: new Date().toISOString(),
  }).eq("user_id", userId).eq("solicitacao_id", requestId)
    .is("whatsapp_notificado_em", null);
  if (markError) throw markError;
  return true;
}
