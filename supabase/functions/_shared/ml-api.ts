import { ML_API_BASE } from "./ml-config.ts";
import { humanizeMlApiError } from "./ml-error-humanize.ts";
import type { MlCategoryAttribute } from "./ml-vehicle-types.ts";

export async function mlFetchCategoryAttributes(
  accessToken: string,
  categoryId: string,
): Promise<MlCategoryAttribute[]> {
  const res = await fetch(`${ML_API_BASE}/categories/${categoryId}/attributes`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`attributes:${res.status}`);
  return await res.json();
}

export const ML_LISTING_PACK_TYPES = ["gold_premium", "gold", "silver"] as const;
export type MlListingPackType = (typeof ML_LISTING_PACK_TYPES)[number];

export async function mlListingPackAvailable(
  accessToken: string,
  mlUserId: number,
  categoryId: string,
  packType: MlListingPackType,
): Promise<boolean> {
  const url =
    `${ML_API_BASE}/users/${mlUserId}/classifieds_promotion_packs/${packType}/available?categoryId=${categoryId}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return false;
  const j = await res.json();
  return j?.has_available_listings === true;
}

/** @deprecated use mlPickListingPackType */
export async function mlHasSilverPackage(
  accessToken: string,
  mlUserId: number,
  categoryId: string,
): Promise<boolean> {
  return mlListingPackAvailable(accessToken, mlUserId, categoryId, "silver");
}

export type MlListingPackPreference = "destaque_first" | "classic_first";

export function mlListingPackTryOrder(preference: MlListingPackPreference | null | undefined): MlListingPackType[] {
  if (preference === "classic_first") return ["silver", "gold", "gold_premium"];
  return ["gold_premium", "gold", "silver"];
}

export async function mlPickListingPackType(
  accessToken: string,
  mlUserId: number,
  categoryId: string,
  preference?: MlListingPackPreference | null,
): Promise<MlListingPackType | null> {
  for (const pack of mlListingPackTryOrder(preference)) {
    if (await mlListingPackAvailable(accessToken, mlUserId, categoryId, pack)) return pack;
  }
  return null;
}

export async function mlValidateItem(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string; payload?: unknown }> {
  const res = await fetch(`${ML_API_BASE}/items/validate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (res.ok) return { ok: true, payload };
  return { ok: false, error: humanizeMlApiError(payload), payload };
}

export async function mlCreateItem(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; item?: Record<string, unknown>; error?: string }> {
  const res = await fetch(`${ML_API_BASE}/items`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const item = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: humanizeMlApiError(item) };
  return { ok: true, item: item as Record<string, unknown> };
}

export async function mlUpdateItem(
  accessToken: string,
  itemId: string,
  patch: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string; item?: Record<string, unknown> }> {
  const res = await fetch(`${ML_API_BASE}/items/${itemId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });
  const item = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: humanizeMlApiError(item) };
  return { ok: true, item: item as Record<string, unknown> };
}

export async function mlGetItem(accessToken: string, itemId: string) {
  const res = await fetch(`${ML_API_BASE}/items/${itemId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return await res.json();
}
