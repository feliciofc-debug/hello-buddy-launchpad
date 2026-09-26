import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  canRunSocialPostAction,
  selectSocialVariantScripts,
  socialApprovalButtons,
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
