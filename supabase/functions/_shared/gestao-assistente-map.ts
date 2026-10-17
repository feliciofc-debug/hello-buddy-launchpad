/** Mapa do sistema para o Jarvis da Gestão (fonte alinhada a gestao-nav + vitrine). */

export type GestaoAssistenteMapEntry = {
  id: string;
  title: string;
  path: string;
  purpose: string;
  steps: string[];
  keywords: string[];
};

export const GESTAO_ASSISTENTE_MAP: GestaoAssistenteMapEntry[] = [
  {
    id: "emitir-nota",
    title: "Emitir nota fiscal",
    path: "/gestao/lucro?aba=notas",
    purpose: "Emitir NF-e de entrada ou saída depois de conectar a Focus NFe.",
    steps: [
      "Conecte a emissão (Focus NFe) na gaveta ou em Integrações.",
      "Abra Gestão › Notas fiscais ou use Emitir nota fiscal no topo.",
      "Escolha o veículo e confira o preview antes de emitir.",
    ],
    keywords: ["nota", "nfe", "nf-e", "fiscal", "emitir nota", "como emito"],
  },
  {
    id: "faturamento",
    title: "Faturamento e vendas do mês",
    path: "/gestao/lucro?aba=vendidos",
    purpose: "Ver quanto faturou e quais carros vendeu na competência.",
    steps: ["Abra Gestão › Vendas e faturamento ou o card Faturamento no topo."],
    keywords: ["faturei", "faturamento", "vendas do mes", "quanto vendi"],
  },
  {
    id: "resultado",
    title: "Resultado da loja (DRE)",
    path: "/gestao/lucro?aba=financeiro&secao=dre",
    purpose: "Lucro líquido da loja no mês (DRE — resultado do mês).",
    steps: ["Gestão › Financeiro › aba Resultado."],
    keywords: ["lucro", "resultado", "dre", "quanto a loja lucrou"],
  },
  {
    id: "comissoes",
    title: "Comissões e equipe",
    path: "/gestao/lucro?aba=equipe",
    purpose: "Cadastrar vendedores, metas e ver comissões.",
    steps: ["Gestão › Equipe e comissões.", "Cadastre vendedores e registre vendas com vendedor."],
    keywords: ["comissao", "comissão", "comissoes", "vendedor", "equipe", "ranking", "onde vejo comiss"],
  },
  {
    id: "importar-estoque",
    title: "Importar estoque / planilha",
    path: "/gestao/lucro",
    purpose: "Trazer carros e valores de compra por planilha.",
    steps: ["Gestão › botão Importar planilha no topo.", "Ou cadastre carros em Estoque vitrine (/veiculos)."],
    keywords: ["importar", "planilha", "estoque", "csv", "excel"],
  },
  {
    id: "estoque",
    title: "Estoque e registrar venda",
    path: "/gestao/lucro?aba=estoque",
    purpose: "Ver carros, custos, registrar venda e lucro por veículo.",
    steps: ["Gestão › aba Estoque.", "Clique no carro ou use Registrar venda."],
    keywords: ["estoque", "carros", "registrar venda", "valor compra"],
  },
  {
    id: "carros-parados",
    title: "Carros parados no estoque",
    path: "/gestao/lucro?aba=estoque",
    purpose: "Ver alertas de carros há muito tempo sem vender.",
    steps: ["Gestão › Estoque — use os alertas ou ordene por dias no estoque."],
    keywords: ["parado", "parados", "tempo", "envelhecido", "dias estoque"],
  },
  {
    id: "financeiro-contas",
    title: "Contas a pagar e receber",
    path: "/gestao/lucro?aba=financeiro&secao=contas",
    purpose: "Lançamentos operacionais e vencimentos.",
    steps: ["Gestão › Financeiro › Contas."],
    keywords: ["contas", "vence", "vencimento", "pagar", "receber"],
  },
  {
    id: "conciliacao",
    title: "Conciliação bancária",
    path: "/gestao/lucro?aba=financeiro&secao=conciliacao",
    purpose: "Conciliação — conferir o extrato do banco com os lançamentos.",
    steps: ["Gestão › Financeiro › Conciliação.", "Importe o OFX e confira pendências."],
    keywords: ["concilia", "extrato", "banco", "ofx"],
  },
  {
    id: "contratos",
    title: "Contratos com assinatura",
    path: "/gestao/lucro?aba=contratos",
    purpose: "Enviar contrato ZapSign para o cliente assinar no celular.",
    steps: ["Conecte ZapSign.", "Gestão › Contratos › escolha o veículo."],
    keywords: ["contrato", "assinatura", "zapsign"],
  },
  {
    id: "integracoes-nfe",
    title: "Conectar emissão de NF-e",
    path: "/gestao/lucro?conectar=nfe",
    purpose: "Ativar Focus NFe com token da loja.",
    steps: ["Use Conectar NF-e na Gestão ou Integrações › foco NF-e."],
    keywords: ["conectar nfe", "focus", "token fiscal"],
  },
  {
    id: "config-fiscal",
    title: "Configuração fiscal da loja",
    path: "/gestao/configuracao-fiscal",
    purpose: "CFOP, natureza e dados do emitente (validar com contador).",
    steps: ["Gestão › Configuração fiscal.", "Preencha com orientação do contador."],
    keywords: ["cfop", "configuração fiscal", "emitente"],
  },
  {
    id: "vitrine",
    title: "Estoque vitrine (anúncios)",
    path: "/veiculos",
    purpose: "Fotos, preço de vitrine e portais.",
    steps: ["Menu Estoque vitrine (/veiculos)."],
    keywords: ["vitrine", "anuncio", "webmotors", "mercado livre"],
  },
];

function normalize(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function matchGestaoAssistenteNavigation(
  text: string,
): GestaoAssistenteMapEntry | null {
  const t = normalize(text);
  if (!t) return null;
  let best: GestaoAssistenteMapEntry | null = null;
  let bestScore = 0;
  for (const entry of GESTAO_ASSISTENTE_MAP) {
    let score = 0;
    for (const kw of entry.keywords) {
      const k = normalize(kw);
      if (t.includes(k)) score += k.length;
    }
    if (entry.id === "emitir-nota" && /\b(como|onde)\b/.test(t) && /\bnota\b/.test(t)) {
      score += 8;
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return bestScore >= 4 ? best : null;
}

export function closestGestaoAssistenteEntries(text: string, limit = 2): GestaoAssistenteMapEntry[] {
  const t = normalize(text);
  const scored = GESTAO_ASSISTENTE_MAP.map((entry) => {
    let score = 0;
    for (const kw of entry.keywords) {
      const k = normalize(kw);
      for (const word of t.split(/\s+/)) {
        if (word.length >= 4 && k.includes(word)) score += 1;
      }
    }
    return { entry, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.entry);
}
