import type { GestaoIntentKind } from "./gestao-intent-pt.ts";

export const JARVIS_AJUDA_CATALOGO_VERSAO = "1.0.0";

export const JARVIS_AJUDA_SECOES = [
  "Estoque e veículos",
  "Compra, venda e despesas",
  "Resultado e financeiro",
  "Equipe e comissões",
  "Notas fiscais e contratos",
  "Oficina e cotações",
  "Anúncios e redes",
  "FIPE e preço",
  "Resumos automáticos",
] as const;

export type JarvisAjudaSecao = typeof JARVIS_AJUDA_SECOES[number];

export type JarvisAjudaRota =
  | { tipo: "gestao_intent"; kind: Exclude<GestaoIntentKind, "none" | "ajuda"> }
  | {
    tipo: "owner_media";
    action: "generate" | "generate_and_post" | "post" | "edit";
  }
  | { tipo: "llm_tool"; nome: string }
  | { tipo: "painel"; caminho: string };

export type JarvisAjudaItem = {
  id: string;
  secao: JarvisAjudaSecao;
  titulo: string;
  comoPedir: readonly [string, string, ...string[]];
  oQueAcontece: string;
  publico: "dono" | "dono_gestor" | "vendedor";
  rota: JarvisAjudaRota;
  palavrasChave?: readonly string[];
};

const g = (
  id: string,
  secao: JarvisAjudaSecao,
  titulo: string,
  kind: Exclude<GestaoIntentKind, "none" | "ajuda">,
  comoPedir: readonly [string, string, ...string[]],
  oQueAcontece: string,
  palavrasChave: readonly string[] = [],
): JarvisAjudaItem => ({
  id,
  secao,
  titulo,
  comoPedir,
  oQueAcontece,
  publico: "dono_gestor",
  rota: { tipo: "gestao_intent", kind },
  palavrasChave,
});

export const JARVIS_AJUDA_CATALOGO: readonly JarvisAjudaItem[] = [
  {
    id: "estoque-resumo",
    secao: "Estoque e veículos",
    titulo: "Consultar o estoque",
    comoPedir: ["Quais carros tenho?", "Qual é o valor do meu estoque?"],
    oQueAcontece: "O Jarvis consulta os veículos ativos e resume o estoque.",
    publico: "dono_gestor",
    rota: { tipo: "llm_tool", nome: "consultar_estoque" },
    palavrasChave: ["estoque", "carros", "veiculos"],
  },
  {
    id: "estoque-busca",
    secao: "Estoque e veículos",
    titulo: "Procurar um veículo no estoque",
    comoPedir: ["Tenho algum Civic disponível?", "Tem Corolla no estoque?"],
    oQueAcontece: "O Jarvis procura modelos disponíveis no estoque da loja.",
    publico: "dono_gestor",
    rota: { tipo: "llm_tool", nome: "consultar_estoque" },
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
    ["despesas", "gastos"],
  ),
  g(
    "venda-raiox",
    "Estoque e veículos",
    "Analisar uma venda",
    "venda_raiox",
    [
      "Como foi a venda Civic?",
      "Como foi a venda Corolla?",
    ],
    "Mostra o raio-X financeiro da venda.",
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
    publico: "dono_gestor",
    rota: { tipo: "painel", caminho: "Gestão > Operações" },
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
    publico: "dono_gestor",
    rota: { tipo: "painel", caminho: "Gestão > Operações > OS > Cotações" },
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
    publico: "dono",
    rota: { tipo: "owner_media", action: "generate" },
    palavrasChave: ["arte", "imagem", "criar"],
  },
  {
    id: "editar-foto",
    secao: "Anúncios e redes",
    titulo: "Editar uma foto",
    comoPedir: ["Melhora essa foto.", "Troca o fundo dessa imagem."],
    oQueAcontece: "O Jarvis edita a última foto enviada ou selecionada.",
    publico: "dono",
    rota: { tipo: "owner_media", action: "edit" },
    palavrasChave: ["editar", "foto", "fundo"],
  },
  {
    id: "publicar-midia",
    secao: "Anúncios e redes",
    titulo: "Publicar uma mídia",
    comoPedir: ["Posta essa no Instagram.", "Publica essa foto no Facebook."],
    oQueAcontece:
      "O Jarvis prepara a publicação da mídia nas redes escolhidas.",
    publico: "dono",
    rota: { tipo: "owner_media", action: "post" },
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
    publico: "dono",
    rota: { tipo: "owner_media", action: "generate_and_post" },
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
    publico: "dono",
    rota: { tipo: "llm_tool", nome: "agendar_post_pendente" },
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
    publico: "dono",
    rota: { tipo: "llm_tool", nome: "listar_agendamentos_posts" },
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
    publico: "dono",
    rota: { tipo: "llm_tool", nome: "criar_video_animado" },
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
    publico: "dono",
    rota: { tipo: "llm_tool", nome: "relatorio_anuncios_meta" },
    palavrasChave: ["anuncios", "campanhas", "meta", "relatorio"],
  },
  {
    id: "campanha-status",
    secao: "Anúncios e redes",
    titulo: "Consultar uma campanha",
    comoPedir: ["Qual o status da campanha?", "Essa campanha está ativa?"],
    oQueAcontece: "O Jarvis consulta a situação atual da campanha informada.",
    publico: "dono",
    rota: { tipo: "llm_tool", nome: "status_campanha_meta" },
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
    publico: "dono_gestor",
    rota: { tipo: "llm_tool", nome: "consultar_fipe" },
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
    publico: "dono_gestor",
    rota: { tipo: "painel", caminho: "Estoque > Veículo > Editar" },
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
    publico: "dono_gestor",
    rota: { tipo: "llm_tool", nome: "criar_lembrete" },
    palavrasChave: ["lembrete", "lembrar", "agenda"],
  },
  {
    id: "mensagem-contato",
    secao: "Equipe e comissões",
    titulo: "Mandar mensagem para um contato",
    comoPedir: [
      "Manda uma mensagem para o João dizendo que retorno amanhã.",
      "Avise a Maria que a reunião mudou para 14h.",
    ],
    oQueAcontece: "O Jarvis localiza o contato comercial e envia a mensagem.",
    publico: "dono_gestor",
    rota: { tipo: "llm_tool", nome: "enviar_mensagem_contato_comercial" },
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
    publico: "dono_gestor",
    rota: { tipo: "painel", caminho: "Gestão > Configurações" },
    palavrasChave: ["automatico", "horario", "configurar"],
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
        ? item.publico !== "vendedor"
        : item.publico === "dono_gestor"
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
      ? item.publico !== "vendedor"
      : item.publico === "dono_gestor"
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
