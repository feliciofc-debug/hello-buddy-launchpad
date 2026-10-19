import { olxAutouploadImport, olxAutouploadImportStatus } from "./olx-api.ts";
import { assertOlxAdPayloadSafe, mapVehicleToOlxAd, stableOlxAdRef } from "./olx-map-vehicle.ts";
import { getOlxAccessTokenForUser } from "./olx-token.ts";
import type { OlxVeiculoEstoqueRow } from "./olx-vehicle-types.ts";

async function applyImportStatus(
  sb: any,
  row: {
    user_id: string;
    veiculo_id: string;
    olx_ad_ref: string;
    import_token: string;
  },
  accessToken: string,
): Promise<void> {
  const st = await olxAutouploadImportStatus(accessToken, row.import_token);
  const ads = st.ads ?? [];
  const ad = ads.find((a) => true) ?? ads[0];
  if (!ad) return;

  if (st.autoupload_status === "pending" || ad.status === "pending" || ad.status === "queued") {
    return;
  }

  if (ad.status === "accepted") {
    if (ad.operation === "delete") {
      await sb.from("olx_vehicle_listing").update({
        status: "removido",
        olx_url: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("user_id", row.user_id).eq("veiculo_id", row.veiculo_id);
      return;
    }
    await sb.from("olx_vehicle_listing").update({
      status: "publicado",
      olx_url: ad.url ?? null,
      last_error: null,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("user_id", row.user_id).eq("veiculo_id", row.veiculo_id);
    return;
  }

  if (ad.status === "error" || ad.status === "refused") {
    await sb.from("olx_vehicle_listing").update({
      status: "erro",
      last_error: ad.message ?? "OLX recusou o anúncio",
      updated_at: new Date().toISOString(),
    }).eq("user_id", row.user_id).eq("veiculo_id", row.veiculo_id);
  }
}

async function deleteSoldVehicleOnOlx(
  sb: any,
  row: {
    user_id: string;
    veiculo_id: string;
    olx_ad_ref: string;
    status: string;
  },
): Promise<void> {
  if (row.status === "removido" || row.status === "pendente") return;
  const { data: vehicle } = await sb.from("veiculos_estoque")
    .select("status, segmento, marca, modelo, versao, ano_fabricacao, ano_modelo, km, preco, combustivel, cambio, cor, descricao, fotos")
    .eq("id", row.veiculo_id)
    .maybeSingle();
  if (vehicle?.status !== "vendido") return;

  const accessToken = await getOlxAccessTokenForUser(sb, row.user_id);
  const adRef = stableOlxAdRef(row.veiculo_id, row.olx_ad_ref);
  const mapped = mapVehicleToOlxAd({
    vehicle: vehicle as OlxVeiculoEstoqueRow,
    mlLocationJson: null,
    phone: "",
    adRef,
    operation: "delete",
  });
  if (!mapped.ok) return;
  assertOlxAdPayloadSafe(mapped.ad);
  const imp = await olxAutouploadImport(accessToken, [mapped.ad]);
  if (imp.statusCode === 0 && imp.token) {
    await sb.from("olx_vehicle_listing").update({
      import_token: imp.token,
      status: "pendente",
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq("user_id", row.user_id).eq("veiculo_id", row.veiculo_id);
  }
}

export async function runOlxVehicleSyncOne(
  sb: any,
  userId: string,
  veiculoId: string,
): Promise<{ ok: boolean; status?: string; olx_url?: string | null; error?: string }> {
  const { data: row } = await sb.from("olx_vehicle_listing")
    .select("user_id, veiculo_id, olx_ad_ref, import_token, status")
    .eq("user_id", userId)
    .eq("veiculo_id", veiculoId)
    .maybeSingle();
  if (!row?.import_token) {
    return { ok: false, error: "Nenhuma publicação OLX pendente para este veículo." };
  }
  try {
    const accessToken = await getOlxAccessTokenForUser(sb, userId);
    await applyImportStatus(sb, row, accessToken);
    const { data: fresh } = await sb.from("olx_vehicle_listing")
      .select("status, olx_url, last_error")
      .eq("user_id", userId)
      .eq("veiculo_id", veiculoId)
      .maybeSingle();
    return {
      ok: true,
      status: fresh?.status,
      olx_url: fresh?.olx_url ?? null,
      error: fresh?.last_error ?? undefined,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function runOlxVehicleSyncBatch(sb: any): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  const { data: pending } = await sb.from("olx_vehicle_listing")
    .select("user_id, veiculo_id, olx_ad_ref, import_token, status")
    .eq("status", "pendente")
    .not("import_token", "is", null);

  for (const row of pending ?? []) {
    try {
      const accessToken = await getOlxAccessTokenForUser(sb, row.user_id);
      await applyImportStatus(sb, row, accessToken);
      processed++;
    } catch {
      errors++;
    }
  }

  const { data: published } = await sb.from("olx_vehicle_listing")
    .select("user_id, veiculo_id, olx_ad_ref, status")
    .in("status", ["publicado", "erro"]);

  for (const row of published ?? []) {
    try {
      await deleteSoldVehicleOnOlx(sb, row);
      processed++;
    } catch {
      errors++;
    }
  }

  return { processed, errors };
}
