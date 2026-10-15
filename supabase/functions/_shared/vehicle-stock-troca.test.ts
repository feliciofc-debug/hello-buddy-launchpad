import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  advanceTrocaAfterPhoto,
  advanceTrocaAfterText,
  buildRecadoTrocaAvaliacao,
  buildTrocaStoragePath,
  confirmacaoTrocaCliente,
  trocaClienteMessageAllowed,
  VITRINE_TROCA_KBB_URL,
} from "./vehicle-stock-troca.ts";
import { parseTrocaVisionResponse } from "./vehicle-stock-troca-vision.ts";
import type { VeiculoVitrineRow } from "./vehicle-stock-whatsapp.ts";

Deno.test("path de foto troca usa UUID de sessão", () => {
  const path = buildTrocaStoragePath("user-1", "abc-uuid", "frente");
  assertEquals(path, "user-1/troca/abc-uuid/frente.jpg");
});

Deno.test("regra de ouro: confirmação ao cliente não cita FIPE/KBB/R$", () => {
  const msg = confirmacaoTrocaCliente("Lux Motors");
  assert(trocaClienteMessageAllowed(msg));
  assertEquals(msg.includes("FIPE"), false);
  assertEquals(msg.includes("KBB"), false);
  assertEquals(/\bR\$\b/.test(msg), false);
});

Deno.test("recado ao avaliador inclui dados, fotos, observações e link KBB", () => {
  const vehicle: VeiculoVitrineRow = {
    id: "v1",
    marca: "BMW",
    modelo: "X1",
    versao: "XDRIVE40I",
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
      observacoes: "Único dono",
      fotos: [{
        slot: "frente",
        url: "https://example.com/frente.jpg",
        vision_view: "Frente",
      }],
    },
  });
  assert(recado.includes("Civic 2018"));
  assert(recado.includes("ABC1D23"));
  assert(recado.includes("https://example.com/frente.jpg"));
  assert(recado.includes("Único dono"));
  assert(recado.includes(VITRINE_TROCA_KBB_URL));
  assert(recado.includes("visão: Frente"));
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

Deno.test("última foto troca leva à etapa observações", () => {
  const now = new Date().toISOString();
  let form = {
    flow: "troca" as const,
    step: "fotos",
    veiculo_id: "v1",
    foto_slot_index: 4,
    fotos: [] as Array<{ slot: string; url: string }>,
    updated_at: now,
  };
  const { form: next } = advanceTrocaAfterPhoto({
    form,
    slot: "hodometro",
    url: "https://example.com/hod.jpg",
    visionView: "Hodômetro",
    now,
  });
  assertEquals(next.step, "observacoes");
});

Deno.test("parseTrocaVisionResponse aceita JSON da visão", () => {
  assertEquals(
    parseTrocaVisionResponse('{"view":"Painel"}'),
    "Painel",
  );
});
