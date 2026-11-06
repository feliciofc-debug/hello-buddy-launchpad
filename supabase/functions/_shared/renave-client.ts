export const RENAVE_OPERATION_NAMES = [
  "clienteAutenticado",
  "aptidaoVeiculo",
  "consultarVeiculos",
  "consultarEstoques",
  "consultarEstoquePorId",
  "solicitarEntradaEstoque",
  "solicitarSaidaEstoque",
  "enviarNotaFiscal",
  "pdfAtpv",
  "termoEntrada",
  "termoSaida",
  "crlve",
  "municipios",
  "mockVeiculoUsado",
  "mockTransferenciaDetran",
] as const;

export type RenaveOperation = typeof RENAVE_OPERATION_NAMES[number];
export type RenaveEnvironment = "hom" | "prod";

type AptidaoParams = {
  tipoCrv: "AZUL" | "VERDE" | "BRANCO" | "DIGITAL";
  numeroCrv?: string;
  placa?: string;
  renavam?: string;
};

type OptionalEstablishment = {
  cnpjEstabelecimento?: string;
};

type OperationParams = {
  clienteAutenticado: OptionalEstablishment;
  aptidaoVeiculo: AptidaoParams & OptionalEstablishment;
  consultarVeiculos: {
    chassi?: string;
    placa?: string;
    renavam?: string;
  } & OptionalEstablishment;
  consultarEstoques: {
    chassi?: string;
    placa?: string;
    estadoEstoque?: "SOLICITADO" | "TRANSFERIDO" | "CONFIRMADO" | "FINALIZADO";
    dataHoraRegistroEntradaInicial?: string;
    dataHoraRegistroEntradaFinal?: string;
    dataHoraRegistroSaidaInicial?: string;
    dataHoraRegistroSaidaFinal?: string;
  } & OptionalEstablishment;
  consultarEstoquePorId: {
    id: number;
  } & OptionalEstablishment;
  solicitarEntradaEstoque: OptionalEstablishment;
  solicitarSaidaEstoque: OptionalEstablishment;
  enviarNotaFiscal: OptionalEstablishment;
  pdfAtpv: {
    placa: string;
    renavam: string;
  } & OptionalEstablishment;
  termoEntrada: {
    idEstoque: number;
  } & OptionalEstablishment;
  termoSaida: {
    idEstoque: number;
  } & OptionalEstablishment;
  crlve: {
    placaVeiculo: string;
    renavamVeiculo: string;
  } & OptionalEstablishment;
  municipios: {
    nome?: string;
    uf?: string;
  } & OptionalEstablishment;
  mockVeiculoUsado: OptionalEstablishment;
  mockTransferenciaDetran: OptionalEstablishment;
};

type OperationBody = {
  clienteAutenticado: never;
  aptidaoVeiculo: never;
  consultarVeiculos: never;
  consultarEstoques: never;
  consultarEstoquePorId: never;
  solicitarEntradaEstoque: {
    cpfOperadorResponsavel: string;
    dataCompra: string;
    emailEstabelecimento: string;
    emailVendedor: string;
    valorCompra: number;
    veiculo: {
      codigoSegurancaCrv: string;
      dataHoraMedicaoHodometro: string;
      documentoProprietarioAtual: string;
      numeroCrv?: string;
      placa: string;
      quilometragemHodometro: number;
      renavam?: string;
      tipoCrv: "AZUL" | "VERDE" | "BRANCO" | "DIGITAL";
      tipoDocumentoProprietarioAtual: "CPF" | "CNPJ";
    };
  };
  solicitarSaidaEstoque: {
    cpfOperadorResponsavel: string;
    dataVenda: string;
    emailEstabelecimento: string;
    valorVenda: number;
    comprador: {
      numeroDocumento: string;
      tipoDocumento: "CPF" | "CNPJ";
      nome: string;
      email?: string;
      endereco: {
        cep: string;
        codigoMunicipio: number;
        logradouro: string;
        numero: string;
        bairro: string;
      };
    };
    veiculo: {
      codigoSegurancaCrv: string;
      numeroCrv?: string;
      placa: string;
      renavam?: string;
    };
  };
  enviarNotaFiscal: {
    chaveNotaFiscal: string;
    evento: "COMPRA" | "VENDA";
    idEstoque: number;
  };
  pdfAtpv: never;
  termoEntrada: never;
  termoSaida: never;
  crlve: never;
  municipios: never;
  mockVeiculoUsado: {
    ufJurisdicaoVeiculo: string;
    sufixoPlaca?: string;
    comRouboFurto?: boolean;
    jaBaixado?: boolean;
    documentoProprietario?: string;
    nomeProprietario?: string;
  };
  mockTransferenciaDetran: {
    placa: string;
  };
};

export type RenaveCall<K extends RenaveOperation> =
  & {
    ambiente: RenaveEnvironment;
    operacao: K;
    params: OperationParams[K];
    lojaId?: string;
    selado?: string;
  }
  & (OperationBody[K] extends never ? {
      body?: never;
    }
    : {
      body: OperationBody[K];
    });

export type RenaveResponse<T = unknown> = {
  status: number;
  body: T;
};

function endpoint(): { url: URL; token: string } {
  const base = Deno.env.get("AMZ_RENAVE_URL")?.trim();
  const token = Deno.env.get("AMZ_RENAVE_TOKEN")?.trim();
  if (!base || !token) throw new Error("Cliente RENAVE não configurado");
  const url = new URL(base);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/renave/chamar`;
  url.search = "";
  url.hash = "";
  return { url, token };
}

export async function chamarRenave<K extends RenaveOperation, T = unknown>(
  input: RenaveCall<K>,
  fetchImpl: typeof fetch = fetch,
): Promise<RenaveResponse<T>> {
  const { url, token } = endpoint();
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-RENAVE-Token": token,
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(35_000),
  });
  if (!response.ok) {
    throw new Error(`amz-renave indisponível (${response.status})`);
  }
  const payload = await response.json().catch(() => null) as {
    status?: unknown;
    body?: unknown;
  } | null;
  if (
    !payload ||
    !Number.isInteger(payload.status) ||
    Number(payload.status) < 100 ||
    Number(payload.status) > 599 ||
    !Object.prototype.hasOwnProperty.call(payload, "body")
  ) {
    throw new Error("Resposta inválida do amz-renave");
  }
  return {
    status: Number(payload.status),
    body: payload.body as T,
  };
}
