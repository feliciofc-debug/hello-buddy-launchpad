export type GestaoNfeOperacaoKey = "entrada_compra_pf" | "saida_venda" | "consignacao";

export type GestaoNfeOperacaoConfig = {
  natureza_operacao: string;
  cfop: string;
  cst_icms: string;
  csosn: string;
  aliquota_icms: string;
  ncm: string;
  /** Marcador de exemplo — contador deve validar */
  is_exemplo?: boolean;
};

export type GestaoNfeOperacoesJson = Partial<
  Record<GestaoNfeOperacaoKey, GestaoNfeOperacaoConfig>
>;

export function defaultGestaoNfeOperacoes(): GestaoNfeOperacoesJson {
  return {
    entrada_compra_pf: {
      natureza_operacao: "Compra para comercialização (exemplo — validar com contador)",
      cfop: "1102",
      cst_icms: "",
      csosn: "102",
      aliquota_icms: "",
      ncm: "87032100",
      is_exemplo: true,
    },
    saida_venda: {
      natureza_operacao: "Venda de mercadoria (exemplo — validar com contador)",
      cfop: "5102",
      cst_icms: "",
      csosn: "102",
      aliquota_icms: "",
      ncm: "87032100",
      is_exemplo: true,
    },
    consignacao: {
      natureza_operacao: "Consignação (exemplo — validar com contador)",
      cfop: "5917",
      cst_icms: "",
      csosn: "102",
      aliquota_icms: "",
      ncm: "87032100",
      is_exemplo: true,
    },
  };
}
