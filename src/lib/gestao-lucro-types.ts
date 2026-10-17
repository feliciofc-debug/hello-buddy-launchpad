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
};

export type GestaoLucroBundle = {
  veiculos: GestaoVeiculoEnriched[];
  despesasFlat: GestaoDespesaRow[];
};

export type GestaoLucroAlertKind =
  | "sem_custo_compra"
  | "parado_60"
  | "margem_baixa";
