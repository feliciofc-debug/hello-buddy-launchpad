import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveTenantOwner } from "./amz-context.ts";
import {
  MOLICAR_PROCEDENCIA_SERVICES,
  type MolicarProcedenciaService,
} from "./molicar-procedencia.ts";

export type MolicarProcedenciaRow = {
  user_id?: string;
  placa?: string | null;
  solicitacao_id?: string | null;
  notificar_whatsapp?: boolean;
  whatsapp_notificado_em?: string | null;
  servicos: string[];
  status: string;
  provider_status?: string | null;
  resultado?: unknown;
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

function providerNotFound(row: MolicarProcedenciaRow): boolean {
  return /RESOURCE_NOT_FOUND/i.test(
    `${row.provider_status ?? ""} ${JSON.stringify(row.resultado ?? {})}`,
  );
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
  if (row.status !== "concluida") return "não consultado";
  if (providerNotFound(row)) {
    return "consultado; veículo não encontrado na base";
  }
  const details = valueCi(row.resultado, ["Details"]);
  const detailRows = Array.isArray(details) ? details : [];
  const totals = detailRows
    .map((item) => money(valueCi(item, ["Total", "SubTotal", "Value"])))
    .filter((value): value is string => !!value);
  if (detailRows.length) {
    return `${detailRows.length} registro(s)${
      totals.length ? `; valores ${totals.slice(0, 3).join(", ")}` : ""
    }`;
  }
  const message = valueCi(row.resultado, ["Message", "mensagem"]);
  return message
    ? `consultado; ${String(message).slice(0, 160)}`
    : "consultado; sem detalhes retornados";
}

function summarizeGravame(row: MolicarProcedenciaRow): string {
  if (row.status !== "concluida") return "não consultado";
  if (providerNotFound(row)) {
    return "consultado; veículo não encontrado na base";
  }
  const entries = valueCi(row.resultado, ["Gravame"]);
  if (Array.isArray(entries) && entries.length) {
    const agents = entries.map((entry) =>
      String(valueCi(entry, ["AgentName", "agente"]) ?? "").trim()
    ).filter(Boolean);
    return `${entries.length} registro(s)${
      agents.length ? `; ${[...new Set(agents)].slice(0, 3).join(", ")}` : ""
    }`;
  }
  const message = valueCi(row.resultado, ["Message", "mensagem"]);
  return message
    ? `consultado; ${String(message).slice(0, 160)}`
    : "consultado; sem detalhes retornados";
}

function summarizeRestrictions(row: MolicarProcedenciaRow): string {
  if (row.status !== "concluida") return "não consultado";
  if (providerNotFound(row)) {
    return "consultado; veículo não encontrado na base";
  }
  const entries = valueCi(row.resultado, ["Renajud"]);
  if (Array.isArray(entries) && entries.length) {
    const restrictions = entries.map((entry) =>
      String(valueCi(entry, ["Restriction", "restricao"]) ?? "").trim()
    ).filter(Boolean);
    return `${entries.length} registro(s)${
      restrictions.length
        ? `; ${[...new Set(restrictions)].slice(0, 3).join(", ")}`
        : ""
    }`;
  }
  const message = valueCi(row.resultado, ["Message", "mensagem"]);
  return message
    ? `consultado; ${String(message).slice(0, 160)}`
    : "consultado; sem detalhes retornados";
}

export function buildMolicarProcedenciaWhatsAppSummary(
  rows: MolicarProcedenciaRow[],
): string {
  const byService = new Map<MolicarProcedenciaService, MolicarProcedenciaRow>();
  for (const row of rows) {
    const service = row.servicos?.[0] as MolicarProcedenciaService;
    if (
      (MOLICAR_PROCEDENCIA_SERVICES as readonly string[]).includes(service) &&
      !byService.has(service)
    ) byService.set(service, row);
  }
  const fallback = (service: MolicarProcedenciaService) =>
    byService.get(service) ?? { servicos: [service], status: "ausente" };
  return [
    "🔎 Procedência Molicar concluída.",
    `Débitos: ${summarizeDebts(fallback("debts"))}.`,
    `Gravame: ${summarizeGravame(fallback("gravame"))}.`,
    `Restrições: ${summarizeRestrictions(fallback("renajud"))}.`,
    "Leilão: ❓ não consultado.",
    "Roubo/furto: ❓ não consultado.",
  ].join("\n");
}

export async function maybeNotifyMolicarProcedenciaOwner(
  db: SupabaseClient,
  userId: string,
  requestId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const { data, error } = await db.from("molicar_procedencia")
    .select(
      "user_id,placa,solicitacao_id,notificar_whatsapp,whatsapp_notificado_em,servicos,status,provider_status,resultado,solicitado_em",
    )
    .eq("user_id", userId)
    .eq("solicitacao_id", requestId)
    .order("solicitado_em", { ascending: false })
    .limit(3);
  if (error) throw error;
  const rows = (data ?? []) as MolicarProcedenciaRow[];
  if (
    rows.length !== MOLICAR_PROCEDENCIA_SERVICES.length ||
    !rows.every((row) => row.notificar_whatsapp === true) ||
    rows.some((row) => !!row.whatsapp_notificado_em)
  ) return false;
  const latest = new Map<string, MolicarProcedenciaRow>();
  for (const row of rows) {
    const service = row.servicos?.[0];
    if (service && !latest.has(service)) latest.set(service, row);
  }
  if (
    MOLICAR_PROCEDENCIA_SERVICES.some((service) =>
      !latest.has(service) || latest.get(service)?.status === "pendente"
    )
  ) return false;

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
        message: buildMolicarProcedenciaWhatsAppSummary([...latest.values()]),
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
