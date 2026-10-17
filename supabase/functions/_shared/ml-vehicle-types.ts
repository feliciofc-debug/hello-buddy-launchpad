export type VeiculoEstoqueRow = {
  id: string;
  user_id: string;
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
  cor: string | null;
  descricao: string | null;
  fotos: string[];
  status: string;
};

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
