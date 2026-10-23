export type VeiculoEstoqueRow = {
  id: string;
  user_id: string;
  placa?: string | null;
  segmento?: string | null;
  preco_de?: number | null;
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
  cilindrada_cc?: number | null;
  estilo_moto?: string | null;
  partida?: string | null;
  refrigeracao?: string | null;
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

export type WmMotoMapResult =
  | {
    ok: true;
    payload: import("./webmotors-moto-api.ts").WmMotoAnuncioPayload;
  }
  | { ok: false; blocking: WmBlockingItem[] };

export type WebmotorsVeiculoMapRow = {
  codigo_marca: number | null;
  codigo_modelo: number | null;
  codigo_versao: number | null;
  codigo_cor: number | null;
  codigo_cor_secundaria?: number | null;
  codigo_combustivel: number | null;
  codigo_cambio: number | null;
  codigo_modalidade: number | null;
  nr_portas: number | null;
  numero_cilindradas?: number | null;
  codigo_numero_marchas?: number | null;
  codigo_tipo_refrigeracao?: number | null;
  codigo_tipo_alimentacao?: number | null;
  codigo_tipo_motor?: number | null;
  codigo_tipo_partida?: number | null;
  codigo_tipo_freio?: number | null;
  codigo_sms?: number | null;
  tipo_consistencia?: number | null;
  opcionais: number[];
  mapping_source: string;
};
