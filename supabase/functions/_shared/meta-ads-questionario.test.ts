import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  filtrarInteressesValidados,
  isMetaAdsQuestionarioCancel,
  isMetaAdsQuestionarioResume,
  metaAdsQuestionarioBudget,
  metaAdsQuestionarioContinuarButtons,
  metaAdsQuestionarioExpirado,
  novoMetaAdsQuestionario,
  questionarioAtivo,
  questionarioButtons,
  questionarioList,
  respostaPertenceAoQuestionario,
} from "./meta-ads-questionario.ts";

Deno.test("questionário avança por respostas próprias e permite cancelar", () => {
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
