import { loadCatalogBundleForVehicle } from "./webmotors-catalog.ts";
import { loadMotoCatalogBundleForVehicle } from "./webmotors-moto-catalog.ts";
import { webmotorsHashForUser } from "./webmotors-conta.ts";
import {
  wmAlterarCarro,
  wmExcluirFoto,
  wmIncluirFotoUrl,
} from "./webmotors-car-api.ts";
import { wmAlterarMoto, wmIncluirFotoMotoBase64 } from "./webmotors-moto-api.ts";
import { assertWebmotorsPayloadPublicOnly, mapVehicleToWebmotorsCar } from "./webmotors-map-car.ts";
import {
  assertWebmotorsMotoPayloadPublicOnly,
  mapVehicleToWebmotorsMoto,
} from "./webmotors-map-moto.ts";
import { fetchPublicImageAsBase64 } from "./webmotors-photo-base64.ts";
import {
  type VeiculoEstoqueRow,
  WEBMOTORS_PUBLIC_VEHICLE_SELECT,
} from "./webmotors-vehicle-types.ts";

export async function runWebmotorsVehicleSync(
  sb: any,
  input: { userId: string; veiculoId: string },
): Promise<{ ok: boolean; error?: string; blocking?: unknown[] }> {
  const { data: vehicle } = await sb.from("veiculos_estoque")
    .select(WEBMOTORS_PUBLIC_VEHICLE_SELECT)
    .eq("user_id", input.userId)
    .eq("id", input.veiculoId)
    .maybeSingle();
  if (!vehicle) return { ok: false, error: "Veículo não encontrado" };
  if (vehicle.segmento === "moto") {
    return await runWebmotorsMotoSync(sb, input, vehicle as VeiculoEstoqueRow);
  }

  const { data: portal } = await sb.from("veiculos_portais")
    .select("*")
    .eq("user_id", input.userId)
    .eq("veiculo_id", input.veiculoId)
    .eq("portal", "webmotors")
    .maybeSingle();
  if (!portal?.external_id) {
    return { ok: false, error: "Veículo ainda não publicado na Webmotors." };
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

  const codigoAnuncio = Number(portal.external_id);
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
    existingCodigoAnuncio: codigoAnuncio,
  });
  if (!mapped.ok) {
    return { ok: false, blocking: mapped.blocking, error: "Complete os campos ou ajuste o de/para Webmotors." };
  }
  assertWebmotorsPayloadPublicOnly(mapped.payload);

  try {
    await wmAlterarCarro(ambiente, hash, mapped.payload);

    const fotos = ((vehicle as VeiculoEstoqueRow).fotos ?? []).filter(Boolean);
    const { data: vinculos } = await sb.from("webmotors_foto_vinculo")
      .select("url_amz, codigo_foto_wm")
      .eq("user_id", input.userId)
      .eq("veiculo_id", input.veiculoId);
    const byUrl = new Map<string, number>(
      (vinculos ?? []).map((r: { url_amz: string; codigo_foto_wm: number }) => [r.url_amz, r.codigo_foto_wm]),
    );

    for (const url of fotos) {
      if (!byUrl.has(url)) {
        const codigoFoto = await wmIncluirFotoUrl(ambiente, hash, codigoAnuncio, url);
        await sb.from("webmotors_foto_vinculo").upsert({
          user_id: input.userId,
          veiculo_id: input.veiculoId,
          url_amz: url,
          codigo_foto_wm: codigoFoto,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,veiculo_id,url_amz" });
      }
    }

    const removed = [...byUrl.keys()].filter((u) => !fotos.includes(u));
    for (const url of removed) {
      const codigoFoto = byUrl.get(url)!;
      await wmExcluirFoto(ambiente, hash, codigoAnuncio, codigoFoto);
      await sb.from("webmotors_foto_vinculo").delete()
        .eq("user_id", input.userId)
        .eq("veiculo_id", input.veiculoId)
        .eq("url_amz", url);
    }

    await sb.from("veiculos_portais").update({
      status: "published",
      last_error: null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("user_id", input.userId).eq("veiculo_id", input.veiculoId).eq("portal", "webmotors");

    return { ok: true };
  } catch (e) {
    await sb.from("veiculos_portais").update({
      last_error: (e as Error).message,
      updated_at: new Date().toISOString(),
    }).eq("user_id", input.userId).eq("veiculo_id", input.veiculoId).eq("portal", "webmotors");
    return { ok: false, error: (e as Error).message };
  }
}

async function runWebmotorsMotoSync(
  sb: any,
  input: { userId: string; veiculoId: string },
  vehicle: VeiculoEstoqueRow,
): Promise<{ ok: boolean; error?: string; blocking?: unknown[] }> {
  const { data: portal } = await sb.from("veiculos_portais")
    .select("*")
    .eq("user_id", input.userId)
    .eq("veiculo_id", input.veiculoId)
    .eq("portal", "webmotors")
    .maybeSingle();
  if (!portal?.external_id) {
    return { ok: false, error: "Veículo ainda não publicado na Webmotors." };
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

  const codigoAnuncio = Number(portal.external_id);
  let catalog;
  try {
    catalog = await loadMotoCatalogBundleForVehicle(
      sb,
      ambiente,
      hash,
      vehicle,
      mapRow,
    );
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const mapped = mapVehicleToWebmotorsMoto({
    vehicle,
    manualMap: mapRow,
    catalog,
    defaultModalidade,
    existingCodigoAnuncio: codigoAnuncio,
  });
  if (!mapped.ok) {
    return { ok: false, blocking: mapped.blocking, error: "Complete os campos ou ajuste o de/para Webmotors." };
  }
  assertWebmotorsMotoPayloadPublicOnly(mapped.payload);

  try {
    await wmAlterarMoto(ambiente, hash, mapped.payload);

    const fotos = (vehicle.fotos ?? []).filter(Boolean);
    const { data: vinculos } = await sb.from("webmotors_foto_vinculo")
      .select("url_amz, codigo_foto_wm")
      .eq("user_id", input.userId)
      .eq("veiculo_id", input.veiculoId);
    const byUrl = new Map<string, number>(
      (vinculos ?? []).map((r: { url_amz: string; codigo_foto_wm: number }) => [r.url_amz, r.codigo_foto_wm]),
    );

    for (const url of fotos) {
      if (!byUrl.has(url)) {
        const b64 = await fetchPublicImageAsBase64(url);
        const codigoFoto = await wmIncluirFotoMotoBase64(ambiente, hash, codigoAnuncio, b64);
        await sb.from("webmotors_foto_vinculo").upsert({
          user_id: input.userId,
          veiculo_id: input.veiculoId,
          url_amz: url,
          codigo_foto_wm: codigoFoto,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,veiculo_id,url_amz" });
      }
    }

    await sb.from("veiculos_portais").update({
      status: "published",
      last_error: null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("user_id", input.userId).eq("veiculo_id", input.veiculoId).eq("portal", "webmotors");

    return { ok: true };
  } catch (e) {
    await sb.from("veiculos_portais").update({
      last_error: (e as Error).message,
      updated_at: new Date().toISOString(),
    }).eq("user_id", input.userId).eq("veiculo_id", input.veiculoId).eq("portal", "webmotors");
    return { ok: false, error: (e as Error).message };
  }
}
