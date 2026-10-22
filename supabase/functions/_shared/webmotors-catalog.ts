import type { WebmotorsAmbiente } from "./webmotors-endpoints.ts";
import {
  type WmCatalogItem,
  wmObterCambio,
  wmObterCombustivel,
  wmObterCores,
  wmObterMarca,
  wmObterModalidade,
  wmObterModelo,
  wmObterNumeroPortas,
  wmObterOpcionais,
  wmObterVersao,
} from "./webmotors-car-api.ts";
import type { WmCatalogBundle } from "./webmotors-map-car.ts";
import { normalizeCatalogLabel } from "./webmotors-text.ts";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function scopedWebmotorsCatalogKey(scope: string, key: string): string {
  return `tenant:${scope}:${key}`;
}

export async function readCatalogCache(
  sb: any,
  ambiente: WebmotorsAmbiente,
  cacheKey: string,
): Promise<unknown | null> {
  const { data } = await sb.from("webmotors_catalog_cache")
    .select("payload, fetched_at")
    .eq("ambiente", ambiente)
    .eq("cache_key", cacheKey)
    .maybeSingle();
  if (!data?.fetched_at) return null;
  const age = Date.now() - new Date(data.fetched_at).getTime();
  if (age > CACHE_TTL_MS) return null;
  return data.payload;
}

export async function writeCatalogCache(
  sb: any,
  ambiente: WebmotorsAmbiente,
  cacheKey: string,
  payload: unknown,
): Promise<void> {
  await sb.from("webmotors_catalog_cache").upsert({
    ambiente,
    cache_key: cacheKey,
    payload,
    fetched_at: new Date().toISOString(),
  }, { onConflict: "ambiente,cache_key" });
}

export async function loadCatalogBundleForVehicle(
  sb: any,
  ambiente: WebmotorsAmbiente,
  hash: string,
  vehicle: { marca: string; modelo: string },
  manualMap:
    | { codigo_marca?: number | null; codigo_modelo?: number | null }
    | null,
  cacheScope: string,
): Promise<WmCatalogBundle> {
  const key = (value: string) => scopedWebmotorsCatalogKey(cacheScope, value);
  let marcas = await readCatalogCache(sb, ambiente, key("marcas")) as
    | WmCatalogItem[]
    | null;
  if (!marcas) {
    marcas = await wmObterMarca(ambiente, hash);
    await writeCatalogCache(sb, ambiente, key("marcas"), marcas);
  }

  const marcaCod = manualMap?.codigo_marca ??
    marcas.find((m) =>
      normalizeCatalogLabel(m.nome) === normalizeCatalogLabel(vehicle.marca)
    )?.codigo;

  const modelosKey = key(`modelos:${marcaCod ?? 0}`);
  let modelos = await readCatalogCache(sb, ambiente, modelosKey) as
    | WmCatalogItem[]
    | null;
  if (!modelos && marcaCod) {
    modelos = await wmObterModelo(ambiente, hash, marcaCod);
    await writeCatalogCache(sb, ambiente, modelosKey, modelos);
  }
  modelos = modelos ?? [];

  const modeloCod = manualMap?.codigo_modelo ??
    modelos.find((m) =>
      normalizeCatalogLabel(m.nome) === normalizeCatalogLabel(vehicle.modelo)
    )?.codigo;

  const versoesKey = key(`versoes:${modeloCod ?? 0}`);
  let versoes = await readCatalogCache(sb, ambiente, versoesKey) as
    | WmCatalogItem[]
    | null;
  if (!versoes && modeloCod) {
    versoes = await wmObterVersao(ambiente, hash, modeloCod);
    await writeCatalogCache(sb, ambiente, versoesKey, versoes);
  }
  versoes = versoes ?? [];

  async function listCached(
    key: string,
    loader: () => Promise<WmCatalogItem[] | number[]>,
  ): Promise<any> {
    let cached = await readCatalogCache(sb, ambiente, key);
    if (!cached) {
      cached = await loader();
      await writeCatalogCache(sb, ambiente, key, cached);
    }
    return cached;
  }

  const [cores, combustiveis, cambios, portas, modalidades, opcionais] =
    await Promise.all([
      listCached(key("cores"), () => wmObterCores(ambiente, hash)),
      listCached(key("combustiveis"), () => wmObterCombustivel(ambiente, hash)),
      listCached(key("cambios"), () => wmObterCambio(ambiente, hash)),
      listCached(key("portas"), () => wmObterNumeroPortas(ambiente, hash)),
      listCached(key("modalidades"), () => wmObterModalidade(ambiente, hash)),
      listCached(key("opcionais"), () => wmObterOpcionais(ambiente, hash)),
    ]);

  return {
    marcas,
    modelos,
    versoes,
    cores: cores as WmCatalogItem[],
    combustiveis: combustiveis as WmCatalogItem[],
    cambios: cambios as WmCatalogItem[],
    portas: portas as number[],
    modalidades: modalidades as WmCatalogItem[],
    opcionais: opcionais as WmCatalogItem[],
  };
}
