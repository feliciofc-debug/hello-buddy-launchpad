import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifyGestaoIntent } from "./gestao-intent-pt.ts";
import type { GestaoFechamentoDia } from "./gestao-fechamento-dia.ts";
import {
  clearJarvisServiceMenuCacheForTests,
  extractJarvisMenuId,
  hasJarvisMenuPriorityPending,
  isJarvisPureGreeting,
  type JarvisMenuConfig,
  jarvisMenuPriorityPendingName,
  type JarvisMenuSkipReason,
  type JarvisServiceMenuDependencies,
  type JarvisServiceMenuInput,
  tryProcessJarvisServiceMenu,
} from "./jarvis-service-menu.ts";

const ENABLED: JarvisMenuConfig = {
  menu_enabled: true,
  vendedor_enabled: false,
  recent_enabled: true,
};

function fechamento(
  dia = "2026-10-27",
  options: {
    vendas?: number;
    parado?: number;
    vencidas?: number;
    urgentes?: number;
  } = {},
): GestaoFechamentoDia {
  return {
    dia,
    lojaNome: "AMZ",
    vendasHoje: {
      qtd: options.vendas ?? 2,
      faturamento: 180_000,
      lucro: 20_000,
      margemPct: 11.1,
      ticketMedio: 90_000,
    },
    vendasMes: {
      qtd: 10,
      faturamento: 900_000,
      lucro: 100_000,
      margemPct: 11.1,
      ticketMedio: 90_000,
    },
    comparacaoMesAnteriorPct: null,
    estoque: {
      total: 20,
      valorImobilizado: 1_000_000,
      entradasHoje: 1,
      saidasHoje: 2,
      emPreparacao: 3,
      consignados: 1,
    },
    custoEstoque: {
      hoje: options.parado ?? 1_234.5,
      mes: 10_000,
      dias30: 4,
      dias60: 2,
      dias90Mais: 1,
      top3: [],
    },
    operacao: {
      osAbertas: 0,
      osEmCotacao: 0,
      cotacoesRecebidasHoje: 0,
      osParadas: 0,
      preparacaoParada: 0,
    },
    financeiro: {
      pagar7Dias: 0,
      receber7Dias: 0,
      pagarVencido: 500,
      receberVencido: 0,
      contasVencidas: options.vencidas ?? 3,
      despesaOperacionalHoje: 0,
      repasseHoje: 0,
      trocoHoje: 0,
      custoVeiculoHoje: 0,
    },
    atendimento: {
      conversasHoje: 0,
      leadsNovos: 0,
      leadsQuentesSemRetorno24h: 0,
    },
    acoes: Array.from(
      { length: options.urgentes ?? 2 },
      (_, index) => `Ação ${index + 1}`,
    ),
  };
}

function ownerInput(
  overrides: Partial<JarvisServiceMenuInput> = {},
): JarvisServiceMenuInput {
  return {
    sb: {} as JarvisServiceMenuInput["sb"],
    userId: "11111111-1111-1111-1111-111111111111",
    fromNumber: "5511999999999",
    text: "oi",
    messageType: "text",
    isOwner: true,
    displayName: "Felicio Costa",
    now: new Date("2026-10-27T15:00:00.000Z"),
    lastMessageAt: "2026-10-27T14:55:00.000Z",
    ...overrides,
  };
}

function deps(
  overrides: Partial<JarvisServiceMenuDependencies> = {},
): JarvisServiceMenuDependencies {
  return {
    loadConfig: async () => ENABLED,
    loadAuthContext: async () => ({
      ownerPhone: "5511999999999",
      ownerAltPhones: [],
      gestores: [],
    }),
    buildFechamento: (async (_sb, _userId, dia) => ({
      dados: fechamento(dia),
      texto: "fechamento",
    })) as JarvisServiceMenuDependencies["buildFechamento"],
    logSkip: () => {},
    ...overrides,
  };
}

