import type { VitrineEventoRow } from "./vitrine-eventos.ts";
import { pickWarmLeadVehicleIds } from "./vitrine-crm-lead-query.ts";

export function countDistinctContacts(events: VitrineEventoRow[]): number {
  const set = new Set<string>();
  for (const e of events) {
    const c = (e as VitrineEventoRow & { contact_number?: string }).contact_number;
    if (c) set.add(c);
  }
  return set.size;
}

export function topVehiclesByViews(
  events: VitrineEventoRow[],
  titleById: Map<string, string>,
  limit = 5,
): Array<{ title: string; count: number }> {
  const counts = new Map<string, number>();
  for (const e of events) {
    const id = String(e.veiculo_id || "").trim();
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([id, count]) => ({
      title: titleById.get(id) ?? "Veículo",
      count,
    }));
}

export type WarmLeadSummaryLine = {
  contactName: string;
  contactNumber: string;
  vehicles: string[];
};

export function buildDailyResumoMessage(input: {
  totalContacts: number;
  topVehicles: Array<{ title: string; count: number }>;
  warmLeads: WarmLeadSummaryLine[];
}): string | null {
  if (input.totalContacts <= 0) return null;
  const lines: string[] = [
    "📊 Resumo da vitrine (hoje)",
    `👥 ${input.totalContacts} pessoa(s) interagiram com a vitrine.`,
  ];
  if (input.topVehicles.length) {
    lines.push("🏆 Veículos mais vistos:");
    for (const v of input.topVehicles) {
      lines.push(`• ${v.title} (${v.count} evento(s))`);
    }
  }
  if (input.warmLeads.length) {
    lines.push("👀 Viram e não pediram contato:");
    for (const w of input.warmLeads.slice(0, 15)) {
      const who = w.contactName.trim() || "Cliente";
      const cars = w.vehicles.join(", ") || "—";
      lines.push(`• ${who} — ${cars}`);
    }
  }
  return lines.join("\n");
}

export function warmLeadsFromEventsByContact(
  events: Array<VitrineEventoRow & { contact_number: string; contact_name?: string | null }>,
  titleById: Map<string, string>,
): WarmLeadSummaryLine[] {
  const byContact = new Map<string, typeof events>();
  for (const e of events) {
    const list = byContact.get(e.contact_number) ?? [];
    list.push(e);
    byContact.set(e.contact_number, list);
  }
  const out: WarmLeadSummaryLine[] = [];
  for (const [contactNumber, rows] of byContact) {
    const ids = pickWarmLeadVehicleIds(rows, 3);
    if (!ids.length) continue;
    const name = String(rows.find((r) => r.contact_name)?.contact_name || "").trim();
    out.push({
      contactName: name || "Cliente",
      contactNumber,
      vehicles: ids.map((id) => titleById.get(id) ?? "Veículo"),
    });
  }
  return out;
}
