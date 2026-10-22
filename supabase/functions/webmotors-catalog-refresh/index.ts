import { webmotorsHashForUser } from "../_shared/webmotors-conta.ts";
import { writeCatalogCache } from "../_shared/webmotors-catalog.ts";
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
    const body = await req.json().catch(() => ({}));
    const admin = webmotorsAdminClient();
    const { hash, ambiente } = await webmotorsHashForUser(admin, user.id);
    const write = (key: string, payload: unknown) =>
      writeCatalogCache(admin, ambiente, `tenant:${user.id}:${key}`, payload);

    const kind = String(body?.kind ?? "all");
    const refreshed: string[] = [];

    if (kind === "all" || kind === "marcas") {
      await write("marcas", await wmObterMarca(ambiente, hash));
      refreshed.push("marcas");
    }
    if (kind === "all" || kind === "cores") {
      await write("cores", await wmObterCores(ambiente, hash));
      refreshed.push("cores");
    }
    if (body?.codigo_marca && (kind === "modelos" || kind === "all")) {
      const cod = Number(body.codigo_marca);
      const key = `modelos:${cod}`;
      await write(key, await wmObterModelo(ambiente, hash, cod));
      refreshed.push(key);
    }
    if (body?.codigo_modelo && (kind === "versoes" || kind === "all")) {
      const cod = Number(body.codigo_modelo);
      const key = `versoes:${cod}`;
      await write(key, await wmObterVersao(ambiente, hash, cod));
      refreshed.push(key);
    }
    if (kind === "all") {
      await write("combustiveis", await wmObterCombustivel(ambiente, hash));
      await write("cambios", await wmObterCambio(ambiente, hash));
      await write("portas", await wmObterNumeroPortas(ambiente, hash));
      await write("modalidades", await wmObterModalidade(ambiente, hash));
      await write("opcionais", await wmObterOpcionais(ambiente, hash));
      refreshed.push("combustiveis", "cambios", "portas", "modalidades", "opcionais");
    }

    return jsonResponse({ success: true, refreshed });
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 422);
  }
});