Deno.test("MENU-B3 — detector aceita somente saudações puras e menu", () => {
  for (
    const value of [
      "oi",
      "Olá!",
      "👋 oi jarvis 😊",
      "Bom dia.",
      "boa tarde!!!",
      "BOA NOITE 🌙",
      "e aí?",
      "menu 📋",
      "opções",
      "O que você faz?",
      "oi jarvis, bom dia!",
      "olá, boa tarde",
      "bom dia jarvis",
      "oi, tudo bem?",
      "e aí, tudo certo?",
      "👋 oi, bom dia, tudo bem? 😊",
    ]
  ) {
    assert(isJarvisPureGreeting(value), value);
  }
  for (
    const value of [
      "bom dia, vendi o Civic por 90 mil",
      "oi, quero consultar o estoque",
      "menu de vendas",
      "boa tarde, orçamento 1950",
      "o que você faz com documentos?",
      "oi, tudo bem? quero consultar o estoque",
      "e aí, tudo certo? vendi o Civic",
      "tudo bem?",
      "👋",
      "",
    ]
  ) {
    assertEquals(isJarvisPureGreeting(value), false, value);
  }
  assertEquals(
    classifyGestaoIntent("bom dia, vendi o Civic por 90 mil").kind,
    "venda",
  );
  assertEquals(classifyGestaoIntent("o que você faz?").kind, "none");
  assertEquals(
    classifyGestaoIntent("o que você faz com documentos?").kind,
    "ajuda",
  );
});

Deno.test("MENU-B3 — extrai somente IDs próprios do menu", () => {
  assertEquals(
    extractJarvisMenuId("jarvis_menu:grupo:gestao"),
    "jarvis_menu:grupo:gestao",
  );
  assertEquals(
    extractJarvisMenuId(
      "Gestão\n<<INTERACTIVE_ID:jarvis_menu:grupo:gestao>>",
    ),
    "jarvis_menu:grupo:gestao",
  );
  assertEquals(
    extractJarvisMenuId("<<INTERACTIVE_ID:meta_ads_q:objetivo:site>>"),
    null,
  );
});

Deno.test("MENU-B3.1 — saudação com pedido não abre menu", async () => {
  let configReads = 0;
  const reasons: JarvisMenuSkipReason[] = [];
  const result = await tryProcessJarvisServiceMenu(
    ownerInput({ text: "bom dia, vendi o Civic por 90 mil" }),
    deps({
      loadConfig: async () => {
        configReads += 1;
        return ENABLED;
      },
      logSkip: (reason) => reasons.push(reason),
    }),
  );
  assertEquals(result, { handled: false });
  assertEquals(configReads, 1);
  assertEquals(reasons, ["nao_saudacao"]);
});

Deno.test("MENU-B3 — dono com flag on recebe resumo, urgência e 3 botões", async () => {
  clearJarvisServiceMenuCacheForTests();
  const result = await tryProcessJarvisServiceMenu(
    ownerInput(),
    deps(),
  );
  assert(result.handled);
  assertEquals(result.kind, "greeting");
  assertEquals(result.role, "owner");
  assertStringIncludes(result.text, "Boa tarde, Felicio.");
  assertStringIncludes(
    result.text,
    "Hoje: 2 vendas · parado R$ 1.234,50 · 3 contas vencidas",
  );
  assertStringIncludes(result.text, "⚠️ 2 urgentes para decidir hoje.");
  assertStringIncludes(
    result.text,
    "Ou me diga (ou mande um áudio) o que precisa.",
  );
  assertEquals(result.interactiveButtons?.buttons, [
    { id: "jarvis_menu:grupo:marketing", title: "📣 Marketing" },
    { id: "jarvis_menu:grupo:gestao", title: "📊 Gestão" },
    {
      id: "jarvis_menu:grupo:vistoria_troca",
      title: "🔍 Vistoria e Troca",
    },
  ]);
});

Deno.test("MENU-B3 — áudio transcrito com saudação pura abre o mesmo menu", async () => {
  clearJarvisServiceMenuCacheForTests();
  const result = await tryProcessJarvisServiceMenu(
    ownerInput({ text: "olá 👋", messageType: "audio" }),
    deps(),
  );
  assert(result.handled);
  assertEquals(result.kind, "greeting");
  assertEquals(result.interactiveButtons?.buttons.length, 3);
});

