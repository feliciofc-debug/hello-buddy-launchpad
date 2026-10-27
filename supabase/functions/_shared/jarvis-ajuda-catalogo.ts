import type { GestaoIntentKind } from "./gestao-intent-pt.ts";

export const JARVIS_AJUDA_CATALOGO_VERSAO = "1.0.0";

export const JARVIS_AJUDA_SECOES = [
  "Estoque e veículos",
  "Compra, venda e despesas",
  "Resultado e financeiro",
  "Equipe e comissões",
  "Notas fiscais e contratos",
  "Oficina e cotações",
  "Documentos",
  "Clientes e leads",
  "Anúncios e redes",
  "Portais de veículos",
  "FIPE e preço",
  "Vistoria e troca",
  "Resumos automáticos",
] as const;

export type JarvisAjudaSecao = typeof JARVIS_AJUDA_SECOES[number];

export type JarvisMenuGrupo = "marketing" | "gestao" | "vistoria_troca";
export type JarvisMenuSubgrupo =
  | "postar_redes"
  | "portais"
  | "estoque"
  | "vendas"
  | "financeiro"
  | "oficina_cotacoes"
  | "documentos"
  | "clientes_leads";
export type JarvisMenuAudience = "owner" | "manager" | "seller";
export type JarvisMenuChannel = "whatsapp" | "panel";

export type JarvisMenuAvailability = {
  segmentos: readonly string[];
  conexoes: readonly string[];
  flags: readonly string[];
  condicao?: string;
  nota?: string;
};

export type JarvisMenuMetadata = {
  grupo: JarvisMenuGrupo;
  subgrupo: JarvisMenuSubgrupo | null;
  parentId: string;
  title: string;
  description: string;
  order: number;
  audiences: readonly JarvisMenuAudience[];
  channel: JarvisMenuChannel;
  recentEligible: boolean;
  availability: JarvisMenuAvailability;
  visible: boolean;
};

export type JarvisAjudaRoute =
  | { type: "gestao_intent"; kind: Exclude<GestaoIntentKind, "none" | "ajuda"> }
  | {
    type: "owner_media";
    action: "generate" | "generate_and_post" | "post" | "edit";
  }
  | { type: "llm_tool"; name: string }
  | {
    type: "handler";
    name: string;
    source: string;
  }
  | {
    type: "panel";
    href: string;
    path: string;
  };

export type JarvisAjudaItem = {
  id: string;
  secao: JarvisAjudaSecao;
  titulo: string;
  comoPedir: readonly [string, string, ...string[]];
  oQueAcontece: string;
  menu: JarvisMenuMetadata;
  route: JarvisAjudaRoute;
  palavrasChave?: readonly string[];
};

export type JarvisMenuList = {
  id: string;
  grupo: JarvisMenuGrupo;
  subgrupo: JarvisMenuSubgrupo | null;
  parentId: string | null;
  title: string;
  description: string;
  order: number;
  audiences: readonly JarvisMenuAudience[];
  recentSlots: 0 | 2;
  backTitle?: string;
  backDescription?: string;
};

const OWNER = ["owner"] as const;
const OWNER_MANAGER = ["owner", "manager"] as const;
const OWNER_MANAGER_SELLER = ["owner", "manager", "seller"] as const;

const availability = (
  input: Partial<JarvisMenuAvailability> = {},
): JarvisMenuAvailability => ({
  segmentos: input.segmentos ?? ["automotivo"],
  conexoes: input.conexoes ?? [],
  flags: input.flags ?? [],
  ...(input.condicao ? { condicao: input.condicao } : {}),
  ...(input.nota ? { nota: input.nota } : {}),
});

const menu = (
  grupo: JarvisMenuGrupo,
  subgrupo: JarvisMenuSubgrupo | null,
  parentId: string,
  title: string,
  description: string,
  order: number,
  audiences: readonly JarvisMenuAudience[],
  channel: JarvisMenuChannel,
  options: {
    recentEligible?: boolean;
    availability?: JarvisMenuAvailability;
    visible?: boolean;
  } = {},
): JarvisMenuMetadata => ({
  grupo,
  subgrupo,
  parentId,
  title,
  description,
  order,
  audiences,
  channel,
  recentEligible: options.recentEligible ?? true,
  availability: options.availability ?? availability(),
  visible: options.visible ?? true,
});

export const JARVIS_MENU_LISTS: readonly JarvisMenuList[] = [
  {
    id: "marketing",
    grupo: "marketing",
    subgrupo: null,
    parentId: null,
    title: "📣 Marketing",
    description: "Criação, publicação, campanhas e portais de veículos.",
    order: 10,
    audiences: OWNER,
    recentSlots: 2,
  },
  {
    id: "marketing:postar_redes",
    grupo: "marketing",
    subgrupo: "postar_redes",
    parentId: "marketing",
    title: "Postar nas redes ›",
    description: "Facebook, Instagram, TikTok e LinkedIn.",
    order: 10,
    audiences: OWNER,
    recentSlots: 2,
    backTitle: "Voltar a Marketing",
    backDescription: "Retorne à lista principal de Marketing.",
  },
  {
    id: "marketing:portais",
    grupo: "marketing",
    subgrupo: "portais",
    parentId: "marketing",
    title: "Portais de veículos ›",
    description: "Mercado Livre, OLX e Webmotors pelo painel.",
    order: 70,
    audiences: OWNER,
    recentSlots: 2,
    backTitle: "Voltar a Marketing",
    backDescription: "Retorne à lista principal de Marketing.",
  },
  {
    id: "gestao",
    grupo: "gestao",
    subgrupo: null,
    parentId: null,
    title: "📊 Gestão",
    description: "Estoque, vendas, financeiro, documentos e clientes.",
    order: 20,
    audiences: OWNER_MANAGER_SELLER,
    recentSlots: 2,
  },
  {
    id: "gestao:estoque",
    grupo: "gestao",
    subgrupo: "estoque",
    parentId: "gestao",
    title: "Estoque ›",
    description: "Consulte carros, giro, custos, lucro e despesas.",
    order: 10,
    audiences: OWNER_MANAGER_SELLER,
    recentSlots: 0,
    backTitle: "Voltar a Gestão",
    backDescription: "Retorne à lista principal de Gestão.",
  },
  {
    id: "gestao:vendas",
    grupo: "gestao",
    subgrupo: "vendas",
    parentId: "gestao",
    title: "Vendas ›",
    description: "Registre e analise compras, vendas e equipe.",
    order: 20,
    audiences: OWNER_MANAGER,
    recentSlots: 0,
    backTitle: "Voltar a Gestão",
    backDescription: "Retorne à lista principal de Gestão.",
  },
  {
    id: "gestao:financeiro",
    grupo: "gestao",
    subgrupo: "financeiro",
    parentId: "gestao",
    title: "Financeiro ›",
    description: "Veja DRE, contas, recebíveis e conciliação.",
    order: 30,
    audiences: OWNER_MANAGER,
    recentSlots: 0,
    backTitle: "Voltar a Gestão",
    backDescription: "Retorne à lista principal de Gestão.",
  },
  {
    id: "gestao:oficina_cotacoes",
    grupo: "gestao",
    subgrupo: "oficina_cotacoes",
    parentId: "gestao",
    title: "Oficina e cotações ›",
    description: "Acompanhe OS e cotações no painel.",
    order: 40,
    audiences: OWNER_MANAGER,
    recentSlots: 0,
    backTitle: "Voltar a Gestão",
    backDescription: "Retorne à lista principal de Gestão.",
  },
  {
    id: "gestao:documentos",
    grupo: "gestao",
    subgrupo: "documentos",
    parentId: "gestao",
    title: "Documentos ›",
    description: "Guarde CRLV no WhatsApp e organize no painel.",
    order: 50,
    audiences: OWNER_MANAGER,
    recentSlots: 0,
    backTitle: "Voltar a Gestão",
    backDescription: "Retorne à lista principal de Gestão.",
  },
  {
    id: "gestao:clientes_leads",
    grupo: "gestao",
    subgrupo: "clientes_leads",
    parentId: "gestao",
    title: "Clientes e leads ›",
    description: "Consulte números, contatos e abra o CRM.",
    order: 60,
    audiences: OWNER_MANAGER_SELLER,
    recentSlots: 0,
    backTitle: "Voltar a Gestão",
    backDescription: "Retorne à lista principal de Gestão.",
  },
  {
    id: "vistoria_troca",
    grupo: "vistoria_troca",
    subgrupo: null,
    parentId: null,
    title: "🔍 Vistoria e Troca",
    description: "Avaliação, laudos, procedência e liberação para estoque.",
    order: 30,
    audiences: OWNER_MANAGER_SELLER,
    recentSlots: 2,
  },
];

