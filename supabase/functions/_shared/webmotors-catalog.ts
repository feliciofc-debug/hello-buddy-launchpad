import type { WebmotorsAmbiente } from "./webmotors-endpoints.ts";
import {
  wmObterCambio,
  wmObterCombustivel,
  wmObterCores,
  wmObterMarca,
  wmObterModalidade,
  wmObterModelo,
  wmObterNumeroPortas,
  wmObterOpcionais,
  wmObterVersao,
  type WmCatalogItem,
} from "./webmotors-car-api.ts";
import type { WmCatalogBundle } from "./webmotors-map-car.ts";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
  manualMap: { codigo_marca?: number | null; codigo_modelo?: number | null } | null,
): Promise<WmCatalogBundle> {
  let marcas = await readCatalogCache(sb, ambiente, "marcas") as WmCatalogItem[] | null;
  if (!marcas) {
    marcas = await wmObterMarca(ambiente, hash);
    await writeCatalogCache(sb, ambiente, "marcas", marcas);
  }

  const marcaCod = manualMap?.codigo_marca ??
    marcas.find((m) => m.nome.toLowerCase() === vehicle.marca.toLowerCase())?.codigo ??
    marcas[0]?.codigo;

  const modelosKey = `modelos:${marcaCod ?? 0}`;
  let modelos = await readCatalogCache(sb, ambiente, modelosKey) as WmCatalogItem[] | null;
  if (!modelos && marcaCod) {
    modelos = await wmObterModelo(ambiente, hash, marcaCod);
    await writeCatalogCache(sb, ambiente, modelosKey, modelos);
  }
  modelos = modelos ?? [];

  const modeloCod = manualMap?.codigo_modelo ??
    modelos.find((m) => m.nome.toLowerCase() === vehicle.modelo.toLowerCase())?.codigo ??
    modelos[0]?.codigo;

  const versoesKey = `versoes:${modeloCod ?? 0}`;
  let versoes = await readCatalogCache(sb, ambiente, versoesKey) as WmCatalogItem[] | null;
  if (!versoes && modeloCod) {
    versoes = await wmObterVersao(ambiente, hash, modeloCod);
    await writeCatalogCache(sb, ambiente, versoesKey, versoes);
  }
  versoes = versoes ?? [];

  async function listCached(key: string, loader: () => Promise<WmCatalogItem[] | number[]>): Promise<any> {
    let cached = await readCatalogCache(sb, ambiente, key);
    if (!cached) {
      cached = await loader();
      await writeCatalogCache(sb, ambiente, key, cached);
    }
    return cached;
  }

  const [cores, combustiveis, cambios, portas, modalidades, opcionais] = await Promise.all([
    listCached("cores", () => wmObterCores(ambiente, hash)),
    listCached("combustiveis", () => wmObterCombustivel(ambiente, hash)),
    listCached("cambios", () => wmObterCambio(ambiente, hash)),
    listCached("portas", () => wmObterNumeroPortas(ambiente, hash)),
    listCached("modalidades", () => wmObterModalidade(ambiente, hash)),
    listCached("opcionais", () => wmObterOpcionais(ambiente, hash)),
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
