import { loadCatalogBundleForVehicle } from "./webmotors-catalog.ts";
import { loadMotoCatalogBundleForVehicle } from "./webmotors-moto-catalog.ts";
import { webmotorsHashForUser } from "./webmotors-conta.ts";
import {
  wmExcluirCarro,
  wmExcluirFoto,
  wmIncluirCarro,
  wmIncluirFotoBase64,
} from "./webmotors-car-api.ts";
import {
  wmExcluirMoto,
  wmIncluirFotoMotoBase64,
  wmIncluirMoto,
} from "./webmotors-moto-api.ts";
import {
  assertWebmotorsPayloadPublicOnly,
  mapVehicleToWebmotorsCar,
} from "./webmotors-map-car.ts";
import {
  assertWebmotorsMotoPayloadPublicOnly,
  mapVehicleToWebmotorsMoto,
} from "./webmotors-map-moto.ts";
import { fetchPublicImageAsBase64 } from "./webmotors-photo-base64.ts";
import {
  resolveWebmotorsAnuncioSnForVehicle,
  webmotorsAnuncioSnValuesFromPayload,
  type WebmotorsAnuncioSnBooleans,
} from "./webmotors-anuncio-sn.ts";
import type { VeiculoEstoqueRow } from "./webmotors-vehicle-types.ts";

const PHOTO_PARTIAL_ERROR =
  "Algumas fotos não foram enviadas. Use Sincronizar.";

export type WebmotorsPublishApi = {
  incluirCarro: typeof wmIncluirCarro;
  incluirFotoBase64: typeof wmIncluirFotoBase64;
};

export type WebmotorsPublishDeps = {
  api?: WebmotorsPublishApi;
  hashForUser?: typeof webmotorsHashForUser;
  loadCatalog?: typeof loadCatalogBundleForVehicle;
  fetchImageBase64?: typeof fetchPublicImageAsBase64;
};

const defaultPublishApi: WebmotorsPublishApi = {
  incluirCarro: wmIncluirCarro,
  incluirFotoBase64: wmIncluirFotoBase64,
};

export async function runWebmotorsVehiclePublish(
  sb: any,
  input: {
    userId: string;
    veiculoId: string;
    anuncioSn?: WebmotorsAnuncioSnBooleans;
  },
  deps: WebmotorsPublishDeps = {},
): Promise<
  { ok: boolean; external_id?: string; error?: string; blocking?: unknown[] }
