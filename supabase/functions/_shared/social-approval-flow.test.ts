import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  canRunSocialPostAction,
  selectSocialVariantScripts,
  socialApprovalButtons,
  socialInteractiveButtonsFromResult,
  type SocialVariantChoice,
} from "./social-approval-flow.ts";

Deno.test("Agendar antes de escolher A/B/C fica bloqueado", () => {
  let selected: SocialVariantChoice | undefined;
  assertEquals(canRunSocialPostAction(selected), false);
  assertEquals(socialApprovalButtons(selected), [
    "variant_A",
    "variant_B",
    "variant_C",
  ]);
});

Deno.test("escolher B libera publicar/agendar e mantém B", () => {
  let selected: SocialVariantChoice | undefined;
  selected = "B";
  const variants = {
    A: "Texto da opção A",
    B: "Texto da opção B",
    C: "Texto da opção C",
  };

  assertEquals(canRunSocialPostAction(selected), true);
  assertEquals(selected, "B");
  assertEquals(
    selectSocialVariantScripts(variants, selected),
    "Texto da opção B",
  );
  assertEquals(socialApprovalButtons(selected), ["publish", "schedule"]);
});

Deno.test("Story escolhido oferece somente publicar agora", () => {
  assertEquals(socialApprovalButtons("C", true), ["publish"]);
});

Deno.test("carrossel recebe botões A/B/C e depois ações de publicar ou agendar", () => {
  const token = "abcd1234";
  const carouselPreview = JSON.stringify({
    status: "aguardando_escolha_variante",
    carrossel: true,
    token,
  });
  assertEquals(
    socialInteractiveButtonsFromResult(carouselPreview)?.buttons,
    [
      { id: `social_variant:A:${token}`, title: "Opção A" },
      { id: `social_variant:B:${token}`, title: "Opção B" },
      { id: `social_variant:C:${token}`, title: "Opção C" },
    ],
  );

  const selectedB = JSON.stringify({
    status: "variante_selecionada",
    carrossel: true,
    token,
    opcao_ativa: "B",
  });
  assertEquals(
    socialInteractiveButtonsFromResult(selectedB)?.buttons,
    [
      { id: `social_publish:${token}`, title: "Publicar agora" },
      { id: `social_schedule:${token}`, title: "Agendar" },
    ],
  );
});

Deno.test("prévia exclusiva do LinkedIn exige A/B/C antes de publicar", () => {
  const preview = JSON.stringify({
    status: "aguardando_escolha_variante",
    token: "abcd1234",
    redes: ["linkedin"],
    variantes: {
      linkedin: {
        A: "Copy A profissional",
        B: "Copy B profissional",
        C: "Copy C profissional",
      },
    },
  });
  assertEquals(
    socialInteractiveButtonsFromResult(preview)?.buttons,
    [
      { id: "social_variant:A:abcd1234", title: "Opção A" },
      { id: "social_variant:B:abcd1234", title: "Opção B" },
      { id: "social_variant:C:abcd1234", title: "Opção C" },
    ],
  );
});
