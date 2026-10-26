import { webmotorsHashForUser } from "../_shared/webmotors-conta.ts";
import { readCatalogCache, writeCatalogCache } from "../_shared/webmotors-catalog.ts";
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
} from "../_shared/webmotors-car-api.ts";
import {
  jsonResponse,
  optionsResponse,
  webmotorsAdminClient,
  webmotorsAuthedUser,
} from "../_shared/webmotors-http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  try {
    const { user } = await webmotorsAuthedUser(req);
    if (!user) return jsonResponse({ success: false, error: "Não autenticado" }, 401);
    const userId = user.id;
    const body = await req.json();
    const kind = String(body?.kind ?? "");
    const admin = webmotorsAdminClient();
    const { hash, ambiente } = await webmotorsHashForUser(admin, userId);

    async function cachedList(key: string, loader: () => Promise<unknown>) {
      const scopedKey = `tenant:${userId}:${key}`;
      let data = await readCatalogCache(admin, ambiente, scopedKey);
      if (!data) {
        data = await loader();
        await writeCatalogCache(admin, ambiente, scopedKey, data);
      }
      return data;
    }

    let options: unknown = [];
    switch (kind) {
      case "marcas":
        options = await cachedList("marcas", () => wmObterMarca(ambiente, hash));
        break;
      case "modelos": {
        const cod = Number(body?.codigo_marca);
        if (!cod) throw new Error("codigo_marca obrigatório");
        options = await cachedList(`modelos:${cod}`, () => wmObterModelo(ambiente, hash, cod));
        break;
      }
      case "versoes": {
        const cod = Number(body?.codigo_modelo);
        if (!cod) throw new Error("codigo_modelo obrigatório");
        options = await cachedList(`versoes:${cod}`, () => wmObterVersao(ambiente, hash, cod));
        break;
      }
      case "cores":
        options = await cachedList("cores", () => wmObterCores(ambiente, hash));
        break;
      case "combustiveis":
        options = await cachedList("combustiveis", () => wmObterCombustivel(ambiente, hash));
        break;
      case "cambios":
        options = await cachedList("cambios", () => wmObterCambio(ambiente, hash));
        break;
      case "portas":
        options = await cachedList("portas", () => wmObterNumeroPortas(ambiente, hash));
        break;
      case "modalidades":
        options = await cachedList("modalidades", () => wmObterModalidade(ambiente, hash));
        break;
      case "opcionais":
        options = await cachedList("opcionais", () => wmObterOpcionais(ambiente, hash));
        break;
      default:
        throw new Error("kind inválido");
    }

    return jsonResponse({ success: true, options });
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 422);
  }
});
