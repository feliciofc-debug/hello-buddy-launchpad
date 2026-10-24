import { hojeSaoPaulo } from "../../supabase/functions/_shared/gestao-date-br.ts";
import { supabase } from "@/integrations/supabase/client";
import { parseGestaoMoneyField } from "@/lib/gestao-money.ts";

export type ConsignacaoFormValue = {
  consignanteNome: string;
  valorGarantido: string;
  pctLoja: string;
  pisoLoja: string;
  precoMinimo: string;
  dataInicio: string;
  prazoDias: string;
  observacao: string;
};

export function emptyConsignacaoForm(): ConsignacaoFormValue {
  return {
    consignanteNome: "",
    valorGarantido: "",
    pctLoja: "100",
    pisoLoja: "",
    precoMinimo: "",
    dataInicio: hojeSaoPaulo(),
    prazoDias: "90",
    observacao: "",
  };
}

export function validateConsignacaoForm(value: ConsignacaoFormValue): string | null {
  const pct = Number(value.pctLoja.replace(",", "."));
  const prazo = Number(value.prazoDias);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    return "O percentual da loja deve estar entre 0 e 100.";
  }
  if (!Number.isInteger(prazo) || prazo <= 0) {
    return "O prazo da consignação deve ser maior que zero.";
  }
  if (!value.dataInicio) return "Informe a data de início da consignação.";
  return null;
}

export function consignacaoPayload(value: ConsignacaoFormValue) {
  return {
    consignante_nome: value.consignanteNome.trim() || null,
    valor_garantido_dono: parseGestaoMoneyField(value.valorGarantido) ?? 0,
    pct_loja_excedente: Number(value.pctLoja.replace(",", ".")),
    piso_loja: parseGestaoMoneyField(value.pisoLoja),
    preco_minimo_autorizado: parseGestaoMoneyField(value.precoMinimo),
    data_inicio: value.dataInicio,
    prazo_dias: Number(value.prazoDias),
    observacao: value.observacao.trim() || null,
  };
}

export async function saveConsignacaoTermos(
  userId: string,
  veiculoId: string,
  value: ConsignacaoFormValue,
  options: { syncCompra?: boolean } = {},
): Promise<void> {
  const validation = validateConsignacaoForm(value);
  if (validation) throw new Error(validation);
  const payload = consignacaoPayload(value);
  const { error } = await supabase.from("veiculo_consignacao" as "veiculos_estoque")
    .upsert({
      user_id: userId,
      veiculo_id: veiculoId,
      ...payload,
      status: "ativo",
    }, { onConflict: "user_id,veiculo_id" });
  if (error) throw error;

  if (options.syncCompra) {
    const { error: compraError } = await supabase
      .from("veiculo_compra" as "veiculos_estoque")
      .upsert({
        user_id: userId,
        veiculo_id: veiculoId,
        valor_compra: payload.valor_garantido_dono,
        data_compra: payload.data_inicio,
        origem: "consignacao",
        fornecedor_obs: payload.consignante_nome,
      }, { onConflict: "user_id,veiculo_id" });
    if (compraError) throw compraError;
  }
}
