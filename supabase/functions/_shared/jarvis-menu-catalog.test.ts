import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  JARVIS_AJUDA_CATALOGO,
  JARVIS_MENU_LISTS,
  type JarvisAjudaItem,
} from "./jarvis-ajuda-catalogo.ts";
import {
  jarvisMenuRows,
  renderJarvisMenuTreeMarkdown,
} from "./jarvis-menu-tree.ts";
import { classifyGestaoTrocaWhatsAppIntent } from "./gestao-troca-whatsapp.ts";
import { isProcedenciaWhatsAppRequest } from "./veiculo-procedencia-inbound.ts";
import { isMetaAdsQuestionarioTrigger } from "./meta-ads-questionario.ts";

const EXPECTED_TREE: Record<string, Array<[string, string]>> = {
  marketing: [
    ["Usado recentemente 1", "Última ação de Marketing usada neste WhatsApp."],
    ["Usado recentemente 2", "Segunda ação recente de Marketing."],
    ["Postar nas redes ›", "Facebook, Instagram, TikTok e LinkedIn."],
    [
      "Criar arte de anúncio",
      "Monte uma arte com foto, dados e identidade da loja.",
    ],
    [
      "Criar carrossel",
      "Gere cards e aprove antes de publicar no Instagram.",
    ],
    ["Criar vídeo", "Crie um vídeo animado com roteiro aprovado."],
    [
      "Campanha Meta Ads",
      "Monte, revise e confirme uma campanha patrocinada.",
    ],
    [
      "Resultado campanhas",
      "Veja gasto, alcance e situação dos anúncios Meta.",
    ],
    [
      "Portais de veículos ›",
      "Mercado Livre, OLX e Webmotors pelo painel.",
    ],
    [
      "Ajuda de Marketing",
      "Veja exemplos de pedidos e limites de cada serviço.",
    ],
  ],
  "marketing:postar_redes": [
    ["Usado recentemente 1", "Atalho recente desta lista."],
    ["Usado recentemente 2", "Segundo atalho recente desta lista."],
    ["Facebook", "Publique foto ou vídeo no feed ou story."],
    ["Instagram feed", "Publique foto, vídeo ou carrossel no feed."],
    ["Instagram story", "Publique foto ou vídeo vertical no story."],
    ["TikTok", "Publique vídeo após privacidade e consentimento."],
    ["LinkedIn", "Prepare texto, foto ou vídeo em tom profissional."],
    [
      "Agendar publicação",
      "Agende um criativo aprovado; story fica no painel.",
    ],
    ["Meus agendamentos", "Liste, remarque ou cancele posts futuros."],
    ["Voltar a Marketing", "Retorne à lista principal de Marketing."],
  ],
  "marketing:portais": [
    ["Usado recentemente 1", "Atalho recente desta lista."],
    ["Usado recentemente 2", "Segundo atalho recente desta lista."],
    ["Mercado Livre", "Abra a publicação e sincronização no painel."],
    ["OLX", "Abra a publicação e sincronização no painel."],
    ["Webmotors", "Abra a publicação, estoque e histórico no painel."],
    ["Voltar a Marketing", "Retorne à lista principal de Marketing."],
  ],
  gestao: [
    ["Usado recentemente 1", "Última ação de Gestão usada neste WhatsApp."],
    ["Usado recentemente 2", "Segunda ação recente de Gestão."],
    [
      "⚡ Urgentes do dia",
      "Veja só o que pede decisão hoje. Some quando estiver vazio.",
    ],
    ["Estoque ›", "Consulte carros, giro, custos, lucro e despesas."],
    ["Vendas ›", "Registre e analise compras, vendas e equipe."],
    ["Financeiro ›", "Veja DRE, contas, recebíveis e conciliação."],
    ["Oficina e cotações ›", "Acompanhe OS e cotações no painel."],
    ["Documentos ›", "Guarde CRLV no WhatsApp e organize no painel."],
    ["Clientes e leads ›", "Consulte números, contatos e abra o CRM."],
    ["Ajuda de Gestão", "Veja exemplos de comandos de gestão."],
  ],
  "gestao:estoque": [
    [
      "Resumo do estoque",
      "Quantidade, valor investido e situação dos carros.",
    ],
    ["Buscar veículo", "Procure por modelo, placa ou situação."],
    ["Vendidos no mês", "Veja quantos veículos foram vendidos no período."],
    ["Lucro do veículo", "Consulte lucro e margem de um carro."],
    ["Despesas do veículo", "Liste os gastos lançados em um carro."],
    ["Giro do estoque", "Veja carros parados e custo de esperar."],
    ["Abrir estoque", "Gerencie cadastros, preços e status no painel."],
    ["Voltar a Gestão", "Retorne à lista principal de Gestão."],
  ],
  "gestao:vendas": [
    ["Registrar compra", "Prepare a compra e confirme antes de salvar."],
    ["Registrar venda", "Prepare a venda e confirme antes de salvar."],
    ["Lançar despesa", "Classifique o gasto e confirme antes de salvar."],
    [
      "Desfazer lançamento",
      "Desfaça o último lançamento elegível em até 24h.",
    ],
    ["Analisar uma venda", "Veja o raio-X financeiro de uma venda."],
    ["Piores negócios", "Veja os piores resultados do mês."],
    [
      "Equipe e comissões",
      "Consulte ranking, metas, vendas e comissões.",
    ],
    ["Voltar a Gestão", "Retorne à lista principal de Gestão."],
  ],
  "gestao:financeiro": [
    ["DRE do mês", "Receba o demonstrativo do resultado no WhatsApp."],
    ["Lucro da loja", "Consulte o resultado líquido do mês."],
    [
      "Contas da semana",
      "Veja contas a pagar e receber nos próximos dias.",
    ],
    ["Valores a receber", "Consulte recebimentos que seguem em aberto."],
    ["Falta conciliar", "Veja quantidade e valor ainda não conciliados."],
    ["Relatório contador", "Gere um link seguro do pacote mensal."],
    [
      "Notas e contratos",
      "Consulte NF-e e contratos; emita com confirmação.",
    ],
    ["Voltar a Gestão", "Retorne à lista principal de Gestão."],
  ],
  "gestao:oficina_cotacoes": [
    ["Abrir operações", "Veja ordens de serviço no painel."],
    [
      "Cotações recebidas",
      "Escolha propostas recebidas na OS pelo painel.",
    ],
    ["Parceiros", "Cadastre e gerencie oficinas parceiras no painel."],
    ["Voltar a Gestão", "Retorne à lista principal de Gestão."],
  ],
  "gestao:documentos": [
    ["Guardar CRLV", "Envie o documento; o portão local protege e lê."],
    ["Abrir cofre", "Consulte documentos guardados no painel."],
    ["Vincular ao estoque", "Vincule um CRLV guardado a um veículo."],
    ["Notas e contratos", "Consulte documentos fiscais e comerciais."],
    ["Voltar a Gestão", "Retorne à lista principal de Gestão."],
  ],
  "gestao:clientes_leads": [
    ["Resumo de leads", "Veja clientes ativos, novos e total de leads."],
    [
      "Contatos comerciais",
      "Liste contatos e envie uma mensagem autorizada.",
    ],
    ["Abrir CRM", "Acompanhe clientes, etapas e retornos no painel."],
    [
      "Leads sem retorno",
      "Veja prioridades no fechamento e abra o CRM.",
    ],
    ["Voltar a Gestão", "Retorne à lista principal de Gestão."],
  ],
  vistoria_troca: [
    [
      "Usado recentemente 1",
      "Última ação de Vistoria e Troca usada.",
    ],
    ["Usado recentemente 2", "Segunda ação recente desta lista."],
    [
      "Nova vistoria/troca",
      "Abra uma nova ficha de avaliação no painel.",
    ],
    [
      "Trocas e laudos",
      "Veja avaliadas, resumo, fotos e laudo em PDF.",
    ],
    ["Preço de troca", "Consulte a referência Molicar no painel."],
    [
      "Consultar procedência",
      "Informe a placa, revise o preço e confirme a consulta.",
    ],
    [
      "Liberar para estoque",
      "Revise a troca e informe o preço no painel.",
    ],
    [
      "Ajuda de troca",
      "Veja como avaliar, consultar e liberar uma troca.",
    ],
  ],
};

