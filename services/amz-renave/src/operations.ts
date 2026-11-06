export const RENAVE_OPERATIONS = {
  clienteAutenticado: {
    method: "GET",
    path: "/api/cliente-autenticado",
    params: ["cnpjEstabelecimento"],
  },
  aptidaoVeiculo: {
    method: "GET",
    path: "/api/aptidao-veiculo-estoque",
    params: ["numeroCrv", "placa", "renavam", "tipoCrv", "cnpjEstabelecimento"],
  },
  consultarVeiculos: {
    method: "GET",
    path: "/api/veiculos",
    params: ["chassi", "placa", "renavam", "cnpjEstabelecimento"],
  },
  consultarEstoques: {
    method: "GET",
    path: "/api/estoques",
    params: [
      "chassi",
      "dataHoraRegistroEntradaFinal",
      "dataHoraRegistroEntradaInicial",
      "dataHoraRegistroSaidaFinal",
      "dataHoraRegistroSaidaInicial",
      "estadoEstoque",
      "placa",
      "cnpjEstabelecimento",
    ],
  },
  consultarEstoquePorId: {
    method: "GET",
    path: "/api/estoques/{id}",
    params: ["id", "cnpjEstabelecimento"],
    pathParams: { id: "idEstoque" },
  },
  solicitarEntradaEstoque: {
    method: "POST",
    path: "/api/solicitacoes-entrada-estoque",
    params: ["cnpjEstabelecimento"],
  },
  solicitarSaidaEstoque: {
    method: "POST",
    path: "/api/solicitacoes-saida-estoque",
    params: ["cnpjEstabelecimento"],
  },
  enviarNotaFiscal: {
    method: "POST",
    path: "/api/notas-fiscais",
    params: ["cnpjEstabelecimento"],
  },
  pdfAtpv: {
    method: "GET",
    path: "/api/pdf-atpv/{placa}/{renavam}",
    params: ["placa", "renavam", "cnpjEstabelecimento"],
    pathParams: { placa: "placa", renavam: "renavam" },
  },
  termoEntrada: {
    method: "GET",
    path: "/api/estoques/{idEstoque}/termo-entrada-estoque",
    params: ["idEstoque", "cnpjEstabelecimento"],
    pathParams: { idEstoque: "idEstoque" },
  },
  termoSaida: {
    method: "GET",
    path: "/api/estoques/{idEstoque}/termo-saida-estoque",
    params: ["idEstoque", "cnpjEstabelecimento"],
    pathParams: { idEstoque: "idEstoque" },
  },
  crlve: {
    method: "GET",
    path: "/api/crlve/{placaVeiculo}/{renavamVeiculo}",
    params: ["placaVeiculo", "renavamVeiculo", "cnpjEstabelecimento"],
    pathParams: {
      placaVeiculo: "placa",
      renavamVeiculo: "renavam",
    },
  },
  municipios: {
    method: "GET",
    path: "/api/municipios",
    params: ["nome", "uf", "cnpjEstabelecimento"],
  },
  mockVeiculoUsado: {
    method: "POST",
    path: "/api/veiculos-usados-mock",
    params: ["cnpjEstabelecimento"],
    homOnly: true,
  },
  mockTransferenciaDetran: {
    method: "POST",
    path: "/api/veiculos-usados-mock/transferencia-no-detran",
    params: ["cnpjEstabelecimento"],
    homOnly: true,
  },
} as const;

export type RenavePathParamKind = "placa" | "renavam" | "idEstoque";

export type RenaveOperation = keyof typeof RENAVE_OPERATIONS;
export type RenaveEnvironment = "hom" | "prod";

export function isRenaveOperation(value: unknown): value is RenaveOperation {
  return typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(RENAVE_OPERATIONS, value);
}
