import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  mlLeadOrigemFromPortal,
  resolveMlVisLeadNotification,
  shouldNotifyMlLeadOnWhatsApp,
} from "./ml-lead-notify-policy.ts";

Deno.test("lead fora de veiculos_portais — origem outro_sistema, sem WhatsApp por padrão", () => {
  assertEquals(mlLeadOrigemFromPortal(false), "outro_sistema");
  assertEquals(shouldNotifyMlLeadOnWhatsApp({
    hasAmzPortal: false,
    whatsappLeadsAllAds: false,
  }), false);
});

Deno.test("opção ligada + item outro sistema → notifica WhatsApp", () => {
  const r = resolveMlVisLeadNotification({
    ownedByAmz: false,
    whatsappLeadsAllAds: true,
  });
  assertEquals(r.origem, "outro_sistema");
  assertEquals(r.notifyWhatsapp, true);
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
