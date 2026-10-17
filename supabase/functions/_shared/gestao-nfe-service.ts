import { decryptGestaoIntegracaoSecret } from "./gestao-integracoes-crypto.ts";
import {
  focusNfeAbsoluteUrl,
  focusNfeCancelar,
  focusNfeCartaCorrecao,
  focusNfeConsultar,
  focusNfeEmitir,
  mapFocusStatusToGestao,
  type GestaoFocusAmbiente,
} from "./gestao-focusnfe-api.ts";
import {
  buildFocusNfePayload,
  type GestaoNfeEmitenteConfig,
  type GestaoNfeTomadorInput,
  type GestaoNfeVeiculoInput,
} from "./gestao-nfe-build.ts";
import type { GestaoNfeOperacaoKey, GestaoNfeOperacoesJson } from "./gestao-nfe-config-default.ts";
import { defaultGestaoNfeOperacoes } from "./gestao-nfe-config-default.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any };

export async function loadFocusTokenForUser(
  client: Db,
  userId: string,
): Promise<{ token: string; ambiente: GestaoFocusAmbiente } | null> {
  const { data } = await client.from("gestao_focusnfe_conta")
    .select("token_enc, ambiente, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || data.status !== "active") return null;
  const token = await decryptGestaoIntegracaoSecret(String(data.token_enc));
  const ambiente = data.ambiente === "producao" ? "producao" : "homolog";
  return { token, ambiente };
}

export async function loadNfeConfig(client: Db, userId: string) {
  const { data } = await client.from("gestao_nfe_config")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  const ops = (data.operacoes_json ?? {}) as GestaoNfeOperacoesJson;
  return {
    ...data,
    operacoes_json: { ...defaultGestaoNfeOperacoes(), ...ops },
  };
}

export function operacaoFromConfig(
  config: { operacoes_json: GestaoNfeOperacoesJson },
  tipo: GestaoNfeOperacaoKey,
) {
  const op = config.operacoes_json[tipo];
  if (!op) throw new Error("Configure a operação fiscal antes de emitir.");
  return op;
}

export async function syncGestaoNfeFromFocus(
  client: Db,
  userId: string,
  nfeId: string,
  token: string,
  ambiente: GestaoFocusAmbiente,
  focusRef: string,
): Promise<void> {
  const consulta = await focusNfeConsultar(ambiente, token, focusRef);
  const status = mapFocusStatusToGestao(consulta.status);
  const patch: Record<string, unknown> = {
    status,
    mensagem_status: consulta.mensagem_sefaz?.slice(0, 500) ?? null,
    chave_acesso: consulta.chave_nfe ?? null,
    numero: consulta.numero != null ? Number(consulta.numero) : null,
    serie: consulta.serie != null ? Number(consulta.serie) : null,
    danfe_url: focusNfeAbsoluteUrl(ambiente, consulta.caminho_danfe),
    xml_url: focusNfeAbsoluteUrl(ambiente, consulta.caminho_xml_nota_fiscal),
    updated_at: new Date().toISOString(),
  };
  if (status === "autorizada") {
    patch.authorized_at = new Date().toISOString();
  }
  await client.from("gestao_nfe").update(patch)
    .eq("user_id", userId)
    .eq("id", nfeId);
}

export async function emitGestaoNfe(input: {
  client: Db;
  userId: string;
  veiculoId: string;
  tipo: GestaoNfeOperacaoKey;
  valorTotal: number;
  tomador: GestaoNfeTomadorInput;
  veiculo: GestaoNfeVeiculoInput;
}): Promise<{ nfeId: string; focusRef: string; status: string }> {
  const auth = await loadFocusTokenForUser(input.client, input.userId);
  if (!auth) throw new Error("Conecte a Focus NFe em Integrações.");

  const config = await loadNfeConfig(input.client, input.userId);
  if (!config) throw new Error("Configure os dados fiscais da loja antes de emitir.");

  const emitente: GestaoNfeEmitenteConfig = {
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

  const op = operacaoFromConfig(config, input.tipo);
  const focusRef = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
  const payload = buildFocusNfePayload({
    tipo: input.tipo,
    emitente,
    operacao: op,
    veiculo: input.veiculo,
    valorTotal: input.valorTotal,
    tomador: input.tomador,
  });

  const enderecoResumo = [
    input.tomador.logradouro,
    input.tomador.numero,
    input.tomador.municipio,
    input.tomador.uf,
  ].filter(Boolean).join(", ").slice(0, 200);

  const { data: row, error } = await input.client.from("gestao_nfe").insert({
    user_id: input.userId,
    veiculo_id: input.veiculoId,
    tipo_operacao: input.tipo,
    focus_ref: focusRef,
    status: "processando",
    valor_total: input.valorTotal,
    cliente_nome: input.tomador.nome.slice(0, 120),
    cliente_cpf_cnpj: input.tomador.cpf_cnpj.replace(/\D/g, "").slice(0, 14),
    cliente_endereco_resumo: enderecoResumo,
  }).select("id").single();
  if (error || !row?.id) throw new Error("Não foi possível registrar a NF-e.");

  try {
    const res = await focusNfeEmitir(auth.ambiente, auth.token, focusRef, payload);
    const status = mapFocusStatusToGestao(res.status);
    await input.client.from("gestao_nfe").update({
      status,
      mensagem_status: res.mensagem_sefaz?.slice(0, 500) ?? null,
      chave_acesso: res.chave_nfe ?? null,
      numero: res.numero != null ? Number(res.numero) : null,
      serie: res.serie != null ? Number(res.serie) : null,
      danfe_url: focusNfeAbsoluteUrl(auth.ambiente, res.caminho_danfe),
      xml_url: focusNfeAbsoluteUrl(auth.ambiente, res.caminho_xml_nota_fiscal),
      updated_at: new Date().toISOString(),
      authorized_at: status === "autorizada" ? new Date().toISOString() : null,
    }).eq("id", row.id).eq("user_id", input.userId);

    if (status === "processando") {
      await syncGestaoNfeFromFocus(
        input.client,
        input.userId,
        row.id,
        auth.token,
        auth.ambiente,
        focusRef,
      );
    }

    const { data: final } = await input.client.from("gestao_nfe").select("status")
      .eq("id", row.id).maybeSingle();
    return { nfeId: row.id, focusRef, status: String(final?.status ?? status) };
  } catch (e) {
    await input.client.from("gestao_nfe").update({
      status: "erro",
      mensagem_status: String((e as Error).message).slice(0, 500),
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    throw e;
  }
}

export async function cancelGestaoNfe(
  client: Db,
  userId: string,
  nfeId: string,
  justificativa: string,
): Promise<void> {
  const auth = await loadFocusTokenForUser(client, userId);
  if (!auth) throw new Error("Focus NFe não conectada.");

  const { data: nfe } = await client.from("gestao_nfe").select("*")
    .eq("user_id", userId).eq("id", nfeId).maybeSingle();
  if (!nfe?.focus_ref) throw new Error("NF-e não encontrada.");

  await focusNfeCancelar(auth.ambiente, auth.token, nfe.focus_ref, justificativa);
  await syncGestaoNfeFromFocus(client, userId, nfeId, auth.token, auth.ambiente, nfe.focus_ref);
}

export async function cceGestaoNfe(
  client: Db,
  userId: string,
  nfeId: string,
  correcao: string,
): Promise<void> {
  const auth = await loadFocusTokenForUser(client, userId);
  if (!auth) throw new Error("Focus NFe não conectada.");

  const { data: nfe } = await client.from("gestao_nfe").select("*")
    .eq("user_id", userId).eq("id", nfeId).maybeSingle();
  if (!nfe?.focus_ref) throw new Error("NF-e não encontrada.");

  await focusNfeCartaCorrecao(auth.ambiente, auth.token, nfe.focus_ref, correcao);
  await syncGestaoNfeFromFocus(client, userId, nfeId, auth.token, auth.ambiente, nfe.focus_ref);
}
