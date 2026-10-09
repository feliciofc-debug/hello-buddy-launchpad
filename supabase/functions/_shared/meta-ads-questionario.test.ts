import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  avancarMetaAdsQuestionario,
  avaliarMetaAdsOrcamentoMinimo,
  contentCreationCommandKind,
  filtrarInteressesValidados,
  isContentCreationCommand,
  isMetaAdsQuestionarioAmbiguousRequest,
  isMetaAdsQuestionarioCancel,
  isMetaAdsLimitChangeRequest,
  isMetaAdsQuestionarioMixedContentRequest,
  isMetaAdsQuestionarioResume,
  isMetaAdsQuestionarioTrigger,
  metaAdsBudgetRecoveryButtons,
  metaAdsCommandText,
  metaAdsLimitProposalButtons,
  metaAdsMaximoDiarioParaSeteDias,
  metaAdsQuestionarioAmbiguityButtons,
  metaAdsQuestionarioBudget,
  metaAdsQuestionarioContinuarButtons,
  metaAdsQuestionarioExpirado,
  novoMetaAdsQuestionario,
  questionarioAtivo,
  questionarioButtons,
  questionarioList,
  resolveMetaAdsLimitAction,
  resolveMetaAdsLimitValueInput,
  resolveMetaAdsQuestionarioAmbiguity,
  respostaPertenceAoQuestionario,
  validarNovoLimiteMensalAnuncios,
  voltarMetaAdsQuestionarioParaOrcamento,
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
  assertEquals(
    isMetaAdsQuestionarioTrigger(
      "Crie um carrossel para o Instagram. Estrutura: gestor de tráfego cria anúncios e campanhas.",
    ),
    false,
  );
  assertEquals(
    isMetaAdsQuestionarioTrigger(
      "Crie uma campanha no Instagram para vender canecas, orçamento 20 reais por dia",
    ),
    true,
  );
  assertEquals(isMetaAdsQuestionarioTrigger("impulsiona esse post"), true);
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

Deno.test("criação de conteúdo vence palavras pagas presentes no briefing", () => {
  const request =
    `Crie um carrossel para o Instagram da AMZ Ofertas, com a identidade visual do nosso site.
Público: empresários.
Mensagem central: "A AMZ cria e gerencia campanhas."
Estrutura (6 slides):
1. Capa
4. Gestor de tráfego: cria e gerencia anúncios no Instagram.`;
  assertEquals(metaAdsCommandText(request), "crie um carrossel para o instagram da amz ofertas, com a identidade visual do nosso site");
  assertEquals(contentCreationCommandKind(request), "carousel");
  assert(isContentCreationCommand(request));
  assertEquals(isMetaAdsQuestionarioTrigger(request), false);
  assertEquals(isMetaAdsQuestionarioAmbiguousRequest(request), false);
});

Deno.test("comando com conteúdo e impulsionamento pede escolha em dois botões", () => {
  const request = "crie um carrossel e impulsione";
  assert(isMetaAdsQuestionarioMixedContentRequest(request));
  assertEquals(isMetaAdsQuestionarioTrigger(request), false);
  assert(isMetaAdsQuestionarioAmbiguousRequest(request));
  assertEquals(
    metaAdsQuestionarioAmbiguityButtons(request).buttons.map((button) =>
      button.title
    ),
    ["Criar carrossel", "Criar campanha paga"],
  );
});

Deno.test("cancelamento reconhece saídas em linguagem natural", () => {
  for (const text of ["cancelar", "sair", "não é isso", "Não é isso."]) {
    assert(isMetaAdsQuestionarioCancel(text));
  }
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

Deno.test("excesso na duração oferece recuperação e volta ao orçamento", () => {
  const buttons = metaAdsBudgetRecoveryButtons(false);
  assertEquals(buttons.buttons.map((button) => button.title), [
    "Mudar orçamento",
    "Aumentar limite",
    "Cancelar",
  ]);
  const durationState = {
    ...novoMetaAdsQuestionario(new Date("2026-10-05T12:00:00.000Z")),
    etapa: "duracao" as const,
    cidade: { id: "1", name: "Niterói" },
    orcamento_diario: 10,
  };
  const changed = voltarMetaAdsQuestionarioParaOrcamento(
    durationState,
    new Date("2026-10-05T12:01:00.000Z"),
  );
  assertEquals(changed.etapa, "orcamento");
  assertEquals(changed.cidade, durationState.cidade);
  assertEquals(changed.orcamento_diario, 10);
  assertEquals(metaAdsMaximoDiarioParaSeteDias(20), 2);
});

Deno.test("orçamento que não cabe em sete dias é recusado imediatamente", () => {
  assertEquals(avaliarMetaAdsOrcamentoMinimo({
    daily: 10,
    available: 20,
  }), {
    ok: false,
    exhausted: false,
    maximumDaily: 2,
    available: 20,
  });
  assertEquals(avaliarMetaAdsOrcamentoMinimo({
    daily: 2,
    available: 20,
  }).ok, true);
});

Deno.test("limite mensal esgotado oferece somente aumentar ou cancelar", () => {
  assertEquals(avaliarMetaAdsOrcamentoMinimo({
    daily: 1,
    available: 6.99,
  }).exhausted, true);
  assertEquals(
    metaAdsBudgetRecoveryButtons(true).buttons.map((button) => button.title),
    ["Aumentar limite", "Cancelar"],
  );
});

Deno.test("espera do novo limite só captura mensagem com número", () => {
  const pending = { criado_em: "2026-10-05T12:00:00.000Z" };
  assertEquals(resolveMetaAdsLimitValueInput({
    text: "bom dia",
    pending,
    isOwner: true,
    now: new Date("2026-10-05T12:01:00.000Z"),
  }), "clear");
  assertEquals(resolveMetaAdsLimitValueInput({
    text: "300",
    pending,
    isOwner: true,
    now: new Date("2026-10-05T12:01:00.000Z"),
  }), "consume");
  assertEquals(resolveMetaAdsLimitValueInput({
    text: "O novo limite pode ser 300 reais",
    pending,
    isOwner: true,
    now: new Date("2026-10-05T12:01:00.000Z"),
  }), "consume");
});
