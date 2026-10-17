import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildDailyResumoMessage } from "./vitrine-crm-resumo.ts";

Deno.test("resumo null sem movimento", () => {
  assertEquals(buildDailyResumoMessage({
    totalContacts: 0,
    topVehicles: [],
    warmLeads: [],
  }), null);
});

Deno.test("resumo com totais", () => {
  const msg = buildDailyResumoMessage({
    totalContacts: 3,
    topVehicles: [{ title: "Civic", count: 5 }],
    warmLeads: [{ contactName: "Ana", contactNumber: "5521999999999", vehicles: ["Civic"] }],
  });
  assertEquals(msg?.includes("3 pessoa"), true);
  assertEquals(msg?.includes("Civic"), true);
});
