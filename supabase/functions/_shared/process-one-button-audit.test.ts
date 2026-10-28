import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  baseProcessOneTables,
  installProcessOneFetchRecorder,
  metaInteractivePayload,
  ProcessOneMemorySupabase,
} from "./process-one-test-harness.ts";

type ProcessorModule =
  typeof import("../whatsapp-cloud-inbound-processor/index.ts");

let processorModule: Promise<ProcessorModule> | null = null;

function loadProcessor(): Promise<ProcessorModule> {
  Deno.env.set("SUPABASE_URL", "http://127.0.0.1:54321");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "audit-test-service-key");
  Deno.env.set("LOVABLE_API_KEY", "audit-test-ai-key");
  processorModule ??= import("../whatsapp-cloud-inbound-processor/index.ts");
  return processorModule;
}

async function runProcessOne(
  tables: ReturnType<typeof baseProcessOneTables>,
) {
  const processor = await loadProcessor();
  const db = new ProcessOneMemorySupabase(tables);
  const fetchRecorder = installProcessOneFetchRecorder();
  const restoreSupabase = processor.setProcessOneSupabaseForTest(
    db as never,
  );
  try {
    const result = await processor.processOne("queue-1");
    return { result, db, fetchCalls: fetchRecorder.calls };
  } finally {
    restoreSupabase();
    fetchRecorder.restore();
  }
}

Deno.test("AUDIT-BOTOES — processOne real recebe os 3 formatos Meta", async () => {
  for (
    const [kind, payloadPath] of [
      ["interactive.button_reply", "button_reply"],
      ["interactive.list_reply", "list_reply"],
      ["button.payload", "button"],
    ] as const
  ) {
    const tables = baseProcessOneTables({
      interactiveId: "jarvis_menu:grupo:marketing",
      title: "Marketing",
      kind,
    });
    const payload = tables.whatsapp_cloud_inbound_queue[0].payload;
    assert(
      payload.interactive?.[payloadPath]?.id ===
          "jarvis_menu:grupo:marketing" ||
        payload[payloadPath]?.payload ===
          "jarvis_menu:grupo:marketing",
      kind,
    );
  }
});

Deno.test("AUDIT-BOTOES J1 — processOne real: menu → Marketing", async () => {
  const tables = baseProcessOneTables({
    interactiveId: "jarvis_menu:grupo:marketing",
    title: "Marketing",
    kind: "interactive.button_reply",
  });
  const { result, db } = await runProcessOne(tables);

  assertEquals(result.ok, true, JSON.stringify(result));
  assertEquals(result.jarvis_menu, true);
  const outbound = db.tables.whatsapp_cloud_messages.filter((message) =>
    message.direction === "outbound"
  );
  assert(outbound.length > 0);
  assertStringIncludes(String(outbound.at(-1)?.content), "Marketing");
  assertEquals(
    db.operations.some((operation) =>
      operation.table === "gestao_lancamentos" &&
      operation.operation === "insert"
    ),
    false,
  );
});

Deno.test("AUDIT-BOTOES J13 — processOne real: saudação limpa fluxo e abre menu", async () => {
  const tables = baseProcessOneTables({
    interactiveId: "unused",
    title: "unused",
    agentState: {
      pending_anuncio_cliente: { created_at: new Date().toISOString() },
      general: {
        pending_single_photo: { created_at: new Date().toISOString() },
      },
      vehicle: {
        pending_vehicle_identification: {
          created_at: new Date().toISOString(),
        },
      },
    },
    messageType: "text",
  });
  tables.whatsapp_cloud_inbound_queue[0].payload = {
    profile: { name: "Dono Teste" },
    contacts: [{ profile: { name: "Dono Teste" } }],
    text: { body: "oi jarvis" },
  };
  const { result, db } = await runProcessOne(tables);

  assertEquals(result.ok, true, JSON.stringify(result));
  assertEquals(result.jarvis_menu, true);
  const state = db.tables.whatsapp_cloud_conversations[0].agent_state;
  assertEquals("pending_anuncio_cliente" in state, false);
  assertEquals("pending_single_photo" in state.general, false);
  assertEquals("pending_vehicle_identification" in state.vehicle, false);
});

Deno.test("AUDIT-BOTOES — fixture Meta preserva ID, título e formato", () => {
  const button = metaInteractivePayload(
    "interactive.button_reply",
    "cofre_possivel_liberar:00000000-0000-4000-8000-000000000001",
    "Não é documento",
  );
  assertEquals(
    button.interactive.button_reply.id,
    "cofre_possivel_liberar:00000000-0000-4000-8000-000000000001",
  );
  assertEquals(button.interactive.button_reply.title, "Não é documento");
});

