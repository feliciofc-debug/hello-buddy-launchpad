export const GESTAO_CONTA_NATUREZAS = [
  "operacional",
  "custo_veiculo",
  "repasse_terceiro",
  "troco_cliente",
  "saldo_cliente",
] as const;

export type GestaoContaNatureza = (typeof GESTAO_CONTA_NATUREZAS)[number];

export const GESTAO_CONTA_NATUREZA_LABEL: Record<GestaoContaNatureza, string> = {
  operacional: "Operacional",
  custo_veiculo: "Custo de veículo (OS)",
  repasse_terceiro: "Repasse ao dono",
  troco_cliente: "Troco ao cliente",
  saldo_cliente: "Saldo do cliente",
};

export function gestaoContaNaturezaLabel(value: string | null | undefined): string {
  return GESTAO_CONTA_NATUREZA_LABEL[
    (value ?? "operacional") as GestaoContaNatureza
  ] ?? value ?? "Operacional";
}

export function isContaDespesaOperacional(conta: {
  tipo: string;
  natureza?: string | null;
}): boolean {
  return conta.tipo === "pagar" &&
    (conta.natureza ?? "operacional") === "operacional";
}
