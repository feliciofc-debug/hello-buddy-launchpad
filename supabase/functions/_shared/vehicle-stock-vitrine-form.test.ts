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
import {
  applyTrocaPhotoAndReply,
  applyTrocaPhotoReprompt,
  runVehicleStockShowcaseTurn,
} from "./vehicle-stock-showcase-turn.ts";
import type { ShowcaseTurnDeps } from "./vehicle-stock-showcase-turn.ts";
import type {
  PendingVitrineEstoque,
  VeiculoVitrineRow,
} from "./vehicle-stock-whatsapp.ts";

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

Deno.test("early capture: cliente_nome captura texto", () => {
  const pending = {
    stage: "detalhe" as const,
    offset: 0,
    updated_at: new Date().toISOString(),
    form: {
      flow: "cliente_nome" as const,
      step: "nome",
      veiculo_id: "v1",
      resume: { kind: "interesse" as const, vehicleId: "v1" },
      updated_at: new Date().toISOString(),
    },
  };
  assert(shouldRunVitrineEarlyCapture({
    userText: "Ana",
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

Deno.test("financiamento inicia com LGPD (ficha conversacional)", async () => {
  let msgCliente = "";
  let pendingStore: PendingVitrineEstoque | null = null;
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
    sendButtons: async (body) => {
      msgCliente = body;
      return { ok: true };
    },
    sendImage: noop,
    sendImageHeaderButtons: noop,
    sendCarousel: noop,
    encaminharRecado: async () => ({ ok: true }),
    savePending: async (p) => {
      pendingStore = p;
    },
    getPending: () => pendingStore,
    pause: async () => {},
    userId: "user-test",
    fetchViaCep: async () => null,
    saveFinanciamentoFicha: async () => ({ id: "ficha-1" }),
  };
  const result = await runVehicleStockShowcaseTurn({
    userText: "<<INTERACTIVE_ID:veiculo_vitrine:acao:financiamento:v-fin>>",
    fromNumber: "5521999999999",
    forceInteractive: true,
    deps,
  });
  assertEquals(result.handled, true);
  assertEquals(result.replyPreview, "financiamento_lgpd");
  assert(msgCliente.toLowerCase().includes("lgpd"));
  assertEquals(pendingStore?.form?.flow, "financiamento");
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
    userId: "user-test",
    fetchViaCep: async () => null,
    saveFinanciamentoFicha: async () => ({ id: "ficha-1" }),
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
      cliente_nome: "Rita",
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
    cliente_nome: "Dedup",
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
    userId: "user-test",
    fetchViaCep: async () => null,
    saveFinanciamentoFicha: async () => ({ id: "ficha-1" }),
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

function trocaVehicle(): VeiculoVitrineRow {
  return {
    id: "v-troca",
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
}

function trocaDepsWithOutboundCounter(stored: {
  pending: PendingVitrineEstoque | null;
}) {
  let textSends = 0;
  let buttonSends = 0;
  const noop = async () => ({ ok: true as const, messageId: "x" });
  const vehicle = trocaVehicle();
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
    loadVeiculoById: async (id) => (id === vehicle.id ? vehicle : null),
    sendText: async () => {
      textSends += 1;
      return { ok: true };
    },
    sendMenu: noop,
    sendButtons: async () => {
      buttonSends += 1;
      return { ok: true };
    },
    sendImage: noop,
    sendImageHeaderButtons: noop,
    sendCarousel: noop,
    encaminharRecado: async () => ({ ok: true }),
    savePending: async (p) => {
      if (p) stored.pending = p;
    },
    getPending: () => stored.pending ?? undefined,
    pause: async () => {},
    userId: "user-test",
    fetchViaCep: async () => null,
    saveFinanciamentoFicha: async () => ({ id: "ficha-1" }),
  };
  return {
    deps,
    counts: () => ({ textSends, buttonSends }),
    resetCounts: () => {
      textSends = 0;
      buttonSends = 0;
    },
  };
}

Deno.test("troca: cada passo de texto envia uma única mensagem ao cliente", async () => {
  const now = new Date().toISOString();
  const stored = {
    pending: {
      stage: "detalhe" as const,
      offset: 0,
      updated_at: now,
      form: {
        flow: "troca" as const,
        step: "modelo_ano",
        veiculo_id: "v-troca",
        updated_at: now,
      },
    } satisfies PendingVitrineEstoque,
  };
  const { deps, counts, resetCounts } = trocaDepsWithOutboundCounter(stored);

  await runVehicleStockShowcaseTurn({
    userText: "Civic 2018",
    fromNumber: "5521999999999",
    allowEarlyFormCapture: true,
    deps,
  });
  assertEquals(counts().textSends, 1);
  assertEquals(counts().buttonSends, 0);

  resetCounts();
  await runVehicleStockShowcaseTurn({
    userText: "85000",
    fromNumber: "5521999999999",
    allowEarlyFormCapture: true,
    deps,
  });
  assertEquals(counts().textSends, 1);
  assertEquals(counts().buttonSends, 0);

  resetCounts();
  await runVehicleStockShowcaseTurn({
    userText: "ABC1D23",
    fromNumber: "5521999999999",
    allowEarlyFormCapture: true,
    deps,
  });
  assertEquals(counts().textSends, 1);
  assertEquals(counts().buttonSends, 0);
});

Deno.test("troca: após foto avança com uma única mensagem", async () => {
  const now = new Date().toISOString();
  const stored = {
    pending: {
      stage: "detalhe" as const,
      offset: 0,
      updated_at: now,
      form: {
        flow: "troca" as const,
        step: "fotos",
        veiculo_id: "v-troca",
        foto_slot_index: 0,
        fotos: [],
        updated_at: now,
      },
    } satisfies PendingVitrineEstoque,
  };
  const { deps, counts } = trocaDepsWithOutboundCounter(stored);
  const turnInput = {
    userText: "",
    fromNumber: "5521999999999",
    deps,
  };
  await applyTrocaPhotoAndReply(turnInput, {
    url: "https://example.com/frente.jpg",
  });
  assertEquals(counts().textSends, 1);
  assertEquals(counts().buttonSends, 0);
});

Deno.test("troca: reprompt envia uma única mensagem", async () => {
  const now = new Date().toISOString();
  const stored = {
    pending: {
      stage: "detalhe" as const,
      offset: 0,
      updated_at: now,
      form: {
        flow: "troca" as const,
        step: "fotos",
        veiculo_id: "v-troca",
        foto_slot_index: 0,
        foto_slot_retries: 1,
        fotos: [],
        updated_at: now,
      },
    } satisfies PendingVitrineEstoque,
  };
  const { deps, counts } = trocaDepsWithOutboundCounter(stored);
  await applyTrocaPhotoReprompt(
    { userText: "", fromNumber: "5521999999999", deps },
    stored.pending!.form!,
    "Pode mandar de novo a frente?",
  );
  assertEquals(counts().textSends, 1);
  assertEquals(counts().buttonSends, 0);
});

Deno.test("financiamento envia uma única mensagem ao iniciar", async () => {
  let buttonSends = 0;
  const vehicle = trocaVehicle();
  vehicle.id = "v-fin";
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
    sendText: noop,
    sendMenu: noop,
    sendButtons: async () => {
      buttonSends += 1;
      return { ok: true };
    },
    sendImage: noop,
    sendImageHeaderButtons: noop,
    sendCarousel: noop,
    encaminharRecado: async () => ({ ok: true }),
    savePending: async () => {},
    getPending: () => null,
    pause: async () => {},
    userId: "user-test",
    fetchViaCep: async () => null,
    saveFinanciamentoFicha: async () => ({ id: "ficha-1" }),
  };
  await runVehicleStockShowcaseTurn({
    userText: "<<INTERACTIVE_ID:veiculo_vitrine:acao:financiamento:v-fin>>",
    fromNumber: "5521999999999",
    forceInteractive: true,
    deps,
  });
  assertEquals(buttonSends, 1);
});
