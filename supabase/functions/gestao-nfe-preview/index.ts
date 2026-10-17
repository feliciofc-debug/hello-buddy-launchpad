import { buildFocusNfePayload, buildNfePreviewResumo } from "../_shared/gestao-nfe-build.ts";
import type { GestaoNfeOperacaoKey } from "../_shared/gestao-nfe-config-default.ts";
import {
  inferNfeTipoOperacao,
  loadTomadorForNfe,
  loadVeiculoNfeFields,
  resolveNfeValorTotal,
  tomadorMissingFields,
} from "../_shared/gestao-nfe-context.ts";
import { loadNfeConfig, loadFocusTokenForUser, operacaoFromConfig } from "../_shared/gestao-nfe-service.ts";
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
    const tomadorBody = body?.tomador ?? null;
    if (!veiculoId) throw new Error("Informe o veículo.");

    const admin = gestaoZapsignAdminClient();
    const auth = await loadFocusTokenForUser(admin, user.id);
    if (!auth) throw new Error("Conecte a Focus NFe em Integrações.");

    const config = await loadNfeConfig(admin, user.id);
    if (!config) throw new Error("Configure os dados fiscais da loja.");

    const tipo = await inferNfeTipoOperacao(admin, user.id, veiculoId, tipoHint ?? null);
    const veiculo = await loadVeiculoNfeFields(admin, user.id, veiculoId);
    if (!veiculo) throw new Error("Veículo não encontrado.");

    const tomadorBase = await loadTomadorForNfe(admin, user.id, veiculoId, tipo);
    const tomador = { ...tomadorBase, ...(tomadorBody ?? {}) };
    const missing = tomadorMissingFields(tomador);
    const valorTotal = await resolveNfeValorTotal(
      admin,
      user.id,
      veiculoId,
      tipo,
      body?.valor_total != null ? Number(body.valor_total) : null,
    );

    const op = operacaoFromConfig(config, tipo);
    const emitente = {
      cnpj: String(config.cnpj),
      inscricao_estadual: String(config.inscricao_estadual),
      regime_tributario: String(config.regime_tributario),
      razao_social: String(config.razao_social),
      nome_fantasia: String(config.nome_fantasia),
      logradouro: String(config.logradouro),
      numero: String(config.numero),
      complemento: config.complemento ?? null,
      bairro: String(config.bairro),
      municipio: String(config.municipio),
      uf: String(config.uf),
      cep: String(config.cep),
    };

    let payload: Record<string, unknown> | null = null;
    if (missing.length === 0) {
      payload = buildFocusNfePayload({
        tipo,
        emitente,
        operacao: op,
        veiculo,
        valorTotal,
        tomador: tomador as never,
      });
    }

    const veiculoLabel = [veiculo.marca, veiculo.modelo, veiculo.placa].filter(Boolean).join(" ");
    const resumo = buildNfePreviewResumo({
      tipo,
      veiculoLabel,
      valor: valorTotal,
      tomadorNome: String(tomador.nome ?? ""),
      cfop: op.cfop,
      natureza: op.natureza_operacao,
      ambiente: auth.ambiente,
    });

    return jsonResponse({
      success: true,
      tipo_operacao: tipo,
      valor_total: valorTotal,
      resumo,
      missing_fields: missing,
      payload_preview: payload,
      ambiente: auth.ambiente,
    });
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 422);
  }
});
