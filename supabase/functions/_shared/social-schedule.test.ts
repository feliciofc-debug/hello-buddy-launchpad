import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  formatScheduledDate,
  formatSocialNetworks,
  normalizeImageUrls,
  parseSaoPauloDateTime,
} from "./social-schedule.ts";

Deno.test("interpreta data absoluta de São Paulo e rejeita calendário inválido", () => {
  assertEquals(
    parseSaoPauloDateTime("2026-10-03 10:00")?.toISOString(),
    "2026-10-03T13:00:00.000Z",
  );
  assertEquals(parseSaoPauloDateTime("2026-02-30 10:00"), null);
  assertEquals(parseSaoPauloDateTime("03/10/2026 10:00"), null);
});

Deno.test("interpreta dd/mm sem ano e avança o ano quando a data já passou", () => {
  const reference = new Date("2026-09-26T15:00:00.000Z");
  assertEquals(
    parseSaoPauloDateTime("30/09 às 10h", reference)?.toISOString(),
    "2026-09-30T13:00:00.000Z",
  );
  assertEquals(
    parseSaoPauloDateTime("20/09 09:30", reference)?.toISOString(),
    "2027-09-20T12:30:00.000Z",
  );
});

Deno.test("interpreta janeiro sem ano como ano seguinte quando a referência é dezembro", () => {
  assertEquals(
    parseSaoPauloDateTime("05/01 às 9h", new Date("2026-12-20T15:00:00.000Z"))?.toISOString(),
    "2027-01-05T12:00:00.000Z",
  );
});

Deno.test("formata confirmação por extenso e redes em português", () => {
  const date = new Date("2026-10-03T13:00:00.000Z");
  assertEquals(formatScheduledDate(date), "sábado, 03/10, às 10:00");
  assertEquals(formatSocialNetworks(["facebook", "instagram"]), "Facebook e Instagram");
});

Deno.test("normaliza lista JSON de imagens e remove duplicatas", () => {
  assertEquals(
    normalizeImageUrls('["https://cdn/a.jpg","https://cdn/a.jpg","https://cdn/b.jpg"]'),
    ["https://cdn/a.jpg", "https://cdn/b.jpg"],
  );
  assertEquals(normalizeImageUrls("not-json"), []);
});
