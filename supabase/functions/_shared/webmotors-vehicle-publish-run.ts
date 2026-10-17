import { loadCatalogBundleForVehicle } from "./webmotors-catalog.ts";
import { webmotorsHashForUser } from "./webmotors-conta.ts";
import { wmIncluirCarro, wmIncluirFotoUrl } from "./webmotors-car-api.ts";
import { assertWebmotorsPayloadPublicOnly, mapVehicleToWebmotorsCar } from "./webmotors-map-car.ts";
import type { VeiculoEstoqueRow } from "./webmotors-vehicle-types.ts";

export async function runWebmotorsVehiclePublish(
  sb: any,
  input: { userId: string; veiculoId: string },
): Promise<{ ok: boolean; external_id?: string; error?: string; blocking?: unknown[] }> {
  const { data: vehicle, error: vErr } = await sb.from("veiculos_estoque")
    .select("*")
    .eq("user_id", input.userId)
    .eq("id", input.veiculoId)
    .maybeSingle();
  if (vErr || !vehicle) return { ok: false, error: "Veículo não encontrado" };
  if (vehicle.status === "vendido") {
    return { ok: false, error: "Veículo vendido. Remova manualmente da Webmotors se ainda estiver publicado." };
  }

  const { data: portal } = await sb.from("veiculos_portais")
    .select("*")
    .eq("user_id", input.userId)
    .eq("veiculo_id", input.veiculoId)
    .eq("portal", "webmotors")
    .maybeSingle();
  if (portal?.external_id && portal.status === "published") {
    return { ok: false, error: "Este veículo já está publicado na Webmotors. Use sincronizar." };
  }

  const { data: mapRow } = await sb.from("webmotors_veiculo_map")
    .select("*")
    .eq("user_id", input.userId)
    .eq("veiculo_id", input.veiculoId)
    .maybeSingle();

  let hash: string;
  let ambiente: "homolog" | "producao";
  let defaultModalidade: number | null;
  try {
    const auth = await webmotorsHashForUser(sb, input.userId);
    hash = auth.hash;
    ambiente = auth.ambiente;
    defaultModalidade = auth.conta.default_codigo_modalidade;
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  let catalog;
  try {
    catalog = await loadCatalogBundleForVehicle(
      sb,
      ambiente,
      hash,
      vehicle as VeiculoEstoqueRow,
      mapRow,
    );
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const mapped = mapVehicleToWebmotorsCar({
    vehicle: vehicle as VeiculoEstoqueRow,
    manualMap: mapRow,
    catalog,
    defaultModalidade,
  });
  if (!mapped.ok) {
    return { ok: false, blocking: mapped.blocking, error: "Complete os campos ou ajuste o de/para Webmotors." };
  }
  assertWebmotorsPayloadPublicOnly(mapped.payload);

  try {
    const created = await wmIncluirCarro(ambiente, hash, mapped.payload);
    const fotos = ((vehicle as VeiculoEstoqueRow).fotos ?? []).filter(Boolean).slice(0, 20);
    for (const url of fotos) {
      const codigoFoto = await wmIncluirFotoUrl(ambiente, hash, created.codigoAnuncio, url);
      await sb.from("webmotors_foto_vinculo").upsert({
        user_id: input.userId,
        veiculo_id: input.veiculoId,
        url_amz: url,
        codigo_foto_wm: codigoFoto,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,veiculo_id,url_amz" });
    }

    const external_id = String(created.codigoAnuncio);
    await sb.from("veiculos_portais").upsert({
      user_id: input.userId,
      veiculo_id: input.veiculoId,
      portal: "webmotors",
      external_id,
      permalink: null,
      category_id: String(mapped.payload.CodigoModalidade),
      status: "published",
      last_error: null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,veiculo_id,portal" });

    return { ok: true, external_id };
  } catch (e) {
    await sb.from("veiculos_portais").upsert({
      user_id: input.userId,
      veiculo_id: input.veiculoId,
      portal: "webmotors",
      status: "error",
      last_error: (e as Error).message,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,veiculo_id,portal" });
    return { ok: false, error: (e as Error).message };
  }
}
