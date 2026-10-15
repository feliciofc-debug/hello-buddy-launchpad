import {
  assert,
  assertEquals,
  assertFalse,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildDetalheVehicleListRows,
  buildProximosDiasUteisVisita,
  buildVisitaDiaListRows,
  isVitrineFormControlText,
  parseIsoDateFromButtonParts,
  parseVisitaTurnoFromButtonParts,
  parseVitrineButtonId,
  pendingFormIsActive,
  shouldRunVitrineEarlyCapture,
  vitrineButtonId,
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

Deno.test("visita_dia: id real do builder → parse → handler turno", async () => {
  const iso = "2026-10-17";
  const dayRow = buildVisitaDiaListRows([iso])[0];
  const { action, parts } = parseVitrineButtonId(dayRow.id);
  assertEquals(action, "visita_dia");
  assertEquals(parseIsoDateFromButtonParts(parts), iso);

  let sentButtons = false;
  const vehicle: VeiculoVitrineRow = {
    id: "v-vis",
    marca: "Land Rover",
    modelo: "Range Rover Evoque",
    versao: "2.0 P300",
    ano_fabricacao: 2023,
    ano_modelo: 2023,
    km: 1000,
    preco: 400000,
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
      nome_empresa: "Loja Teste",
    }),
    loadMarcas: async () => [],
    loadPrecosDisponiveis: async () => [],
    loadVeiculosByMarca: async () => [],
    loadVeiculosByFaixa: async () => [],
    loadVeiculoById: async () => vehicle,
    sendText: noop,
    sendMenu: noop,
    sendButtons: async () => {
      sentButtons = true;
      return { ok: true };
    },
    sendImage: noop,
    sendImageHeaderButtons: noop,
    sendCarousel: noop,
    encaminharRecado: async () => ({ ok: true }),
    savePending: async () => {},
    getPending: () => ({
      stage: "detalhe",
      offset: 0,
      updated_at: new Date().toISOString(),
      form: {
        flow: "visita",
        step: "dia",
        veiculo_id: "v-vis",
        updated_at: new Date().toISOString(),
      },
    }),
    pause: async () => {},
  };

  const dayResult = await runVehicleStockShowcaseTurn({
    userText: `<<INTERACTIVE_ID:${dayRow.id}>>`,
    fromNumber: "5521999999999",
    forceInteractive: true,
    deps,
  });
  assertEquals(dayResult.handled, true);
  assertEquals(dayResult.replyPreview, "visita_turno");
  assert(sentButtons);

  const turnoId = vitrineButtonId("visita_turno", `${iso}:manha`);
  const turnoParsed = parseVitrineButtonId(turnoId);
  assertEquals(turnoParsed.action, "visita_turno");
  assertEquals(parseVisitaTurnoFromButtonParts(turnoParsed.parts)?.iso, iso);
  assertEquals(parseVisitaTurnoFromButtonParts(turnoParsed.parts)?.turno, "manha");

  let confirmou = false;
  const depsTurno: ShowcaseTurnDeps = {
    ...deps,
    sendText: async (t) => {
      confirmou = t.includes("Nosso consultor vai entrar em contato");
      return { ok: true };
    },
    getPending: () => ({
      stage: "detalhe",
      offset: 0,
      updated_at: new Date().toISOString(),
      form: {
        flow: "visita",
        step: "turno",
        veiculo_id: "v-vis",
        dia_iso: iso,
        updated_at: new Date().toISOString(),
      },
    }),
  };
  const turnoResult = await runVehicleStockShowcaseTurn({
    userText: `<<INTERACTIVE_ID:${turnoId}>>`,
    fromNumber: "5521999999999",
    forceInteractive: true,
    deps: depsTurno,
  });
  assertEquals(turnoResult.handled, true);
  assertEquals(turnoResult.replyPreview, "visita_confirmada");
  assert(confirmou);
});

Deno.test("visita turno duplicado não encaminha recado duas vezes", async () => {
  let encaminhamentos = 0;
  const iso = "2026-10-17";
  const turnoId = vitrineButtonId("visita_turno", `${iso}:manha`);
  const vehicle: VeiculoVitrineRow = {
    id: "v-dedup",
    marca: "BMW",
    modelo: "X1",
    versao: null,
    ano_fabricacao: 2022,
    ano_modelo: 2022,
    km: 1000,
    preco: 200000,
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
  let storedPending: import("./vehicle-stock-whatsapp.ts").PendingVitrineEstoque = {
    stage: "detalhe",
    offset: 0,
    updated_at: new Date().toISOString(),
    form: {
      flow: "visita",
      step: "turno",
      veiculo_id: "v-dedup",
      dia_iso: iso,
      updated_at: new Date().toISOString(),
    },
  };
  const noop = async () => ({ ok: true as const, messageId: "x" });
  const deps = (): ShowcaseTurnDeps => ({
    loadTenantFlags: async () => ({
      segmento: "revenda de veículos",
      vitrine_veiculos_demo: false,
      nome_empresa: "Loja",
    }),
    loadMarcas: async () => [],
    loadPrecosDisponiveis: async () => [],
    loadVeiculosByMarca: async () => [],
    loadVeiculosByFaixa: async () => [],
    loadVeiculoById: async () => vehicle,
    sendText: noop,
    sendMenu: noop,
    sendButtons: noop,
    sendImage: noop,
    sendImageHeaderButtons: noop,
    sendCarousel: noop,
    encaminharRecado: async () => {
      encaminhamentos += 1;
      return { ok: true };
    },
    savePending: async (p) => {
      if (p) storedPending = p;
    },
    getPending: () => storedPending,
    pause: async () => {},
  });

  const sharedDeps = deps();
  for (let i = 0; i < 2; i++) {
    await runVehicleStockShowcaseTurn({
      userText: `<<INTERACTIVE_ID:${turnoId}>>`,
      fromNumber: "5521888777666",
      forceInteractive: true,
      deps: sharedDeps,
    });
  }
  assertEquals(encaminhamentos, 1);
});
