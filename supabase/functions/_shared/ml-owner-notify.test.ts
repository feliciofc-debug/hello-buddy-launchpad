import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildMlLeadOwnerMessage } from "./ml-owner-notify.ts";

Deno.test("guest lead sem PII", () => {
  const msg = buildMlLeadOwnerMessage({
    contactType: "whatsapp",
    vehicleTitle: "BMW X6",
    isGuest: true,
    permalink: "https://ml.com/item",
  });
  assert(msg.includes("visitante"));
  assert(msg.includes("WhatsApp"));
  assert(!msg.includes("@"));
});

Deno.test("lead nomeado usa padrão ML", () => {
  const msg = buildMlLeadOwnerMessage({
    buyerName: "João",
    contactType: "visit_request",
    vehicleTitle: "Audi A3",
    buyerPhone: "+55 21 99999",
  });
  assert(msg.includes("🛒 Mercado Livre"));
  assert(msg.includes("João"));
  assert(msg.includes("visita"));
});
