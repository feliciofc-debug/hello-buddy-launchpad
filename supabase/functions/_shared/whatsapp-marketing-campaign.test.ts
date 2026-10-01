import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  campaignTenantId,
  claimQueuedCampaignRecipient,
  filterAuthorizedAudience,
  filterSelectedAuthorizedAudience,
  isCampaignDue,
  isInsideWhatsAppWindow,
  isRateLimitAutoResumeDue,
  isRecipientSendingStale,
  nextCampaignDeliveryStatus,
  runConservativeCampaignBatch,
  templateMatchesCampaignMedia,
  templateSupportsImage,
} from "./whatsapp-marketing-campaign.ts";

Deno.test("tenant da campanha sempre vem do usuário autenticado", () => {
  assertEquals(
    campaignTenantId("tenant-do-jwt", "tenant-enviado-pelo-frontend"),
    "tenant-do-jwt",
  );
});

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

Deno.test("recusa prevalece entre variantes com e sem nono dígito", () => {
  const result = filterAuthorizedAudience([
    { phone: "5521967520706", name: "Contato", optInStatus: "confirmado" },
    { phone: "552167520706", name: "Contato", optInStatus: "recusado" },
  ]);

  assertEquals(result.recipients, []);
  assertEquals(result.duplicates, 1);
  assertEquals(result.ignoredWithoutOptIn, 1);
});

Deno.test("seleção só da janela usa apenas o telefone autorizado escolhido", () => {
  const result = filterSelectedAuthorizedAudience([
    {
      phone: "5511999990001",
      name: "Dentro da janela",
      optInStatus: "confirmado",
    },
    {
      phone: "5511999990002",
      name: "Fora da janela",
      optInStatus: "confirmado",
    },
  ], ["5511999990001"]);
  assertEquals(result.recipients, [{
    phone: "5511999990001",
    name: "Dentro da janela",
  }]);
});

Deno.test("servidor bloqueia contato selecionado sem autorização", () => {
  assertThrows(
    () =>
      filterSelectedAuthorizedAudience([
        {
          phone: "5511999990001",
          name: "Sem opt-in",
          optInStatus: "pendente",
        },
      ], ["5511999990001"]),
    Error,
    "contato_sem_autorizacao",
  );
});

Deno.test("servidor bloqueia número selecionado que não pertence à lista", () => {
  assertThrows(
    () =>
      filterSelectedAuthorizedAudience([
        {
          phone: "5511999990001",
          name: "Membro",
          optInStatus: "confirmado",
        },
      ], ["5511999999999"]),
    Error,
    "contato_nao_pertence_a_lista",
  );
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
  assertEquals(templateMatchesCampaignMedia({ format: "IMAGE" }, true), true);
  assertEquals(templateMatchesCampaignMedia({ format: "IMAGE" }, false), false);
  assertEquals(templateMatchesCampaignMedia({ format: "TEXT" }, false), true);
  assertEquals(templateMatchesCampaignMedia({ format: "TEXT" }, true), false);
});

Deno.test("claim concorrente permite um único worker enviar", async () => {
  let status = "queued";
  const admin = {
    from: () => ({
      update: () => {
        let expectedStatus = "";
        const query = {
          eq: (column: string, value: string) => {
            if (column === "status") expectedStatus = value;
            return query;
          },
          select: () => ({
            maybeSingle: async () => {
              if (status !== expectedStatus) return { data: null, error: null };
              status = "sending";
              return { data: { id: "recipient-1" }, error: null };
            },
          }),
        };
        return query;
      },
    }),
  };

  const [first, second] = await Promise.all([
    claimQueuedCampaignRecipient(admin, "recipient-1", 1),
    claimQueuedCampaignRecipient(admin, "recipient-1", 1),
  ]);
  assertEquals([first, second].filter(Boolean).length, 1);
});

Deno.test("recipient sending há mais de 15 minutos fica obsoleto", () => {
  const now = Date.parse("2026-09-29T12:00:00Z");
  assertEquals(
    isRecipientSendingStale("2026-09-29T11:44:59Z", now),
    true,
  );
  assertEquals(
    isRecipientSendingStale("2026-09-29T11:45:01Z", now),
    false,
  );
});

Deno.test("webhook não rebaixa read para delivered", () => {
  assertEquals(nextCampaignDeliveryStatus("sent", "delivered"), "delivered");
  assertEquals(nextCampaignDeliveryStatus("delivered", "read"), "read");
  assertEquals(nextCampaignDeliveryStatus("read", "delivered"), null);
  assertEquals(nextCampaignDeliveryStatus("read", "failed"), null);
  assertEquals(nextCampaignDeliveryStatus("sent", "failed"), "failed");
});

Deno.test("rate limit retoma automaticamente somente depois de 30 minutos", () => {
  const now = Date.parse("2026-09-29T12:00:00Z");
  assertEquals(
    isRateLimitAutoResumeDue(
      "rate_limit",
      "2026-09-29T11:29:59Z",
      now,
    ),
    true,
  );
  assertEquals(
    isRateLimitAutoResumeDue(
      "rate_limit",
      "2026-09-29T11:30:01Z",
      now,
    ),
    false,
  );
  assertEquals(
    isRateLimitAutoResumeDue("quality", "2026-09-29T10:00:00Z", now),
    false,
  );
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