function codePointLength(value: string): number {
  return Array.from(value).length;
}

Deno.test("MENU-B2 — IDs, pais e listas formam uma árvore sem ciclos", () => {
  const itemIds = JARVIS_AJUDA_CATALOGO.map((item) => item.id);
  const listIds = JARVIS_MENU_LISTS.map((list) => list.id);
  assertEquals(new Set(itemIds).size, itemIds.length);
  assertEquals(new Set(listIds).size, listIds.length);
  assertEquals(
    new Set([...itemIds, ...listIds]).size,
    itemIds.length + listIds.length,
  );

  const lists = new Map(JARVIS_MENU_LISTS.map((list) => [list.id, list]));
  for (const list of JARVIS_MENU_LISTS) {
    if (list.parentId) assert(lists.has(list.parentId), list.id);
    const visited = new Set<string>();
    let current: typeof list | undefined = list;
    while (current?.parentId) {
      assert(!visited.has(current.id), `ciclo em ${list.id}`);
      visited.add(current.id);
      current = lists.get(current.parentId);
    }
  }
  for (const item of JARVIS_AJUDA_CATALOGO) {
    const parent = lists.get(item.menu.parentId);
    assert(parent, `${item.id}: pai ${item.menu.parentId} não existe`);
    assertEquals(item.menu.grupo, parent.grupo, item.id);
    assertEquals(item.menu.subgrupo, parent.subgrupo, item.id);
  }
});

