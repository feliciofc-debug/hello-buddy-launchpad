import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  apiKeyUltimos4,
  decryptProcedenciaApiKey,
  encryptProcedenciaApiKey,
  PROCEDENCIA_ENC_KEY_CLIENT_ERROR,
  resetProcedenciaEncKeyCache,
} from "./procedencia-enc-crypto.ts";

function keyB64(fill: number): string {
  return btoa(String.fromCharCode(...new Uint8Array(32).fill(fill)));
}

Deno.test("procedencia encrypt roundtrip (env)", async () => {
  resetProcedenciaEncKeyCache();
  Deno.env.set("PROCEDENCIA_ENC_KEY", keyB64(7));
  const enc = await encryptProcedenciaApiKey("sk-test-12345678");
  assertEquals(apiKeyUltimos4("sk-test-12345678"), "5678");
  const dec = await decryptProcedenciaApiKey(enc);
  assertEquals(dec, "sk-test-12345678");
});

Deno.test("env tem prioridade sobre arquivo", async () => {
  resetProcedenciaEncKeyCache();
  const dir = await Deno.makeTempDir();
  const filePath = `${dir}/key.txt`;
  await Deno.writeTextFile(filePath, keyB64(1));
  Deno.env.set("PROCEDENCIA_ENC_KEY_FILE", filePath);
  Deno.env.set("PROCEDENCIA_ENC_KEY", keyB64(9));

  const enc = await encryptProcedenciaApiKey("prioridade-env");
  resetProcedenciaEncKeyCache();
  Deno.env.delete("PROCEDENCIA_ENC_KEY");
  const decFromFileKey = await decryptProcedenciaApiKey(enc).catch(() => null);
  assertEquals(decFromFileKey, null);

  resetProcedenciaEncKeyCache();
  Deno.env.set("PROCEDENCIA_ENC_KEY", keyB64(9));
  assertEquals(await decryptProcedenciaApiKey(enc), "prioridade-env");

  Deno.env.delete("PROCEDENCIA_ENC_KEY");
  Deno.env.delete("PROCEDENCIA_ENC_KEY_FILE");
  await Deno.remove(dir, { recursive: true });
});

Deno.test("lê chave do arquivo quando env ausente", async () => {
  resetProcedenciaEncKeyCache();
  Deno.env.delete("PROCEDENCIA_ENC_KEY");
  const dir = await Deno.makeTempDir();
  const filePath = `${dir}/procedencia_enc_key`;
  await Deno.writeTextFile(filePath, `  ${keyB64(3)}  \n`);
  Deno.env.set("PROCEDENCIA_ENC_KEY_FILE", filePath);

  const enc = await encryptProcedenciaApiKey("do-arquivo");
  resetProcedenciaEncKeyCache();
  Deno.env.set("PROCEDENCIA_ENC_KEY", keyB64(3));
  assertEquals(await decryptProcedenciaApiKey(enc), "do-arquivo");

  Deno.env.delete("PROCEDENCIA_ENC_KEY");
  Deno.env.delete("PROCEDENCIA_ENC_KEY_FILE");
  await Deno.remove(dir, { recursive: true });
});

Deno.test("chave inválida → erro genérico ao cliente", async () => {
  resetProcedenciaEncKeyCache();
  Deno.env.set("PROCEDENCIA_ENC_KEY", btoa("curta"));
  await assertRejects(
    () => encryptProcedenciaApiKey("x"),
    Error,
    PROCEDENCIA_ENC_KEY_CLIENT_ERROR,
  );
  Deno.env.delete("PROCEDENCIA_ENC_KEY");
});
