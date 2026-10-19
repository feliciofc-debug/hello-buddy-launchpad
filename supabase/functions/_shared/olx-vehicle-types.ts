export type OlxVeiculoEstoqueRow = {
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
  cor: string | null;
  descricao: string | null;
  fotos: string[];
  status: string;
};

export type OlxMapBlocking = { field: string; message: string };

export type OlxMapResult =
  | { ok: true; ad: Record<string, unknown>; adRef: string }
  | { ok: false; blocking: OlxMapBlocking[] };