Deno.test("AUDIT-BOTOES J6 — processOne real trata ações posteriores do CRLV", async () => {
  const documentId = "00000000-0000-4000-8000-000000000001";
  const vehicleId = "00000000-0000-4000-8000-000000000002";
  const cases = [
    {
      action: "salvar",
      id: `cofre_doc_salvar:${documentId}:${vehicleId}`,
      expected: "CRLV confirmado",
    },
    {
      action: "vistoria",
      id: `cofre_doc_vistoria:${documentId}`,
      expected: "avaliação começa",
    },
    {
      action: "desvincular",
      id: `cofre_doc_desvincular:${documentId}:${vehicleId}`,
      expected: "Vínculo com o veículo desfeito",
    },
    {
      action: "vincular",
      id: `cofre_doc_vincular:${documentId}`,
      expected: "Escolha o veículo",
    },
    {
      action: "link",
      id: `cofre_doc_link:${documentId}:${vehicleId}`,
      expected: "Documento vinculado",
    },
  ];

  for (const auditCase of cases) {
    const tables = baseProcessOneTables({
      interactiveId: auditCase.id,
      title: auditCase.action,
      kind: auditCase.action === "link"
        ? "interactive.list_reply"
        : "interactive.button_reply",
    });
    tables.gestao_documento = [{
      id: documentId,
      user_id: "11111111-1111-4111-8111-111111111111",
      veiculo_id: vehicleId,
      deleted_at: null,
      status: "lido",
    }];
    tables.gestao_documento_acesso = [];
    tables.veiculos_estoque = [{
      id: vehicleId,
      user_id: "11111111-1111-4111-8111-111111111111",
      marca: "Renault",
      modelo: "Kwid",
      placa: "ABC1D23",
      deleted_at: null,
      created_at: new Date().toISOString(),
    }];
    const { result, db } = await runProcessOne(tables);
    assertEquals(
      result.gestao_documento_action,
      auditCase.action,
      JSON.stringify(result),
    );
    const outbound = db.tables.whatsapp_cloud_messages.filter((message) =>
      message.direction === "outbound"
    );
    assertStringIncludes(
      String(outbound.at(-1)?.content),
      auditCase.expected,
      auditCase.id,
    );
    assertEquals(
      db.operations.some((operation) =>
        operation.table === "gestao_lancamentos" &&
        operation.operation === "insert"
      ),
      false,
      auditCase.id,
    );
  }
});

Deno.test("AUDIT-BOTOES — processOne real revela famílias de lista sem marcador", async () => {
  const ids = [
    "ready_media:schedule_at:today_18:video:00000000-0000-4000-8000-000000000010",
    "vehicle_brand_position:bottom-right:00000000-0000-4000-8000-000000000010",
    "single_photo:destination:photo_feed",
  ];
  const missingMarkers: string[] = [];

  for (const id of ids) {
    const tables = baseProcessOneTables({
      interactiveId: id,
      title: "Escolha auditada",
      kind: "interactive.list_reply",
    });
    await runProcessOne(tables);
    const inbound = tables.whatsapp_cloud_messages.find((message) =>
      message.direction === "inbound"
    );
    if (!String(inbound?.content).includes(`<<INTERACTIVE_ID:${id}>>`)) {
      missingMarkers.push(id.split(":")[0]);
    }
  }

  assertEquals(missingMarkers, [
    "ready_media",
    "vehicle_brand_position",
    "single_photo",
  ]);
});

Deno.test("AUDIT-BOTOES — processOne real trata OPTIN_SIM e OPTIN_NAO", async () => {
  for (
    const [id, expected] of [
      ["OPTIN_SIM", "confirmado"],
      ["OPTIN_NAO", "recusado_stop_universal"],
    ] as const
  ) {
    const fromPhone = "5511888888888";
    const tables = baseProcessOneTables({
      interactiveId: id,
      title: id === "OPTIN_SIM" ? "Sim, quero!" : "Não, obrigado",
      kind: "button.payload",
      fromPhone,
      messageType: "button",
    });
    tables.pj_lista_membros = [{
      id: "member-1",
      user_id: "11111111-1111-4111-8111-111111111111",
      telefone: fromPhone,
      nome: "Cliente",
      opt_in_status: "convite_enviado",
      convite_enviado_em: new Date().toISOString(),
      convite_template_id: null,
    }];
    tables.opt_in_log = [];
    tables.pj_ebooks = [];
    tables.pj_ebook_ofertas = [];
    tables.vitrine_retomada_optout = [];
    const { result } = await runProcessOne(tables);
    assertEquals(result.opt_in_gate, expected, JSON.stringify(result));
  }
});