Deno.test("MENU-B2 — contratos 24/72 e máximo de 10 linhas", () => {
  for (const list of JARVIS_MENU_LISTS) {
    assert(codePointLength(list.title) <= 24, `${list.id}: título`);
    assert(codePointLength(list.description) <= 72, `${list.id}: descrição`);
    const rows = jarvisMenuRows(list.id);
    assert(rows.length <= 10, `${list.id}: ${rows.length} linhas`);
    for (const row of rows) {
      assert(codePointLength(row.title) <= 24, `${row.id}: título`);
      assert(codePointLength(row.description) <= 72, `${row.id}: descrição`);
    }
  }
  for (const item of JARVIS_AJUDA_CATALOGO) {
    assert(codePointLength(item.menu.title) <= 24, `${item.id}: título`);
    assert(
      codePointLength(item.menu.description) <= 72,
      `${item.id}: descrição`,
    );
    assert(Array.isArray(item.menu.availability.segmentos), item.id);
    assert(Array.isArray(item.menu.availability.conexoes), item.id);
    assert(Array.isArray(item.menu.availability.flags), item.id);
  }
});

Deno.test("MENU-B2 — árvore visível bate integralmente com a seção 4", () => {
  assertEquals(Object.keys(EXPECTED_TREE), JARVIS_MENU_LISTS.map((x) => x.id));
  for (const [listId, expected] of Object.entries(EXPECTED_TREE)) {
    assertEquals(
      jarvisMenuRows(listId).map((row) => [row.title, row.description]),
      expected,
      listId,
    );
  }
});

