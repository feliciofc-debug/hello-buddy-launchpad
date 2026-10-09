import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseNumericEnvFileKey } from "./env-file-key.ts";

const KEY = "WHATSAPP_EMBEDDED_CONFIG_ID";

Deno.test("lê somente a chave numérica solicitada", () => {
  assertEquals(
    parseNumericEnvFileKey(
      "META_SECRET=nunca-retornar\nWHATSAPP_EMBEDDED_CONFIG_ID=123456789\n",
      KEY,
    ),
    "123456789",
  );
});

Deno.test("aceita aspas simples ou duplas e export", () => {
  assertEquals(
    parseNumericEnvFileKey(
      "export WHATSAPP_EMBEDDED_CONFIG_ID='123456789' # público",
      KEY,
    ),
    "123456789",
  );
  assertEquals(
    parseNumericEnvFileKey(
      'WHATSAPP_EMBEDDED_CONFIG_ID="987654321"',
      KEY,
    ),
    "987654321",
  );
});

Deno.test("chave ausente e valor inválido retornam null", () => {
  assertEquals(parseNumericEnvFileKey("META_APP_ID=123456", KEY), null);
  assertEquals(
    parseNumericEnvFileKey(
      "WHATSAPP_EMBEDDED_CONFIG_ID=valor-nao-numerico",
      KEY,
    ),
    null,
  );
  assertEquals(
    parseNumericEnvFileKey("WHATSAPP_EMBEDDED_CONFIG_ID=1234", KEY),
    null,
  );
});

Deno.test("outras chaves e comentários são ignorados", () => {
  assertEquals(
    parseNumericEnvFileKey(
      [
        "# WHATSAPP_EMBEDDED_CONFIG_ID=111111",
        "OUTRA_CHAVE=222222",
        "WHATSAPP_EMBEDDED_CONFIG_ID=333333 # comentário",
      ].join("\n"),
      KEY,
    ),
    "333333",
  );
});
