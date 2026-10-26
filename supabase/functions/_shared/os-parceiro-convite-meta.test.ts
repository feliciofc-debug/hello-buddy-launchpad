import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  extractOsCotacaoWaButtonId,
  parseOsCotacaoConvitePayload,
} from "./os-parceiro-interactive.ts";

const COTACAO_ID = "123e4567-e89b-42d3-a456-426614174000";

Deno.test("COTACAO-WPP-1.2 — payload do botão de convite é roteado", () => {
  const payload = `os_cot_wa:aceite:${COTACAO_ID}`;
  assertEquals(extractOsCotacaoWaButtonId({ button: { payload } }), payload);
  assertEquals(parseOsCotacaoConvitePayload(payload), {
    action: "aceite",
    cotacaoId: COTACAO_ID,
  });
  assertEquals(
    parseOsCotacaoConvitePayload(`os_cot_wa:sem_agenda:${COTACAO_ID}`)?.action,
    "sem_agenda",
  );
  assertEquals(parseOsCotacaoConvitePayload("campanha:quero"), null);
});

Deno.test("COTACAO-WPP-1.2 — submit preserva convite opt-in e campanha", async () => {
  const submit = await Deno.readTextFile(new URL(
    "../whatsapp-template-submit/index.ts",
    import.meta.url,
  ));
  assertStringIncludes(submit, 'tpl.tipo_uso === "convite_optin"');
  assertStringIncludes(submit, '"Sim, quero!"');
  assertStringIncludes(submit, 'Array.isArray(tpl.botoes)');
  assertStringIncludes(submit, '"QUICK_REPLY"');
});

Deno.test("COTACAO-WPP-1.2 — ativação é idempotente e usa env por loja", async () => {
  const activate = await Deno.readTextFile(new URL(
    "../gestao-os-cotacao-template-activate/index.ts",
    import.meta.url,
  ));
  assertStringIncludes(activate, "OS_COTACAO_CONVITE_TEMPLATE_NOME");
  assertStringIncludes(activate, ".maybeSingle()");
  assertStringIncludes(activate, 'tipo_uso: "transacional"');
  assertStringIncludes(activate, '"Sim, pode enviar"');
  assertStringIncludes(activate, '"Não tenho agenda"');
});

Deno.test("COTACAO-WPP-1.2 — envio convite e aceite disparam PDF direto", async () => {
  const envio = await Deno.readTextFile(new URL(
    "./os-parceiro-whatsapp-envio.ts",
    import.meta.url,
  ));
  const inbound = await Deno.readTextFile(new URL(
    "./os-parceiro-inbound.ts",
    import.meta.url,
  ));
  assertStringIncludes(envio, '"convite_enviado"');
  assertStringIncludes(envio, "OS_COTACAO_CONVITE_TEMPLATE_NOME");
  assertStringIncludes(envio, "quick_reply_payloads");
  assertStringIncludes(inbound, "enviarPedidoAposAceite");
  assertStringIncludes(inbound, "force_direct: true");
  assertStringIncludes(inbound, "aceitou receber o pedido");
  assertStringIncludes(inbound, "conviteTextAction");
});

Deno.test("COTACAO-WPP-1.2 — processor inclui apenas button no gancho parceiro", async () => {
  const processor = await Deno.readTextFile(new URL(
    "../whatsapp-cloud-inbound-processor/index.ts",
    import.meta.url,
  ));
  const marker = "// COTACAO-WPP-1: parceiro";
  const start = processor.indexOf(marker);
  const block = processor.slice(start, start + 900);
  assertStringIncludes(block, 'row.message_type === "button"');
  assertStringIncludes(block, "tryProcessOsParceiroCotacaoWhatsAppShortcut");
});

Deno.test("COTACAO-WPP-1.2 — migration aceita convite_enviado", async () => {
  const sql = await Deno.readTextFile(new URL(
    "../../migrations/20261032268000_gestao_os_cotacao_convite_meta.sql",
    import.meta.url,
  ));
  assertStringIncludes(sql, "'convite_enviado'");
});
