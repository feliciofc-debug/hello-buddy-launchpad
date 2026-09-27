import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  canUseAmbiguousPendingReply,
  classifyExplicitPendingPostCommand,
  isPendingInteractionRecent,
  requiresOldPendingPublishConfirmation,
} from "./social-pending-window.ts";

const now = new Date("2026-09-27T15:00:00.000Z");

Deno.test("resposta curta só pode usar pendente recente", () => {
  const recent = isPendingInteractionRecent("2026-09-27T14:55:00.000Z", null, now);
  const old = isPendingInteractionRecent("2026-09-27T13:00:00.000Z", null, now);
  assertEquals(canUseAmbiguousPendingReply(recent), true);
  assertEquals(canUseAmbiguousPendingReply(old), false);
});

Deno.test("updated_at recente reabre a janela curta", () => {
  assertEquals(
    isPendingInteractionRecent(
      "2026-09-27T10:00:00.000Z",
      "2026-09-27T14:50:00.000Z",
      now,
    ),
    true,
  );
});

Deno.test("comandos explícitos isolados recuperam pendente antigo", () => {
  assertEquals(classifyExplicitPendingPostCommand("publicar agora"), "publish");
  assertEquals(classifyExplicitPendingPostCommand("agendar 30/09 às 10h"), "schedule");
  assertEquals(classifyExplicitPendingPostCommand("agendar"), "schedule");
});

Deno.test("botão publicar de pendente antigo exige nova confirmação", () => {
  assertEquals(requiresOldPendingPublishConfirmation(false), true);
  assertEquals(requiresOldPendingPublishConfirmation(true), false);
});

Deno.test("ligação e outros compromissos não são interceptados como post", () => {
  assertEquals(
    classifyExplicitPendingPostCommand("agenda uma ligação com o fornecedor amanhã às 10h"),
    null,
  );
});

Deno.test("mídia nova nunca aciona comando sobre pendente anterior", () => {
  assertEquals(canUseAmbiguousPendingReply(true, true), false);
  assertEquals(
    classifyExplicitPendingPostCommand("pode postar", true),
    null,
  );
  assertEquals(
    classifyExplicitPendingPostCommand("pode postar essa foto no Instagram"),
    null,
  );
  assertEquals(
    classifyExplicitPendingPostCommand("postar agora no Instagram"),
    null,
  );
});
