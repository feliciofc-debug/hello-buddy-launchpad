import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  advanceTrocaAfterPhoto,
  advanceTrocaAfterText,
  buildRecadoTrocaAvaliacao,
  buildTrocaRepromptMessage,
  buildTrocaStoragePath,
  confirmacaoTrocaCliente,
  evaluateTrocaPhotoVision,
  kmDivergenciaObservacao,
  trocaClienteMessageAllowed,
  trocaViewMatchesSlot,
  VITRINE_TROCA_FOTO_SLOTS,
  VITRINE_TROCA_KBB_URL,
} from "./vehicle-stock-troca.ts";
import {
  parseTrocaVisionAnalysis,
  TROCA_VISION_MODEL_FAST,
} from "./vehicle-stock-troca-vision.ts";
import type { VeiculoVitrineRow } from "./vehicle-stock-whatsapp.ts";

Deno.test("8 slots de foto na ordem combinada", () => {
  assertEquals(
    VITRINE_TROCA_FOTO_SLOTS.map((s) => s.id),
    [
      "frente",
      "traseira",
      "lateral_esquerda",
      "lateral_direita",
      "painel",
      "bancos_interior",
      "pneus",
      "motor",
    ],
  );
  assertEquals(VITRINE_TROCA_FOTO_SLOTS[6].optional, true);
  assertEquals(VITRINE_TROCA_FOTO_SLOTS[7].optional, true);
});

Deno.test("path de foto troca usa UUID de sessão", () => {
  const path = buildTrocaStoragePath("user-1", "abc-uuid", "frente");
  assertEquals(path, "user-1/troca/abc-uuid/frente.jpg");
});

Deno.test("modelo visão alinhado ao MODEL_FAST do processor", () => {
  assertEquals(TROCA_VISION_MODEL_FAST, "google/gemini-3.6-flash");
});

Deno.test("slot errado → reprompt gentil", () => {
  const msg = buildTrocaRepromptMessage("frente", "Traseira", true);
  assert(msg.includes("traseira") || msg.includes("frente"));
  assert(trocaClienteMessageAllowed(msg));
});

Deno.test("nitida=false → reprompt", () => {
  const now = new Date().toISOString();
  const form = {
    flow: "troca" as const,
    step: "fotos" as const,
    veiculo_id: "v1",
    foto_slot_index: 0,
    foto_slot_retries: 0,
    updated_at: now,
  };
  const decision = evaluateTrocaPhotoVision({
    form,
    slotId: "frente",
    analysis: parseTrocaVisionAnalysis(
      '{"view":"Frente","nitida":false,"km_lido":null,"luzes_alerta":null,"avarias":null}',
    ),
    now,
  });
  assertEquals(decision.action, "reprompt");
  if (decision.action === "reprompt") {
    assert(trocaClienteMessageAllowed(decision.clientMessage));
    assertEquals(decision.form.foto_slot_retries, 1);
  }
});

Deno.test("limite de 2 novas tentativas por slot → aceita com nota", () => {
  const now = new Date().toISOString();
  const form = {
    flow: "troca" as const,
    step: "fotos" as const,
    veiculo_id: "v1",
    foto_slot_index: 0,
    foto_slot_retries: 2,
    km: "100000",
    updated_at: now,
  };
  const decision = evaluateTrocaPhotoVision({
    form,
    slotId: "frente",
    analysis: parseTrocaVisionAnalysis(
      '{"view":"Traseira","nitida":false,"km_lido":null,"luzes_alerta":null,"avarias":null}',
    ),
    now,
  });
  assertEquals(decision.action, "accept");
  if (decision.action === "accept") {
    assert(decision.visionMeta.nota_avaliador?.includes("aceita após"));
  }
});

Deno.test("km divergente >10% vira observação interna", () => {
  const obs = kmDivergenciaObservacao(100_000, 115_000);
  assert(obs?.includes("10%"));
  const now = new Date().toISOString();
  const decision = evaluateTrocaPhotoVision({
    form: {
      flow: "troca",
      step: "fotos",
      veiculo_id: "v1",
      km: "100000",
      foto_slot_retries: 0,
      updated_at: now,
    },
    slotId: "painel",
    analysis: parseTrocaVisionAnalysis(
      '{"view":"Painel","nitida":true,"km_lido":115000,"luzes_alerta":false,"avarias":null}',
    ),
    now,
  });
  assertEquals(decision.action, "accept");
  if (decision.action === "accept") {
    assert(decision.internalNotes.some((n) => n.includes("divergência")));
  }
});

