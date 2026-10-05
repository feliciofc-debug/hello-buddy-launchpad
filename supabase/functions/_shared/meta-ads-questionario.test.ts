import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  avancarMetaAdsQuestionario,
  filtrarInteressesValidados,
  isMetaAdsQuestionarioAmbiguousRequest,
  isMetaAdsQuestionarioCancel,
  isMetaAdsLimitChangeRequest,
  isMetaAdsQuestionarioResume,
  isMetaAdsQuestionarioTrigger,
  metaAdsLimitProposalButtons,
  metaAdsQuestionarioAmbiguityButtons,
  metaAdsQuestionarioBudget,
  metaAdsQuestionarioContinuarButtons,
  metaAdsQuestionarioExpirado,
  novoMetaAdsQuestionario,
  questionarioAtivo,
  questionarioButtons,
  questionarioList,
  resolveMetaAdsLimitAction,
  resolveMetaAdsQuestionarioAmbiguity,
  respostaPertenceAoQuestionario,
  validarNovoLimiteMensalAnuncios,
} from "./meta-ads-questionario.ts";

Deno.test("questionário avança por respostas próprias e permite cancelar", () => {
  const initial = novoMetaAdsQuestionario(
    new Date("2026-10-03T12:00:00.000Z"),
  );
  const audience = avancarMetaAdsQuestionario(
    initial,
    "publico",
    { objetivo: "whatsapp" },
    new Date("2026-10-03T12:01:00.000Z"),
  );
  const city = avancarMetaAdsQuestionario(
    audience,
    "cidade",
    { interesses: [] },
    new Date("2026-10-03T12:02:00.000Z"),
  );
  assertEquals(initial.etapa, "objetivo");
  assertEquals(audience.etapa, "publico");
  assertEquals(city.etapa, "cidade");
  assertEquals(city.objetivo, "whatsapp");
  assertEquals(city.criado_em, initial.criado_em);
  assert(respostaPertenceAoQuestionario(
    "Conversas\n<<INTERACTIVE_ID:meta_ads_q:objetivo:whatsapp>>",
    "objetivo",
  ));
  assert(respostaPertenceAoQuestionario("Niterói", "cidade"));
  assert(isMetaAdsQuestionarioCancel("Cancelar"));
  assert(isMetaAdsQuestionarioCancel(
    "Cancelar\n<<INTERACTIVE_ID:meta_ads_q:cancelar>>",
  ));
});

Deno.test("questionário expira em 24 horas e ignora rascunho expirado", () => {
  const now = new Date("2026-10-03T15:00:00.000Z");
  const active = novoMetaAdsQuestionario(
    new Date("2026-10-02T15:00:01.000Z"),
  );
  const expired = novoMetaAdsQuestionario(
    new Date("2026-10-02T14:59:59.000Z"),
  );
  assertEquals(metaAdsQuestionarioExpirado(active, now), false);
  assertEquals(metaAdsQuestionarioExpirado(expired, now), true);
  assertEquals(questionarioAtivo([
    {
      id: "expired",
      status: "rascunho",
      criado_em: expired.criado_em,
      rascunho: { questionario: expired },
    },
    {
      id: "active",
      status: "rascunho",
      criado_em: active.criado_em,
      rascunho: { questionario: active },
    },
  ], now)?.id, "active");
});

Deno.test("mudança de assunto não avança e botão retoma questionário", () => {
  assertEquals(
    respostaPertenceAoQuestionario("Como está o relatório de hoje?", "objetivo"),
    false,
  );
  assertEquals(
    respostaPertenceAoQuestionario("Me manda o relatório da campanha", "cidade"),
    false,
  );
  assertEquals(respostaPertenceAoQuestionario("Niterói, RJ", "cidade"), true);
  assert(isMetaAdsQuestionarioResume(
    "Continuar campanha\n<<INTERACTIVE_ID:meta_ads_q:continuar>>",
  ));
  const buttons = metaAdsQuestionarioContinuarButtons();
  assertEquals(buttons.buttons[0].title, "Continuar campanha");
});

Deno.test("interesses inexistentes são descartados", () => {
  const result = filtrarInteressesValidados(
    ["Odontologia", "Estética dental", "Interesse inventado"],
    [
      { id: "1", name: "Odontologia" },
      { id: "2", name: "Estética dental" },
      { id: "3", name: "Futebol" },
    ],
  );
  assertEquals(result, [
    { id: "1", name: "Odontologia" },
    { id: "2", name: "Estética dental" },
  ]);
});

Deno.test("teto mensal bloqueia orçamento que excede o disponível", () => {
  assertEquals(metaAdsQuestionarioBudget({
    daily: 20,
    duration: 15,
    available: 250,
  }), { ok: false, maximumSpend: 300, available: 250 });
  assertEquals(metaAdsQuestionarioBudget({
    daily: 10,
    duration: 15,
    available: 250,
  }), { ok: true, maximumSpend: 150 });
});

