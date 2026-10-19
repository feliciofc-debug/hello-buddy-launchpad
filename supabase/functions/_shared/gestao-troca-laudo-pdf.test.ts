import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildGestaoTrocaLaudoPdfSection } from "./gestao-troca-laudo-pdf-section.ts";

Deno.test("PDF laudo: análise concluída com 0 itens confirmados gera seção", () => {
  const section = buildGestaoTrocaLaudoPdfSection({
    analiseStatus: "concluida",
    km_painel_lido: 52000,
    km_ficha: 50000,
    km_informado: 50000,
    alerta_km: true,
    km_painel_conferido: false,
    luzes_painel: false,
    aviso_carroceria: false,
    qualidade_json: [{ etiqueta: "Painel ligado (km)", usada: true }],
    resumo: "Veículo em bom estado geral.",
    modelo_ia: "google/gemini-3.6-flash",
    concluida_em: "2026-10-19T12:00:00.000Z",
    itensConfirmados: [],
  });
  assertEquals(section != null, true);
  assertEquals(section!.itensConfirmados.length, 0);
  assertEquals(section!.alertaKm, true);
  assertEquals(section!.luzesPainel, false);
});

Deno.test("PDF laudo: análise não concluída não gera seção", () => {
  const section = buildGestaoTrocaLaudoPdfSection({
    analiseStatus: "processando",
    km_painel_lido: null,
    km_ficha: null,
    alerta_km: false,
    km_painel_conferido: false,
    luzes_painel: null,
    aviso_carroceria: false,
    qualidade_json: [],
    resumo: null,
    modelo_ia: null,
    concluida_em: null,
    itensConfirmados: [],
  });
  assertEquals(section, null);
});
