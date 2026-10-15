import {
  assert,
  assertEquals,
  assertFalse,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  activeFaixasFromCounts,
  buildRecadoInteresse,
  buildShowcaseMenuSections,
  confirmacaoComNomeLoja,
  countVehiclesByFaixa,
  extractVitrineInteractiveId,
  formatCarouselVitrineButtonText,
  formatFichaElegante,
  formatVehicleDisplayTitle,
  isTransientVitrineSendFailure,
  registerVitrineRecadoIdempotency,
  vitrineRecadoJaEnviado,
  buildVitrineRecadoIdempotencyKey,
  isExplicitVehicleShowcaseRequest,
  isVitrineInteractiveId,
  marcaToSlug,
  resolveVitrineInboundButtonId,
  shouldEnterShowcase,
  shouldOfferVehicleShowcase,
  vehicleDisplayTitle,
  vitrineButtonId,
} from "./vehicle-stock-whatsapp.ts";

Deno.test("shouldOfferVehicleShowcase — revenda ou demo", () => {
  assert(shouldOfferVehicleShowcase({ segmento: "revenda de veículos", vitrine_veiculos_demo: false }));
  assert(shouldOfferVehicleShowcase({ segmento: "restaurante", vitrine_veiculos_demo: true }));
  assertFalse(shouldOfferVehicleShowcase({ segmento: "restaurante", vitrine_veiculos_demo: false }));
});

Deno.test("intent explícita de estoque", () => {
  const revenda = { segmento: "revenda de veículos", vitrine_veiculos_demo: false };
  assert(isExplicitVehicleShowcaseRequest("Quero ver os carros", revenda));
  assert(isExplicitVehicleShowcaseRequest("ver carros disponíveis", revenda));
  assert(isExplicitVehicleShowcaseRequest("o que tem na loja", revenda));
  assert(isExplicitVehicleShowcaseRequest("ver o estoque", revenda));
  assertFalse(isExplicitVehicleShowcaseRequest("qual a fipe do civic", revenda));
  assertFalse(isExplicitVehicleShowcaseRequest("montar carrossel do carro", revenda));
});

Deno.test("conta demo não-automotiva ignora gatilhos genéricos de loja", () => {
  const demo = { segmento: "loja de produtos", vitrine_veiculos_demo: true };
  assertFalse(isExplicitVehicleShowcaseRequest("o que tem na loja", demo));
  assertFalse(isExplicitVehicleShowcaseRequest("ver o estoque", demo));
  assert(isExplicitVehicleShowcaseRequest("ver carros", demo));
});

Deno.test("ids veiculo_vitrine", () => {
  assert(isVitrineInteractiveId("veiculo_vitrine:detalhe:abc"));
  const id = vitrineButtonId("interesse", "uuid-1");
  assertEquals(
    extractVitrineInteractiveId({
      userText: `Tenho interesse\n<<INTERACTIVE_ID:${id}>>`,
    }),
    id,
  );
});

Deno.test("carrossel type button: payload veiculo_vitrine é reconhecido", () => {
  const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
  const payload = {
    button: {
      payload: `veiculo_vitrine:detalhe:${uuid}`,
      text: "Ver detalhes",
    },
  };
  assertEquals(
    formatCarouselVitrineButtonText(payload.button),
    `Ver detalhes\n<<INTERACTIVE_ID:veiculo_vitrine:detalhe:${uuid}>>`,
  );
  assertEquals(
    extractVitrineInteractiveId({ inboundPayload: payload }),
    `veiculo_vitrine:detalhe:${uuid}`,
  );
  assertEquals(resolveVitrineInboundButtonId(payload), `veiculo_vitrine:detalhe:${uuid}`);
});

Deno.test("type button sem prefixo vitrine mantém só o texto", () => {
  const payload = { button: { payload: "OPTIN_SIM", text: "Sim, quero!" } };
  assertEquals(formatCarouselVitrineButtonText(payload.button), null);
  assertEquals(resolveVitrineInboundButtonId(payload), "OPTIN_SIM");
  assertEquals(extractVitrineInteractiveId({ inboundPayload: payload }), null);
});

Deno.test("menu inicial respeita no máximo 10 linhas", () => {
  const marcas = Array.from({ length: 20 }, (_, i) => `Marca${i}`);
  const faixas = activeFaixasFromCounts(countVehiclesByFaixa([100_000, 400_000, 800_000]));
  const { sections } = buildShowcaseMenuSections({ marcas, marcaOffset: 0, faixasAtivas: faixas });
  const totalRows = sections.reduce((n, s) => n + s.rows.length, 0);
  assert(totalRows <= 10);
  assert(sections.some((s) => s.title.includes("faixa")));
  assert(sections.some((s) => s.title.includes("marca")));
});

Deno.test("formatVehicleDisplayTitle preserva siglas curtas em caixa alta", () => {
  assertEquals(formatVehicleDisplayTitle("Cadillac SRX Luxury"), "Cadillac SRX Luxury");
  assertEquals(
    formatVehicleDisplayTitle(
      "RANGE ROVER 2.0 P300 MHEV HSE AWD Automático",
    ),
    "Range Rover 2.0 P300 MHEV HSE AWD Automático",
  );
  assertEquals(formatVehicleDisplayTitle("BMW X1 XDRIVE40I"), "BMW X1 XDRIVE40I");
});

Deno.test("vehicleDisplayTitle mantém marca cadastrada", () => {
  assertEquals(
    vehicleDisplayTitle({
      id: "1",
      marca: "BMW",
      modelo: "x1",
      versao: "xDrive40i",
      ano_fabricacao: 2022,
      ano_modelo: 2022,
      km: null,
      preco: null,
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
    }),
    "BMW x1 xDrive40i",
  );
});

