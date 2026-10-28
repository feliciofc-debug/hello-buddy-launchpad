import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifyGestaoIntent } from "./gestao-intent-pt.ts";
import {
  clearJarvisGreetingPendingState,
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
    logSkip: () => {},
    ...overrides,
  };
}

Deno.test("MENU-B3.2 — detector aceita somente a gramática de saudação pura", () => {
  for (
    const value of [
      "oi",
      "Olá!",
      "👋 oi jarvis 😊",
      "Bom dia.",
      "boa tarde!!!",
      "BOA NOITE 🌙",
      "e aí?",
      "Oi Jarvis!",
      "bom dia jarvis, tudo bem?",
      "Opa",
      "E aí Jarvis",
      "boa tarde amigo",
      "olá, tudo bom?",
      "salve chefe, firmeza?",
      "hey Jarvis, beleza?",
      "hello, blz?",
      "oi, td bem?",
    ]
  ) {
    assert(isJarvisPureGreeting(value, "Felicio Costa"), value);
  }
  assert(isJarvisPureGreeting("Boa noite, Felicio!", "Felicio Costa"));
  assert(isJarvisPureGreeting("Oi, Felicio Costa, como vai?", "Felicio Costa"));
  for (
    const value of [
      "menu",
      "ajuda",
      "o que voce faz",
      "bom dia, vendi o Civic por 90 mil",
      "bom dia, quanto lucrei no Corolla?",
      "oi, posta o Corolla",
      "oi jarvis manda o fechamento",
      "o que você faz com documentos?",
      "e aí, tudo certo? vendi o Civic",
      "e aí, tudo certo?",
      "tudo bem?",
      "Oi, Costa",
      "👋",
      "",
      `oi ${"!".repeat(59)}`,
    ]
  ) {
    assertEquals(
      isJarvisPureGreeting(value, "Felicio Costa"),
      false,
      value,
    );
  }
  assertEquals(
    classifyGestaoIntent("bom dia, vendi o Civic por 90 mil").kind,
    "venda",
  );
  assertEquals(classifyGestaoIntent("ajuda").kind, "ajuda");
  assertEquals(classifyGestaoIntent("o que você faz?").kind, "ajuda");
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

Deno.test("MENU-B3.2 — dono com flag on recebe saudação sem números e 3 botões", async () => {
  const result = await tryProcessJarvisServiceMenu(
    ownerInput(),
    deps(),
  );
  assert(result.handled);
  assertEquals(result.kind, "greeting");
  assertEquals(result.role, "owner");
  assertEquals(result.text, "Boa tarde, Felicio! Como posso te ajudar?");
  assertEquals(/\d|R\$|vendas|parado|contas|urgente/i.test(result.text), false);
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
  const result = await tryProcessJarvisServiceMenu(
    ownerInput({ text: "olá 👋", messageType: "audio" }),
    deps(),
  );
  assert(result.handled);
  assertEquals(result.kind, "greeting");
  assertEquals(result.interactiveButtons?.buttons.length, 3);
});

Deno.test("MENU-B3.2 — viradas 11:59/12:00 e 17:59/18:00 usam horário SP", async () => {
  const cases: Array<[string, string]> = [
    ["2026-10-27T14:59:00.000Z", "Bom dia"],
    ["2026-10-27T15:00:00.000Z", "Boa tarde"],
    ["2026-10-27T20:59:00.000Z", "Boa tarde"],
    ["2026-10-27T21:00:00.000Z", "Boa noite"],
  ];
  for (const [iso, greeting] of cases) {
    const result = await tryProcessJarvisServiceMenu(
      ownerInput({ now: new Date(iso) }),
      deps(),
    );
    assert(result.handled);
    assertEquals(result.text, `${greeting}, Felicio! Como posso te ajudar?`);
  }
});

Deno.test("MENU-B3 — gestor autorizado recebe 2 botões e nunca Marketing", async () => {
  const result = await tryProcessJarvisServiceMenu(
    ownerInput({
      isOwner: false,
      fromNumber: "5511888888888",
      displayName: "Ana Gestora",
      text: "boa tarde Ana",
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

Deno.test("MENU-B3.2 — vendedor futuro recebe saudação sem dados financeiros", async () => {
  const sellerDeps = deps({
    loadConfig: async () => ({ ...ENABLED, vendedor_enabled: true }),
    loadAuthContext: async () => ({
      ownerPhone: "5511999999999",
      ownerAltPhones: [],
      gestores: [],
    }),
    isActiveSeller: async () => true,
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
      text: "jarvis_menu:grupo:marketing",
      messageType: "interactive",
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
      text: "oi",
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

Deno.test("MENU-B3 — clique no menu mantém bloqueios atuais", async () => {
  const blockedInputs: Array<Partial<JarvisServiceMenuInput>> = [
    {
      text: "jarvis_menu:grupo:marketing",
      messageType: "interactive",
      hasBlockingMedia: true,
    },
    {
      text: "jarvis_menu:grupo:marketing",
      messageType: "interactive",
      priorityFlowActive: true,
    },
    {
      text: "jarvis_menu:grupo:marketing",
      messageType: "interactive",
      agentState: { pending_gestao_confirm: { token: "x" } },
    },
    {
      text: "jarvis_menu:grupo:marketing",
      messageType: "interactive",
      agentState: { general: { pending_single_photo: { id: "x" } } },
    },
    {
      text: "jarvis_menu:grupo:marketing",
      messageType: "interactive",
      agentState: {
        vehicle: { pending_vitrine_estoque: { etapa: "telefone" } },
      },
    },
    {
      text: "jarvis_menu:grupo:marketing",
      messageType: "interactive",
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

Deno.test("MENU-SEMPRE — saudação limpa pendência de mídia mesmo velha", async () => {
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
  assertEquals("pending_vehicle_identification" in agentState, false);
});

Deno.test("MENU-SEMPRE — oi jarvis abre menu e limpa pendings recentes", async () => {
  const recent = "2026-10-27T14:59:00.000Z";
  const agentState: Record<string, unknown> = {
    pending_anuncio_cliente: { created_at: recent },
    pending_single_photo: { created_at: recent },
    pending_vehicle_identification: { created_at: recent },
    vehicle: {
      pending_fipe: { created_at: recent },
    },
    general: {
      pending_carousel: { created_at: recent },
    },
    vertical_router: {
      pending_choice: { created_at: recent },
      last_route: "veiculo",
    },
  };
  const result = await tryProcessJarvisServiceMenu(
    ownerInput({ text: "oi jarvis", agentState }),
    deps(),
  );
  assert(result.handled);
  assertEquals(result.kind, "greeting");
  assertEquals(result.interactiveButtons?.buttons.length, 3);
  for (const key of [
    "pending_anuncio_cliente",
    "pending_single_photo",
    "pending_vehicle_identification",
  ]) {
    assertEquals(key in agentState, false, key);
    assertEquals(key in (result.clearedAgentState ?? {}), false, key);
  }
  assertEquals(
    "pending_fipe" in
      ((result.clearedAgentState?.vehicle ?? {}) as Record<string, unknown>),
    false,
  );
  assertEquals(
    "pending_carousel" in
      ((result.clearedAgentState?.general ?? {}) as Record<string, unknown>),
    false,
  );
  assertEquals(
    (result.clearedAgentState?.vertical_router as Record<string, unknown>)
      .last_route,
    "veiculo",
  );
});

Deno.test("MENU-SEMPRE — confirmação financeira aparece e não é limpa", async () => {
  const agentState = {
    pending_gestao_confirm: {
      action: "nfe_emit",
      created_at: "2026-10-27T14:59:00.000Z",
    },
    pending_procedencia_confirm: {
      placa: "ABC1D23",
      created_at: "2026-10-27T14:59:00.000Z",
    },
    pending_single_photo: {
      created_at: "2026-10-27T14:59:00.000Z",
    },
  };
  const result = await tryProcessJarvisServiceMenu(
    ownerInput({ text: "bom dia", agentState }),
    deps(),
  );
  assert(result.handled);
  assertStringIncludes(result.text, "Você tem uma confirmação pendente:");
  assertStringIncludes(result.text, "nfe emit");
  assertEquals(agentState.pending_gestao_confirm.action, "nfe_emit");
  assertEquals(agentState.pending_procedencia_confirm.placa, "ABC1D23");
  assertEquals("pending_single_photo" in agentState, false);
});

Deno.test("MENU-SEMPRE — parceiro com cotação ativa não recebe menu", async () => {
  const result = await tryProcessJarvisServiceMenu(
    ownerInput({
      isOwner: false,
      fromNumber: "5511888888888",
      text: "oi",
      partnerQuoteActive: true,
    }),
    deps({
      loadAuthContext: async () => ({
        ownerPhone: "5511999999999",
        ownerAltPhones: [],
        gestores: ["5511888888888"],
      }),
    }),
  );
  assertEquals(result, { handled: false });
});

Deno.test("MENU-SEMPRE — helper preserva só confirmações financeiras", () => {
  const state = {
    pending_gestao_confirm: { action: "despesa" },
    pending_procedencia_confirm: { placa: "ABC1D23" },
    pending_fipe: { stage: "model" },
  };
  const next = clearJarvisGreetingPendingState(state);
  assertEquals(next?.pending_gestao_confirm, { action: "despesa" });
  assertEquals(next?.pending_procedencia_confirm, { placa: "ABC1D23" });
  assertEquals("pending_fipe" in (next ?? {}), false);
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

Deno.test("MENU-B3.2 — Postar nas redes usa copy automotiva por segmento", async () => {
  const automotive = await tryProcessJarvisServiceMenu(
    ownerInput({
      text: "jarvis_menu:lista:marketing:postar_redes",
      messageType: "interactive",
      tenantSegment: "Revenda de veículos seminovos",
    }),
    deps(),
  );
  assert(automotive.handled);
  assertEquals(
    automotive.text,
    [
      "O que vamos divulgar hoje?",
      '1. Um carro do estoque (ex: "Posta o Corolla 2022")',
      "2. A última foto ou vídeo que você me mandou",
      '3. Um texto ou ideia (ex: "feirão de sábado", "carro recém-chegado")',
    ].join("\n"),
  );

  const retail = await tryProcessJarvisServiceMenu(
    ownerInput({
      text: "jarvis_menu:lista:marketing:postar_redes",
      messageType: "interactive",
      tenantSegment: "Loja de cosméticos",
    }),
    deps(),
  );
  assert(retail.handled);
  assertEquals(retail.text, "Postar nas redes ›\nEscolha uma opção.");
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
    "const interactiveId = extractWhatsAppInteractiveId(row.payload);",
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
    processor.slice(
      processor.indexOf("async function tryProcessGestaoLucroShortcut"),
      processor.indexOf("async function tryProcessGestaoTrocaWhatsAppShortcut"),
    ),
    "isJarvisPureGreeting(",
  );
  assertStringIncludes(
    processor.slice(
      processor.indexOf("async function tryProcessVehicleStockShowcase"),
      processor.indexOf("async function processOne"),
    ),
    "isJarvisPureGreeting(input.userText, input.contactName)",
  );
  assertStringIncludes(
    processor.slice(menu - 7_000, menu),
    "if (!pureMenuGreeting) try {",
  );
  assertStringIncludes(
    processor.slice(
      processor.indexOf("async function tryProcessJarvisServiceMenuShortcut"),
      processor.indexOf("async function tryProcessGestaoLucroShortcut"),
    ),
    "agent_state: menu.clearedAgentState",
  );
  assertStringIncludes(
    processor.slice(menu - 800, menu + 1_200),
    "rawJarvisMenuInteractiveId.toLowerCase().startsWith(",
  );
  assertStringIncludes(
    processor.slice(menu - 800, menu + 1_200),
    "stripWhatsAppInteractiveMarkers(userText)",
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
    processor.slice(menu - 800, menu + 1_200),
    "tenantSegment: textAutomotiveEffectiveSegment",
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
