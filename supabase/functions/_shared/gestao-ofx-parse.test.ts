import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseGestaoOfx } from "./gestao-ofx-parse.ts";

Deno.test("parse OFX Nubank sample", async () => {
  const raw = await Deno.readTextFile(new URL("./fixtures/ofx-nubank-sample.ofx", import.meta.url));
  const rows = parseGestaoOfx(raw);
  assertEquals(rows.length, 2);
  assertEquals(rows[0].valor, 3000);
  assertEquals(rows[0].sentido, "debito");
  assertEquals(rows[0].fitid, "NUB20260410001");
});

Deno.test("parse OFX Itaú sample", async () => {
  const raw = await Deno.readTextFile(new URL("./fixtures/ofx-itau-sample.ofx", import.meta.url));
  const rows = parseGestaoOfx(raw);
  assertEquals(rows.length, 2);
  assertEquals(rows[1].sentido, "credito");
  assertEquals(rows[1].valor, 1200);
});