const g = (
  id: string,
  secao: JarvisAjudaSecao,
  titulo: string,
  kind: Exclude<GestaoIntentKind, "none" | "ajuda">,
  comoPedir: readonly [string, string, ...string[]],
  oQueAcontece: string,
  menuMetadata: JarvisMenuMetadata,
  palavrasChave: readonly string[] = [],
): JarvisAjudaItem => ({
  id,
  secao,
  titulo,
  comoPedir,
  oQueAcontece,
  menu: menuMetadata,
  route: { type: "gestao_intent", kind },
  palavrasChave,
});

export const JARVIS_AJUDA_CATALOGO: readonly JarvisAjudaItem[] = [
  {
    id: "estoque-resumo",
    secao: "Estoque e veículos",
    titulo: "Consultar o estoque",
    comoPedir: ["Quais carros tenho?", "Qual é o valor do meu estoque?"],
    oQueAcontece: "O Jarvis consulta os veículos ativos e resume o estoque.",
    menu: menu(
      "gestao",
      "estoque",
      "gestao:estoque",
      "Resumo do estoque",
      "Quantidade, valor investido e situação dos carros.",
      10,
      OWNER_MANAGER_SELLER,
      "whatsapp",
    ),
    route: { type: "llm_tool", name: "consultar_estoque" },
    palavrasChave: ["estoque", "carros", "veiculos"],
  },
  {
    id: "estoque-busca",
    secao: "Estoque e veículos",
    titulo: "Procurar um veículo no estoque",
    comoPedir: ["Tenho algum Civic disponível?", "Tem Corolla no estoque?"],
    oQueAcontece: "O Jarvis procura modelos disponíveis no estoque da loja.",
    menu: menu(
      "gestao",
      "estoque",
      "gestao:estoque",
      "Buscar veículo",
      "Procure por modelo, placa ou situação.",
      20,
      OWNER_MANAGER_SELLER,
      "whatsapp",
    ),
    route: { type: "llm_tool", name: "consultar_estoque" },
    palavrasChave: ["procurar", "modelo", "disponivel"],
  },
  g(
    "lucro-veiculo",
    "Estoque e veículos",
    "Ver lucro de um veículo",
    "lucro_veiculo",
    [
      "Quanto lucrei no Civic?",
      "Qual o lucro do Corolla?",
    ],
    "Mostra o lucro calculado do veículo informado.",
    menu(
      "gestao",
      "estoque",
      "gestao:estoque",
      "Lucro do veículo",
      "Consulte lucro e margem de um carro.",
      40,
      OWNER_MANAGER_SELLER,
      "whatsapp",
    ),
    ["lucro", "veiculo", "carro"],
  ),
  g(
    "despesas-veiculo",
    "Estoque e veículos",
    "Ver despesas de um veículo",
    "despesas_veiculo",
    [
      "Quais as despesas do Civic?",
      "Mostre as despesas no Corolla.",
    ],
    "Lista as despesas lançadas no veículo.",
    menu(
      "gestao",
      "estoque",
      "gestao:estoque",
      "Despesas do veículo",
      "Liste os gastos lançados em um carro.",
      50,
      OWNER_MANAGER_SELLER,
      "whatsapp",
    ),
    ["despesas", "gastos"],
  ),
  g(
    "venda-raiox",
    "Estoque e veículos",
    "Analisar uma venda",
    "venda_raiox",
    [
      "Como foi a venda do Civic?",
      "Como foi a venda do Corolla?",
    ],
    "Mostra o raio-X financeiro da venda.",
    menu(
      "gestao",
      "vendas",
      "gestao:vendas",
      "Analisar uma venda",
      "Veja o raio-X financeiro de uma venda.",
      50,
      OWNER_MANAGER,
      "whatsapp",
    ),
    ["venda", "raio x", "analise"],
  ),

  g(
    "registrar-compra",
    "Compra, venda e despesas",
    "Registrar uma compra",
    "compra",
    [
      "Comprei o Civic por 80 mil.",
      "Comprei o Corolla por 95 mil.",
    ],
    "Prepara o lançamento e pede confirmação antes de salvar.",
    menu(
      "gestao",
      "vendas",
      "gestao:vendas",
      "Registrar compra",
      "Prepare a compra e confirme antes de salvar.",
      10,
      OWNER_MANAGER,
      "whatsapp",
    ),
    ["compra", "comprei"],
  ),
  g(
    "registrar-venda",
    "Compra, venda e despesas",
    "Registrar uma venda",
    "venda",
    [
      "Vendi o Civic por 90 mil.",
      "Vendi o Corolla por 110 mil.",
    ],
    "Prepara a venda e pede confirmação antes de salvar.",
    menu(
      "gestao",
      "vendas",
      "gestao:vendas",
      "Registrar venda",
      "Prepare a venda e confirme antes de salvar.",
      20,
      OWNER_MANAGER,
      "whatsapp",
    ),
    ["venda", "vendi"],
  ),
  g(
    "registrar-despesa",
    "Compra, venda e despesas",
    "Lançar uma despesa do veículo",
    "despesa",
    [
      "Gastei 850 de pneu no Civic.",
      "Paguei 1.200 de funilaria no Corolla.",
    ],
    "Classifica a despesa e pede confirmação antes de salvar.",
    menu(
      "gestao",
      "vendas",
      "gestao:vendas",
      "Lançar despesa",
      "Classifique o gasto e confirme antes de salvar.",
      30,
      OWNER_MANAGER,
      "whatsapp",
    ),
    ["despesa", "gastei", "paguei"],
  ),
  g(
    "desfazer",
    "Compra, venda e despesas",
    "Desfazer o último lançamento",
    "desfazer",
    [
      "Desfazer último lançamento.",
      "Desfaz o último.",
    ],
    "Localiza o último lançamento elegível e pede confirmação.",
    menu(
      "gestao",
      "vendas",
      "gestao:vendas",
      "Desfazer lançamento",
      "Desfaça o último lançamento elegível em até 24h.",
      40,
      OWNER_MANAGER,
      "whatsapp",
    ),
    ["desfazer", "cancelar lancamento"],
  ),
  g(
    "piores-negocios",
    "Compra, venda e despesas",
    "Ver os piores negócios",
    "piores_negocios_mes",
    [
      "Quais foram os piores negócios do mês?",
      "Mostre o pior negócio.",
    ],
    "Aponta as vendas com pior resultado no mês.",
    menu(
      "gestao",
      "vendas",
      "gestao:vendas",
      "Piores negócios",
      "Veja os piores resultados do mês.",
      60,
      OWNER_MANAGER,
      "whatsapp",
    ),
    ["piores", "negocios", "prejuizo"],
  ),

  g(
    "dre",
    "Resultado e financeiro",
    "Consultar o DRE",
    "dre_whatsapp",
    [
      "DRE completo.",
      "Resultado do mês.",
    ],
    "Entrega o demonstrativo do resultado pelo WhatsApp.",
    menu(
      "gestao",
      "financeiro",
      "gestao:financeiro",
      "DRE do mês",
      "Receba o demonstrativo do resultado no WhatsApp.",
      10,
      OWNER_MANAGER,
      "whatsapp",
    ),
    ["dre", "resultado", "demonstrativo"],
  ),
  g(
    "lucro-mes",
    "Resultado e financeiro",
    "Consultar o lucro dos carros no mês",
    "lucro_mes",
    [
      "Qual foi o lucro do mês?",
      "Mostre o lucro mensal.",
    ],
    "Soma o lucro dos veículos vendidos no mês.",
    menu(
      "gestao",
      "financeiro",
      "gestao:financeiro",
      "Lucro dos carros",
      "Consulte o lucro dos carros vendidos no mês.",
      101,
      OWNER_MANAGER,
      "whatsapp",
      { visible: false },
    ),
    ["lucro", "mes"],
  ),
  g(
    "lucro-loja",
    "Resultado e financeiro",
    "Consultar o lucro líquido da loja",
    "lucro_loja_mes",
    [
      "Quanto a loja lucrou?",
      "Qual o lucro líquido da loja?",
    ],
    "Calcula o resultado líquido da loja no mês.",
    menu(
      "gestao",
      "financeiro",
      "gestao:financeiro",
      "Lucro da loja",
      "Consulte o resultado líquido do mês.",
      20,
      OWNER_MANAGER,
      "whatsapp",
    ),
    ["lucro liquido", "loja"],
  ),
  g(
    "contas-semana",
    "Resultado e financeiro",
    "Ver contas da semana",
    "contas_semana",
    [
      "O que vence essa semana?",
      "O que vence essa semana na loja?",
    ],
    "Resume as contas a pagar e receber da semana.",
    menu(
      "gestao",
      "financeiro",
      "gestao:financeiro",
      "Contas da semana",
      "Veja contas a pagar e receber nos próximos dias.",
      30,
      OWNER_MANAGER,
      "whatsapp",
    ),
    ["contas", "semana", "vencimentos"],
  ),
  g(
    "contas-amanha",
    "Resultado e financeiro",
    "Ver contas de amanhã",
    "contas_amanha",
    [
      "O que vence amanhã?",
      "Quais são as contas amanhã?",
    ],
    "Lista os compromissos financeiros do dia seguinte.",
    menu(
      "gestao",
      "financeiro",
      "gestao:financeiro",
      "Contas de amanhã",
      "Liste os compromissos financeiros de amanhã.",
      102,
      OWNER_MANAGER,
      "whatsapp",
      { visible: false },
    ),
    ["contas", "amanha"],
  ),
  g(
    "a-receber",
    "Resultado e financeiro",
    "Consultar valores a receber",
    "a_receber",
    [
      "Quanto tenho a receber?",
      "Mostre as contas a receber.",
    ],
    "Soma e lista os recebimentos em aberto.",
    menu(
      "gestao",
      "financeiro",
      "gestao:financeiro",
      "Valores a receber",
      "Consulte recebimentos que seguem em aberto.",
      40,
      OWNER_MANAGER,
      "whatsapp",
    ),
    ["receber", "recebimentos"],
  ),
  g(
    "conciliacao",
    "Resultado e financeiro",
    "Ver pendências de conciliação",
    "conciliacao_pendente",
    [
      "O que falta conciliar?",
      "Mostre o que falta conciliar.",
    ],
    "Mostra os lançamentos ainda não conciliados.",
    menu(
      "gestao",
      "financeiro",
      "gestao:financeiro",
      "Falta conciliar",
      "Veja quantidade e valor ainda não conciliados.",
      50,
      OWNER_MANAGER,
      "whatsapp",
    ),
    ["conciliar", "conciliacao"],
  ),
  g(
    "contador",
    "Resultado e financeiro",
    "Enviar relatório ao contador",
    "pacote_contador",
    [
      "Manda o relatório do mês pro contador.",
      "Mandar relatório do mês para o contador.",
    ],
    "Gera o pacote mensal e o link seguro para o contador.",
    menu(
      "gestao",
      "financeiro",
      "gestao:financeiro",
      "Relatório contador",
      "Gere um link seguro do pacote mensal.",
      60,
      OWNER_MANAGER,
      "whatsapp",
    ),
    ["contador", "relatorio"],
  ),
  g(
    "contador-revogar",
    "Resultado e financeiro",
    "Cancelar link do contador",
    "revogar_link_contador",
    [
      "Cancela o link do contador.",
      "Revogar link contador.",
    ],
    "Revoga o link ativo do relatório do contador.",
    menu(
      "gestao",
      "financeiro",
      "gestao:financeiro",
      "Cancelar link contador",
      "Revogue o link ativo do relatório mensal.",
      103,
      OWNER_MANAGER,
      "whatsapp",
      { visible: false },
    ),
    ["contador", "cancelar link"],
  ),

  g(
    "ranking",
    "Equipe e comissões",
    "Ver ranking dos vendedores",
    "ranking_vendedores",
    [
      "Ranking dos vendedores.",
      "Ranking equipe.",
    ],
    "Ordena os vendedores pelo resultado do mês.",
    menu(
      "gestao",
      "vendas",
      "gestao:vendas",
      "Ranking vendedores",
      "Ordene os vendedores pelo resultado do mês.",
      110,
      OWNER_MANAGER,
      "whatsapp",
      { visible: false },
    ),
    ["ranking", "vendedores", "equipe"],
  ),
  g(
    "relatorio-vendedores",
    "Equipe e comissões",
    "Ver relatório da equipe",
    "relatorio_vendedores",
    [
      "Relatório dos vendedores.",
      "Como estão as vendas dos vendedores?",
    ],
    "Resume desempenho, metas e alertas da equipe.",
    menu(
      "gestao",
      "vendas",
      "gestao:vendas",
      "Relatório da equipe",
      "Resuma desempenho, metas e alertas da equipe.",
      111,
      OWNER_MANAGER,
      "whatsapp",
      { visible: false },
    ),
    ["relatorio", "equipe"],
  ),
  g(
    "vendedor-detalhe",
    "Equipe e comissões",
    "Ver detalhes de um vendedor",
    "vendedor_detalhe",
    [
      "Como está a Ana?",
      "Vendas do Carlos.",
    ],
    "Mostra o desempenho individual do vendedor citado.",
    menu(
      "gestao",
      "vendas",
      "gestao:vendas",
      "Detalhe do vendedor",
      "Veja o desempenho individual de um vendedor.",
      112,
      OWNER_MANAGER,
      "whatsapp",
      { visible: false },
    ),
    ["vendedor", "desempenho"],
  ),
  g(
    "vendedor-mes",
    "Equipe e comissões",
    "Consultar vendas de um vendedor",
    "vendedor_mes",
    [
      "Quanto a Ana vendeu? Vendedora Ana.",
      "Quanto o Carlos vendeu? Vendedor Carlos.",
    ],
    "Mostra as vendas do vendedor no mês.",
    menu(
      "gestao",
      "vendas",
      "gestao:vendas",
      "Vendas do vendedor",
      "Veja as vendas de um vendedor no mês.",
      113,
      OWNER_MANAGER,
      "whatsapp",
      { visible: false },
    ),
    ["vendedor", "vendeu"],
  ),
  g(
    "comissao",
    "Equipe e comissões",
    "Consultar comissões",
    "comissao_mes",
    [
      "Comissão do mês.",
      "Qual a comissão do mês?",
    ],
    "Resume as comissões apuradas no mês.",
    menu(
      "gestao",
      "vendas",
      "gestao:vendas",
      "Comissões do mês",
      "Consulte as comissões apuradas no mês.",
      114,
      OWNER_MANAGER,
      "whatsapp",
      { visible: false },
    ),
    ["comissao", "comissoes"],
  ),
  g(
    "metas",
    "Equipe e comissões",
    "Ver metas da equipe",
    "meta_bateu",
    [
      "Quem bateu a meta?",
      "Mostre a meta do mês.",
    ],
    "Mostra quem atingiu a meta mensal.",
    menu(
      "gestao",
      "vendas",
      "gestao:vendas",
      "Metas da equipe",
      "Veja quem atingiu a meta mensal.",
      115,
      OWNER_MANAGER,
      "whatsapp",
      { visible: false },
    ),
    ["meta", "equipe"],
  ),

  g(
    "nfe-emitir",
    "Notas fiscais e contratos",
    "Emitir uma nota fiscal",
    "nfe_emit",
    [
      "Emite a nota do Civic.",
      "Emitir a nota do Corolla.",
    ],
    "Prepara a NF-e do veículo e pede confirmação.",
    menu(
      "gestao",
      "financeiro",
      "gestao:financeiro",
      "Emitir nota fiscal",
      "Prepare a NF-e e confirme antes de emitir.",
      120,
      OWNER_MANAGER,
      "whatsapp",
      { visible: false },
    ),
    ["nota", "nfe", "emitir"],
  ),
  g(
    "nfe-status",
    "Notas fiscais e contratos",
    "Consultar o status de uma nota",
    "nfe_status",
    [
      "Qual o status da nota do Civic?",
      "Status da nota do Corolla.",
    ],
    "Consulta a situação da NF-e do veículo.",
    menu(
      "gestao",
      "financeiro",
      "gestao:financeiro",
      "Status da nota",
      "Consulte a situação da NF-e de um veículo.",
      121,
      OWNER_MANAGER,
      "whatsapp",
      { visible: false },
    ),
    ["nota", "status", "nfe"],
  ),
  g(
    "notas-mes",
    "Notas fiscais e contratos",
    "Ver notas do mês",
    "notas_mes",
    [
      "Notas do mês.",
      "Notas fiscais do mês.",
    ],
    "Resume as notas fiscais emitidas no mês.",
    menu(
      "gestao",
      "financeiro",
      "gestao:financeiro",
      "Notas do mês",
      "Resuma as notas fiscais emitidas no mês.",
      122,
      OWNER_MANAGER,
      "whatsapp",
      { visible: false },
    ),
    ["notas", "mes"],
  ),
  g(
    "contratos-pendentes",
    "Notas fiscais e contratos",
    "Ver contratos pendentes",
    "contratos_pendentes",
    [
      "Contratos pendentes?",
      "Pendentes de assinatura.",
    ],
    "Lista os contratos que aguardam assinatura.",
    menu(
      "gestao",
      "financeiro",
      "gestao:financeiro",
      "Contratos pendentes",
      "Liste contratos que aguardam assinatura.",
      123,
      OWNER_MANAGER,
      "whatsapp",
      { visible: false },
    ),
    ["contratos", "pendentes"],
  ),
  g(
    "contrato-status",
    "Notas fiscais e contratos",
    "Consultar um contrato",
    "contrato_status",
    [
      "Status do contrato do Civic.",
      "Contrato do Corolla.",
    ],
    "Consulta o contrato ligado ao veículo.",
    menu(
      "gestao",
      "financeiro",
      "gestao:financeiro",
      "Consultar contrato",
      "Consulte o contrato ligado ao veículo.",
      124,
      OWNER_MANAGER,
      "whatsapp",
      { visible: false },
    ),
    ["contrato", "status"],
  ),

  {
    id: "oficina-os",
    secao: "Oficina e cotações",
    titulo: "Gerenciar ordens de serviço",
    comoPedir: [
      "Abra Gestão e toque em Operações.",
      "No painel, entre em Gestão > Operações.",
    ],
    oQueAcontece:
      "No painel você abre OS, registra serviços e acompanha o andamento.",
    menu: menu(
      "gestao",
      "oficina_cotacoes",
      "gestao:oficina_cotacoes",
      "Abrir operações",
      "Veja ordens de serviço no painel.",
      10,
      OWNER_MANAGER,
      "panel",
    ),
    route: {
      type: "panel",
      href: "/gestao/operacoes",
      path: "Gestão › Operações",
    },
    palavrasChave: ["oficina", "os", "ordem de servico"],
  },
  {
    id: "cotacoes",
    secao: "Oficina e cotações",
    titulo: "Pedir e escolher cotações",
    comoPedir: [
      "Abra uma OS e toque em Pedir cotação.",
      "Na OS, abra a área de cotações.",
    ],
    oQueAcontece: "O painel envia pedidos aos parceiros e reúne as respostas.",
    menu: menu(
      "gestao",
      "oficina_cotacoes",
      "gestao:oficina_cotacoes",
      "Cotações recebidas",
      "Escolha propostas recebidas na OS pelo painel.",
      20,
      OWNER_MANAGER,
      "panel",
    ),
    route: {
      type: "panel",
      href: "/gestao/operacoes",
      path: "Gestão › Operações › OS › Cotações",
    },
    palavrasChave: ["cotacao", "parceiro", "oficina"],
  },

  {
    id: "gerar-arte",
    secao: "Anúncios e redes",
    titulo: "Criar uma arte",
    comoPedir: [
      "Crie uma arte para a promoção da loja.",
      "Gere uma imagem para o evento de sábado.",
    ],
    oQueAcontece: "O Jarvis cria uma imagem a partir do seu pedido.",
    menu: menu(
      "marketing",
      null,
      "marketing",
      "Criar arte de anúncio",
      "Monte uma arte com foto, dados e identidade da loja.",
      20,
      OWNER,
      "whatsapp",
    ),
    route: { type: "owner_media", action: "generate" },
    palavrasChave: ["arte", "imagem", "criar"],
  },
  {
    id: "editar-foto",
    secao: "Anúncios e redes",
    titulo: "Editar uma foto",
    comoPedir: ["Melhora essa foto.", "Troca o fundo dessa imagem."],
    oQueAcontece: "O Jarvis edita a última foto enviada ou selecionada.",
    menu: menu(
      "marketing",
      null,
      "marketing",
      "Editar foto",
      "Edite a última foto enviada ou selecionada.",
      101,
      OWNER,
      "whatsapp",
      { visible: false },
    ),
    route: { type: "owner_media", action: "edit" },
    palavrasChave: ["editar", "foto", "fundo"],
  },
  {
    id: "publicar-midia",
    secao: "Anúncios e redes",
    titulo: "Publicar uma mídia",
    comoPedir: ["Posta essa no Instagram.", "Publica essa foto no Facebook."],
    oQueAcontece:
      "O Jarvis prepara a publicação da mídia nas redes escolhidas.",
    menu: menu(
      "marketing",
      "postar_redes",
      "marketing:postar_redes",
      "Publicar mídia",
      "Prepare a publicação nas redes escolhidas.",
      101,
      OWNER,
      "whatsapp",
      { visible: false },
    ),
    route: { type: "owner_media", action: "post" },
    palavrasChave: ["postar", "publicar", "instagram", "facebook"],
  },
  {
    id: "gerar-publicar",
    secao: "Anúncios e redes",
    titulo: "Criar e publicar uma arte",
    comoPedir: [
      "Crie uma arte da promoção e depois posta no Instagram.",
      "Gere uma imagem do evento e publica no Facebook.",
    ],
    oQueAcontece: "O Jarvis cria a arte e segue para a publicação.",
    menu: menu(
      "marketing",
      null,
      "marketing",
      "Criar e publicar",
      "Crie uma arte e siga para a publicação.",
      102,
      OWNER,
      "whatsapp",
      { visible: false },
    ),
    route: { type: "owner_media", action: "generate_and_post" },
    palavrasChave: ["criar", "publicar", "arte"],
  },
  {
    id: "agendar-post",
    secao: "Anúncios e redes",
    titulo: "Agendar uma publicação",
    comoPedir: [
      "Agenda este post para amanhã às 10h.",
      "Publica esta foto sábado às 9h.",
    ],
    oQueAcontece:
      "O Jarvis agenda a publicação pendente para o horário pedido.",
    menu: menu(
      "marketing",
      "postar_redes",
      "marketing:postar_redes",
      "Agendar publicação",
      "Agende um criativo aprovado; story fica no painel.",
      60,
      OWNER,
      "whatsapp",
    ),
    route: { type: "llm_tool", name: "agendar_post_pendente" },
    palavrasChave: ["agendar", "post", "publicacao"],
  },
  {
    id: "listar-posts-agendados",
    secao: "Anúncios e redes",
    titulo: "Ver publicações agendadas",
    comoPedir: [
      "Quais posts estão agendados?",
      "Mostre meus agendamentos de posts.",
    ],
    oQueAcontece: "O Jarvis lista as publicações futuras da loja.",
    menu: menu(
      "marketing",
      "postar_redes",
      "marketing:postar_redes",
      "Meus agendamentos",
      "Liste, remarque ou cancele posts futuros.",
      70,
      OWNER,
      "whatsapp",
    ),
    route: { type: "llm_tool", name: "listar_agendamentos_posts" },
    palavrasChave: ["posts", "agendados", "agenda"],
  },
  {
    id: "video",
    secao: "Anúncios e redes",
    titulo: "Criar um vídeo animado",
    comoPedir: [
      "Crie um vídeo animado deste carro.",
      "Faça um vídeo com esta foto.",
    ],
    oQueAcontece: "O Jarvis gera um vídeo animado usando a mídia enviada.",
    menu: menu(
      "marketing",
      null,
      "marketing",
      "Criar vídeo",
      "Crie um vídeo animado com roteiro aprovado.",
      40,
      OWNER,
      "whatsapp",
    ),
    route: { type: "llm_tool", name: "criar_video_animado" },
    palavrasChave: ["video", "animado"],
  },
  {
    id: "anuncios-relatorio",
    secao: "Anúncios e redes",
    titulo: "Consultar anúncios patrocinados",
    comoPedir: [
      "Como estão meus anúncios?",
      "Mostre o relatório dos anúncios Meta.",
    ],
    oQueAcontece: "O Jarvis consulta o desempenho das campanhas conectadas.",
    menu: menu(
      "marketing",
      null,
      "marketing",
      "Resultado campanhas",
      "Veja gasto, alcance e situação dos anúncios Meta.",
      60,
      OWNER,
      "whatsapp",
      {
        availability: availability({ conexoes: ["meta_ads"] }),
      },
    ),
    route: { type: "llm_tool", name: "relatorio_anuncios_meta" },
    palavrasChave: ["anuncios", "campanhas", "meta", "relatorio"],
  },
  {
    id: "campanha-status",
    secao: "Anúncios e redes",
    titulo: "Consultar uma campanha",
    comoPedir: ["Qual o status da campanha?", "Essa campanha está ativa?"],
    oQueAcontece: "O Jarvis consulta a situação atual da campanha informada.",
    menu: menu(
      "marketing",
      null,
      "marketing",
      "Status da campanha",
      "Consulte a situação atual de uma campanha.",
      103,
      OWNER,
      "whatsapp",
      {
        availability: availability({ conexoes: ["meta_ads"] }),
        visible: false,
      },
    ),
    route: { type: "llm_tool", name: "status_campanha_meta" },
    palavrasChave: ["campanha", "status", "ativa"],
  },

  {
    id: "fipe",
    secao: "FIPE e preço",
    titulo: "Consultar a tabela FIPE",
    comoPedir: [
      "Qual a FIPE do Civic 2022?",
      "Consulte a FIPE do Corolla 2021.",
    ],
    oQueAcontece: "O Jarvis consulta a referência FIPE do veículo informado.",
    menu: menu(
      "gestao",
      "estoque",
      "gestao:estoque",
      "Consultar FIPE",
      "Consulte a referência FIPE de um veículo.",
      110,
      OWNER_MANAGER_SELLER,
      "whatsapp",
      { visible: false },
    ),
    route: { type: "llm_tool", name: "consultar_fipe" },
    palavrasChave: ["fipe", "preco", "valor"],
  },
  {
    id: "preco-painel",
    secao: "FIPE e preço",
    titulo: "Alterar o preço anunciado",
    comoPedir: [
      "Abra o veículo no estoque e edite o preço.",
      "No painel, entre no veículo e altere o preço.",
    ],
    oQueAcontece: "O preço anunciado é alterado com segurança no painel.",
    menu: menu(
      "gestao",
      "estoque",
      "gestao:estoque",
      "Alterar preço",
      "Altere o preço anunciado com segurança no painel.",
      111,
      OWNER_MANAGER_SELLER,
      "panel",
      { visible: false },
    ),
    route: {
      type: "panel",
      href: "/veiculos",
      path: "Estoque › Veículo › Editar",
    },
    palavrasChave: ["preco", "alterar", "anunciado"],
  },

  g(
    "fechamento",
    "Resumos automáticos",
    "Pedir o fechamento do dia",
    "fechamento_dia",
    [
      "Fechamento do dia.",
      "Fechamento de hoje.",
      "Resumo do dia.",
    ],
    "Entrega o fechamento novo com vendas, estoque, financeiro e decisões.",
    menu(
      "gestao",
      null,
      "gestao",
      "Fechamento do dia",
      "Veja vendas, estoque, financeiro e decisões.",
      120,
      OWNER_MANAGER,
      "whatsapp",
      { visible: false },
    ),
    ["fechamento", "resumo", "hoje"],
  ),
  g(
    "posicao",
    "Resumos automáticos",
    "Consultar a posição da loja",
    "posicao_loja",
    [
      "Posição da loja.",
      "Como estamos?",
    ],
    "Mostra a posição gerencial atual da loja.",
    menu(
      "gestao",
      null,
      "gestao",
      "Posição da loja",
      "Veja a posição gerencial atual da loja.",
      121,
      OWNER_MANAGER,
      "whatsapp",
      { visible: false },
    ),
    ["posicao", "status", "loja"],
  ),
  {
    id: "lembrete",
    secao: "Resumos automáticos",
    titulo: "Criar um lembrete",
    comoPedir: [
      "Me lembre amanhã às 10h de ligar para o cliente.",
      "Crie um lembrete para sexta às 15h.",
    ],
    oQueAcontece: "O Jarvis agenda um lembrete e avisa no WhatsApp.",
    menu: menu(
      "gestao",
      null,
      "gestao",
      "Criar lembrete",
      "Agende um lembrete pelo WhatsApp.",
      122,
      OWNER_MANAGER,
      "whatsapp",
      { visible: false },
    ),
    route: { type: "llm_tool", name: "criar_lembrete" },
    palavrasChave: ["lembrete", "lembrar", "agenda"],
  },
  {
    id: "mensagem-contato",
    secao: "Clientes e leads",
    titulo: "Mandar mensagem para um contato",
    comoPedir: [
      "Manda uma mensagem para o João dizendo que retorno amanhã.",
      "Avise a Maria que a reunião mudou para 14h.",
    ],
    oQueAcontece: "O Jarvis localiza o contato comercial e envia a mensagem.",
    menu: menu(
      "gestao",
      "clientes_leads",
      "gestao:clientes_leads",
      "Contatos comerciais",
      "Liste contatos e envie uma mensagem autorizada.",
      20,
      OWNER_MANAGER_SELLER,
      "whatsapp",
    ),
    route: {
      type: "llm_tool",
      name: "enviar_mensagem_contato_comercial",
    },
    palavrasChave: ["mensagem", "contato", "avisar"],
  },
  {
    id: "resumos-config",
    secao: "Resumos automáticos",
    titulo: "Configurar resumos automáticos",
    comoPedir: [
      "Abra Gestão e entre em Configurações.",
      "No painel, ajuste os resumos em Gestão > Configurações.",
    ],
    oQueAcontece:
      "No painel você escolhe horários e destinatários dos resumos.",
    menu: menu(
      "gestao",
      null,
      "gestao",
      "Configurar resumos",
      "Escolha horários e destinatários no painel.",
      123,
      OWNER_MANAGER,
      "panel",
      { visible: false },
    ),
    route: {
      type: "panel",
      href: "/gestao/lucro",
      path: "Gestão › Configurações",
    },
    palavrasChave: ["automatico", "horario", "configurar"],
  },
  {
    id: "estoque-vendidos",
    secao: "Estoque e veículos",
    titulo: "Ver vendidos no mês",
    comoPedir: [
      "Quantos veículos vendi este mês?",
      "Quais carros foram vendidos no mês?",
    ],
    oQueAcontece: "Lista os veículos vendidos e resume o período.",
    menu: menu(
      "gestao",
      "estoque",
      "gestao:estoque",
      "Vendidos no mês",
      "Veja quantos veículos foram vendidos no período.",
      30,
      OWNER_MANAGER_SELLER,
      "whatsapp",
    ),
    route: {
      type: "handler",
      name: "tryProcessOwnerVehicleStockInbound",
      source: "./vehicle-stock-owner-handler.ts",
    },
    palavrasChave: ["vendidos", "vendas", "mes"],
  },
  {
    id: "estoque-giro",
    secao: "Estoque e veículos",
    titulo: "Ver Giro 30-60-90",
    comoPedir: [
      "Abra o Giro 30-60-90 no painel.",
      "No painel, veja os carros parados no Giro 30-60-90.",
    ],
    oQueAcontece:
      "Não há comando WhatsApp dedicado; o painel mostra faixas e custo.",
    menu: menu(
      "gestao",
      "estoque",
      "gestao:estoque",
      "Giro do estoque",
      "Veja carros parados e custo de esperar.",
      60,
      OWNER_MANAGER_SELLER,
      "panel",
    ),
    route: {
      type: "panel",
      href: "/gestao/lucro?aba=giro",
      path: "Gestão › Giro 30-60-90",
    },
    palavrasChave: ["giro", "30", "60", "90", "parados"],
  },
  {
    id: "estoque-abrir",
    secao: "Estoque e veículos",
    titulo: "Abrir estoque no painel",
    comoPedir: [
      "Abra o estoque no painel.",
      "No painel, entre em Estoque.",
    ],
    oQueAcontece: "Abre o cadastro e a gestão dos veículos no painel.",
    menu: menu(
      "gestao",
      "estoque",
      "gestao:estoque",
      "Abrir estoque",
      "Gerencie cadastros, preços e status no painel.",
      70,
      OWNER_MANAGER_SELLER,
      "panel",
    ),
    route: {
      type: "panel",
      href: "/veiculos",
      path: "Estoque › Veículos",
    },
    palavrasChave: ["abrir", "estoque", "painel"],
  },
  {
    id: "equipe-comissoes-ajuda",
    secao: "Equipe e comissões",
    titulo: "Ajuda de equipe e comissões",
    comoPedir: [
      "Como consulto a equipe e as comissões?",
      "Quais comandos existem para vendedores e metas?",
    ],
    oQueAcontece: "Mostra exemplos reais de equipe, metas e comissões.",
    menu: menu(
      "gestao",
      "vendas",
      "gestao:vendas",
      "Equipe e comissões",
      "Consulte ranking, metas, vendas e comissões.",
      70,
      OWNER_MANAGER,
      "whatsapp",
    ),
    route: {
      type: "handler",
      name: "formatarMenuJarvisAjuda",
      source: "./jarvis-ajuda-catalogo.ts",
    },
    palavrasChave: ["equipe", "comissoes", "vendedores"],
  },
  {
    id: "notas-contratos-ajuda",
    secao: "Notas fiscais e contratos",
    titulo: "Ajuda de notas e contratos",
    comoPedir: [
      "Como uso notas e contratos?",
      "Quais comandos existem para NF-e e contratos?",
    ],
    oQueAcontece: "Mostra exemplos reais de NF-e e contratos.",
    menu: menu(
      "gestao",
      "financeiro",
      "gestao:financeiro",
      "Notas e contratos",
      "Consulte NF-e e contratos; emita com confirmação.",
      70,
      OWNER_MANAGER,
      "whatsapp",
    ),
    route: {
      type: "handler",
      name: "formatarMenuJarvisAjuda",
      source: "./jarvis-ajuda-catalogo.ts",
    },
    palavrasChave: ["notas", "nfe", "contratos"],
  },
  {
    id: "oficina-parceiros",
    secao: "Oficina e cotações",
    titulo: "Gerenciar parceiros",
    comoPedir: [
      "Abra os parceiros no painel.",
      "No painel, entre em Gestão e depois Parceiros.",
    ],
    oQueAcontece: "Abre o cadastro das oficinas parceiras no painel.",
    menu: menu(
      "gestao",
      "oficina_cotacoes",
      "gestao:oficina_cotacoes",
      "Parceiros",
      "Cadastre e gerencie oficinas parceiras no painel.",
      30,
      OWNER_MANAGER,
      "panel",
    ),
    route: {
      type: "panel",
      href: "/gestao/parceiros",
      path: "Gestão › Parceiros",
    },
    palavrasChave: ["parceiros", "oficinas", "fornecedores"],
  },
  {
    id: "documentos-guardar-crlv",
    secao: "Documentos",
    titulo: "Guardar CRLV",
    comoPedir: [
      "Vou enviar o CRLV para guardar.",
      "Guarde este documento do veículo no cofre.",
    ],
    oQueAcontece:
      "O portão local identifica o CRLV e o cofre guarda o arquivo protegido.",
    menu: menu(
      "gestao",
      "documentos",
      "gestao:documentos",
      "Guardar CRLV",
      "Envie o documento; o portão local protege e lê.",
      10,
      OWNER_MANAGER,
      "whatsapp",
    ),
    route: {
      type: "handler",
      name: "verificarDocumentoNoPortao",
      source: "./documento-portao.ts",
    },
    palavrasChave: ["crlv", "documento", "cofre", "guardar"],
  },
  {
    id: "documentos-cofre",
    secao: "Documentos",
    titulo: "Abrir o cofre",
    comoPedir: [
      "Abra os documentos no painel.",
      "No painel, entre no veículo e abra Documentos.",
    ],
    oQueAcontece: "Abre a pasta digital protegida de cada veículo.",
    menu: menu(
      "gestao",
      "documentos",
      "gestao:documentos",
      "Abrir cofre",
      "Consulte documentos guardados no painel.",
      20,
      OWNER_MANAGER,
      "panel",
      {
        availability: availability({
          condicao: "selecionar_veiculo",
          nota: "A pasta digital é aberta dentro do veículo selecionado.",
        }),
      },
    ),
    route: {
      type: "panel",
      href: "/veiculos",
      path: "Estoque › Veículo › Documentos",
    },
    palavrasChave: ["cofre", "pasta digital", "documentos"],
  },
  {
    id: "documentos-vincular",
    secao: "Documentos",
    titulo: "Vincular documento ao estoque",
    comoPedir: [
      "Vincule o CRLV ao veículo pelo painel.",
      "No painel, abra o veículo e a pasta digital.",
    ],
    oQueAcontece: "Permite vincular um documento guardado ao veículo.",
    menu: menu(
      "gestao",
      "documentos",
      "gestao:documentos",
      "Vincular ao estoque",
      "Vincule um CRLV guardado a um veículo.",
      30,
      OWNER_MANAGER,
      "panel",
      {
        availability: availability({ condicao: "selecionar_veiculo" }),
      },
    ),
    route: {
      type: "panel",
      href: "/veiculos",
      path: "Estoque › Veículo › Documentos",
    },
    palavrasChave: ["vincular", "crlv", "estoque"],
  },
  {
    id: "documentos-notas-contratos",
    secao: "Documentos",
    titulo: "Abrir notas e contratos",
    comoPedir: [
      "Abra notas e contratos no painel.",
      "No painel, entre em Gestão e abra Notas ou Contratos.",
    ],
    oQueAcontece: "Abre os documentos fiscais e comerciais no painel.",
    menu: menu(
      "gestao",
      "documentos",
      "gestao:documentos",
      "Notas e contratos",
      "Consulte documentos fiscais e comerciais.",
      40,
      OWNER_MANAGER,
      "panel",
    ),
    route: {
      type: "panel",
      href: "/gestao/lucro?aba=notas",
      path: "Gestão › Notas e contratos",
    },
    palavrasChave: ["notas", "contratos", "documentos"],
  },
  {
    id: "clientes-resumo",
    secao: "Clientes e leads",
    titulo: "Consultar clientes e leads",
    comoPedir: [
      "Quantos clientes e leads temos?",
      "Mostre o resumo dos leads.",
    ],
    oQueAcontece: "Resume clientes ativos, novos e total de leads.",
    menu: menu(
      "gestao",
      "clientes_leads",
      "gestao:clientes_leads",
      "Resumo de leads",
      "Veja clientes ativos, novos e total de leads.",
      10,
      OWNER_MANAGER_SELLER,
      "whatsapp",
    ),
    route: { type: "llm_tool", name: "consultar_clientes_leads" },
    palavrasChave: ["clientes", "leads", "resumo"],
  },
  {
    id: "clientes-crm",
    secao: "Clientes e leads",
    titulo: "Abrir o CRM",
    comoPedir: [
      "Abra o CRM no painel.",
      "No painel, entre no funil de leads.",
    ],
    oQueAcontece: "Abre o acompanhamento de clientes e retornos no painel.",
    menu: menu(
      "gestao",
      "clientes_leads",
      "gestao:clientes_leads",
      "Abrir CRM",
      "Acompanhe clientes, etapas e retornos no painel.",
      30,
      OWNER_MANAGER_SELLER,
      "panel",
    ),
    route: {
      type: "panel",
      href: "/leads-funil",
      path: "Clientes › Funil de leads",
    },
    palavrasChave: ["crm", "clientes", "funil"],
  },
  {
    id: "clientes-sem-retorno",
    secao: "Clientes e leads",
    titulo: "Ver leads sem retorno",
    comoPedir: [
      "Quais leads estão sem retorno?",
      "Mostre os leads quentes que precisam de resposta.",
    ],
    oQueAcontece: "Usa as prioridades do fechamento e orienta abrir o CRM.",
    menu: menu(
      "gestao",
      "clientes_leads",
      "gestao:clientes_leads",
      "Leads sem retorno",
      "Veja prioridades no fechamento e abra o CRM.",
      40,
      OWNER_MANAGER_SELLER,
      "whatsapp",
      {
        availability: availability({
          condicao: "fechamento.dados.atendimento.leadsQuentesSemRetorno24h",
        }),
      },
    ),
    route: {
      type: "handler",
      name: "buildGestaoFechamentoDia",
      source: "./gestao-fechamento-dia.ts",
    },
    palavrasChave: ["leads", "sem retorno", "quentes"],
  },
  {
    id: "gestao-urgentes",
    secao: "Resumos automáticos",
    titulo: "Ver urgentes do dia",
    comoPedir: [
      "Quais são os urgentes do dia?",
      "O que precisa de decisão hoje?",
    ],
    oQueAcontece: "Mostra somente as ações do fechamento que pedem decisão.",
    menu: menu(
      "gestao",
      null,
      "gestao",
      "⚡ Urgentes do dia",
      "Veja só o que pede decisão hoje. Some quando estiver vazio.",
      5,
      OWNER_MANAGER,
      "whatsapp",
      {
        availability: availability({
          condicao: "buildGestaoFechamentoDia().dados.acoes.length > 0",
        }),
      },
    ),
    route: {
      type: "handler",
      name: "buildGestaoFechamentoDia",
      source: "./gestao-fechamento-dia.ts",
    },
    palavrasChave: ["urgentes", "acoes", "decisoes"],
  },
  {
    id: "gestao-ajuda",
    secao: "Resumos automáticos",
    titulo: "Ajuda de Gestão",
    comoPedir: [
      "Ajuda de Gestão.",
      "Quais comandos de gestão estão disponíveis?",
    ],
    oQueAcontece: "Mostra exemplos dos comandos de gestão disponíveis.",
    menu: menu(
      "gestao",
      null,
      "gestao",
      "Ajuda de Gestão",
      "Veja exemplos de comandos de gestão.",
      70,
      OWNER_MANAGER,
      "whatsapp",
      { recentEligible: false },
    ),
    route: {
      type: "handler",
      name: "formatarMenuJarvisAjuda",
      source: "./jarvis-ajuda-catalogo.ts",
    },
    palavrasChave: ["ajuda", "gestao", "comandos"],
  },
  {
    id: "marketing-carrossel",
    secao: "Anúncios e redes",
    titulo: "Criar carrossel",
    comoPedir: [
      "Crie um carrossel para o Instagram.",
      "Monte cards para publicar no Instagram.",
    ],
    oQueAcontece: "Gera cards para aprovação e publica somente no Instagram.",
    menu: menu(
      "marketing",
      null,
      "marketing",
      "Criar carrossel",
      "Gere cards e aprove antes de publicar no Instagram.",
      30,
      OWNER,
      "whatsapp",
      {
        availability: availability({ conexoes: ["instagram"] }),
      },
    ),
    route: { type: "llm_tool", name: "criar_carrossel" },
    palavrasChave: ["carrossel", "cards", "instagram"],
  },
  {
    id: "marketing-campanha-meta",
    secao: "Anúncios e redes",
    titulo: "Criar campanha Meta Ads",
    comoPedir: [
      "Quero criar uma campanha no Meta Ads.",
      "Monte um anúncio patrocinado para a loja.",
    ],
    oQueAcontece: "Inicia o questionário e exige revisão antes de publicar.",
    menu: menu(
      "marketing",
      null,
      "marketing",
      "Campanha Meta Ads",
      "Monte, revise e confirme uma campanha patrocinada.",
      50,
      OWNER,
      "whatsapp",
      {
        availability: availability({ conexoes: ["meta_ads"] }),
      },
    ),
    route: {
      type: "handler",
      name: "processMetaAdsQuestionario",
      source: "../whatsapp-cloud-inbound-processor/index.ts",
    },
    palavrasChave: ["campanha", "meta ads", "patrocinado"],
  },
  {
    id: "marketing-ajuda",
    secao: "Anúncios e redes",
    titulo: "Ajuda de Marketing",
    comoPedir: [
      "Ajuda de Marketing.",
      "Quais comandos de Marketing estão disponíveis?",
    ],
    oQueAcontece: "Mostra exemplos e limites das ações de Marketing.",
    menu: menu(
      "marketing",
      null,
      "marketing",
      "Ajuda de Marketing",
      "Veja exemplos de pedidos e limites de cada serviço.",
      80,
      OWNER,
      "whatsapp",
      { recentEligible: false },
    ),
    route: {
      type: "handler",
      name: "formatarMenuJarvisAjuda",
      source: "./jarvis-ajuda-catalogo.ts",
    },
    palavrasChave: ["ajuda", "marketing", "limites"],
  },
  {
    id: "redes-facebook",
    secao: "Anúncios e redes",
    titulo: "Publicar no Facebook",
    comoPedir: [
      "Posta essa foto no Facebook.",
      "Publica este vídeo no Facebook.",
    ],
    oQueAcontece: "Prepara foto ou vídeo para feed ou story do Facebook.",
    menu: menu(
      "marketing",
      "postar_redes",
      "marketing:postar_redes",
      "Facebook",
      "Publique foto ou vídeo no feed ou story.",
      10,
      OWNER,
      "whatsapp",
      {
        availability: availability({ conexoes: ["facebook"] }),
      },
    ),
    route: { type: "owner_media", action: "post" },
    palavrasChave: ["facebook", "feed", "story"],
  },
  {
    id: "redes-instagram-feed",
    secao: "Anúncios e redes",
    titulo: "Publicar no Instagram feed",
    comoPedir: [
      "Posta essa foto no feed do Instagram.",
      "Publica este vídeo no Instagram.",
    ],
    oQueAcontece: "Prepara foto, vídeo ou carrossel para o feed do Instagram.",
    menu: menu(
      "marketing",
      "postar_redes",
      "marketing:postar_redes",
      "Instagram feed",
      "Publique foto, vídeo ou carrossel no feed.",
      20,
      OWNER,
      "whatsapp",
      {
        availability: availability({ conexoes: ["instagram"] }),
      },
    ),
    route: { type: "owner_media", action: "post" },
    palavrasChave: ["instagram", "feed"],
  },
  {
    id: "redes-instagram-story",
    secao: "Anúncios e redes",
    titulo: "Publicar Instagram story",
    comoPedir: [
      "Posta essa foto no story do Instagram.",
      "Publica este vídeo no Instagram story.",
    ],
    oQueAcontece: "Prepara foto ou vídeo vertical para o story do Instagram.",
    menu: menu(
      "marketing",
      "postar_redes",
      "marketing:postar_redes",
      "Instagram story",
      "Publique foto ou vídeo vertical no story.",
      30,
      OWNER,
      "whatsapp",
      {
        availability: availability({ conexoes: ["instagram"] }),
      },
    ),
    route: { type: "owner_media", action: "post" },
    palavrasChave: ["instagram", "story"],
  },
  {
    id: "redes-tiktok",
    secao: "Anúncios e redes",
    titulo: "Publicar vídeo no TikTok",
    comoPedir: [
      "Posta este vídeo no TikTok.",
      "Publica esse vídeo no TikTok.",
    ],
    oQueAcontece: "Publica somente vídeo após privacidade e consentimento.",
    menu: menu(
      "marketing",
      "postar_redes",
      "marketing:postar_redes",
      "TikTok",
      "Publique vídeo após privacidade e consentimento.",
      40,
      OWNER,
      "whatsapp",
      {
        availability: availability({
          conexoes: ["tiktok"],
          condicao: "midia.tipo === video",
          nota: "TikTok aceita somente vídeo neste fluxo.",
        }),
      },
    ),
    route: { type: "owner_media", action: "post" },
    palavrasChave: ["tiktok", "video", "consentimento"],
  },
  {
    id: "redes-linkedin",
    secao: "Anúncios e redes",
    titulo: "Publicar no LinkedIn",
    comoPedir: [
      "Prepare este post para o LinkedIn.",
      "Publica esta foto no LinkedIn.",
    ],
    oQueAcontece: "Prepara texto, foto ou vídeo em tom profissional.",
    menu: menu(
      "marketing",
      "postar_redes",
      "marketing:postar_redes",
      "LinkedIn",
      "Prepare texto, foto ou vídeo em tom profissional.",
      50,
      OWNER,
      "whatsapp",
      {
        availability: availability({ conexoes: ["linkedin"] }),
      },
    ),
    route: { type: "llm_tool", name: "publicar_linkedin" },
    palavrasChave: ["linkedin", "profissional"],
  },
  {
    id: "portal-mercado-livre",
    secao: "Portais de veículos",
    titulo: "Abrir Mercado Livre",
    comoPedir: [
      "Abra o Mercado Livre no painel.",
      "No painel, publique o veículo no Mercado Livre.",
    ],
    oQueAcontece: "Abre a publicação e sincronização do portal no painel.",
    menu: menu(
      "marketing",
      "portais",
      "marketing:portais",
      "Mercado Livre",
      "Abra a publicação e sincronização no painel.",
      10,
      OWNER,
      "panel",
      {
        availability: availability({ conexoes: ["mercado_livre"] }),
      },
    ),
    route: {
      type: "panel",
      href: "/veiculos",
      path: "Estoque › Veículo › Mercado Livre",
    },
    palavrasChave: ["mercado livre", "portal", "publicar"],
  },
  {
    id: "portal-olx",
    secao: "Portais de veículos",
    titulo: "Abrir OLX",
    comoPedir: [
      "Abra a OLX no painel.",
      "No painel, publique o veículo na OLX.",
    ],
    oQueAcontece: "Abre a publicação e sincronização da OLX no painel.",
    menu: menu(
      "marketing",
      "portais",
      "marketing:portais",
      "OLX",
      "Abra a publicação e sincronização no painel.",
      20,
      OWNER,
      "panel",
      {
        availability: availability({ conexoes: ["olx"] }),
      },
    ),
    route: {
      type: "panel",
      href: "/veiculos",
      path: "Estoque › Veículo › OLX",
    },
    palavrasChave: ["olx", "portal", "publicar"],
  },
  {
    id: "portal-webmotors",
    secao: "Portais de veículos",
    titulo: "Abrir Webmotors",
    comoPedir: [
      "Abra a Webmotors no painel.",
      "No painel, publique o veículo na Webmotors.",
    ],
    oQueAcontece: "Abre publicação, estoque e histórico no painel.",
    menu: menu(
      "marketing",
      "portais",
      "marketing:portais",
      "Webmotors",
      "Abra a publicação, estoque e histórico no painel.",
      30,
      OWNER,
      "panel",
      {
        availability: availability({ conexoes: ["webmotors"] }),
      },
    ),
    route: {
      type: "panel",
      href: "/veiculos",
      path: "Estoque › Veículo › Webmotors",
    },
    palavrasChave: ["webmotors", "portal", "publicar"],
  },
  {
    id: "troca-nova",
    secao: "Vistoria e troca",
    titulo: "Nova vistoria ou troca",
    comoPedir: [
      "Abra uma nova troca no painel.",
      "No painel, entre em Gestão e depois Trocas.",
    ],
    oQueAcontece:
      "A ficha nova fica no painel; o WhatsApp completo virá no TROCA-WPP-1.",
    menu: menu(
      "vistoria_troca",
      null,
      "vistoria_troca",
      "Nova vistoria/troca",
      "Abra uma nova ficha de avaliação no painel.",
      10,
      OWNER_MANAGER_SELLER,
      "panel",
      {
        availability: availability({
          nota: "Criação por WhatsApp fica para o TROCA-WPP-1.",
        }),
      },
    ),
    route: {
      type: "panel",
      href: "/gestao/trocas",
      path: "Gestão › Trocas › Nova ficha",
    },
    palavrasChave: ["nova", "vistoria", "troca"],
  },
  {
    id: "troca-laudos",
    secao: "Vistoria e troca",
    titulo: "Ver trocas e laudos",
    comoPedir: [
      "Quais trocas foram avaliadas?",
      "Mostre o laudo do Civic.",
    ],
    oQueAcontece: "Lista avaliadas e entrega resumo, fotos e laudo em PDF.",
    menu: menu(
      "vistoria_troca",
      null,
      "vistoria_troca",
      "Trocas e laudos",
      "Veja avaliadas, resumo, fotos e laudo em PDF.",
      20,
      OWNER_MANAGER_SELLER,
      "whatsapp",
    ),
    route: {
      type: "handler",
      name: "tryProcessGestaoTrocaWhatsAppInbound",
      source: "./gestao-troca-whatsapp.ts",
    },
    palavrasChave: ["trocas", "avaliadas", "laudo", "fotos"],
  },
  {
    id: "troca-preco-molicar",
    secao: "Vistoria e troca",
    titulo: "Consultar preço Molicar",
    comoPedir: [
      "Abra o preço Molicar da troca no painel.",
      "No painel, consulte a referência Molicar da ficha.",
    ],
    oQueAcontece: "A referência Molicar permanece na ficha da troca no painel.",
    menu: menu(
      "vistoria_troca",
      null,
      "vistoria_troca",
      "Preço de troca",
      "Consulte a referência Molicar no painel.",
      30,
      OWNER_MANAGER_SELLER,
      "panel",
      {
        availability: availability({ conexoes: ["molicar"] }),
      },
    ),
    route: {
      type: "panel",
      href: "/gestao/trocas",
      path: "Gestão › Trocas › Ficha › Preço Molicar",
    },
    palavrasChave: ["preco", "molicar", "troca"],
  },
  {
    id: "troca-procedencia",
    secao: "Vistoria e troca",
    titulo: "Consultar procedência",
    comoPedir: [
      "Consultar procedência da placa ABC1D23.",
      "Puxa a placa ABC1D23 para ver a procedência.",
    ],
    oQueAcontece:
      "Usa Consultar Placa, não Molicar; mostra custo e exige confirmação.",
    menu: menu(
      "vistoria_troca",
      null,
      "vistoria_troca",
      "Consultar procedência",
      "Informe a placa, revise o preço e confirme a consulta.",
      40,
      OWNER_MANAGER_SELLER,
      "whatsapp",
      {
        availability: availability({
          conexoes: ["consultar_placa"],
          nota: "Este fluxo usa Consultar Placa, não Molicar.",
        }),
      },
    ),
    route: {
      type: "handler",
      name: "tryProcessVeiculoProcedenciaInbound",
      source: "./veiculo-procedencia-inbound.ts",
    },
    palavrasChave: ["procedencia", "placa", "consultar placa"],
  },
  {
    id: "troca-liberar-estoque",
    secao: "Vistoria e troca",
    titulo: "Liberar troca para estoque",
    comoPedir: [
      "Abra a troca no painel para liberar ao estoque.",
      "No painel, revise a troca e informe o preço.",
    ],
    oQueAcontece:
      "A liberação e o preço permanecem no painel no primeiro ciclo.",
    menu: menu(
      "vistoria_troca",
      null,
      "vistoria_troca",
      "Liberar para estoque",
      "Revise a troca e informe o preço no painel.",
      50,
      OWNER_MANAGER_SELLER,
      "panel",
    ),
    route: {
      type: "panel",
      href: "/gestao/trocas",
      path: "Gestão › Trocas › Ficha › Liberar para estoque",
    },
    palavrasChave: ["liberar", "troca", "estoque"],
  },
  {
    id: "troca-ajuda",
    secao: "Vistoria e troca",
    titulo: "Ajuda de troca",
    comoPedir: [
      "Ajuda de troca.",
      "Como avaliar, consultar e liberar uma troca?",
    ],
    oQueAcontece: "Mostra exemplos para avaliar, consultar e liberar trocas.",
    menu: menu(
      "vistoria_troca",
      null,
      "vistoria_troca",
      "Ajuda de troca",
      "Veja como avaliar, consultar e liberar uma troca.",
      60,
      OWNER_MANAGER_SELLER,
      "whatsapp",
      { recentEligible: false },
    ),
    route: {
      type: "handler",
      name: "formatarMenuJarvisAjuda",
      source: "./jarvis-ajuda-catalogo.ts",
    },
    palavrasChave: ["ajuda", "troca", "vistoria"],
  },
];

