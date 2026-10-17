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
  cor: string | null;
  combustivel: string | null;
  cambio: string | null;
  portas: number | null;
  blindado: boolean;
  opcionais: string[];
  descricao: string | null;
  fotos: string[];
  status: string;
};

export type WmBlockingItem = {
  field: string;
  message: string;
  allowed?: string[];
};

export type WmMapResult =
  | { ok: true; payload: import("./webmotors-car-api.ts").WmAnuncioPayload }
  | { ok: false; blocking: WmBlockingItem[] };

export type WebmotorsVeiculoMapRow = {
  codigo_marca: number | null;
  codigo_modelo: number | null;
  codigo_versao: number | null;
  codigo_cor: number | null;
  codigo_combustivel: number | null;
  codigo_cambio: number | null;
  codigo_modalidade: number | null;
  nr_portas: number | null;
  opcionais: number[];
  mapping_source: string;
};
