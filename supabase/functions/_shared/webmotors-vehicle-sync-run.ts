import { loadCatalogBundleForVehicle } from "./webmotors-catalog.ts";
import { loadMotoCatalogBundleForVehicle } from "./webmotors-moto-catalog.ts";
import { webmotorsHashForUser } from "./webmotors-conta.ts";
import {
  wmAlterarCarro,
  wmExcluirFoto,
  wmIncluirFotoBase64,
} from "./webmotors-car-api.ts";
import {
  wmAlterarMoto,
  wmIncluirFotoMotoBase64,
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
import type { WebmotorsAnuncioSnBooleans } from "./webmotors-anuncio-sn.ts";
import type { VeiculoEstoqueRow } from "./webmotors-vehicle-types.ts";

export function webmotorsPhotoOrderChanged(
  desiredUrls: string[],
  links: Array<{ url_amz: string; ordem: number | null }>,
): boolean {
  const currentUrls = [...links]
    .sort((a, b) =>
      (a.ordem ?? Number.MAX_SAFE_INTEGER) -
      (b.ordem ?? Number.MAX_SAFE_INTEGER)
    )
    .map((row) => row.url_amz);
  return JSON.stringify(currentUrls) !== JSON.stringify(desiredUrls);
}

export async function runWebmotorsVehicleSync(
  sb: any,
  input: {
    userId: string;
    veiculoId: string;
    anuncioSn?: WebmotorsAnuncioSnBooleans;
  },
): Promise<{ ok: boolean; error?: string; blocking?: unknown[] }> {
  const { data: vehicle } = await sb.from("veiculos_estoque")
    .select("*")
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
  if (portal.managed_by_platform !== true) {
    return {
      ok: false,
      error:
        "Este anúncio não foi criado pela plataforma e não pode ser alterado.",
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

  const codigoAnuncio = Number(portal.external_id);
  let catalog;
  try {
    catalog = await loadCatalogBundleForVehicle(
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

  const mapped = mapVehicleToWebmotorsCar({
    vehicle: vehicle as VeiculoEstoqueRow,
    manualMap: mapRow,
    catalog,
    defaultModalidade,
    existingCodigoAnuncio: codigoAnuncio,
    anuncioSn: input.anuncioSn,
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
    await wmAlterarCarro(ambiente, hash, mapped.payload);

    const fotos = ((vehicle as VeiculoEstoqueRow).fotos ?? []).filter(Boolean);
    const { data: vinculos, error: linksError } = await sb.from("webmotors_foto_vinculo")
      .select("url_amz, codigo_foto_wm, ordem")
      .eq("user_id", input.userId)
      .eq("veiculo_id", input.veiculoId);
    if (linksError) {
      throw new Error("Não foi possível ler os vínculos de fotos Webmotors.");
    }
    const orderedLinks = [...(vinculos ?? [])].sort((
      a: { ordem: number | null },
      b: { ordem: number | null },
    ) =>
      (a.ordem ?? Number.MAX_SAFE_INTEGER) -
      (b.ordem ?? Number.MAX_SAFE_INTEGER)
    );
    if (webmotorsPhotoOrderChanged(fotos, vinculos ?? [])) {
      const preparedPhotos = await Promise.all(
        fotos.map(async (url) => ({
          url,
          base64: await fetchPublicImageAsBase64(url),
        })),
      );
      for (
        const row of orderedLinks as Array<{
          url_amz: string;
          codigo_foto_wm: number;
        }>
      ) {
        await wmExcluirFoto(
          ambiente,
          hash,
          codigoAnuncio,
          row.codigo_foto_wm,
        );
        const { error: deleteLinkError } = await sb.from(
          "webmotors_foto_vinculo",
        ).delete()
          .eq("user_id", input.userId)
          .eq("veiculo_id", input.veiculoId)
          .eq("url_amz", row.url_amz);
        if (deleteLinkError) {
          throw new Error("Não foi possível atualizar o vínculo de uma foto.");
        }
      }

      for (const [ordem, photo] of preparedPhotos.entries()) {
        const codigoFoto = await wmIncluirFotoBase64(
          ambiente,
          hash,
          codigoAnuncio,
          photo.base64,
        );
        const { error: insertLinkError } = await sb.from(
          "webmotors_foto_vinculo",
        ).upsert({
          user_id: input.userId,
          veiculo_id: input.veiculoId,
          url_amz: photo.url,
          codigo_foto_wm: codigoFoto,
          ordem,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,veiculo_id,url_amz" });
        if (insertLinkError) {
          await wmExcluirFoto(ambiente, hash, codigoAnuncio, codigoFoto);
          throw new Error("Não foi possível salvar o vínculo de uma foto.");
        }
      }
    }

    await sb.from("veiculos_portais").update({
      status: "published",
      last_error: null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("user_id", input.userId).eq("veiculo_id", input.veiculoId).eq(
      "portal",
      "webmotors",
    );

    return { ok: true };
  } catch (e) {
    await sb.from("veiculos_portais").update({
      last_error: (e as Error).message,
      updated_at: new Date().toISOString(),
    }).eq("user_id", input.userId).eq("veiculo_id", input.veiculoId).eq(
      "portal",
      "webmotors",
    );
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
  if (portal.managed_by_platform !== true) {
    return {
      ok: false,
      error:
        "Este anúncio não foi criado pela plataforma e não pode ser alterado.",
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

  const codigoAnuncio = Number(portal.external_id);
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
    existingCodigoAnuncio: codigoAnuncio,
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
    await wmAlterarMoto(ambiente, hash, mapped.payload);

    const fotos = (vehicle.fotos ?? []).filter(Boolean);
    const { data: vinculos } = await sb.from("webmotors_foto_vinculo")
      .select("url_amz, codigo_foto_wm")
      .eq("user_id", input.userId)
      .eq("veiculo_id", input.veiculoId);
    const byUrl = new Map<string, number>(
      (vinculos ?? []).map((
        r: { url_amz: string; codigo_foto_wm: number },
      ) => [r.url_amz, r.codigo_foto_wm]),
    );

    for (const url of fotos) {
      if (!byUrl.has(url)) {
        const b64 = await fetchPublicImageAsBase64(url);
        const codigoFoto = await wmIncluirFotoMotoBase64(
          ambiente,
          hash,
          codigoAnuncio,
          b64,
        );
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
    }).eq("user_id", input.userId).eq("veiculo_id", input.veiculoId).eq(
      "portal",
      "webmotors",
    );

    return { ok: true };
  } catch (e) {
    await sb.from("veiculos_portais").update({
      last_error: (e as Error).message,
      updated_at: new Date().toISOString(),
    }).eq("user_id", input.userId).eq("veiculo_id", input.veiculoId).eq(
      "portal",
      "webmotors",
    );
    return { ok: false, error: (e as Error).message };
  }
}
