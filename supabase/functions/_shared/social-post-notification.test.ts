import { assertEquals, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildScheduledPostNotification } from "./social-post-notification.ts";

const base = {
  scheduled_at: "2026-10-03T13:00:00.000Z",
  error_message: null,
  fb_post_id: null,
  notificado_em: null,
};

Deno.test("FB e Instagram publicados geram um único aviso de sucesso", () => {
  const result = buildScheduledPostNotification([
    { ...base, id: "fb", platform: "facebook", status: "publicado", fb_post_id: "123_456" },
    { ...base, id: "ig", platform: "instagram", status: "publicado" },
  ]);
  assertEquals(result?.kind, "success");
  assertMatch(result!.text, /publicado no Facebook e Instagram/);
  assertMatch(result!.text, /facebook\.com\/123_456/);
});

Deno.test("Instagram em retry pendente ainda não gera aviso", () => {
  assertEquals(buildScheduledPostNotification([
    { ...base, id: "fb", platform: "facebook", status: "publicado" },
    { ...base, id: "ig", platform: "instagram", status: "pendente" },
  ]), null);
});

Deno.test("Facebook publicado e Instagram com erro geram aviso parcial legível", () => {
  const result = buildScheduledPostNotification([
    { ...base, id: "fb", platform: "facebook", status: "publicado" },
    { ...base, id: "ig", platform: "instagram", status: "erro", error_message: "Graph API (#190): Invalid OAuth access token" },
  ]);
  assertEquals(result?.kind, "partial");
  assertMatch(result!.text, /publicado no Facebook, mas falhou no Instagram/);
  assertMatch(result!.text, /conexão com a rede social precisa ser renovada/);
  assertEquals(result!.text.includes("OAuth"), false);
});

Deno.test("grupo já notificado não gera aviso duplicado", () => {
  assertEquals(buildScheduledPostNotification([
    { ...base, id: "fb", platform: "facebook", status: "publicado", notificado_em: "2026-10-03T13:01:00Z" },
    { ...base, id: "ig", platform: "instagram", status: "publicado" },
  ]), null);
});
