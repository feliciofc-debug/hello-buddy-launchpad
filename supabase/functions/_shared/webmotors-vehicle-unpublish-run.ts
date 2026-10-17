import { webmotorsHashForUser } from "./webmotors-conta.ts";
import { wmExcluirCarro } from "./webmotors-car-api.ts";

export async function runWebmotorsVehicleUnpublish(
  sb: any,
  input: { userId: string; veiculoId: string; motivo?: string },
): Promise<{ ok: boolean; error?: string }> {
  const { data: portal } = await sb.from("veiculos_portais")
    .select("*")
    .eq("user_id", input.userId)
    .eq("veiculo_id", input.veiculoId)
    .eq("portal", "webmotors")
    .maybeSingle();
  if (!portal?.external_id) {
    return { ok: false, error: "Não há anúncio Webmotors vinculado a este veículo." };
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
    await wmExcluirCarro(
      ambiente,
      hash,
      Number(portal.external_id),
      input.motivo?.trim() || "Removido pelo estoque AMZ",
    );
    await sb.from("veiculos_portais").update({
      status: "closed",
      last_error: null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("user_id", input.userId).eq("veiculo_id", input.veiculoId).eq("portal", "webmotors");

    await sb.from("webmotors_foto_vinculo").delete()
      .eq("user_id", input.userId)
      .eq("veiculo_id", input.veiculoId);

    return { ok: true };
  } catch (e) {
    await sb.from("veiculos_portais").update({
      last_error: (e as Error).message,
      updated_at: new Date().toISOString(),
    }).eq("user_id", input.userId).eq("veiculo_id", input.veiculoId).eq("portal", "webmotors");
    return { ok: false, error: (e as Error).message };
  }
}
