import {
  assert,
  assertEquals,
  assertFalse,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildDetalheVehicleListRows,
  buildProximosDiasUteisVisita,
  isVitrineFormControlText,
  pendingFormIsActive,
  shouldRunVitrineEarlyCapture,
  vitrineFormStepExpectsText,
} from "./vehicle-stock-whatsapp.ts";
import { runVehicleStockShowcaseTurn } from "./vehicle-stock-showcase-turn.ts";
import type { ShowcaseTurnDeps } from "./vehicle-stock-showcase-turn.ts";
import type { VeiculoVitrineRow } from "./vehicle-stock-whatsapp.ts";

Deno.test("visitas começam amanhã e pulam domingo", () => {
  const sundayUtc = Date.parse("2026-10-18T15:00:00.000Z");
  const days = buildProximosDiasUteisVisita(6, sundayUtc);
  assertEquals(days.length, 6);
  for (const iso of days) {
    const [y, m, d] = iso.split("-").map(Number);
    const wd = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
    }).format(new Date(Date.UTC(y, m - 1, d, 12)));
    assert(wd !== "Sun");
  }
  const tomorrow = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date(sundayUtc + 86_400_000));
  assertEquals(days[0], tomorrow);
});

Deno.test("controle cancelar/consultor na vitrine", () => {
  assertEquals(isVitrineFormControlText("cancelar"), "cancelar");
  assertEquals(isVitrineFormControlText("Falar com consultor"), "consultor");
  assertEquals(isVitrineFormControlText("quero outra coisa"), null);
});

Deno.test("early capture: visita não captura texto livre", () => {
  const pending = {
    stage: "detalhe" as const,
    offset: 0,
    updated_at: new Date().toISOString(),
    form: {
      flow: "visita" as const,
      step: "dia",
      veiculo_id: "v1",
      updated_at: new Date().toISOString(),
    },
  };
  assert(pendingFormIsActive(pending));
  assertFalse(shouldRunVitrineEarlyCapture({
    userText: "quero outra coisa",
    vitrineInteractiveId: null,
    pending,
  }));
  assert(shouldRunVitrineEarlyCapture({
    userText: "cancelar",
    vitrineInteractiveId: null,
    pending,
  }));
});

Deno.test("early capture: troca texto só nas etapas de formulário", () => {
  assert(vitrineFormStepExpectsText("modelo_ano"));
  assertFalse(vitrineFormStepExpectsText("dia"));
  const pending = {
    stage: "detalhe" as const,
    offset: 0,
    updated_at: new Date().toISOString(),
    form: {
      flow: "troca" as const,
      step: "modelo_ano",
      veiculo_id: "v1",
      updated_at: new Date().toISOString(),
    },
  };
  assert(shouldRunVitrineEarlyCapture({
    userText: "Civic 2018",
    vitrineInteractiveId: null,
    pending,
  }));
});

Deno.test("financiamento one-shot encaminha e confirma", async () => {
  let recadoDono = "";
  let msgCliente = "";
  const vehicle: VeiculoVitrineRow = {
    id: "v-fin",
    marca: "BMW",
    modelo: "320i",
    versao: null,
    ano_fabricacao: 2021,
    ano_modelo: 2021,
    km: 20000,
    preco: 220000,
    cor: null,
    cambio: "Automático",
    combustivel: "Gasolina",
    portas: 4,
    blindado: false,
    nivel_blindagem: null,
    opcionais: null,
    caracteristicas: null,
    descricao: null,
    fotos: null,
    status: "disponivel",
  };
  const noop = async () => ({ ok: true as const, messageId: "x" });
  const deps: ShowcaseTurnDeps = {
    loadTenantFlags: async () => ({
      segmento: "revenda de veículos",
      vitrine_veiculos_demo: false,
      nome_empresa: "Prime Motors",
    }),
    loadMarcas: async () => [],
    loadPrecosDisponiveis: async () => [],
    loadVeiculosByMarca: async () => [],
    loadVeiculosByFaixa: async () => [],
    loadVeiculoById: async (id) => (id === "v-fin" ? vehicle : null),
    sendText: async (text) => {
      msgCliente = text;
      return { ok: true };
    },
    sendMenu: noop,
    sendButtons: noop,
    sendImage: noop,
    sendImageHeaderButtons: noop,
    sendCarousel: noop,
    encaminharRecado: async (r) => {
      recadoDono = r;
      return { ok: true };
    },
    savePending: async () => {},
    getPending: () => null,
    pause: async () => {},
  };
  const result = await runVehicleStockShowcaseTurn({
    userText: "<<INTERACTIVE_ID:veiculo_vitrine:acao:financiamento:v-fin>>",
    fromNumber: "5521999999999",
    forceInteractive: true,
    deps,
  });
  assertEquals(result.handled, true);
  assert(recadoDono.toLowerCase().includes("financiamento"));
  assert(msgCliente.includes("Prime Motors"));
});

Deno.test("lista detalhe usa título Financiamento", () => {
  const row = buildDetalheVehicleListRows("abc").find((r) =>
    r.id.includes("financiamento")
  );
  assertEquals(row?.title, "💰 Financiamento");
});