Deno.test("MENU-B2 — audiências respeitam gestor e vendedor futuros", () => {
  for (
    const item of JARVIS_AJUDA_CATALOGO.filter((candidate) =>
      candidate.menu.grupo === "marketing"
    )
  ) {
    assertEquals(item.menu.audiences, ["owner"], item.id);
  }
  for (
    const item of JARVIS_AJUDA_CATALOGO.filter((candidate) =>
      candidate.menu.visible && candidate.menu.audiences.includes("seller")
    )
  ) {
    const sellerAllowed = item.menu.grupo === "vistoria_troca" ||
      item.menu.subgrupo === "estoque" ||
      item.menu.subgrupo === "clientes_leads";
    assert(sellerAllowed, `${item.id}: vendedor não pode ver este item`);
  }
  assertEquals(
    JARVIS_AJUDA_CATALOGO.find((item) => item.id === "mensagem-contato")
      ?.menu.subgrupo,
    "clientes_leads",
  );
});

Deno.test("MENU-B2 — canais e rotas apontam para capacidade real", async () => {
  const processor = await Deno.readTextFile(
    new URL("../whatsapp-cloud-inbound-processor/index.ts", import.meta.url),
  );
  const app = await Deno.readTextFile(
    new URL("../../../src/App.tsx", import.meta.url),
  );
  for (const item of JARVIS_AJUDA_CATALOGO) {
    if (item.menu.channel === "panel") {
      assertEquals(item.route.type, "panel", item.id);
    } else {
      assert(item.route.type !== "panel", item.id);
    }
    if (item.route.type === "llm_tool") {
      assertStringIncludes(processor, `name: "${item.route.name}"`);
    } else if (item.route.type === "handler") {
      const source = await Deno.readTextFile(
        new URL(item.route.source, import.meta.url),
      );
      assertStringIncludes(source, item.route.name);
    } else if (item.route.type === "panel") {
      assert(item.route.href.startsWith("/"), item.id);
      assertStringIncludes(item.route.path, "›");
      const path = item.route.href.split("?")[0];
      assertStringIncludes(app, `path="${path}"`);
    }
  }
});

Deno.test("MENU-B2 — fixtures provam troca, procedência, CRLV e Meta Ads", async () => {
  const byId = new Map<string, JarvisAjudaItem>(
    JARVIS_AJUDA_CATALOGO.map((item) => [item.id, item]),
  );
  assertEquals(byId.get("troca-laudos")?.route, {
    type: "handler",
    name: "tryProcessGestaoTrocaWhatsAppInbound",
    source: "./gestao-troca-whatsapp.ts",
  });
  assert(
    classifyGestaoTrocaWhatsAppIntent("Quais trocas foram avaliadas?").matches,
  );
  assert(
    isProcedenciaWhatsAppRequest(
      "Consultar procedência da placa ABC1D23.",
    ),
  );
  assert(
    isMetaAdsQuestionarioTrigger("Quero criar uma campanha no Meta Ads."),
  );

  const processor = await Deno.readTextFile(
    new URL("../whatsapp-cloud-inbound-processor/index.ts", import.meta.url),
  );
  const gestaoInbound = await Deno.readTextFile(
    new URL("./gestao-inbound.ts", import.meta.url),
  );
  const procedenciaCore = await Deno.readTextFile(
    new URL("./veiculo-procedencia-core.ts", import.meta.url),
  );
  assertStringIncludes(
    processor,
    "tryProcessGestaoTrocaWhatsAppInbound({",
  );
  assertStringIncludes(
    gestaoInbound,
    "tryProcessVeiculoProcedenciaInbound({",
  );
  assertStringIncludes(procedenciaCore, "consultarPlacaPacoteCompleto");
  assertEquals(/molicar/i.test(procedenciaCore), false);
  assertStringIncludes(processor, "verificarDocumentoNoPortao(");
  assertStringIncludes(processor, "gestaoCofreUpload({");
  assertStringIncludes(processor, "processMetaAdsQuestionario(");
});

Deno.test("MENU-B2 — documentação gerada está sincronizada", async () => {
  const committed = await Deno.readTextFile(
    new URL("../../../docs/menu-arvore.md", import.meta.url),
  );
  assertEquals(committed, renderJarvisMenuTreeMarkdown());
});
