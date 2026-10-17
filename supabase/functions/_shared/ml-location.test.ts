import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  formatBrazilCep,
  hasPublishableMlLocation,
  mlLocationToPersistAfterOAuth,
  normalizeBrazilCep,
  parseMlZipCodeApiResponse,
} from "./ml-location.ts";

Deno.test("normalizeBrazilCep aceita máscara e rejeita tamanho errado", () => {
  assertEquals(normalizeBrazilCep("01310-100"), "01310100");
  assertEquals(normalizeBrazilCep("01310100"), "01310100");
  assertEquals(normalizeBrazilCep("0131"), null);
  assertEquals(normalizeBrazilCep(""), null);
});

Deno.test("formatBrazilCep", () => {
  assertEquals(formatBrazilCep("01310100"), "01310-100");
});

Deno.test("parseMlZipCodeApiResponse monta city/state/neighborhood/zip", () => {
  const parsed = parseMlZipCodeApiResponse({
    zip_code: "01310-100",
    city: { id: "TUxBQ1NBQ1oyMDVk", name: "São Paulo" },
    state: { id: "TUxBUEFTQzEwNzQ3NQ", name: "São Paulo" },
    country: { id: "BR", name: "Brasil" },
    neighborhood: { id: "TUxBQkJFTjE5NDda", name: "Bela Vista" },
  });
  assert(parsed);
  assertEquals(parsed!.source, "tenant_override");
  assertEquals(parsed!.location?.zip_code, "01310100");
  assertEquals(parsed!.location?.city?.id, "TUxBQ1NBQ1oyMDVk");
  assertEquals(parsed!.location?.state?.id, "TUxBUEFTQzEwNzQ3NQ");
  assertEquals(parsed!.location?.neighborhood?.id, "TUxBQkJFTjE5NDda");
  assert(hasPublishableMlLocation(parsed));
});

Deno.test("parseMlZipCodeApiResponse lê neighborhood em extended_attributes", () => {
  const parsed = parseMlZipCodeApiResponse({
    zip_code: "7167",
    city: { id: null, name: null },
    state: { id: "AR-B", name: "Buenos Aires" },
    country: { id: "AR", name: "Argentina" },
    extended_attributes: {
      city_name: "Valeria del Mar",
      neighborhood: { id: "TUxBQ1ZBTDM4MGFj", name: "Centro" },
    },
  });
  assert(parsed);
  assertEquals(parsed!.location?.city?.name, "Valeria del Mar");
  assertEquals(parsed!.location?.neighborhood?.id, "TUxBQ1ZBTDM4MGFj");
});

Deno.test("parseMlZipCodeApiResponse retorna null para corpo vazio", () => {
  assertEquals(parseMlZipCodeApiResponse(null), null);
  assertEquals(parseMlZipCodeApiResponse({}), null);
});

Deno.test("mlLocationToPersistAfterOAuth respeita tenant_override", () => {
  const profile = {
    source: "ml_user_profile" as const,
    updated_at: "2026-01-01T00:00:00.000Z",
    location: { city: { id: "c1" }, state: { id: "s1" } },
  };
  const cepSaved = {
    source: "tenant_override" as const,
    updated_at: "2026-01-02T00:00:00.000Z",
    location: { zip_code: "01310100", city: { id: "c2" }, state: { id: "s2" } },
  };
  assertEquals(mlLocationToPersistAfterOAuth(cepSaved, profile), null);
  assertEquals(mlLocationToPersistAfterOAuth(null, profile), profile);
  assertEquals(mlLocationToPersistAfterOAuth({ source: "ml_user_profile" }, profile), profile);
});
