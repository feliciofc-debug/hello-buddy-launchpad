import type { WebmotorsAmbiente } from "./webmotors-endpoints.ts";
import {
  wmObterCoresMotosUsadas,
  wmObterMarcaMotos,
  wmObterModalidadesMotosUsadas,
  wmObterModeloMotos,
} from "./webmotors-moto-api.ts";
import type { WmMotoCatalogBundle } from "./webmotors-map-moto.ts";
import { readCatalogCache, writeCatalogCache } from "./webmotors-catalog.ts";

export async function loadMotoCatalogBundleForVehicle(
  sb: any,
  ambiente: WebmotorsAmbiente,
  hash: string,
  vehicle: { marca: string; modelo: string },
  manualMap: { codigo_marca?: number | null; codigo_modelo?: number | null } | null,
  cacheScope: string,
): Promise<WmMotoCatalogBundle> {
  const key = (value: string) => `tenant:${cacheScope}:${value}`;
  let marcas = await readCatalogCache(sb, ambiente, key("motos:marcas")) as WmMotoCatalogBundle["marcas"] | null;
  if (!marcas) {
    marcas = await wmObterMarcaMotos(ambiente, hash);
    await writeCatalogCache(sb, ambiente, key("motos:marcas"), marcas);
  }

  const marcaCod = manualMap?.codigo_marca ??
    marcas.find((m) => m.nome.toLowerCase() === vehicle.marca.toLowerCase())?.codigo ??
    null;
  if (!marcaCod) {
    return { marcas, modelos: [], cores: [], modalidades: [] };
  }

  const cacheKey = key(`motos:modelos:${marcaCod}`);
  let modelos = await readCatalogCache(sb, ambiente, cacheKey) as WmMotoCatalogBundle["modelos"] | null;
  if (!modelos) {
    modelos = await wmObterModeloMotos(ambiente, hash, marcaCod);
    await writeCatalogCache(sb, ambiente, cacheKey, modelos);
  }

  let cores = await readCatalogCache(sb, ambiente, key("motos:cores_usadas")) as WmMotoCatalogBundle["cores"] | null;
  if (!cores) {
    cores = await wmObterCoresMotosUsadas(ambiente, hash);
    await writeCatalogCache(sb, ambiente, key("motos:cores_usadas"), cores);
  }

  let modalidades = await readCatalogCache(sb, ambiente, key("motos:modalidades_usadas")) as WmMotoCatalogBundle["modalidades"] | null;
  if (!modalidades) {
    modalidades = await wmObterModalidadesMotosUsadas(ambiente, hash);
    await writeCatalogCache(sb, ambiente, key("motos:modalidades_usadas"), modalidades);
  }

  return { marcas, modelos, cores, modalidades };
}
