import { webmotorsHashForUser } from "./webmotors-conta.ts";
import { wmExcluirCarro } from "./webmotors-car-api.ts";
import { wmExcluirMoto } from "./webmotors-moto-api.ts";

export async function runWebmotorsVehicleUnpublish(
  sb: any,
  input: { userId: string; veiculoId: string; motivo?: string },
): Promise<{ ok: boolean; error?: string }> {
  const { data: vehicle } = await sb.from("veiculos_estoque")
    .select("segmento")
    .eq("user_id", input.userId)
    .eq("id", input.veiculoId)
    .maybeSingle();

  const { data: portal } = await sb.from("veiculos_portais")
    .select("*")
    .eq("user_id", input.userId)
    .eq("veiculo_id", input.veiculoId)
    .eq("portal", "webmotors")
    .maybeSingle();
  if (!portal?.external_id) {
    return {
      ok: false,
      error: "Não há anúncio Webmotors vinculado a este veículo.",
    };
  }
  if (portal.managed_by_platform !== true) {
    return {
      ok: false,
      error:
        "Este anúncio não foi criado pela plataforma e não pode ser excluído.",
    };
  }

  let hash: string;
  let ambiente: "homolog" | "producao";
  try {
    const auth = await webmotorsHashForUser(sb, input.userId);
    hash = auth.hash;
    ambiente = auth.ambiente;
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  try {
    const requestedReason = input.motivo?.trim() ?? "";
    const motivo = ["1", "2", "3"].includes(requestedReason)
      ? requestedReason
      : "3";
    if (vehicle?.segmento === "moto") {
      await wmExcluirMoto(ambiente, hash, Number(portal.external_id), motivo);
    } else {
      await wmExcluirCarro(ambiente, hash, Number(portal.external_id), motivo);
    }
    await sb.from("veiculos_portais").update({
      status: "closed",
      last_error: null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("user_id", input.userId).eq("veiculo_id", input.veiculoId).eq(
      "portal",
      "webmotors",
    );

    await sb.from("webmotors_foto_vinculo").delete()
      .eq("user_id", input.userId)
      .eq("veiculo_id", input.veiculoId);

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