Deno.test("MENU-B3 — viradas 11:59/12:00 e 17:59/18:00 usam horário SP", async () => {
  const cases: Array<[string, string, string]> = [
    ["2026-10-27T14:59:00.000Z", "Bom dia", "Ontem:"],
    ["2026-10-27T15:00:00.000Z", "Boa tarde", "Hoje:"],
    ["2026-10-27T20:59:00.000Z", "Boa tarde", "Hoje:"],
    ["2026-10-27T21:00:00.000Z", "Boa noite", "Hoje:"],
  ];
  for (const [iso, greeting, summary] of cases) {
    clearJarvisServiceMenuCacheForTests();
    const result = await tryProcessJarvisServiceMenu(
      ownerInput({ now: new Date(iso) }),
      deps(),
    );
    assert(result.handled);
    assertStringIncludes(result.text, `${greeting}, Felicio.`);
    assertStringIncludes(result.text, summary);
  }
});

Deno.test("MENU-B3 — antes de 12h resume ontem mas urgência vem de hoje", async () => {
  clearJarvisServiceMenuCacheForTests();
  const days: string[] = [];
  const result = await tryProcessJarvisServiceMenu(
    ownerInput({ now: new Date("2026-10-27T14:59:00.000Z") }),
    deps({
      buildFechamento: (async (_sb, _userId, dia) => {
        days.push(dia);
        return {
          dados: fechamento(dia, {
            vendas: dia === "2026-10-26" ? 4 : 1,
            urgentes: dia === "2026-10-27" ? 1 : 3,
          }),
          texto: "",
        };
      }) as JarvisServiceMenuDependencies["buildFechamento"],
    }),
  );
  assert(result.handled);
  assertEquals(days, ["2026-10-26", "2026-10-27"]);
  assertStringIncludes(result.text, "Ontem: 4 vendas");
  assertStringIncludes(result.text, "⚠️ 1 urgente para decidir hoje.");
});

Deno.test("MENU-B3 — sem urgentes omite a linha inteira", async () => {
  clearJarvisServiceMenuCacheForTests();
  const result = await tryProcessJarvisServiceMenu(
    ownerInput(),
    deps({
      buildFechamento: (async (_sb, _userId, dia) => ({
        dados: fechamento(dia, { urgentes: 0 }),
        texto: "",
      })) as JarvisServiceMenuDependencies["buildFechamento"],
    }),
  );
  assert(result.handled);
  assertEquals(result.text.includes("urgente"), false);
});

Deno.test("MENU-B3 — falha do resumo mantém menu e não inventa números", async () => {
  clearJarvisServiceMenuCacheForTests();
  const result = await tryProcessJarvisServiceMenu(
    ownerInput(),
    deps({
      buildFechamento: (async () => {
        throw new Error("indisponível");
      }) as JarvisServiceMenuDependencies["buildFechamento"],
    }),
  );
  assert(result.handled);
  assertStringIncludes(
    result.text,
    "Não consegui carregar o resumo agora.",
  );
  assertEquals(result.text.includes("vendas · parado"), false);
  assertEquals(result.interactiveButtons?.buttons.length, 3);
});

Deno.test("MENU-B3 — resumo usa cache de 10 minutos por loja e período", async () => {
  clearJarvisServiceMenuCacheForTests();
  let builds = 0;
  const buildFechamento = (async (_sb, _userId, dia) => {
    builds += 1;
    return { dados: fechamento(dia), texto: "" };
  }) as JarvisServiceMenuDependencies["buildFechamento"];
  await tryProcessJarvisServiceMenu(
    ownerInput({ now: new Date("2026-10-27T15:00:00.000Z") }),
    deps({ buildFechamento }),
  );
  await tryProcessJarvisServiceMenu(
    ownerInput({ now: new Date("2026-10-27T15:09:59.000Z") }),
    deps({ buildFechamento }),
  );
  assertEquals(builds, 1);
  await tryProcessJarvisServiceMenu(
    ownerInput({ now: new Date("2026-10-27T15:10:01.000Z") }),
    deps({ buildFechamento }),
  );
  assertEquals(builds, 2);
});