Deno.test("isTransientVitrineSendFailure detecta Meta 131000 e HTTP 5xx", () => {
  assert(isTransientVitrineSendFailure({
    httpStatus: 500,
    metaError: "(#131000) Something went wrong",
  }));
  assertFalse(isTransientVitrineSendFailure({
    httpStatus: 400,
    metaError: "invalid parameter",
  }));
});

Deno.test("ficha elegante usa título normal e ícones", () => {
  const ficha = formatFichaElegante({
    id: "1",
    marca: "Porsche",
    modelo: "911",
    versao: "Carrera 3.0 PDK",
    ano_fabricacao: 2022,
    ano_modelo: 2022,
    km: 12000,
    preco: 890000,
    cor: null,
    cambio: "PDK",
    combustivel: "Gasolina",
    portas: null,
    blindado: false,
    nivel_blindagem: null,
    opcionais: ["Teto solar"],
    caracteristicas: ["Revisado"],
    descricao: null,
    fotos: [],
    status: "disponivel",
  });
  assertEquals(vehicleDisplayTitle({
    id: "1",
    marca: "Porsche",
    modelo: "911",
    versao: "Carrera 3.0 PDK",
    ano_fabricacao: 2022,
    ano_modelo: 2022,
    km: null,
    preco: null,
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
  }), "Porsche 911 Carrera 3.0 PDK");
  assertStringIncludes(ficha, "📅 Ano");
  assertStringIncludes(ficha, "✨ Opcionais");
  assertStringIncludes(ficha, "✅ Diferenciais");
  assertFalse(ficha.includes("PORSCHE 911"));
});

Deno.test("ficha blindado e descricao em formato normal", () => {
  const ficha = formatFichaElegante({
    id: "1",
    marca: "Volvo",
    modelo: "XC90",
    versao: null,
    ano_fabricacao: 2020,
    ano_modelo: 2020,
    km: 1000,
    preco: 300000,
    cor: null,
    cambio: null,
    combustivel: null,
    portas: null,
    blindado: true,
    nivel_blindagem: "Solution Place · PROTECHTOR EVO",
    opcionais: null,
    caracteristicas: null,
    descricao: "BLINDAGEM COMPLETA · VIDROS ESCUROS",
    fotos: [],
    status: "disponivel",
  });
  assertStringIncludes(ficha, "🛡️ Blindado");
  assertStringIncludes(ficha, "Blindagem Completa · Vidros Escuros");
  assertFalse(ficha.includes("BLINDAGEM COMPLETA"));
});

Deno.test("idempotência de recado bloqueia duplicata em 10 min", () => {
  const key = buildVitrineRecadoIdempotencyKey({
    acao: "visita",
    fromNumber: "5521999999999",
    veiculoId: "v1",
    diaIso: "2026-10-17",
    turno: "manha",
  });
  let pending = registerVitrineRecadoIdempotency({
    stage: "detalhe",
    offset: 0,
    updated_at: new Date().toISOString(),
  }, key);
  assert(vitrineRecadoJaEnviado(pending, key));
});

Deno.test("confirmação usa nome da loja", () => {
  assertStringIncludes(confirmacaoComNomeLoja("Auto Prime"), "Auto Prime");
});

Deno.test("ficha não inclui procedência por origem/url", () => {
  const lines = formatFichaElegante({
    id: "1",
    marca: "Honda",
    modelo: "Civic",
    versao: "EX",
    ano_fabricacao: 2020,
    ano_modelo: 2020,
    km: 10000,
    preco: 120000,
    cor: "Preto",
    cambio: "Automático",
    combustivel: "Flex",
    portas: 4,
    blindado: false,
    nivel_blindagem: null,
    opcionais: [],
    caracteristicas: [],
    descricao: "Único dono",
    fotos: [],
    status: "disponivel",
  });
  const joined = lines.toLowerCase();
  assertFalse(joined.includes("procedência"));
  assertFalse(joined.includes("origem"));
  assertStringIncludes(joined, "honda");
});

Deno.test("recado de interesse inclui carro e preço", () => {
  const recado = buildRecadoInteresse({
    contactName: "Ana",
    fromNumber: "5521999999999",
    vehicle: {
      id: "v1",
      marca: "VW",
      modelo: "Golf",
      versao: "Highline",
      ano_fabricacao: 2019,
      ano_modelo: 2019,
      km: 50000,
      preco: 95000,
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
    },
  });
  assert(recado.length >= 15);
  assertStringIncludes(recado.toLowerCase(), "interesse");
  assertStringIncludes(recado, "Golf");
  assertStringIncludes(recado, "5521999999999");
});

Deno.test("pending ativo não abre vitrine sem botão nem texto explícito", () => {
  const flags = { segmento: "revenda de veículos", vitrine_veiculos_demo: false };
  assertFalse(shouldEnterShowcase({
    flags,
    explicitText: false,
    vitrineInteractiveId: null,
  }));
  assertFalse(shouldEnterShowcase({
    flags,
    explicitText: isExplicitVehicleShowcaseRequest("aceita troca?", flags),
    vitrineInteractiveId: null,
  }));
});

Deno.test("demo exige intent explícita de veículo se segmento não automotivo", () => {
  const flags = { segmento: "padaria", vitrine_veiculos_demo: true };
  assertFalse(shouldEnterShowcase({
    flags,
    explicitText: false,
    vitrineInteractiveId: null,
  }));
  assert(shouldEnterShowcase({
    flags,
    explicitText: isExplicitVehicleShowcaseRequest("ver carros", flags),
    vitrineInteractiveId: null,
  }));
});

Deno.test("marca slug roundtrip", () => {
  assertEquals(marcaToSlug("Mercedes-Benz"), "mercedes_benz");
});