> {
  const api = deps.api ?? defaultPublishApi;
  const resolveHash = deps.hashForUser ?? webmotorsHashForUser;
  const resolveCatalog = deps.loadCatalog ?? loadCatalogBundleForVehicle;
  const fetchImage = deps.fetchImageBase64 ?? fetchPublicImageAsBase64;
  const { data: vehicle, error: vErr } = await sb.from("veiculos_estoque")
    .select("*")
    .eq("user_id", input.userId)
    .eq("id", input.veiculoId)
    .maybeSingle();
  if (vErr || !vehicle) return { ok: false, error: "Veículo não encontrado" };
  if (vehicle.status === "vendido") {
    return {
      ok: false,
      error:
        "Veículo vendido. Remova manualmente da Webmotors se ainda estiver publicado.",
    };
  }
  if (vehicle.segmento === "moto") {
    return await runWebmotorsMotoPublish(
      sb,
      input,
      vehicle as VeiculoEstoqueRow,
    );
  }

  const { data: portal } = await sb.from("veiculos_portais")
    .select("*")
    .eq("user_id", input.userId)
    .eq("veiculo_id", input.veiculoId)
    .eq("portal", "webmotors")
    .maybeSingle();
  if (portal?.external_id && portal.status !== "closed") {
    return {
      ok: false,
      error:
        "Anúncio já criado na Webmotors. Use Sincronizar para fotos e dados.",
    };
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
    const auth = await resolveHash(sb, input.userId);
    hash = auth.hash;
    ambiente = auth.ambiente;
    defaultModalidade = auth.conta.default_codigo_modalidade;
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  let catalog;
  try {
    catalog = await resolveCatalog(
      sb,
      ambiente,
      hash,
      vehicle as VeiculoEstoqueRow,
      mapRow,
      input.userId,
    );
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const snResolved = resolveWebmotorsAnuncioSnForVehicle({
    request: input.anuncioSn ?? {},
    stored: undefined,
  });

  const mapped = mapVehicleToWebmotorsCar({
    vehicle: vehicle as VeiculoEstoqueRow,
    manualMap: mapRow,
    catalog,
    defaultModalidade,
    anuncioSn: snResolved.booleans,
  });
  if (!mapped.ok) {
    return {
      ok: false,
      blocking: mapped.blocking,
      error: "Complete os campos ou ajuste o de/para Webmotors.",
    };
  }
  assertWebmotorsPayloadPublicOnly(mapped.payload);

  try {
    const created = await api.incluirCarro(ambiente, hash, mapped.payload);
    const external_id = String(created.codigoAnuncio);
    const anuncioSnSaved = webmotorsAnuncioSnValuesFromPayload(mapped.payload);

    const { error: portalSaveError } = await sb.from("veiculos_portais").upsert({
      user_id: input.userId,
      veiculo_id: input.veiculoId,
      portal: "webmotors",
      external_id,
      permalink: null,
      category_id: String(mapped.payload.CodigoModalidade),
      managed_by_platform: true,
      status: "published",
      anuncio_sn: anuncioSnSaved,
      last_error: null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,veiculo_id,portal" });
    if (portalSaveError) {
      try {
        await wmExcluirCarro(ambiente, hash, created.codigoAnuncio, "3");
      } catch {
        // A falha original continua sendo a mais útil; a compensação é best effort.
      }
      throw new Error("Não foi possível salvar o vínculo do anúncio Webmotors.");
    }

    const fotos = ((vehicle as VeiculoEstoqueRow).fotos ?? []).filter(Boolean);
    let photoFailed = false;
    for (const [ordem, url] of fotos.entries()) {
      try {
        const b64 = await fetchImage(url);
        const codigoFoto = await api.incluirFotoBase64(
          ambiente,
          hash,
          created.codigoAnuncio,
          b64,
        );
        const { error: photoLinkError } = await sb.from(
          "webmotors_foto_vinculo",
        ).upsert({
          user_id: input.userId,
          veiculo_id: input.veiculoId,
          url_amz: url,
          codigo_foto_wm: codigoFoto,
          ordem,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,veiculo_id,url_amz" });
        if (photoLinkError) {
          await wmExcluirFoto(
            ambiente,
            hash,
            created.codigoAnuncio,
            codigoFoto,
          );
          throw new Error("Não foi possível salvar o vínculo da foto.");
        }
      } catch {
        photoFailed = true;
      }
    }

    if (photoFailed) {
      await sb.from("veiculos_portais").update({
        status: "published",
        last_error: PHOTO_PARTIAL_ERROR,
        updated_at: new Date().toISOString(),
      }).eq("user_id", input.userId).eq("veiculo_id", input.veiculoId).eq(
        "portal",
        "webmotors",
      );
      return { ok: true, external_id, error: PHOTO_PARTIAL_ERROR };
    }

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

async function runWebmotorsMotoPublish(
  sb: any,
  input: { userId: string; veiculoId: string },
  vehicle: VeiculoEstoqueRow,
): Promise<
  { ok: boolean; external_id?: string; error?: string; blocking?: unknown[] }
> {
  const { data: portal } = await sb.from("veiculos_portais")
    .select("*")
    .eq("user_id", input.userId)
    .eq("veiculo_id", input.veiculoId)
    .eq("portal", "webmotors")
    .maybeSingle();
  if (portal?.external_id && portal.status !== "closed") {
    return {
      ok: false,
      error:
        "Anúncio já criado na Webmotors. Use Sincronizar para fotos e dados.",
    };
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
    catalog = await loadMotoCatalogBundleForVehicle(
      sb,
      ambiente,
      hash,
      vehicle,
      mapRow,
      input.userId,
    );
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const mapped = mapVehicleToWebmotorsMoto({
    vehicle,
    manualMap: mapRow,
    catalog,
    defaultModalidade,
  });
  if (!mapped.ok) {
    return {
      ok: false,
      blocking: mapped.blocking,
      error: "Complete os campos ou ajuste o de/para Webmotors.",
    };
  }
  assertWebmotorsMotoPayloadPublicOnly(mapped.payload);

  try {
    const created = await wmIncluirMoto(ambiente, hash, mapped.payload);
    const external_id = String(created.codigoAnuncio);

    const { error: portalSaveError } = await sb.from("veiculos_portais").upsert({
      user_id: input.userId,
      veiculo_id: input.veiculoId,
      portal: "webmotors",
      external_id,
      permalink: null,
      category_id: String(mapped.payload.CodigoModalidade),
      managed_by_platform: true,
      status: "published",
      last_error: null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,veiculo_id,portal" });
    if (portalSaveError) {
      try {
        await wmExcluirMoto(ambiente, hash, created.codigoAnuncio, "3");
      } catch {
        // Compensação best effort; não expõe credenciais nem mascara a falha local.
      }
      throw new Error("Não foi possível salvar o vínculo do anúncio Webmotors.");
    }

    const fotos = (vehicle.fotos ?? []).filter(Boolean);
    let photoFailed = false;
    for (const [ordem, url] of fotos.entries()) {
      try {
        const b64 = await fetchPublicImageAsBase64(url);
        const codigoFoto = await wmIncluirFotoMotoBase64(
          ambiente,
          hash,
          created.codigoAnuncio,
          b64,
        );
        const { error: photoLinkError } = await sb.from(
          "webmotors_foto_vinculo",
        ).upsert({
          user_id: input.userId,
          veiculo_id: input.veiculoId,
          url_amz: url,
          codigo_foto_wm: codigoFoto,
          ordem,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,veiculo_id,url_amz" });
        if (photoLinkError) {
          throw new Error("Não foi possível salvar o vínculo da foto.");
        }
      } catch {
        photoFailed = true;
      }
    }

    if (photoFailed) {
      await sb.from("veiculos_portais").update({
        status: "published",
        last_error: PHOTO_PARTIAL_ERROR,
        updated_at: new Date().toISOString(),
      }).eq("user_id", input.userId).eq("veiculo_id", input.veiculoId).eq(
        "portal",
        "webmotors",
      );
      return { ok: true, external_id, error: PHOTO_PARTIAL_ERROR };
    }

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