Deno.test("MENU-B3 — gestor autorizado recebe 2 botões e nunca Marketing", async () => {
  clearJarvisServiceMenuCacheForTests();
  const result = await tryProcessJarvisServiceMenu(
    ownerInput({
      isOwner: false,
      fromNumber: "5511888888888",
      displayName: "Ana Gestora",
      text: "menu",
    }),
    deps({
      loadAuthContext: async () => ({
        ownerPhone: "5511999999999",
        ownerAltPhones: [],
        gestores: ["5511888888888"],
      }),
    }),
  );
  assert(result.handled);
  assertEquals(result.role, "manager");
  assertEquals(result.interactiveButtons?.buttons, [
    { id: "jarvis_menu:grupo:gestao", title: "📊 Gestão" },
    {
      id: "jarvis_menu:grupo:vistoria_troca",
      title: "🔍 Vistoria e Troca",
    },
  ]);
  assertEquals(result.text.includes("Marketing"), false);
});

Deno.test("MENU-B3 — vendedor flag off, cliente e parceiro nunca recebem menu", async () => {
  let sellerLookup = 0;
  for (const text of ["oi", "menu"]) {
    for (
      const fromNumber of [
        "5511777777777",
        "5511666666666",
        "5511555555555",
      ]
    ) {
      const result = await tryProcessJarvisServiceMenu(
        ownerInput({
          isOwner: false,
          fromNumber,
          displayName: "Contato",
          text,
        }),
        deps({
          loadAuthContext: async () => ({
            ownerPhone: "5511999999999",
            ownerAltPhones: [],
            gestores: [],
          }),
          isActiveSeller: async () => {
            sellerLookup += 1;
            return true;
          },
        }),
      );
      assertEquals(result, { handled: false });
    }
  }
  assertEquals(sellerLookup, 0);
});

Deno.test("MENU-B3 — vendedor futuro não recebe resumo financeiro", async () => {
  clearJarvisServiceMenuCacheForTests();
  let builds = 0;
  const sellerDeps = deps({
    loadConfig: async () => ({ ...ENABLED, vendedor_enabled: true }),
    loadAuthContext: async () => ({
      ownerPhone: "5511999999999",
      ownerAltPhones: [],
      gestores: [],
    }),
    isActiveSeller: async () => true,
    buildFechamento: (async () => {
      builds += 1;
      return { dados: fechamento(), texto: "" };
    }) as JarvisServiceMenuDependencies["buildFechamento"],
  });
  const result = await tryProcessJarvisServiceMenu(
    ownerInput({
      isOwner: false,
      fromNumber: "5511777777777",
      displayName: "Bia Vendedora",
    }),
    sellerDeps,
  );
  assert(result.handled);
  assertEquals(result.role, "seller");
  assertEquals(result.text.includes("contas vencidas"), false);
  assertEquals(result.text.includes("urgente"), false);
  assertEquals(builds, 0);
  assertEquals(
    result.interactiveButtons?.buttons.map((button) => button.id),
    [
      "jarvis_menu:grupo:gestao",
      "jarvis_menu:grupo:vistoria_troca",
    ],
  );

  const management = await tryProcessJarvisServiceMenu(
    ownerInput({
      isOwner: false,
      fromNumber: "5511777777777",
      text: "jarvis_menu:grupo:gestao",
      messageType: "interactive",
    }),
    sellerDeps,
  );
  assert(management.handled);
  assertEquals(
    management.interactiveList?.rows.map((row) => row.id),
    [
      "jarvis_menu:lista:gestao:estoque",
      "jarvis_menu:lista:gestao:clientes_leads",
    ],
  );
});

Deno.test("MENU-B3 — flag off ignora saudação e qualquer ID", async () => {
  for (
    const text of [
      "oi",
      "jarvis_menu:grupo:gestao",
      "jarvis_menu:item:registrar-venda",
    ]
  ) {
    const result = await tryProcessJarvisServiceMenu(
      ownerInput({ text }),
      deps({
        loadConfig: async () => ({ ...ENABLED, menu_enabled: false }),
      }),
    );
    assertEquals(result, { handled: false });
  }
});

