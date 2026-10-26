export type GestaoOsCotacaoPdfItem = {
  descricao: string;
  observacao?: string | null;
};

export type GestaoOsCotacaoPdfInput = {
  titulo: "pedido_cotacao" | "os_aprovada";
  lojaNome: string;
  lojaContato?: string | null;
  lojaSite?: string | null;
  lojaCnpj?: string | null;
  lojaCidade?: string | null;
  parceiroNome: string;
  osNumero: number;
  dataIso: string;
  veiculo: {
    marca: string;
    modelo: string;
    ano?: number | null;
    placa?: string | null;
    cor?: string | null;
    km?: number | null;
  };
  itens: GestaoOsCotacaoPdfItem[];
  prazoDesejado?: string | null;
  valorCombinado?: number | null;
  fotoLegendas?: string[];
  comoResponder?: string | null;
};

const PROIBIDO_PDF_OS = [
  "margem",
  "preço de venda",
  "preco de venda",
  "custo interno",
  "preparacao_estimada",
  "kbb",
  "fipe",
  "valor estimado no laudo",
  "lucro",
];

export function gestaoOsPdfContemCustosInternos(linhas: string[]): boolean {
  const texto = linhas.join("\n").toLowerCase();
  return PROIBIDO_PDF_OS.some((termo) => texto.includes(termo));
}

function formatData(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatValor(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function buildGestaoOsCotacaoPdfLines(input: GestaoOsCotacaoPdfInput): string[] {
  const lines: string[] = [];
  const titulo = input.titulo === "os_aprovada"
    ? "Ordem de Serviço aprovada"
    : "Pedido de cotação / Ordem de Serviço";
  lines.push(titulo);
  lines.push(input.lojaNome);
  if (input.lojaCnpj) lines.push(`CNPJ: ${input.lojaCnpj}`);
  if (input.lojaCidade) lines.push(`Cidade: ${input.lojaCidade}`);
  if (input.lojaContato) lines.push(`Contato: ${input.lojaContato}`);
  if (input.lojaSite) lines.push(`Site: ${input.lojaSite}`);
  lines.push(`OS nº ${input.osNumero} · ${formatData(input.dataIso)}`);
  lines.push(`Parceiro: ${input.parceiroNome}`);
  const v = input.veiculo;
  const veiculoTxt = [
    v.marca,
    v.modelo,
    v.ano ? String(v.ano) : null,
    v.placa ? `Placa ${v.placa}` : null,
    v.cor ? `Cor ${v.cor}` : null,
    v.km != null ? `${v.km.toLocaleString("pt-BR")} km` : null,
  ].filter(Boolean).join(" · ");
  lines.push(`Veículo: ${veiculoTxt}`);
  if (input.prazoDesejado) lines.push(`Prazo desejado: ${input.prazoDesejado}`);
  lines.push("");
  lines.push("Serviços solicitados:");
  if (input.itens.length === 0) {
    lines.push("— (descrever na conversa com o parceiro)");
  } else {
    for (const item of input.itens) {
      lines.push(`• ${item.descricao}`);
      if (item.observacao?.trim()) lines.push(`  Obs.: ${item.observacao.trim()}`);
    }
  }
  if (input.fotoLegendas?.length) {
    lines.push("");
    lines.push(`Fotos anexas (${input.fotoLegendas.length}):`);
    for (const leg of input.fotoLegendas.slice(0, 12)) {
      lines.push(`  - ${leg}`);
    }
  }
  if (input.comoResponder) {
    lines.push("");
    lines.push(`Como responder: ${input.comoResponder}`);
  }
  if (input.titulo === "os_aprovada" && input.valorCombinado != null) {
    lines.push("");
    lines.push(`Valor combinado: ${formatValor(input.valorCombinado)}`);
  }
  lines.push("");
  lines.push("Documento para o prestador — sem valores internos da loja.");
  return lines;
}

export type GestaoOsCotacaoRow = {
  id: string;
  os_id: string;
  parceiro_id: string;
  valor: number | null;
  prazo_dias: number | null;
  status: "solicitada" | "recebida" | "escolhida" | "descartada";
};

export function simularEscolhaCotacao(
  cotacoes: GestaoOsCotacaoRow[],
  escolhidaId: string,
  osId: string,
  osStatus = "orcamento",
): {
  parceiroId: string | null;
  valorAprovado: number | null;
  cotacoes: GestaoOsCotacaoRow[];
} {
  const gate = podeEscolherCotacaoOs(osStatus);
  if (!gate.ok) throw new Error(gate.mensagem);

  const escolhida = cotacoes.find((c) => c.id === escolhidaId);
  if (!escolhida || escolhida.os_id !== osId) {
    throw new Error("Cotação não pertence a esta OS");
  }
  if (escolhida.status !== "recebida" || escolhida.valor == null) {
    throw new Error("Cotação sem valor recebido");
  }
  return {
    parceiroId: escolhida.parceiro_id,
    valorAprovado: escolhida.valor,
    cotacoes: cotacoes.map((c) => {
      if (c.id === escolhidaId) return { ...c, status: "escolhida" as const };
      if (c.os_id === osId && ["solicitada", "recebida"].includes(c.status)) {
        return { ...c, status: "descartada" as const };
      }
      return c;
    }),
  };
}

export function podeAbrirOsGestao(parceirosAtivos: number): boolean {
  return parceirosAtivos > 0;
}

const STATUS_PODE_ESCOLHER_COTACAO = new Set([
  "rascunho",
  "orcamento",
  "aguardando_aprovacao",
]);

export function podeEscolherCotacaoOs(
  osStatus: string,
): { ok: true } | { ok: false; mensagem: string } {
  if (STATUS_PODE_ESCOLHER_COTACAO.has(osStatus)) return { ok: true };
  return {
    ok: false,
    mensagem:
      "A OS já foi aprovada; para trocar de fornecedor, cancele e abra nova OS",
  };
}
