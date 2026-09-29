import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  filterAuthorizedAudience,
  isCampaignDue,
  isInsideWhatsAppWindow,
  runConservativeCampaignBatch,
  templateSupportsImage,
} from "./whatsapp-marketing-campaign.ts";

Deno.test("janela de 24h distingue mensagens dentro, no limite e futuras", () => {
  const now = Date.parse("2026-09-28T12:00:00Z");
  assertEquals(isInsideWhatsAppWindow("2026-09-27T12:00:01Z", now), true);
  assertEquals(isInsideWhatsAppWindow("2026-09-27T12:00:00Z", now), false);
  assertEquals(isInsideWhatsAppWindow("2026-09-28T12:00:01Z", now), false);
  assertEquals(isInsideWhatsAppWindow(null, now), false);
});

Deno.test("audiência exige opt-in, respeita recusa e remove duplicados", () => {
  const result = filterAuthorizedAudience([
    { phone: "(11) 99999-0001", name: "Ana", optInStatus: "confirmado" },
    { phone: "5511999990001", name: "Ana duplicada", optInStatus: "confirmado" },
    { phone: "11 99999-0002", name: "Bia", optInStatus: "confirmado" },
    { phone: "5511999990002", name: "Bia", optInStatus: "recusado" },
    { phone: "11999990003", name: "Caio", optInStatus: "pendente" },
    { phone: "inválido", name: "Dani", optInStatus: "confirmado" },
  ]);

  assertEquals(result.recipients, [{ phone: "5511999990001", name: "Ana" }]);
  assertEquals(result.duplicates, 2);
  assertEquals(result.ignoredWithoutOptIn, 3);
});

Deno.test("campanha só fica disponível no horário agendado", () => {
  const now = Date.parse("2026-09-28T12:00:00Z");
  assertEquals(isCampaignDue("2026-09-28T11:59:59Z", now), true);
  assertEquals(isCampaignDue("2026-09-28T12:00:00Z", now), true);
  assertEquals(isCampaignDue("2026-09-28T12:00:01Z", now), false);
  assertEquals(isCampaignDue("data inválida", now), false);
});

Deno.test("template com imagem é detectado em formatos persistidos", () => {
  assertEquals(templateSupportsImage({ format: "IMAGE" }), true);
  assertEquals(templateSupportsImage('[{"tipo":"imagem"}]'), true);
  assertEquals(templateSupportsImage({ format: "TEXT" }), false);
});

Deno.test("lote respeita ritmo conservador entre destinatários", async () => {
  const waits: number[] = [];
  const result = await runConservativeCampaignBatch({
    recipients: ["a", "b", "c"],
    paceMs: 1,
    send: async () => ({ success: true }),
    sleep: async (milliseconds) => {
      waits.push(milliseconds);
    },
  });

  assertEquals(result, { processed: 3, sent: 3, failed: 0, stoppedBy: null });
  assertEquals(waits, [1_200, 1_200]);
});

Deno.test("lote para imediatamente ao receber rate limit", async () => {
  const attempted: string[] = [];
  const result = await runConservativeCampaignBatch({
    recipients: ["a", "b", "c"],
    send: async (recipient) => {
      attempted.push(recipient);
      return recipient === "b"
        ? { success: false, category: "rate_limit", reason: "Meta 429" }
        : { success: true };
    },
    sleep: async () => {},
  });

  assertEquals(attempted, ["a", "b"]);
  assertEquals(result, {
    processed: 2,
    sent: 1,
    failed: 1,
    stoppedBy: "rate_limit",
  });
});

Deno.test("falha comum é registrada sem interromper o restante do lote", async () => {
  const result = await runConservativeCampaignBatch({
    recipients: ["a", "b"],
    send: async (recipient) =>
      recipient === "a"
        ? { success: false, category: "numero", reason: "telefone inválido" }
        : { success: true },
    sleep: async () => {},
  });

  assertEquals(result, { processed: 2, sent: 1, failed: 1, stoppedBy: null });
});
