import type { calcGestaoLucro } from "../../supabase/functions/_shared/gestao-lucro-calc.ts";

export type GestaoDespesaRow = {
  id: string;
  veiculo_id: string;
  data: string;
  categoria: string;
  valor: number;
  descricao: string | null;
  origem_lancamento: string;
  lancado_por: string | null;
  comprovante_path: string | null;
  descontar_do_consignante?: boolean;
};

export type GestaoConsignacaoRow = {
  consignante_nome: string | null;
  valor_garantido_dono: number;
  pct_loja_excedente: number;
  piso_loja: number | null;
  preco_minimo_autorizado: number | null;
  data_inicio: string;
  prazo_dias: number;
  status: "ativo" | "vendido" | "devolvido";
  observacao: string | null;
};

export type GestaoVeiculoBase = {
  id: string;
  marca: string;
  modelo: string;
  versao: string | null;
  preco: number | null;
  status: string;
  placa: string | null;
  fotos: string[];
  codigo_origem: string | null;
  ano_modelo: number | null;
  ano_fabricacao: number | null;
  combustivel: string | null;
  created_at: string;
};

export type GestaoLucroComputed = ReturnType<typeof calcGestaoLucro>;

export type GestaoVeiculoEnriched = GestaoVeiculoBase & {
  valorCompra: number | null;
  dataCompra: string | null;
  valorVenda: number | null;
  dataVenda: string | null;
  vendedor: string | null;
  vendedor_id: string | null;
  despesas: GestaoDespesaRow[];
  lucro: GestaoLucroComputed;
  compraOrigem: "compra" | "troca" | "consignacao" | null;
  consignacao: GestaoConsignacaoRow | null;
  consignacaoResultado: {
    parteLoja: number;
    parteDono: number;
    repasseDonoLiquido: number;
    lucroLoja: number;
    abaixoDoGarantido: boolean;
  } | null;
};

export type GestaoLucroBundle = {
  veiculos: GestaoVeiculoEnriched[];
  despesasFlat: GestaoDespesaRow[];
};

export type GestaoLucroAlertKind =
  | "sem_custo_compra"
  | "parado_60"
  | "margem_baixa"
  | "lucro_negativo_comissao";
