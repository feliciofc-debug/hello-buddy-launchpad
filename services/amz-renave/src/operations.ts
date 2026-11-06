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
} as const;

export type RenaveOperation = keyof typeof RENAVE_OPERATIONS;
export type RenaveEnvironment = "hom" | "prod";

export function isRenaveOperation(value: unknown): value is RenaveOperation {
  return typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(RENAVE_OPERATIONS, value);
}
