import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  AMZ_INVITE_DISCOVERY_MESSAGE,
  amzProspectHandoffInstruction,
  buildAmzLeadOwnerSummary,
  prospectDemoBrandPlan,
  resolveInviteConfirmation,
} from "./amz-consultive-prospect.ts";

Deno.test("convite AMZ inicia descoberta consultiva e aceita mensagem configurada", () => {
  assertEquals(resolveInviteConfirmation({
    isAmzTenant: true,
    template: { nome_meta: "convite_pietro_amz_v1", tipo_uso: "convite_optin" },
    contactName: "Mariana Silva",
    fallback: "fallback",
  }), AMZ_INVITE_DISCOVERY_MESSAGE.replace("{nome}", "Mariana"));
  assertEquals(
    AMZ_INVITE_DISCOVERY_MESSAGE.includes("www.suaempresa.com.br"),
    true,
  );

  assertEquals(resolveInviteConfirmation({
    isAmzTenant: true,
    template: {
      nome_meta: "outro_convite",
      tipo_uso: "convite",
      variaveis_map: { confirmation_message: "Olá, {nome}. Qual é o seu negócio?" },
    },
    contactName: "João",
    fallback: "fallback",
  }), "Olá, João. Qual é o seu negócio?");
});

Deno.test("confirmação de outros tenants mantém fallback atual", () => {
  assertEquals(resolveInviteConfirmation({
    isAmzTenant: false,
    template: { nome_meta: "convite_pietro_amz_v1", tipo_uso: "convite_optin" },
    contactName: "Mariana",
    fallback: "Show! Você está na lista.",
  }), "Show! Você está na lista.");
});

Deno.test("demo AMZ usa identidade do site somente na geração e nunca publica", () => {
  assertEquals(prospectDemoBrandPlan({
    isAmzProspect: true,
    siteUrl: "https://exemplo.com",
    brandColors: ["#EE3124", "#ffffff", "#ee3124", "vermelho"],
  }), {
    siteUrl: "https://exemplo.com",
    brandColors: ["#ee3124", "#ffffff"],
    useTemporarySiteIdentity: true,
    persistIdentity: false,
    allowPublishing: false,
  });
});

Deno.test("handoff comercial inclui resumo e contato sem expor o dono", () => {
  assertEquals(buildAmzLeadOwnerSummary({
    business: "Clínica odontológica",
    pain: "Falta de tempo para publicar",
    demonstration: "Imagem com identidade do site",
    nextStep: "Enviar proposta",
  }), [
    "Negócio: Clínica odontológica",
    "Dor: Falta de tempo para publicar",
    "Demonstração: Imagem com identidade do site",
    "Próximo passo: Enviar proposta",
  ]);
  assertEquals(
    amzProspectHandoffInstruction(),
    "Avise o prospect que um consultor da AMZ vai entrar em contato.",
  );
});
