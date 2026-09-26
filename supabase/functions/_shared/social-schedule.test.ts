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