Deno.test("falha da visão não bloqueia — aceita e marca indisponível", () => {
  const now = new Date().toISOString();
  const decision = evaluateTrocaPhotoVision({
    form: {
      flow: "troca",
      step: "fotos",
      veiculo_id: "v1",
      foto_slot_retries: 0,
      updated_at: now,
    },
    slotId: "frente",
    analysis: {
      ok: false,
      view: null,
      nitida: null,
      km_lido: null,
      luzes_alerta: null,
      avarias: null,
      unavailable: true,
    },
    now,
  });
  assertEquals(decision.action, "accept");
  if (decision.action === "accept") {
    assertEquals(decision.visionMeta.visao_indisponivel, true);
  }
});

Deno.test("luzes e avarias só no recado interno", () => {
  const now = new Date().toISOString();
  const decision = evaluateTrocaPhotoVision({
    form: {
      flow: "troca",
      step: "fotos",
      veiculo_id: "v1",
      km: "50000",
      foto_slot_retries: 0,
      updated_at: now,
    },
    slotId: "painel",
    analysis: parseTrocaVisionAnalysis(
      '{"view":"Painel","nitida":true,"km_lido":50000,"luzes_alerta":true,"avarias":"amassado leve porta"}',
    ),
    now,
  });
  assertEquals(decision.action, "accept");
  if (decision.action === "accept") {
    assert(decision.internalNotes.some((n) => n.includes("Luzes")));
    assert(decision.internalNotes.some((n) => n.includes("amassado")));
  }
});

Deno.test("regra de ouro: confirmação e reprompts ao cliente", () => {
  const msg = confirmacaoTrocaCliente("Lux Motors");
  assert(trocaClienteMessageAllowed(msg));
  assertEquals(msg.includes("FIPE"), false);
  assertEquals(msg.includes("KBB"), false);
  assert(trocaClienteMessageAllowed(buildTrocaRepromptMessage("frente", "Traseira", true)));
});

Deno.test("trocaViewMatchesSlot frente e laterais", () => {
  assert(trocaViewMatchesSlot("frente", "Frente"));
  assert(trocaViewMatchesSlot("lateral_esquerda", "Lateral esquerda"));
  assertEquals(trocaViewMatchesSlot("frente", "Traseira"), false);
});

Deno.test("recado ao avaliador inclui link KBB e visão", () => {
  const vehicle: VeiculoVitrineRow = {
    id: "v1",
    marca: "BMW",
    modelo: "X1",
    versao: null,
    ano_fabricacao: 2022,
    ano_modelo: 2022,
    km: 1000,
    preco: 300000,
    cor: null,
    cambio: null,
    combustivel: null,
    portas: null,
    blindado: false,
    nivel_blindagem: null,
    opcionais: null,
    caracteristicas: null,
    descricao: null,
    fotos: null,
    status: "disponivel",
  };
  const recado = buildRecadoTrocaAvaliacao({
    clienteNome: "Ana",
    contactName: "Ana",
    fromNumber: "5521999999999",
    vehicleEstoque: vehicle,
    form: {
      flow: "troca",
      step: "concluido",
      veiculo_id: "v1",
      updated_at: new Date().toISOString(),
      modelo_ano: "Civic 2018",
      km: "85000",
      placa: "ABC1D23",
      troca_observacoes_internas: ["Km divergente"],
      fotos: [{
        slot: "frente",
        url: "https://example.com/frente.jpg",
        vision: { view: "Frente", visao_indisponivel: false },
      }],
    },
  });
  assert(recado.includes(VITRINE_TROCA_KBB_URL));
  assert(recado.includes("Observações internas"));
  assert(recado.includes("Km divergente"));
});

Deno.test("fluxo texto troca avança até pedir fotos", () => {
  const now = new Date().toISOString();
  let form = {
    flow: "troca" as const,
    step: "modelo_ano",
    veiculo_id: "v1",
    updated_at: now,
  };
  ({ form } = advanceTrocaAfterText(form, "Onix 2019", now));
  assertEquals(form.step, "km");
  ({ form } = advanceTrocaAfterText(form, "60000", now));
  assertEquals(form.step, "placa");
  ({ form } = advanceTrocaAfterText(form, "XYZ9A87", now));
  assertEquals(form.step, "fotos");
});

Deno.test("último slot leva à etapa observações", () => {
  const now = new Date().toISOString();
  const form = {
    flow: "troca" as const,
    step: "fotos",
    veiculo_id: "v1",
    foto_slot_index: 7,
    fotos: [] as Array<{ slot: string; url: string }>,
    updated_at: now,
  };
  const { form: next } = advanceTrocaAfterPhoto({
    form,
    slot: "motor",
    url: "https://example.com/motor.jpg",
    now,
  });
  assertEquals(next.step, "observacoes");
});

Deno.test("parseTrocaVisionAnalysis lê JSON completo", () => {
  const a = parseTrocaVisionAnalysis(
    '{"view":"Painel","nitida":true,"km_lido":82000,"luzes_alerta":false,"avarias":null}',
  );
  assertEquals(a.view, "Painel");
  assertEquals(a.km_lido, 82000);
});
