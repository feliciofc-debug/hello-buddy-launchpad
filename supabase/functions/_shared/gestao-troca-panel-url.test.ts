import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildGestaoTrocaFichaPanelUrl,
  GESTAO_TROCA_FICHA_PATH_PREFIX,
} from "./gestao-troca-panel-url.ts";

const TROCA_ID = "00000000-0000-4000-8000-000000000099";

Deno.test("FIX-VEIC-3 B10b — rota da ficha existe no App.tsx", async () => {
  const appTsx = await Deno.readTextFile(
    new URL("../../../src/App.tsx", import.meta.url),
  );
  assert(
    appTsx.includes('path="/gestao/trocas/:id"'),
    "React router must expose gestao/trocas/:id",
  );
  assertEquals(GESTAO_TROCA_FICHA_PATH_PREFIX, "/gestao/trocas");
});

Deno.test("FIX-VEIC-3 B10b — link absoluto usa origem pública (www por padrão)", () => {
  assertEquals(
    buildGestaoTrocaFichaPanelUrl(TROCA_ID, "https://www.amzofertas.com.br"),
    `https://www.amzofertas.com.br/gestao/trocas/${TROCA_ID}`,
  );
  assertEquals(
    buildGestaoTrocaFichaPanelUrl(TROCA_ID, "https://app.test/"),
    `https://app.test/gestao/trocas/${TROCA_ID}`,
  );
});
