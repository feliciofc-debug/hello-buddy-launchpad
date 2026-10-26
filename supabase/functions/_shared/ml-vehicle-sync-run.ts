import { mlGetItem, mlUpdateItem, mlFetchCategoryAttributes } from "./ml-api.ts";
import { mapVehicleToMlItem, resolveMlCategoryId } from "./ml-map-vehicle.ts";
import { buildMlSellerContact } from "./ml-seller-contact.ts";
import {
  ML_PUBLIC_VEHICLE_SELECT,
  type VeiculoEstoqueRow,
} from "./ml-vehicle-types.ts";
import { assertMlItemOwnedByAmz } from "./ml-portal-ownership.ts";
import { getMlAccessTokenForUser } from "./ml-token.ts";

export async function runMlVehicleSync(
  sb: any,
  input: { userId: string; veiculoId: string },
): Promise<{ ok: boolean; error?: string }> {
  const { data: portal } = await sb.from("veiculos_portais")
    .select("*")
    .eq("user_id", input.userId)
    .eq("veiculo_id", input.veiculoId)
    .eq("portal", "mercadolivre")
    .maybeSingle();
  if (!portal?.external_id) return { ok: false, error: "Anúncio ML não vinculado" };
  if (!(await assertMlItemOwnedByAmz(sb, input.userId, String(portal.external_id)))) {
    return { ok: false, error: "Anúncio ML não vinculado à AMZ" };
  }

  const { data: vehicle } = await sb.from("veiculos_estoque")
    .select(ML_PUBLIC_VEHICLE_SELECT)
    .eq("user_id", input.userId)
    .eq("id", input.veiculoId)
    .maybeSingle();
  if (!vehicle) return { ok: false, error: "Veículo não encontrado" };

  const { accessToken } = await getMlAccessTokenForUser(sb, input.userId);

  if (vehicle.status === "vendido") {
    const closed = await mlUpdateItem(accessToken, portal.external_id, { status: "closed" });
    await sb.from("veiculos_portais").update({
      status: closed.ok ? "closed" : "error",
      last_error: closed.error ?? null,
      last_synced_at: new Date().toISOString(),
    }).eq("user_id", input.userId).eq("veiculo_id", input.veiculoId).eq("portal", "mercadolivre");
    return closed.ok ? { ok: true } : { ok: false, error: closed.error };
  }

  const { data: cfg } = await sb.from("empresa_config")
    .select("ml_location_json")
    .eq("user_id", input.userId)
    .maybeSingle();
  const sellerContact = await buildMlSellerContact(sb, input.userId);
  if (!sellerContact) return { ok: false, error: "WhatsApp da loja não configurado" };

  const categoryId = portal.category_id || await resolveMlCategoryId(accessToken, vehicle as VeiculoEstoqueRow);
  const attrs = await mlFetchCategoryAttributes(accessToken, categoryId);
  const mapped = mapVehicleToMlItem({
    vehicle: vehicle as VeiculoEstoqueRow,
    categoryId,
    categoryAttributes: attrs,
    mlLocationJson: cfg?.ml_location_json,
    sellerContact,
  });
  if (!mapped.ok) {
    await sb.from("veiculos_portais").update({
      status: "error",
      last_error: mapped.blocking.map((b) => b.message).join("; "),
    }).eq("user_id", input.userId).eq("veiculo_id", input.veiculoId).eq("portal", "mercadolivre");
    return { ok: false, error: "Campos incompletos para sync" };
  }

  const patch = {
    price: mapped.body.price,
    pictures: mapped.body.pictures,
    attributes: mapped.body.attributes,
  };
  const updated = await mlUpdateItem(accessToken, portal.external_id, patch);
  await sb.from("veiculos_portais").update({
    status: updated.ok ? "published" : "error",
    last_error: updated.error ?? null,
    last_synced_at: new Date().toISOString(),
  }).eq("user_id", input.userId).eq("veiculo_id", input.veiculoId).eq("portal", "mercadolivre");
  return updated.ok ? { ok: true } : { ok: false, error: updated.error };
}

export async function runMlReconcile(sb: any, env: { supabaseUrl: string; serviceKey: string }): Promise<void> {
  const { data: rows } = await sb.from("veiculos_portais")
    .select("user_id, veiculo_id, external_id, status")
    .eq("portal", "mercadolivre")
    .in("status", ["published", "paused"]);
  for (const row of rows ?? []) {
    const { data: vehicle } = await sb.from("veiculos_estoque")
      .select("status")
      .eq("id", row.veiculo_id)
      .maybeSingle();
    if (vehicle?.status === "vendido" && row.status !== "closed") {
      await runMlVehicleSync(sb, { userId: row.user_id, veiculoId: row.veiculo_id });
      continue;
    }
    try {
      const { accessToken } = await getMlAccessTokenForUser(sb, row.user_id);
      const item = await mlGetItem(accessToken, row.external_id);
      if (!item) continue;
      const st = String(item.status ?? "");
      let portalStatus = row.status;
      if (st === "closed") portalStatus = "closed";
      else if (st === "paused") portalStatus = "paused";
      else if (st === "active") portalStatus = "published";
      if (portalStatus !== row.status) {
        await sb.from("veiculos_portais").update({
          status: portalStatus,
          last_synced_at: new Date().toISOString(),
        }).eq("user_id", row.user_id).eq("veiculo_id", row.veiculo_id).eq("portal", "mercadolivre");
      }
    } catch {
      /* skip tenant */
    }
  }
  void env;
}
