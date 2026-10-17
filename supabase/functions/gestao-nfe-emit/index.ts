import type { GestaoNfeOperacaoKey } from "../_shared/gestao-nfe-config-default.ts";
import type { GestaoNfeTomadorInput } from "../_shared/gestao-nfe-build.ts";
import {
  inferNfeTipoOperacao,
  loadTomadorForNfe,
  loadVeiculoNfeFields,
  resolveNfeValorTotal,
  tomadorMissingFields,
} from "../_shared/gestao-nfe-context.ts";
import { emitGestaoNfe } from "../_shared/gestao-nfe-service.ts";
import {
  gestaoZapsignAdminClient,
  gestaoZapsignAuthedUser,
  jsonResponse,
  optionsResponse,
} from "../_shared/gestao-zapsign-http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  try {
    const { user } = await gestaoZapsignAuthedUser(req);
    if (!user) return jsonResponse({ success: false, error: "Não autenticado" }, 401);
    const body = await req.json();
    const veiculoId = String(body?.veiculo_id ?? "");
    const tipoHint = body?.tipo_operacao as GestaoNfeOperacaoKey | undefined;
    if (!veiculoId) throw new Error("Informe o veículo.");
    if (body?.confirm !== true && body?.confirm !== "true") {
      throw new Error("Confirme a emissão (confirm: true) após revisar a pré-visualização.");
    }

    const admin = gestaoZapsignAdminClient();
    const tipo = await inferNfeTipoOperacao(admin, user.id, veiculoId, tipoHint ?? null);
    const veiculo = await loadVeiculoNfeFields(admin, user.id, veiculoId);
    if (!veiculo) throw new Error("Veículo não encontrado.");

    const tomadorBase = await loadTomadorForNfe(admin, user.id, veiculoId, tipo);
    const tomador = { ...tomadorBase, ...(body?.tomador ?? {}) } as GestaoNfeTomadorInput;
    const missing = tomadorMissingFields(tomador);
    if (missing.length) {
      throw new Error(`Complete os dados: ${missing.join(", ")}.`);
    }

    const valorTotal = await resolveNfeValorTotal(
      admin,
      user.id,
      veiculoId,
      tipo,
      body?.valor_total != null ? Number(body.valor_total) : null,
    );

    const result = await emitGestaoNfe({
      client: admin,
      userId: user.id,
      veiculoId,
      tipo,
      valorTotal,
      tomador,
      veiculo,
    });

    return jsonResponse({
      success: true,
      nfe_id: result.nfeId,
      focus_ref: result.focusRef,
      status: result.status,
    });
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 422);
  }
});
