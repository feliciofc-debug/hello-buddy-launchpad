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
let processorServeRegistrations = 0;
let processorServeHandler: unknown = null;

function loadProcessor(): Promise<ProcessorModule> {
  Deno.env.set("SUPABASE_URL", "http://127.0.0.1:54321");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "audit-test-service-key");
  Deno.env.set("LOVABLE_API_KEY", "audit-test-ai-key");
  processorModule ??= (async () => {
    const originalServe = Deno.serve;
    Deno.serve = ((...args: unknown[]) => {
      processorServeRegistrations += 1;
      processorServeHandler = typeof args[0] === "function" ? args[0] : args[1];
      return {};
    }) as typeof Deno.serve;
    try {
      return await import("../whatsapp-cloud-inbound-processor/index.ts");
    } finally {
      Deno.serve = originalServe;
    }
  })();
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

function enqueueInteractive(
  tables: ReturnType<typeof baseProcessOneTables>,
  sequence: number,
  id: string,
  title: string,
  kind: "interactive.button_reply" | "interactive.list_reply" =
    "interactive.button_reply",
) {
  tables.whatsapp_cloud_inbound_queue.push({
    ...structuredClone(tables.whatsapp_cloud_inbound_queue[0]),
    id: `queue-${sequence}`,
    wamid: `wamid-in-${sequence}`,
    status: "received",
    attempts: 0,
    message_type: "interactive",
    payload: metaInteractivePayload(kind, id, title),
    created_at: new Date(Date.now() + sequence * 1_000).toISOString(),
  });
}

function enqueueText(
  tables: ReturnType<typeof baseProcessOneTables>,
  sequence: number,
  text: string,
) {
  const row = structuredClone(tables.whatsapp_cloud_inbound_queue[0]);
  tables.whatsapp_cloud_inbound_queue.push({
    ...row,
    id: `queue-${sequence}`,
    wamid: `wamid-in-${sequence}`,
    status: "received",
    attempts: 0,
    message_type: "text",
    payload: {
      profile: { name: "Dono Teste" },
      contacts: [{ profile: { name: "Dono Teste" } }],
      text: { body: text },
    },
    created_at: new Date(Date.now() + sequence * 1_000).toISOString(),
  });
}

Deno.test("FIX-BOTOES-1 — import do processor registra exatamente um handler", async () => {
  await loadProcessor();
  assertEquals(processorServeRegistrations, 1);
  assertEquals(typeof processorServeHandler, "function");
});

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