Deno.test("listas e botões respeitam limites do WhatsApp", () => {
  const list = questionarioList({
    body: "Escolha",
    rows: Array.from({ length: 12 }, (_, index) => ({
      id: `id-${index}`,
      title: `Título extremamente comprido ${index}`,
    })),
  });
  assertEquals(list.rows.length, 10);
  assert(list.rows.every((row) => row.title.length <= 24));

  const buttons = questionarioButtons({
    body: "Escolha",
    buttons: Array.from({ length: 5 }, (_, index) => ({
      id: `id-${index}`,
      title: `Botão extremamente longo ${index}`,
    })),
  });
  assertEquals(buttons.buttons.length, 3);
  assert(buttons.buttons.every((button) => button.title.length <= 20));
});

Deno.test("gatilho exige intenção clara de anúncio pago", () => {
  assertEquals(
    isMetaAdsQuestionarioTrigger("cria um anúncio desse produto"),
    false,
  );
  assertEquals(
    isMetaAdsQuestionarioTrigger("quero anunciar no Instagram"),
    true,
  );
  assertEquals(
    isMetaAdsQuestionarioTrigger("quero anunciar esta foto no Instagram"),
    true,
  );
  assertEquals(
    isMetaAdsQuestionarioTrigger("quero saber da campanha"),
    false,
  );
  assertEquals(
    isMetaAdsQuestionarioTrigger("como está minha campanha no Meta Ads?"),
    false,
  );
  assertEquals(
    isMetaAdsQuestionarioTrigger("quero uma campanha de WhatsApp"),
    false,
  );
});

Deno.test("pedido ambíguo oferece três caminhos", () => {
  assert(isMetaAdsQuestionarioAmbiguousRequest(
    "cria um anúncio desse produto",
  ));
  const buttons = metaAdsQuestionarioAmbiguityButtons();
  assertEquals(buttons.buttons.map((button) => button.title), [
    "Anúncio pago (Meta)",
    "Arte de anúncio",
    "Outra coisa",
  ]);
});

Deno.test("Arte de anúncio volta ao Jarvis com o pedido original", () => {
  const pending = {
    texto_original: "cria um anúncio desse produto",
    criado_em: "2026-10-05T12:00:00.000Z",
  };
  const choice = resolveMetaAdsQuestionarioAmbiguity({
    text:
      "Arte de anúncio\n<<INTERACTIVE_ID:meta_ads_q:ambiguidade:arte>>",
    pending,
    now: new Date("2026-10-05T12:01:00.000Z"),
  });
  assertEquals(choice, {
    destino: "jarvis",
    textoOriginal: "cria um anúncio desse produto",
  });
  assertEquals(
    isMetaAdsQuestionarioTrigger(
      "Anúncio pago (Meta)\n<<INTERACTIVE_ID:meta_ads_q:ambiguidade:meta>>",
    ),
    true,
  );
});

Deno.test("limite mensal aceita somente valores de R$ 50 a R$ 10.000", () => {
  assert(isMetaAdsLimitChangeRequest(
    "quero aumentar meu limite mensal de anúncios para 300",
  ));
  assertEquals(validarNovoLimiteMensalAnuncios(49.99), null);
  assertEquals(validarNovoLimiteMensalAnuncios(50), 50);
  assertEquals(validarNovoLimiteMensalAnuncios("R$ 300,00"), 300);
  assertEquals(validarNovoLimiteMensalAnuncios(10_000), 10_000);
  assertEquals(validarNovoLimiteMensalAnuncios(10_000.01), null);
});

Deno.test("alteração de limite exige dono e botão vinculado à proposta", () => {
  const proposal = {
    token: "abc123",
    limite_atual: 200,
    novo_limite: 300,
    gasto_mes: 80,
    criado_em: "2026-10-05T12:00:00.000Z",
  };
  const confirmation =
    "Confirmar\n<<INTERACTIVE_ID:meta_ads_limit:confirm:abc123>>";
  assertEquals(resolveMetaAdsLimitAction({
    text: confirmation,
    pending: proposal,
    isOwner: false,
    now: new Date("2026-10-05T12:01:00.000Z"),
  }), null);
  assertEquals(resolveMetaAdsLimitAction({
    text: "Confirmar",
    pending: proposal,
    isOwner: true,
    now: new Date("2026-10-05T12:01:00.000Z"),
  }), null);
  assertEquals(resolveMetaAdsLimitAction({
    text:
      "Confirmar\n<<INTERACTIVE_ID:meta_ads_limit:confirm:outra-proposta>>",
    pending: proposal,
    isOwner: true,
    now: new Date("2026-10-05T12:01:00.000Z"),
  }), null);
  assertEquals(resolveMetaAdsLimitAction({
    text: confirmation,
    pending: proposal,
    isOwner: true,
    now: new Date("2026-10-05T12:01:00.000Z"),
  }), { action: "confirm", proposal });
  assertEquals(metaAdsLimitProposalButtons(proposal.token).buttons.map((
    button,
  ) => button.title), ["Confirmar", "Cancelar"]);
});
