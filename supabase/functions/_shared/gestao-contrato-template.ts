export const GESTAO_CONTRATO_AVISO_ADVOGADO =
  "Modelos marcados como EXEMPLO devem ser revisados pelo advogado da loja antes do uso.";

export type GestaoContratoTipo = "compra" | "venda" | "consignacao" | "garantia";

export type GestaoContratoVariaveis = {
  loja_nome: string;
  loja_cnpj: string;
  cliente_nome: string;
  cliente_cpf: string;
  cliente_endereco: string;
  veiculo: string;
  ano: string;
  placa: string;
  chassi: string;
  cor: string;
  km: string;
  valor: string;
  forma_pagamento: string;
  data: string;
  cidade: string;
};

export const GESTAO_CONTRATO_VARIAVEIS = [
  "loja_nome", "loja_cnpj", "cliente_nome", "cliente_cpf", "cliente_endereco",
  "veiculo", "ano", "placa", "chassi", "cor", "km", "valor", "forma_pagamento", "data", "cidade",
] as const;

export function renderGestaoContratoCorpo(
  corpo: string,
  vars: Partial<GestaoContratoVariaveis>,
): string {
  let out = corpo;
  for (const k of GESTAO_CONTRATO_VARIAVEIS) {
    const val = vars[k] ?? "";
    out = out.replaceAll(`{${k}}`, val);
  }
  return out;
}

export function defaultGestaoContratoModelos(): Array<{
  tipo: GestaoContratoTipo;
  titulo: string;
  corpo: string;
  is_exemplo: boolean;
}> {
  const base = `CONTRATO DE {tipo} — {loja_nome}, CNPJ {loja_cnpj}, {cidade}, {data}.

Cliente: {cliente_nome}, CPF {cliente_cpf}, endereço {cliente_endereco}.

Veículo: {veiculo}, ano {ano}, placa {placa}, chassi {chassi}, cor {cor}, km {km}.

Valor: {valor}. Forma de pagamento: {forma_pagamento}.

Assinaturas:`;

  return (["compra", "venda", "consignacao", "garantia"] as GestaoContratoTipo[]).map((tipo) => ({
    tipo,
    titulo: `EXEMPLO — ${tipo.charAt(0).toUpperCase()}${tipo.slice(1)}`,
    corpo: base.replace("{tipo}", tipo.toUpperCase()),
    is_exemplo: true,
  }));
}
