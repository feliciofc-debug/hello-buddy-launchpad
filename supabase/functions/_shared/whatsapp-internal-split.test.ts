import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  splitInternalWhatsAppMessage,
  stripInternalWhatsAppSplit,
} from "./whatsapp-internal-split.ts";

Deno.test("delimitador interno vira partes e nunca chega ao transporte", () => {
  const source = "Preparei 3 opções 👇<<SPLIT>>Opção A";
  assertEquals(splitInternalWhatsAppMessage(source), [
    "Preparei 3 opções 👇",
    "Opção A",
  ]);
  const safe = stripInternalWhatsAppSplit(source);
  assertEquals(safe.includes("<<SPLIT>>"), false);
  assertEquals(safe, "Preparei 3 opções 👇\n\nOpção A");
});