Deno.test("AUDIT-BOTOES J9 — processOne real confirma despesa pendente", async () => {
  const vehicleId = "00000000-0000-4000-8000-000000000020";
  const tables = baseProcessOneTables({
    interactiveId: "unused",
    title: "unused",
    messageType: "text",
    agentState: {
      pending_gestao_confirm: {
        phase: "confirm",
        action: "despesa",
        draft: {
          valor: 500,
          categoria: "funilaria",
          veiculo_id: vehicleId,
        },
        expires_at: new Date(Date.now() + 600_000).toISOString(),
      },
    },
  });
  tables.whatsapp_cloud_inbound_queue[0].payload = {
    profile: { name: "Dono Teste" },
    text: { body: "sim" },
  };
  tables.profiles[0].tipo = "revenda_veiculos";
  tables.empresa_config[0].gestao_estoque_enabled = true;
  tables.veiculos_estoque = [{
    id: vehicleId,
    user_id: "11111111-1111-4111-8111-111111111111",
    marca: "Renault",
    modelo: "Kwid",
    status: "disponivel",
    deleted_at: null,
  }];
  tables.gestao_despesa = [];
  tables.gestao_lancamentos_whatsapp = [];

  const { result, db } = await runProcessOne(tables);
  assertEquals(result.gestao_lucro, true, JSON.stringify(result));
  const outbound = db.tables.whatsapp_cloud_messages.filter((message) =>
    message.direction === "outbound"
  );
  assertStringIncludes(String(outbound.at(-1)?.content), "Despesa registrada");
});

Deno.test("AUDIT-BOTOES J8 — processOne real revela IDs Molicar perdidos", async () => {
  const failures: string[] = [];
  for (
    const [action, title] of [
      ["procedencia", "Procedência"],
      ["troca", "Usar na troca"],
      ["cadastrar", "Cadastrar no estoque"],
    ] as const
  ) {
    const id = `molicar_wa:${action}:ABC1D23`;
    const tables = baseProcessOneTables({
      interactiveId: id,
      title,
      kind: "interactive.button_reply",
    });
    tables.profiles[0].tipo = "revenda_veiculos";
    tables.empresa_config[0].gestao_estoque_enabled = true;
    const { result } = await runProcessOne(tables);
    if (result.gestao_lucro !== true) failures.push(id);
  }
  assertEquals(failures, [
    "molicar_wa:procedencia:ABC1D23",
    "molicar_wa:troca:ABC1D23",
    "molicar_wa:cadastrar:ABC1D23",
  ]);
});

Deno.test("AUDIT-BOTOES J10 — processOne real inicia cotação do parceiro", async () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const fromPhone = "5511777777777";
  const tables = baseProcessOneTables({
    interactiveId: "os_cot_wa:enviar_orcamento",
    title: "Enviar orçamento",
    kind: "interactive.button_reply",
    fromPhone,
  });
  tables.gestao_parceiro = [{
    id: "partner-1",
    user_id: tenantId,
    nome: "Oficina Teste",
    whatsapp_e164: fromPhone,
    ativo: true,
  }];
  tables.gestao_os_cotacao = [{
    id: "00000000-0000-4000-8000-000000000030",
    user_id: tenantId,
    parceiro_id: "partner-1",
    os_id: "os-1",
    status: "solicitada",
    envio_whatsapp_status: "enviado",
    solicitada_em: new Date().toISOString(),
  }];
  tables.gestao_os_cotacao_wa_sessao = [];

  const { result } = await runProcessOne(tables);
  assertEquals(result.os_cotacao_parceiro_wa, true, JSON.stringify(result));
  assertStringIncludes(
    String(result.preview),
    "Qual o valor total do orçamento",
  );
});

Deno.test("AUDIT-BOTOES J11 — processOne real trata detalhe da vitrine", async () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const vehicleId = "00000000-0000-4000-8000-000000000040";
  const tables = baseProcessOneTables({
    interactiveId: `veiculo_vitrine:detalhe:${vehicleId}`,
    title: "Ver detalhes",
    kind: "button.payload",
    fromPhone: "5511666666666",
    messageType: "button",
  });
  tables.empresa_config[0] = {
    ...tables.empresa_config[0],
    nome_empresa: "Loja Teste",
    vitrine_veiculos_demo: false,
  };
  tables.veiculos_estoque = [{
    id: vehicleId,
    user_id: tenantId,
    marca: "Renault",
    modelo: "Kwid",
    versao: "Zen",
    ano_fabricacao: 2023,
    ano_modelo: 2024,
    km: 12_000,
    preco: 58_900,
    cor: "Branco",
    cambio: "Manual",
    combustivel: "Flex",
    portas: 4,
    opcionais: ["Ar-condicionado"],
    caracteristicas: [],
    descricao: null,
    fotos: ["https://storage.test/kwid-1.jpg"],
    status: "disponivel",
    deleted_at: null,
  }];
  tables.vitrine_leads = [];

  const { result } = await runProcessOne(tables);
  assertEquals(
    result.vehicle_vitrine_early,
    true,
    JSON.stringify(result),
  );
});
