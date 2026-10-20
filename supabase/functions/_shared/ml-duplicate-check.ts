import { ML_API_BASE } from "./ml-config.ts";
import type { VeiculoEstoqueRow } from "./ml-vehicle-types.ts";

export type MlDuplicateCandidate = {
  item_id: string;
  permalink: string | null;
  title: string;
  price: number | null;
  km: number | null;
};

function norm(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function attrNumber(attrs: unknown[], id: string): number | null {
  if (!Array.isArray(attrs)) return null;
  for (const a of attrs) {
    const o = a as { id?: string; value_name?: string; value_struct?: { number?: number } };
    if (o.id !== id) continue;
    if (o.value_struct?.number != null) return Number(o.value_struct.number);
    const n = Number(String(o.value_name ?? "").replace(/\D/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function vehicleMatchesMlItem(
  vehicle: Pick<VeiculoEstoqueRow, "marca" | "modelo" | "ano_modelo" | "ano_fabricacao" | "km" | "preco">,
  item: {
    title?: string;
    price?: number;
    attributes?: unknown[];
  },
): boolean {
  const title = norm(String(item.title ?? ""));
  const marca = norm(String(vehicle.marca ?? ""));
  const modelo = norm(String(vehicle.modelo ?? ""));
  if (marca && !title.includes(marca)) return false;
  if (modelo && !title.includes(modelo.split(" ")[0])) return false;

  const ano = vehicle.ano_modelo ?? vehicle.ano_fabricacao;
  if (ano && !title.includes(String(ano))) return false;

  const vKm = vehicle.km != null ? Number(vehicle.km) : null;
  const iKm = attrNumber(item.attributes ?? [], "KILOMETERS");
  if (vKm != null && iKm != null && vKm > 0) {
    const delta = Math.abs(vKm - iKm) / vKm;
    if (delta > 0.05) return false;
  }

  const vPrice = vehicle.preco != null ? Number(vehicle.preco) : null;
  const iPrice = item.price != null ? Number(item.price) : null;
  if (vPrice != null && iPrice != null && vPrice > 0) {
    const delta = Math.abs(vPrice - iPrice) / vPrice;
    if (delta > 0.10) return false;
  }

  return true;
}

export async function mlSearchSellerActiveItemIds(
  accessToken: string,
  mlUserId: number,
  limit = 50,
): Promise<string[]> {
  const url =
    `${ML_API_BASE}/users/${mlUserId}/items/search?seller_id=${mlUserId}&status=active&limit=${limit}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return [];
  const j = await res.json();
  const ids = j?.results;
  return Array.isArray(ids) ? ids.map(String) : [];
}

export async function mlFindPossibleDuplicateListings(
  accessToken: string,
  mlUserId: number,
  vehicle: VeiculoEstoqueRow,
  ownedExternalIds: Set<string>,
): Promise<MlDuplicateCandidate[]> {
  const ids = await mlSearchSellerActiveItemIds(accessToken, mlUserId);
  const out: MlDuplicateCandidate[] = [];
  for (const itemId of ids) {
    if (ownedExternalIds.has(itemId)) continue;
    const res = await fetch(`${ML_API_BASE}/items/${itemId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) continue;
    const item = await res.json();
    if (!vehicleMatchesMlItem(vehicle, item)) continue;
    out.push({
      item_id: itemId,
      permalink: item.permalink != null ? String(item.permalink) : null,
      title: String(item.title ?? itemId),
      price: item.price != null ? Number(item.price) : null,
      km: attrNumber(item.attributes ?? [], "KILOMETERS"),
    });
  }
  return out;
}
