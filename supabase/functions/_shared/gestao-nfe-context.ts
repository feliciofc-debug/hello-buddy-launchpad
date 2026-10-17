import type { GestaoNfeOperacaoKey } from "./gestao-nfe-config-default.ts";
import type { GestaoNfeTomadorInput, GestaoNfeVeiculoInput } from "./gestao-nfe-build.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (t: string) => any };

export function parseEnderecoResumo(endereco: string | null | undefined): Partial<GestaoNfeTomadorInput> {
  const raw = String(endereco ?? "").trim();
  if (!raw) return {};
  const parts = raw.split(/[,;\n]/).map((p) => p.trim()).filter(Boolean);
  return {
    logradouro: parts[0]?.slice(0, 60) ?? "",
    numero: parts[1]?.slice(0, 10) ?? "S/N",
    bairro: parts[2]?.slice(0, 60) ?? "",
    municipio: parts[3]?.slice(0, 60) ?? "",
    uf: (parts[4]?.replace(/\W/g, "").toUpperCase().slice(0, 2) || ""),
    cep: (parts[5]?.replace(/\D/g, "").slice(0, 8) || ""),
  };
}

export function tomadorMissingFields(t: Partial<GestaoNfeTomadorInput>): string[] {
  const miss: string[] = [];
  if (!t.nome?.trim()) miss.push("nome");
  if (!t.cpf_cnpj?.replace(/\D/g, "")) miss.push("CPF/CNPJ");
  if (!t.logradouro?.trim()) miss.push("endereço");
  if (!t.municipio?.trim()) miss.push("município");
  if (!t.uf?.trim()) miss.push("UF");
  if (!t.cep?.replace(/\D/g, "")) miss.push("CEP");
  return miss;
}

export async function loadVeiculoNfeFields(
  client: Db,
  userId: string,
  veiculoId: string,
): Promise<GestaoNfeVeiculoInput | null> {
  const { data } = await client.from("veiculos_estoque")
    .select("marca, modelo, versao, ano_modelo, ano_fabricacao, cor, km, placa, chassi, renavam")
    .eq("user_id", userId)
    .eq("id", veiculoId)
    .maybeSingle();
  if (!data) return null;
  return {
    marca: String(data.marca ?? ""),
    modelo: String(data.modelo ?? ""),
    versao: data.versao ?? null,
    ano_modelo: data.ano_modelo != null ? Number(data.ano_modelo) : null,
    ano_fabricacao: data.ano_fabricacao != null ? Number(data.ano_fabricacao) : null,
    cor: data.cor ?? null,
    km: data.km != null ? Number(data.km) : null,
    placa: data.placa ?? null,
    chassi: data.chassi ?? null,
    renavam: data.renavam ?? null,
  };
}

export async function inferNfeTipoOperacao(
  client: Db,
  userId: string,
  veiculoId: string,
  hint?: GestaoNfeOperacaoKey | null,
): Promise<GestaoNfeOperacaoKey> {
  if (hint) return hint;
  const { data: venda } = await client.from("veiculo_venda")
    .select("veiculo_id")
    .eq("user_id", userId)
    .eq("veiculo_id", veiculoId)
    .maybeSingle();
  if (venda) return "saida_venda";
  return "entrada_compra_pf";
}

export async function loadTomadorForNfe(
  client: Db,
  userId: string,
  veiculoId: string,
  tipo: GestaoNfeOperacaoKey,
): Promise<Partial<GestaoNfeTomadorInput>> {
  const contratoTipo = tipo === "saida_venda" ? "venda" : "compra";
  const { data: contrato } = await client.from("gestao_contrato")
    .select("cliente_nome, cliente_cpf, cliente_endereco, cliente_email, cliente_telefone")
    .eq("user_id", userId)
    .eq("veiculo_id", veiculoId)
    .eq("tipo", contratoTipo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (contrato) {
    const addr = parseEnderecoResumo(contrato.cliente_endereco);
    return {
      nome: String(contrato.cliente_nome ?? ""),
      cpf_cnpj: String(contrato.cliente_cpf ?? ""),
      email: contrato.cliente_email ?? null,
      telefone: contrato.cliente_telefone ?? null,
      logradouro: addr.logradouro ?? "",
      numero: addr.numero ?? "S/N",
      bairro: addr.bairro ?? "",
      municipio: addr.municipio ?? "",
      uf: addr.uf ?? "",
      cep: addr.cep ?? "",
    };
  }

  return {
    nome: "",
    cpf_cnpj: "",
    logradouro: "",
    numero: "S/N",
    bairro: "",
    municipio: "",
    uf: "",
    cep: "",
  };
}

export async function resolveNfeValorTotal(
  client: Db,
  userId: string,
  veiculoId: string,
  tipo: GestaoNfeOperacaoKey,
  override?: number | null,
): Promise<number> {
  if (override != null && Number.isFinite(override) && override > 0) return override;
  if (tipo === "saida_venda") {
    const { data } = await client.from("veiculo_venda")
      .select("valor_venda")
      .eq("user_id", userId)
      .eq("veiculo_id", veiculoId)
      .maybeSingle();
    if (data?.valor_venda != null) return Number(data.valor_venda);
  } else {
    const { data } = await client.from("veiculo_compra")
      .select("valor_compra")
      .eq("user_id", userId)
      .eq("veiculo_id", veiculoId)
      .maybeSingle();
    if (data?.valor_compra != null) return Number(data.valor_compra);
  }
  throw new Error("Informe o valor da nota ou registre compra/venda no carro.");
}
