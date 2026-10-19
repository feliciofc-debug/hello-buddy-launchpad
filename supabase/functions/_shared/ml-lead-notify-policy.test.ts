import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  mlLeadOrigemFromPortal,
  shouldNotifyMlLeadOnWhatsApp,
} from "./ml-lead-notify-policy.ts";

Deno.test("lead fora de veiculos_portais — origem outro_sistema, sem WhatsApp por padrão", () => {
  assertEquals(mlLeadOrigemFromPortal(false), "outro_sistema");
  assertEquals(shouldNotifyMlLeadOnWhatsApp({
    hasAmzPortal: false,
    whatsappLeadsAllAds: false,
  }), false);
});

Deno.test("lead AMZ notifica; opção todos os anúncios notifica outro_sistema", () => {
  assertEquals(mlLeadOrigemFromPortal(true), "amz");
  assertEquals(shouldNotifyMlLeadOnWhatsApp({
    hasAmzPortal: true,
    whatsappLeadsAllAds: false,
  }), true);
  assertEquals(shouldNotifyMlLeadOnWhatsApp({
    hasAmzPortal: false,
    whatsappLeadsAllAds: true,
  }), true);
});