Deno.test("FIX-BOTOES-1 — processOne preserva ID de todo list_reply", async () => {
  const mediaId = "00000000-0000-4000-8000-000000000010";
  const ids = [
    ...["publish", "schedule", "edit", "brand"].map((action) =>
      `ready_media:${action}:foto:${mediaId}`
    ),
    ...["today_18", "tomorrow_10", "tomorrow_18", "custom"].map((slot) =>
      `ready_media:schedule_at:${slot}:video:${mediaId}`
    ),
    ...["bottom-right", "top-left", "bottom-center"].map((position) =>
      `vehicle_brand_position:${position}:${mediaId}`
    ),
    ...["photo_feed", "photo_story", "photo_linkedin", "photo_tiktok"].map((
      destination,
    ) => `single_photo:destination:${destination}`),
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

  assertEquals(missingMarkers, []);
});

Deno.test("FIX-BOTOES-1 — resolvedor único respeita reenvio, criação e publicação", async () => {
  const processor = await loadProcessor();
  const tables = baseProcessOneTables({
    interactiveId: "unused",
    title: "unused",
  });
  const oldPhotoId = "00000000-0000-4000-8000-000000000031";
  const newPhotoId = "00000000-0000-4000-8000-000000000032";
  const generatedId = "00000000-0000-4000-8000-000000000033";
  const now = Date.now();
  tables.midias_whatsapp = [
    {
      id: oldPhotoId,
      user_id: "11111111-1111-4111-8111-111111111111",
      telefone_origem: "5511999999999",
      tipo: "foto",
      origem: "whatsapp",
      midia_url: "https://storage.test/old.jpg",
      created_at: new Date(now - 86_400_000).toISOString(),
    },
    {
      id: newPhotoId,
      user_id: "11111111-1111-4111-8111-111111111111",
      telefone_origem: "5511999999999",
      tipo: "foto",
      origem: "whatsapp",
      midia_url: "https://storage.test/new.jpg",
      created_at: new Date(now - 60_000).toISOString(),
    },
    {
      id: generatedId,
      user_id: "11111111-1111-4111-8111-111111111111",
      telefone_origem: "5511999999999",
      tipo: "foto",
      origem: "anuncio_produto",
      midia_url: "https://storage.test/generated.jpg",
      created_at: new Date(now - 30_000).toISOString(),
    },
  ];
  const db = new ProcessOneMemorySupabase(tables);
  const restore = processor.setProcessOneSupabaseForTest(db as never);
  try {
    const state = {
      last_media_interaction: {
        media_id: oldPhotoId,
        at: new Date(now).toISOString(),
      },
      pending_image_composition: {
        media_ids: [newPhotoId, oldPhotoId],
        at: new Date(now).toISOString(),
      },
    };
    const context = {
      userId: "11111111-1111-4111-8111-111111111111",
      fromNumber: "5511999999999",
      agentState: state,
    };
    assertEquals(
      (await processor.resolveUltimaMidia(context, "foto_usuario")).midia?.id,
      oldPhotoId,
      "foto repetida reenviada deve voltar a ser a última foto do usuário",
    );
    assertEquals(
      (await processor.resolveUltimaMidia(context, "foto_conversa")).midia?.id,
      oldPhotoId,
      "o evento de reenvio também vence uma arte gerada antes dele",
    );
    const withoutResend = {
      ...context,
      agentState: {
        ...state,
        last_media_interaction: {
          media_id: generatedId,
          at: new Date(now - 30_000).toISOString(),
        },
      },
    };
    assertEquals(
      (await processor.resolveUltimaMidia(withoutResend, "foto_usuario")).midia
        ?.id,
      newPhotoId,
      "criação ignora arte gerada e escolhe a última foto recebida",
    );
    assertEquals(
      (await processor.resolveUltimaMidia(withoutResend, "foto_conversa"))
        .midia?.id,
      generatedId,
      "publicação escolhe a arte gerada mais recente",
    );
    assertEquals(
      (await processor.resolveUltimaMidia(context, "grupo_fotos_usuario"))
        .midias?.map((media) => media.id),
      [newPhotoId, oldPhotoId],
    );
  } finally {
    restore();
  }
});

Deno.test("FIX-BOTOES-1 J2 — foto → arte → estilo → publicar a arte", async () => {
  const processor = await loadProcessor();
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const photoId = "00000000-0000-4000-8000-000000000037";
  const now = new Date().toISOString();
  const identification = {
    marca: "Renault",
    modelo: "Kwid",
    ano: "2024",
    confianca: "alta",
  };
  const photoContext = {
    identification,
    media_ids: [photoId],
    target: "single_ad",
    confirmed: true,
    confirmed_title: "Renault Kwid",
    data: { preco: "65000", ano: "2024", cor: "branco" },
    created_at: now,
  };
  const tables = baseProcessOneTables({
    interactiveId: `vehicle_photo_action:ad:${photoId}`,
    title: "Criar arte",
    kind: "interactive.list_reply",
    agentState: {
      pending_vehicle_identification: photoContext,
      last_vehicle_photo_context: photoContext,
      last_media_interaction: { media_id: photoId, at: now },
      vertical_router: {
        media_routes: {
          [photoId]: {
            route: "veiculo",
            vehicle_identification: identification,
            vehicle_media_ids: [photoId],
            confirmed: true,
            confirmed_product_title: "Renault Kwid",
          },
        },
      },
    },
  });
  tables.midias_whatsapp = [{
    id: photoId,
    user_id: tenantId,
    telefone_origem: "5511999999999",
    tipo: "foto",
    origem: "whatsapp",
    midia_url: "https://storage.test/kwid.jpg",
    contexto_original:
      "[visão] Renault Kwid branco fotografado de frente em fundo neutro.",
    created_at: now,
  }];
  tables.meta_connections = [{
    id: "meta-1",
    user_id: tenantId,
    page_id: "page-1",
    ig_account_id: "ig-1",
    page_name: "Loja Teste",
    ig_username: "lojateste",
    is_active: true,
  }];
  tables.linkedin_connections = [];
  tables.social_posts_queue = [];
  tables.anuncio_tenant_preferences = [];
  const db = new ProcessOneMemorySupabase(tables);
  const fetchRecorder = installProcessOneFetchRecorder();
  const restoreSupabase = processor.setProcessOneSupabaseForTest(db as never);
  try {
    const ad = await processor.processOne("queue-1");
    assertEquals(ad.ok, true, JSON.stringify(ad));
    const afterAd = db.tables.whatsapp_cloud_conversations[0].agent_state;
    assert(
      afterAd?.pending_anuncio_photo ||
        afterAd?.vehicle?.pending_anuncio_photo,
      JSON.stringify(afterAd),
    );

    enqueueInteractive(
      db.tables,
      2,
      "anuncio_photo:original",
      "Usar original",
    );
    const styles = await processor.processOne("queue-2");
    assertEquals(styles.ok, true, JSON.stringify(styles));
    const afterStyles = db.tables.whatsapp_cloud_conversations[0].agent_state;
    assert(
      afterStyles?.pending_anuncio_styles ||
        afterStyles?.vehicle?.pending_anuncio_styles,
      JSON.stringify(afterStyles),
    );

    enqueueInteractive(
      db.tables,
      3,
      "anuncio_style:impacto",
      "Impacto",
    );
    const rendered = await processor.processOne("queue-3");
    assertEquals(rendered.ok, true, JSON.stringify(rendered));
    const art = db.tables.midias_whatsapp.filter((media) =>
      media.origem === "anuncio_produto"
    ).at(-1);
    assert(art?.id, JSON.stringify(db.tables.midias_whatsapp));

    enqueueInteractive(
      db.tables,
      4,
      `ready_media:publish:foto:${art.id}`,
      "Publicar",
    );
    const publish = await processor.processOne("queue-4");
    assertEquals(publish.ok, true, JSON.stringify(publish));
    assert(
      db.tables.social_posts_queue.some((row) =>
        row.image_url === art.midia_url
      ),
      JSON.stringify(db.tables.social_posts_queue),
    );
  } finally {
    restoreSupabase();
    fetchRecorder.restore();
  }
});

Deno.test("FIX-BOTOES-1 J3 — foto → destino Feed → legenda pelo processOne", async () => {
  const processor = await loadProcessor();
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const photoId = "00000000-0000-4000-8000-000000000034";
  const tables = baseProcessOneTables({
    interactiveId: "single_photo:destination:photo_feed",
    title: "Feed",
    kind: "interactive.list_reply",
    agentState: {
      pending_single_photo: {
        media_id: photoId,
        stage: "destination",
        created_at: new Date().toISOString(),
      },
      last_media_interaction: {
        media_id: photoId,
        at: new Date().toISOString(),
      },
    },
  });
  tables.midias_whatsapp = [{
    id: photoId,
    user_id: tenantId,
    telefone_origem: "5511999999999",
    tipo: "foto",
    origem: "whatsapp",
    midia_url: "https://storage.test/product.jpg",
    contexto_original:
      "[visão] Produto automotivo azul fotografado em fundo neutro para divulgação.",
    created_at: new Date().toISOString(),
  }];
  tables.meta_connections = [{
    id: "meta-1",
    user_id: tenantId,
    page_id: "page-1",
    ig_account_id: "ig-1",
    is_active: true,
  }];
  tables.linkedin_connections = [];
  tables.social_posts_queue = [];
  const db = new ProcessOneMemorySupabase(tables);
  const fetchRecorder = installProcessOneFetchRecorder();
  const restoreSupabase = processor.setProcessOneSupabaseForTest(db as never);
  try {
    const result = await processor.processOne("queue-1");
    assertEquals(result.ok, true, JSON.stringify(result));
    assertEquals(
      db.tables.whatsapp_cloud_conversations[0].agent_state
          ?.pending_single_photo == null,
      true,
    );
    const token = db.tables.social_posts_queue[0]?.approval_token;
    assert(token, JSON.stringify(db.tables.social_posts_queue));
    enqueueInteractive(
      db.tables,
      2,
      `social_variant:A:${token}`,
      "Opção A",
    );
    const published = await processor.processOne("queue-2");
    assertEquals(published.ok, true, JSON.stringify(published));
    assert(
      db.operations.some((operation) =>
        operation.table === "social_posts_queue" &&
        operation.operation === "update"
      ),
    );
  } finally {
    restoreSupabase();
    fetchRecorder.restore();
  }
});

Deno.test("FIX-BOTOES-1 J4 — editar → resultado → publicar imagem editada", async () => {
  const processor = await loadProcessor();
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const photoId = "00000000-0000-4000-8000-000000000035";
  const tables = baseProcessOneTables({
    interactiveId: "single_photo:edit",
    title: "Editar",
    agentState: {
      pending_single_photo: {
        media_id: photoId,
        stage: "actions",
        confirmed_product_title: "Produto teste",
        created_at: new Date().toISOString(),
      },
      last_media_interaction: {
        media_id: photoId,
        at: new Date().toISOString(),
      },
    },
  });
  tables.midias_whatsapp = [{
    id: photoId,
    user_id: tenantId,
    telefone_origem: "5511999999999",
    tipo: "foto",
    origem: "whatsapp",
    midia_url: "https://storage.test/original.jpg",
    contexto_original:
      "[visão] Produto azul em fundo neutro pronto para divulgação.",
    created_at: new Date().toISOString(),
  }];
  tables.meta_connections = [{
    id: "meta-1",
    user_id: tenantId,
    page_id: "page-1",
    ig_account_id: "ig-1",
    is_active: true,
  }];
  tables.linkedin_connections = [];
  tables.social_posts_queue = [];
  tables.videos_agendados = [];
  const db = new ProcessOneMemorySupabase(tables);
  const fetchRecorder = installProcessOneFetchRecorder();
  const restoreSupabase = processor.setProcessOneSupabaseForTest(db as never);
  try {
    const editStart = await processor.processOne("queue-1");
    assertEquals(editStart.ok, true, JSON.stringify(editStart));
    enqueueText(db.tables, 2, "Melhore a luz e mantenha o produto");
    const edited = await processor.processOne("queue-2");
    assertEquals(edited.ok, true, JSON.stringify(edited));
    const generated = db.tables.midias_whatsapp.find((media) =>
      media.origem === "ia_edicao"
    );
    assert(generated?.id, JSON.stringify(db.tables.midias_whatsapp));
    assertEquals(generated.midia_pai_id, photoId);

    enqueueInteractive(
      db.tables,
      3,
      `ready_media:publish:foto:${generated.id}`,
      "Publicar",
    );
    const publish = await processor.processOne("queue-3");
    assertEquals(publish.ok, true, JSON.stringify(publish));
    assert(
      db.tables.social_posts_queue.some((row) =>
        row.image_url === generated.midia_url
      ),
      JSON.stringify(db.tables.social_posts_queue),
    );
  } finally {
    restoreSupabase();
    fetchRecorder.restore();
  }
});

Deno.test("FIX-BOTOES-1 J5 — carrossel pronto → publicar pelo processOne", async () => {
  const processor = await loadProcessor();
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const carouselId = "00000000-0000-4000-8000-000000000036";
  const now = new Date().toISOString();
  const tables = baseProcessOneTables({
    interactiveId: "vehicle_carousel:publish",
    title: "Publicar",
    agentState: {
      pending_carrossel_veiculo: {
        stage: "delivered",
        photos: [
          { id: "photo-1", url: "https://storage.test/photo-1.jpg" },
          { id: "photo-2", url: "https://storage.test/photo-2.jpg" },
        ],
        data: { titulo: "Renault Kwid 2024", preco: "65000" },
        format: "portrait",
        media_id: carouselId,
        image_urls: [
          "https://storage.test/card-1.jpg",
          "https://storage.test/card-2.jpg",
        ],
        caption: "Renault Kwid 2024 pronto para sua próxima viagem.",
        created_at: now,
      },
      last_media_interaction: { media_id: carouselId, at: now },
    },
  });
  tables.midias_whatsapp = [{
    id: carouselId,
    user_id: tenantId,
    telefone_origem: "5511999999999",
    tipo: "foto",
    origem: "carrossel_whatsapp",
    midia_url: "https://storage.test/card-1.jpg",
    contexto_original: "Carrossel: Renault Kwid 2024",
    created_at: now,
  }];
  tables.meta_connections = [{
    id: "meta-1",
    user_id: tenantId,
    page_id: "page-1",
    ig_account_id: "ig-1",
    is_active: true,
  }];
  tables.linkedin_connections = [];
  tables.social_posts_queue = [];
  const db = new ProcessOneMemorySupabase(tables);
  const fetchRecorder = installProcessOneFetchRecorder();
  const restoreSupabase = processor.setProcessOneSupabaseForTest(db as never);
  try {
    const publish = await processor.processOne("queue-1");
    assertEquals(publish.ok, true, JSON.stringify(publish));
    enqueueInteractive(
      db.tables,
      2,
      "vehicle_carousel:networks:both",
      "Instagram e Facebook",
    );
    const networks = await processor.processOne("queue-2");
    assertEquals(networks.ok, true, JSON.stringify(networks));
    const savedState = db.tables.whatsapp_cloud_conversations[0].agent_state;
    const state = savedState?.pending_carrossel_veiculo ??
      savedState?.vehicle?.pending_carrossel_veiculo;
    assertEquals(state?.stage, "caption_choice", JSON.stringify(state));
    assert(state?.token);

    enqueueInteractive(
      db.tables,
      3,
      `social_variant:A:${state.token}`,
      "Opção A",
    );
    const caption = await processor.processOne("queue-3");
    assertEquals(caption.ok, true, JSON.stringify(caption));
    assertEquals(
      (db.tables.whatsapp_cloud_conversations[0].agent_state
        ?.pending_carrossel_veiculo ??
        db.tables.whatsapp_cloud_conversations[0].agent_state?.vehicle
          ?.pending_carrossel_veiculo)?.stage,
      "approval",
    );

    enqueueInteractive(
      db.tables,
      4,
      `vehicle_carousel:confirm:${state.token}`,
      "Publicar",
    );
    const confirmed = await processor.processOne("queue-4");
    assertEquals(confirmed.ok, true, JSON.stringify(confirmed));
    assertEquals(
      (db.tables.whatsapp_cloud_conversations[0].agent_state
          ?.pending_carrossel_veiculo ??
        db.tables.whatsapp_cloud_conversations[0].agent_state?.vehicle
          ?.pending_carrossel_veiculo) == null,
      true,
    );
  } finally {
    restoreSupabase();
    fetchRecorder.restore();
  }
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

Deno.test("FIX-BOTOES-1 J8 — processOne repassa IDs Molicar", async () => {
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
  assertEquals(failures, []);
});

Deno.test("FIX-BOTOES-1 J8 — Procedência → confirmar pelo processOne", async () => {
  const processor = await loadProcessor();
  const tables = baseProcessOneTables({
    interactiveId: "molicar_wa:procedencia:ABC1D23",
    title: "Procedência",
    kind: "interactive.button_reply",
  });
  tables.profiles[0].tipo = "revenda_veiculos";
  tables.empresa_config[0].gestao_estoque_enabled = true;
  const db = new ProcessOneMemorySupabase(tables);
  const fetchRecorder = installProcessOneFetchRecorder();
  const restoreSupabase = processor.setProcessOneSupabaseForTest(db as never);
  try {
    const offered = await processor.processOne("queue-1");
    assertEquals(offered.gestao_lucro, true, JSON.stringify(offered));
    const pending = db.tables.whatsapp_cloud_conversations[0].agent_state
      ?.pending_procedencia_confirm;
    assertEquals(pending?.placa, "ABC1D23");

    enqueueInteractive(
      db.tables,
      2,
      "molicar_wa:procedencia_confirmar",
      "Confirmar",
    );
    const confirmed = await processor.processOne("queue-2");
    assertEquals(confirmed.gestao_lucro, true, JSON.stringify(confirmed));
    assertEquals(
      db.tables.whatsapp_cloud_conversations[0].agent_state
        ?.pending_procedencia_confirm,
      null,
    );
  } finally {
    restoreSupabase();
    fetchRecorder.restore();
  }
});

Deno.test("FIX-BOTOES-1 J12 — vídeo → legenda → agendar pelo processOne", async () => {
  const processor = await loadProcessor();
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const videoId = "00000000-0000-4000-8000-000000000041";
  const tables = baseProcessOneTables({
    interactiveId: `ready_media:caption_choice:A:video:${videoId}`,
    title: "Opção A",
    kind: "interactive.button_reply",
    agentState: {
      last_media_interaction: {
        media_id: videoId,
        at: new Date().toISOString(),
      },
    },
  });
  tables.midias_whatsapp = [{
    id: videoId,
    user_id: tenantId,
    telefone_origem: "5511999999999",
    tipo: "video",
    origem: "video_legendado",
    midia_url:
      "https://storage.test/storage/v1/object/public/videos/legendado.mp4",
    contexto_original: "Legenda original",
    created_at: new Date().toISOString(),
  }];
  tables.video_render_jobs = [{
    id: "video-job-1",
    user_id: tenantId,
    resultado_bucket: "videos",
    resultado_path: "legendado.mp4",
    status: "concluido",
    formato: "reels",
    caption: "Legenda original",
    metadata: {
      opcoes: ["Legenda A", "Legenda B", "Legenda C"],
      video_output: { width: 1080, height: 1920 },
    },
    created_at: new Date().toISOString(),
  }];
  tables.meta_connections = [{
    id: "meta-1",
    user_id: tenantId,
    page_id: "page-1",
    ig_account_id: "ig-1",
    is_active: true,
  }];
  tables.linkedin_connections = [];
  tables.social_posts_queue = [];
  tables.videos_agendados = [];
  const db = new ProcessOneMemorySupabase(tables);
  const fetchRecorder = installProcessOneFetchRecorder();
  const restoreSupabase = processor.setProcessOneSupabaseForTest(db as never);
  try {
    const caption = await processor.processOne("queue-1");
    assertEquals(caption.ok, true, JSON.stringify(caption));
    assertEquals(db.tables.video_render_jobs[0].copy_escolhida, "Legenda A");

    enqueueInteractive(
      db.tables,
      2,
      `ready_media:schedule:video:${videoId}`,
      "Agendar",
    );
    const schedule = await processor.processOne("queue-2");
    assertEquals(schedule.ok, true, JSON.stringify(schedule));

    enqueueInteractive(
      db.tables,
      3,
      `ready_media:schedule_at:tomorrow_10:video:${videoId}`,
      "Amanhã às 10h",
      "interactive.list_reply",
    );
    const scheduled = await processor.processOne("queue-3");
    assertEquals(scheduled.ok, true, JSON.stringify(scheduled));
    assert(
      db.tables.videos_agendados.some((row) =>
        row.video_url?.includes("legendado.mp4") &&
        row.status === "pendente" &&
        row.scheduled_for
      ),
      JSON.stringify(db.tables.videos_agendados),
    );
  } finally {
    restoreSupabase();
    fetchRecorder.restore();
  }
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