Deno.test("MENU-B3.1 — diagnóstico usa somente motivos sem PII", async () => {
  const reasons: JarvisMenuSkipReason[] = [];
  const logSkip = (reason: JarvisMenuSkipReason) => reasons.push(reason);

  await tryProcessJarvisServiceMenu(
    ownerInput(),
    deps({
      loadConfig: async () => ({ ...ENABLED, menu_enabled: false }),
      logSkip,
    }),
  );
  await tryProcessJarvisServiceMenu(
    ownerInput({
      isOwner: false,
      fromNumber: "5511888888888",
      text: "quero ver um carro",
    }),
    deps({
      loadAuthContext: async () => ({
        ownerPhone: "5511999999999",
        ownerAltPhones: [],
        gestores: ["5511888888888"],
      }),
      logSkip,
    }),
  );
  await tryProcessJarvisServiceMenu(
    ownerInput({ hasBlockingMedia: true }),
    deps({ logSkip }),
  );
  await tryProcessJarvisServiceMenu(
    ownerInput({
      agentState: {
        pending_vehicle_identification: {
          created_at: "2026-10-27T14:30:00.000Z",
        },
      },
    }),
    deps({ logSkip }),
  );
  await tryProcessJarvisServiceMenu(
    ownerInput({
      isOwner: false,
      fromNumber: "5511777777777",
      text: "menu",
    }),
    deps({ logSkip }),
  );

  assertEquals(reasons, [
    "flag_off",
    "nao_saudacao",
    "midia",
    "pendencia:pending_vehicle_identification",
    "sem_acesso",
  ]);
  assert(
    reasons.every((reason) =>
      /^(flag_off|nao_saudacao|midia|sem_acesso|pendencia:[a-z0-9_]+)$/.test(
        reason,
      )
    ),
  );
  assertEquals(JSON.stringify(reasons).includes("5511"), false);
  assertEquals(JSON.stringify(reasons).includes("Felicio"), false);
});

Deno.test("MENU-B3 — mídia, fluxo anterior e pendências prioritárias vencem", async () => {
  const blockedInputs: Array<Partial<JarvisServiceMenuInput>> = [
    { hasBlockingMedia: true },
    { priorityFlowActive: true },
    { agentState: { pending_gestao_confirm: { token: "x" } } },
    { agentState: { general: { pending_single_photo: { id: "x" } } } },
    {
      agentState: {
        vehicle: { pending_vitrine_estoque: { etapa: "telefone" } },
      },
    },
    {
      agentState: {
        vertical_router: { pending_choice: { media_id: "x" } },
      },
    },
  ];
  for (const blocked of blockedInputs) {
    assertEquals(
      await tryProcessJarvisServiceMenu(
        ownerInput(blocked),
        deps(),
      ),
      { handled: false },
    );
  }
  assert(hasJarvisMenuPriorityPending(
    {
      pending_meta_ads_limit: { token: "x" },
    },
    {
      now: new Date("2026-10-27T15:00:00.000Z"),
      lastMessageAt: "2026-10-27T14:55:00.000Z",
    },
  ));
});

Deno.test("MENU-B3.1 — pendência própria velha é ignorada sem apagar estado", async () => {
  const stalePending = {
    identification: { marca: "Honda", modelo: "Civic" },
    media_ids: ["media-1"],
    target: "single_ad",
    created_at: "2026-10-26T15:00:00.000Z",
  };
  const agentState = {
    pending_vehicle_identification: stalePending,
  };
  assertEquals(
    jarvisMenuPriorityPendingName(agentState, {
      now: new Date("2026-10-27T15:00:00.000Z"),
      lastMessageAt: "2026-10-27T14:55:00.000Z",
    }),
    null,
  );

  const result = await tryProcessJarvisServiceMenu(
    ownerInput({
      text: "oi jarvis, bom dia!",
      agentState,
    }),
    deps(),
  );
  assert(result.handled);
  assertEquals(result.kind, "greeting");
  assertEquals(
    agentState.pending_vehicle_identification,
    stalePending,
    "o menu não deve apagar a pendência dos outros fluxos",
  );
});

