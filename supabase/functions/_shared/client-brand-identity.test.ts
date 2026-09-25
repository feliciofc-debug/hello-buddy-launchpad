import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  extractClientNameFromLogoRequest,
  normalizeClientBrandName,
} from "./client-brand-identity.ts";

Deno.test("extrai cliente citado no pedido de guardar logo", () => {
  assertEquals(
    extractClientNameFromLogoRequest(
      "esse e o logo do Casarao Lustres, guarda ele para usar nos videos e posts desse cliente",
    ),
    "Casarao Lustres",
  );
  assertEquals(
    extractClientNameFromLogoRequest("Salva esta logomarca da Clínica São José para os vídeos"),
    "Clínica São José",
  );
});

Deno.test("não inventa cliente quando o pedido de logo não informa nome", () => {
  assertEquals(extractClientNameFromLogoRequest("guarda esse logo do cliente"), null);
  assertEquals(extractClientNameFromLogoRequest("guarda esta imagem"), null);
});

Deno.test("normaliza nome para correspondência com domínio", () => {
  assertEquals(normalizeClientBrandName("Casarão Lustres"), "casaraolustres");
});