function normalizarBusca(value: string): string[] {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((x) => x.length >= 3);
}

export function buscarJarvisAjudaCatalogo(
  pergunta: string,
  audiencia: "dono" | "gestor" = "dono",
): JarvisAjudaItem | null {
  const ignorar = new Set([
    "como",
    "faco",
    "para",
    "quero",
    "pedir",
    "jarvis",
    "posso",
    "uma",
    "umas",
    "uns",
    "por",
    "com",
    "sem",
    "meu",
    "minha",
  ]);
  const termos = normalizarBusca(pergunta).filter((x) => !ignorar.has(x));
  if (!termos.length) return null;
  let melhor: { item: JarvisAjudaItem; pontos: number } | null = null;
  for (
    const item of JARVIS_AJUDA_CATALOGO.filter((item) =>
      audiencia === "dono"
        ? item.menu.audiences.includes("owner")
        : item.menu.audiences.includes("manager")
    )
  ) {
    const alvo = normalizarBusca([
      item.titulo,
      item.secao,
      ...item.comoPedir,
      ...(item.palavrasChave ?? []),
    ].join(" "));
    const pontos = termos.reduce(
      (total, termo) =>
        total + (alvo.some((x) => x === termo || x.startsWith(termo)) ? 1 : 0),
      0,
    );
    if (pontos > 0 && (!melhor || pontos > melhor.pontos)) {
      melhor = { item, pontos };
    }
  }
  return melhor?.item ?? null;
}

export function formatarMenuJarvisAjuda(
  audiencia: "dono" | "gestor" = "dono",
): string {
  const itens = JARVIS_AJUDA_CATALOGO.filter((item) =>
    audiencia === "dono"
      ? item.menu.audiences.includes("owner")
      : item.menu.audiences.includes("manager")
  );
  return [
    "🤖 *COMO PEDIR AO JARVIS*",
    ...JARVIS_AJUDA_SECOES.filter((secao) =>
      itens.some((item) => item.secao === secao)
    ).map((secao) => {
      const titulos = itens.filter((item) => item.secao === secao)
        .slice(0, 3).map((item) => item.titulo.toLowerCase()).join(", ");
      return `• *${secao}:* ${titulos}`;
    }),
    "",
    "Diga “como faço para…” e descreva o que precisa.",
  ].join("\n");
}

export function formatarRespostaJarvisAjuda(item: JarvisAjudaItem): string {
  return [
    `🤖 *${item.titulo}*`,
    item.oQueAcontece,
    "",
    "*Você pode pedir assim:*",
    ...item.comoPedir.map((frase) => `• “${frase}”`),
    "",
    "Quer a cartilha completa? Responda *cartilha*.",
  ].join("\n");
}
