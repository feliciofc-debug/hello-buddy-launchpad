export type VeiculoEstoqueRow = {
  id: string;
  user_id: string;
  segmento?: string | null;
  marca: string;
  modelo: string;
  versao: string | null;
  ano_fabricacao: number | null;
  ano_modelo: number | null;
  km: number | null;
  preco: number | null;
  combustivel: string | null;
  cambio: string | null;
  portas: number | null;
  cilindrada_cc?: number | null;
  estilo_moto?: string | null;
  cor: string | null;
  descricao: string | null;
  fotos: string[];
  status: string;
};

export const ML_PUBLIC_VEHICLE_SELECT =
  "id,user_id,segmento,marca,modelo,versao,ano_fabricacao,ano_modelo,km,preco,combustivel,cambio,portas,cilindrada_cc,estilo_moto,cor,descricao,fotos,status";

export type MlCategoryAttribute = {
  id: string;
  name: string;
  tags?: { required?: boolean; catalog_required?: boolean };
  value_type?: string;
  values?: Array<{ id: string; name: string }>;
};

export type MlMapResult =
  | { ok: true; body: Record<string, unknown>; categoryId: string }
  | { ok: false; blocking: Array<{ field: string; attribute_id: string; message: string; allowed?: string[] }> };
