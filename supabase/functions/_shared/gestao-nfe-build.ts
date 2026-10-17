import type { GestaoNfeOperacaoConfig, GestaoNfeOperacaoKey } from "./gestao-nfe-config-default.ts";

export type GestaoNfeEmitenteConfig = {
  cnpj: string;
  inscricao_estadual: string;
  regime_tributario: string;
  razao_social: string;
  nome_fantasia: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
};

export type GestaoNfeTomadorInput = {
  nome: string;
  cpf_cnpj: string;
  email?: string | null;
  telefone?: string | null;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
};

export type GestaoNfeVeiculoInput = {
  marca: string;
  modelo: string;
  versao?: string | null;
  ano_modelo?: number | null;
  ano_fabricacao?: number | null;
  cor?: string | null;
  km?: number | null;
  placa?: string | null;
  chassi?: string | null;
  renavam?: string | null;
};

function digitsOnly(v: string): string {
  return String(v || "").replace(/\D/g, "");
}

function vehicleDescricao(v: GestaoNfeVeiculoInput): string {
  const ano = v.ano_modelo ?? v.ano_fabricacao;
  const parts = [v.marca, v.modelo, v.versao, ano ? String(ano) : null, v.cor]
    .filter(Boolean);
  let desc = parts.join(" ").slice(0, 120);
  if (v.placa) desc += ` · Placa ${v.placa}`;
  if (v.km != null) desc += ` · ${v.km} km`;
  return desc.slice(0, 200);
}

export function buildFocusNfePayload(input: {
  tipo: GestaoNfeOperacaoKey;
  emitente: GestaoNfeEmitenteConfig;
  operacao: GestaoNfeOperacaoConfig;
  veiculo: GestaoNfeVeiculoInput;
  valorTotal: number;
  tomador: GestaoNfeTomadorInput;
  dataEmissao?: string;
}): Record<string, unknown> {
  const op = input.operacao;
  if (!op.cfop?.trim() || !op.natureza_operacao?.trim()) {
    throw new Error("Configure CFOP e natureza da operação (contador).");
  }
  const valor = Math.round(Number(input.valorTotal) * 100) / 100;
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error("Valor da nota inválido.");
  }

  const cnpjEmit = digitsOnly(input.emitente.cnpj);
  if (cnpjEmit.length !== 14) throw new Error("CNPJ do emitente inválido na configuração fiscal.");

  const docTomador = digitsOnly(input.tomador.cpf_cnpj);
  const isCnpj = docTomador.length === 14;

  const descricao = vehicleDescricao(input.veiculo);
  const ncm = (op.ncm || "87032100").replace(/\D/g, "").slice(0, 8) || "87032100";

  const payload: Record<string, unknown> = {
    natureza_operacao: op.natureza_operacao.slice(0, 60),
    data_emissao: input.dataEmissao ?? new Date().toISOString().slice(0, 10),
    data_entrada_saida: input.dataEmissao ?? new Date().toISOString().slice(0, 10),
    tipo_documento: input.tipo === "entrada_compra_pf" ? "0" : "1",
    finalidade_emissao: "1",
    cnpj_emitente: cnpjEmit,
    inscricao_estadual_emitente: digitsOnly(input.emitente.inscricao_estadual) ||
      input.emitente.inscricao_estadual,
    nome_emitente: input.emitente.razao_social.slice(0, 60),
    nome_fantasia_emitente: (input.emitente.nome_fantasia || input.emitente.razao_social).slice(0, 60),
    logradouro_emitente: input.emitente.logradouro.slice(0, 60),
    numero_emitente: input.emitente.numero.slice(0, 10),
    bairro_emitente: input.emitente.bairro.slice(0, 60),
    municipio_emitente: input.emitente.municipio.slice(0, 60),
    uf_emitente: input.emitente.uf.toUpperCase().slice(0, 2),
    cep_emitente: digitsOnly(input.emitente.cep).slice(0, 8),
    items: [{
      numero_item: "1",
      codigo_produto: "1",
      descricao,
      cfop: op.cfop.replace(/\D/g, "").slice(0, 4),
      unidade_comercial: "UN",
      quantidade_comercial: "1",
      valor_unitario_comercial: String(valor),
      valor_bruto: String(valor),
      codigo_ncm: ncm,
      icms_situacao_tributaria: op.csosn?.trim() || op.cst_icms?.trim() || "102",
      icms_origem: "0",
    }],
  };

  if (input.emitente.complemento?.trim()) {
    payload.complemento_emitente = input.emitente.complemento.slice(0, 60);
  }

  if (input.tipo === "entrada_compra_pf") {
    payload.nome_destinatario = input.tomador.nome.slice(0, 60);
    if (isCnpj) payload.cnpj_destinatario = docTomador;
    else payload.cpf_destinatario = docTomador;
  } else {
    payload.nome_destinatario = input.tomador.nome.slice(0, 60);
    if (isCnpj) payload.cnpj_destinatario = docTomador;
    else payload.cpf_destinatario = docTomador;
  }

  payload.logradouro_destinatario = input.tomador.logradouro.slice(0, 60);
  payload.numero_destinatario = input.tomador.numero.slice(0, 10);
  payload.bairro_destinatario = input.tomador.bairro.slice(0, 60);
  payload.municipio_destinatario = input.tomador.municipio.slice(0, 60);
  payload.uf_destinatario = input.tomador.uf.toUpperCase().slice(0, 2);
  payload.cep_destinatario = digitsOnly(input.tomador.cep).slice(0, 8);
  if (input.tomador.complemento?.trim()) {
    payload.complemento_destinatario = input.tomador.complemento.slice(0, 60);
  }
  if (input.tomador.email?.trim()) {
    payload.email_destinatario = input.tomador.email.trim().slice(0, 80);
  }

  if (input.veiculo.chassi?.trim()) {
    (payload.items as Record<string, unknown>[])[0].informacoes_adicionais =
      `Chassi: ${input.veiculo.chassi.slice(0, 30)}`;
  }

  return payload;
}

export function buildNfePreviewResumo(input: {
  tipo: GestaoNfeOperacaoKey;
  veiculoLabel: string;
  valor: number;
  tomadorNome: string;
  cfop: string;
  natureza: string;
  ambiente: string;
}): string {
  const tipoLabel = input.tipo === "saida_venda"
    ? "Saída (venda)"
    : input.tipo === "entrada_compra_pf"
    ? "Entrada (compra PF)"
    : "Consignação";
  return [
    `Prévia NF-e (${input.ambiente === "producao" ? "Produção" : "Homologação"})`,
    `Tipo: ${tipoLabel}`,
    `Veículo: ${input.veiculoLabel}`,
    `Valor: R$ ${input.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    `Destinatário/Parte: ${input.tomadorNome}`,
    `CFOP ${input.cfop} · ${input.natureza.slice(0, 80)}`,
    "Confirme no painel ou responda SIM após revisar.",
  ].join("\n");
}

export function maskCpfCnpj(doc: string): string {
  const d = digitsOnly(doc);
  if (d.length === 11) return `***.***.***-${d.slice(-2)}`;
  if (d.length === 14) return `**.***.***/****-${d.slice(-2)}`;
  return "***";
}