Deno.test("MENU-B3.1 — pendência recente bloqueia pelo timestamp próprio ou da conversa", async () => {
  const ownTimestamp = {
    pending_vehicle_identification: {
      created_at: "2026-10-27T14:00:01.000Z",
    },
  };
  assertEquals(
    jarvisMenuPriorityPendingName(ownTimestamp, {
      now: new Date("2026-10-27T16:00:00.000Z"),
      lastMessageAt: "2026-10-26T15:00:00.000Z",
    }),
    "pending_vehicle_identification",
  );
  assertEquals(
    jarvisMenuPriorityPendingName(
      { pending_gestao_confirm: { token: "x" } },
      {
        now: new Date("2026-10-27T16:00:00.000Z"),
        lastMessageAt: "2026-10-27T15:30:00.000Z",
      },
    ),
    "pending_gestao_confirm",
  );
  assertEquals(
    jarvisMenuPriorityPendingName(
      {
        pending_vehicle_identification: {
          created_at: "2026-10-27T14:00:00.000Z",
        },
      },
      {
        now: new Date("2026-10-27T16:00:00.000Z"),
        lastMessageAt: "2026-10-27T15:59:00.000Z",
      },
    ),
    null,
    "com duas horas exatas, o timestamp próprio deve vencer o fallback recente",
  );
});

Deno.test("MENU-B3 — grupo e subgrupo vêm da árvore sem slots recentes", async () => {
  const marketing = await tryProcessJarvisServiceMenu(
    ownerInput({
      text: "jarvis_menu:grupo:marketing",
      messageType: "interactive",
    }),
    deps(),
  );
  assert(marketing.handled);
  assertEquals(marketing.kind, "list");
  assertEquals(marketing.interactiveList?.rows.length, 8);
  assertEquals(
    marketing.interactiveList?.rows.some((row) => row.id.includes(":recent:")),
    false,
  );
  assertEquals(
    marketing.interactiveList?.rows[0].id,
    [
      "jarvis_menu:lista:marketing:postar_redes",
    ][0],
  );

  const redes = await tryProcessJarvisServiceMenu(
    ownerInput({
      text: "jarvis_menu:lista:marketing:postar_redes",
      messageType: "interactive",
    }),
    deps(),
  );
  assert(redes.handled);
  assertEquals(redes.interactiveList?.rows.length, 8);
  assertEquals(
    redes.interactiveList?.rows.at(-1)?.id,
    "jarvis_menu:lista:marketing",
  );
});

Deno.test("MENU-B3 — item só ensina como pedir e painel inclui link+caminho", async () => {
  const actionItem = await tryProcessJarvisServiceMenu(
    ownerInput({
      text: "jarvis_menu:item:registrar-venda",
      messageType: "interactive",
    }),
    deps(),
  );
  assert(actionItem.handled);
  assertEquals(actionItem.kind, "item");
  assertStringIncludes(actionItem.text, "Você pode pedir assim:");
  assertStringIncludes(actionItem.text, "Vendi o Civic por 90 mil.");

  const panelItem = await tryProcessJarvisServiceMenu(
    ownerInput({
      text: "jarvis_menu:item:troca-nova",
      messageType: "interactive",
      appBaseUrl: "https://app.example.com/",
    }),
    deps(),
  );
  assert(panelItem.handled);
  assertStringIncludes(
    panelItem.text,
    "🔗 https://app.example.com/gestao/trocas",
  );
  assertStringIncludes(panelItem.text, "Caminho: Gestão › Trocas › Nova ficha");
});

Deno.test("MENU-B3 — gestor não abre Marketing por ID e ID inválido é inerte", async () => {
  const managerInput = ownerInput({
    isOwner: false,
    fromNumber: "5511888888888",
    displayName: "Ana",
    messageType: "interactive",
  });
  const managerDeps = deps({
    loadAuthContext: async () => ({
      ownerPhone: "5511999999999",
      ownerAltPhones: [],
      gestores: ["5511888888888"],
    }),
  });
  assertEquals(
    await tryProcessJarvisServiceMenu(
      { ...managerInput, text: "jarvis_menu:grupo:marketing" },
      managerDeps,
    ),
    { handled: false },
  );
  assertEquals(
    await tryProcessJarvisServiceMenu(
      { ...managerInput, text: "jarvis_menu:item:inexistente" },
      managerDeps,
    ),
    { handled: false },
  );
});

