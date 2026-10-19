import { olxAutouploadImport } from "./olx-api.ts";
import { assertOlxAdPayloadSafe, mapVehicleToOlxAd, stableOlxAdRef } from "./olx-map-vehicle.ts";
import { buildOlxSellerPhone } from "./olx-seller-contact.ts";
import { getOlxAccessTokenForUser } from "./olx-token.ts";
import { runOlxVehicleSyncOne } from "./olx-vehicle-sync-run.ts";
import type { OlxVeiculoEstoqueRow } from "./olx-vehicle-types.ts";

export type OlxPublishAcao = "publicar" | "atualizar" | "remover" | "verificar_status";

export async function runOlxVehiclePublish(
  sb: any,
  input: { userId: string; veiculoId: string; acao: OlxPublishAcao },
): Promise<{
  ok: boolean;
  status?: string;
  olx_url?: string | null;
  error?: string;
  blocking?: Array<{ field: string; message: string }>;
}> {
  const { data: vehicle, error: vErr } = await sb.from("veiculos_estoque")
    .select("*")
    .eq("id", input.veiculoId)
    .maybeSingle();
  if (vErr || !vehicle) return { ok: false, error: "Veículo não encontrado" };
  if (vehicle.user_id !== input.userId) {
    return { ok: false, error: "Sem permissão para este veículo" };
  }

  if (input.acao === "verificar_status") {
    return runOlxVehicleSyncOne(sb, input.userId, input.veiculoId);
  }

  const { data: listing } = await sb.from("olx_vehicle_listing")
    .select("*")
    .eq("user_id", input.userId)
    .eq("veiculo_id", input.veiculoId)
    .maybeSingle();

  const adRef = stableOlxAdRef(input.veiculoId, listing?.olx_ad_ref);

  let accessToken: string;
  try {
    accessToken = await getOlxAccessTokenForUser(sb, input.userId);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  if (input.acao === "remover") {
    if (!listing || listing.status === "removido") {
      return { ok: false, error: "Veículo não está publicado na OLX." };
    }
    const mapped = mapVehicleToOlxAd({
      vehicle: vehicle as OlxVeiculoEstoqueRow,
      mlLocationJson: null,
      phone: "",
      adRef,
      operation: "delete",
    });
    if (!mapped.ok) return { ok: false, error: "Falha ao montar remoção." };
    assertOlxAdPayloadSafe(mapped.ad);
    const imp = await olxAutouploadImport(accessToken, [mapped.ad]);
    if (imp.statusCode !== 0 || !imp.token) {
      await sb.from("olx_vehicle_listing").update({
        status: "erro",
        last_error: imp.statusMessage ?? "Remoção rejeitada pela OLX",
        updated_at: new Date().toISOString(),
      }).eq("user_id", input.userId).eq("veiculo_id", input.veiculoId);
      return { ok: false, error: imp.statusMessage ?? "Remoção rejeitada pela OLX" };
    }
    await sb.from("olx_vehicle_listing").update({
      import_token: imp.token,
      status: "pendente",
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq("user_id", input.userId).eq("veiculo_id", input.veiculoId);
    return { ok: true, status: "pendente" };
  }

  if (input.acao === "publicar" && listing?.status === "publicado") {
    return { ok: false, error: "Veículo já publicado na OLX. Use atualizar ou remover." };
  }
  if (input.acao === "atualizar" && listing?.status !== "publicado" && listing?.status !== "erro") {
    return { ok: false, error: "Publique o veículo na OLX antes de atualizar." };
  }

  const { data: cfg } = await sb.from("empresa_config")
    .select("ml_location_json")
    .eq("user_id", input.userId)
    .maybeSingle();

  const phone = await buildOlxSellerPhone(sb, input.userId);
  const mapped = mapVehicleToOlxAd({
    vehicle: vehicle as OlxVeiculoEstoqueRow,
    mlLocationJson: cfg?.ml_location_json,
    phone: phone ?? "",
    adRef,
    operation: "insert",
  });
  if (!mapped.ok) {
    return { ok: false, blocking: mapped.blocking, error: "Complete os campos obrigatórios." };
  }
  assertOlxAdPayloadSafe(mapped.ad);

  const imp = await olxAutouploadImport(accessToken, [mapped.ad]);
  if (imp.statusCode !== 0 || !imp.token) {
    const errMsg = imp.statusMessage ?? "Publicação rejeitada pela OLX";
    await sb.from("olx_vehicle_listing").upsert({
      user_id: input.userId,
      veiculo_id: input.veiculoId,
      olx_ad_ref: adRef,
      import_token: null,
      status: "erro",
      last_error: errMsg,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,veiculo_id" });
    return { ok: false, error: errMsg };
  }

  await sb.from("olx_vehicle_listing").upsert({
    user_id: input.userId,
    veiculo_id: input.veiculoId,
    olx_ad_ref: adRef,
    import_token: imp.token,
    status: "pendente",
    last_error: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,veiculo_id" });

  return { ok: true, status: "pendente" };
}
