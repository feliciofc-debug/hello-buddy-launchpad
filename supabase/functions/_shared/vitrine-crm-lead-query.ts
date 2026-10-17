import type { VitrineEventoRow } from "./vitrine-eventos.ts";
import { VITRINE_CONVERSION_EVENTS, VITRINE_WARM_EVENTS } from "./vitrine-eventos.ts";

/** Veículos com detalhe/fotos sem conversão posterior (por veículo). */
export function pickWarmLeadVehicleIds(
  events: VitrineEventoRow[],
  maxVehicles = 3,
): string[] {
  const byVehicle = new Map<string, VitrineEventoRow[]>();
  for (const ev of events) {
    const id = String(ev.veiculo_id || "").trim();
    if (!id) continue;
    const list = byVehicle.get(id) ?? [];
    list.push(ev);
    byVehicle.set(id, list);
  }

  const eligible: Array<{ id: string; lastWarmMs: number }> = [];
  for (const [id, rows] of byVehicle) {
    rows.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    const hasWarm = rows.some((r) => VITRINE_WARM_EVENTS.has(r.evento as never));
    if (!hasWarm) continue;
    const firstWarmMs = Math.min(
      ...rows
        .filter((r) => VITRINE_WARM_EVENTS.has(r.evento as never))
        .map((r) => Date.parse(r.created_at)),
    );
    const converted = rows.some(
      (r) =>
        VITRINE_CONVERSION_EVENTS.has(r.evento as never) &&
        Date.parse(r.created_at) >= firstWarmMs,
    );
    if (converted) continue;
    const lastWarmMs = Math.max(
      ...rows
        .filter((r) => VITRINE_WARM_EVENTS.has(r.evento as never))
        .map((r) => Date.parse(r.created_at)),
    );
    eligible.push({ id, lastWarmMs });
  }

  eligible.sort((a, b) => b.lastWarmMs - a.lastWarmMs);
  return eligible.slice(0, maxVehicles).map((e) => e.id);
}

export function formatVehicleListPt(names: string[]): string {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (!clean.length) return "";
  if (clean.length === 1) return `o ${clean[0]}`;
  if (clean.length === 2) return `o ${clean[0]} e o ${clean[1]}`;
  const head = clean.slice(0, -1).map((n) => `o ${n}`).join(", ");
  return `${head} e o ${clean[clean.length - 1]}`;
}

export function buildLeadMornoOwnerMessage(input: {
  contactName: string;
  vehicleTitles: string[];
}): string {
  const perfil = input.contactName.trim() || "Cliente";
  const list = formatVehicleListPt(input.vehicleTitles);
  return `👀 Lead morno: ${perfil} olhou ${list} (viu fotos e detalhes) e não pediu contato. Vale uma mensagem.`;
}