Deno.test("MENU-B3 — contrato do processor preserva a ordem segura", async () => {
  const processor = await Deno.readTextFile(
    new URL("../whatsapp-cloud-inbound-processor/index.ts", import.meta.url),
  );
  const idGuard = processor.indexOf(
    "const rawJarvisMenuInteractiveId = String(",
  );
  const late = processor.indexOf("const vitrineLate =");
  const menu = processor.indexOf(
    "const jarvisMenu = await tryProcessJarvisServiceMenuShortcut",
  );
  const gestao = processor.lastIndexOf(
    "tryProcessGestaoLucroShortcut({",
    menu,
  );
  const cotacao = processor.lastIndexOf(
    "tryProcessOsParceiroCotacaoWhatsAppShortcut({",
    menu,
  );
  const documentGate = processor.lastIndexOf(
    "if (detectedDocument) {",
    menu,
  );
  const freshPhoto = processor.lastIndexOf(
    "const freshLibraryMedia =",
    menu,
  );
  const state = processor.indexOf("let persistedForward =", menu);
  const ai = processor.indexOf("const aiResult = await callGemini(", menu);
  assert(
    idGuard >= 0 && idGuard < gestao,
    "ID deve ficar opaco antes de Gestão",
  );
  assert(late >= 0 && menu > late, "menu deve vir após a vitrine late");
  assert(menu > gestao, "menu deve vir após Gestão");
  assert(menu > cotacao, "menu deve vir após cotação/parceiro");
  assert(menu > documentGate, "menu deve vir após o portão de documentos");
  assert(menu > freshPhoto, "menu deve vir após o fluxo de foto");
  assert(state > menu, "menu deve vir antes do estado final");
  assert(ai > menu, "menu deve vir antes do callGemini");
  assertStringIncludes(
    processor.slice(menu - 800, menu + 1_200),
    "rawJarvisMenuInteractiveId.toLowerCase().startsWith(",
  );
  assertStringIncludes(
    processor.slice(menu - 800, menu + 1_200),
    "audioTranscript?.trim() || userText",
  );
  assertStringIncludes(
    processor.slice(menu - 800, menu + 1_200),
    'media.some((item) => item.kind !== "audio")',
  );
  assertStringIncludes(
    processor.slice(menu - 800, menu + 1_200),
    "metaAdsQuestionarioResult.handled",
  );
  assertStringIncludes(
    processor.slice(menu - 800, menu + 1_200),
    "lastMessageAt: existingConv?.last_message_at ?? null",
  );
  assertStringIncludes(
    processor.slice(idGuard, idGuard + 800),
    "userText = rawJarvisMenuInteractiveId",
  );
  assertStringIncludes(
    processor.slice(menu, menu + 2_000),
    "userText = jarvisMenuFallbackText",
  );
});

Deno.test("MENU-B3 — migration nasce desligada e escrita fica no service_role", async () => {
  const migration = await Deno.readTextFile(
    new URL(
      "../../../supabase/migrations/20261032290000_jarvis_menu_config.sql",
      import.meta.url,
    ),
  );
  assertStringIncludes(
    migration,
    "CREATE TABLE IF NOT EXISTS public.jarvis_menu_config",
  );
  assertStringIncludes(
    migration,
    "menu_enabled BOOLEAN NOT NULL DEFAULT FALSE",
  );
  assertStringIncludes(
    migration,
    "vendedor_enabled BOOLEAN NOT NULL DEFAULT FALSE",
  );
  assertStringIncludes(
    migration,
    "recent_enabled BOOLEAN NOT NULL DEFAULT TRUE",
  );
  assertStringIncludes(
    migration,
    "GRANT SELECT ON public.jarvis_menu_config TO authenticated",
  );
  assertStringIncludes(
    migration,
    "GRANT ALL ON public.jarvis_menu_config TO service_role",
  );
  assertStringIncludes(migration, "USING (auth.uid() = user_id)");
  assertEquals(/\bINSERT\s+INTO\b/i.test(migration), false);
});
