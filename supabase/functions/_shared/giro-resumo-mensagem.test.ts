import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  agregarGiroResumo,
  GESTAO_GIRO_RESUMO_TEMPLATE_CORPO,
  horaResumoAtingida,
  montarMensagemGiroResumo,
  montarVariaveisTemplateGiroResumo,
  resumoJaEnviadoHoje,
  sanitizarVariavelTemplateMeta,
} from "./giro-resumo-mensagem.ts";
import { decidirModoEnvioResumo } from "./giro-resumo-whatsapp.ts";
import type { EstoqueGiroResultado } from "./estoque-giro-calc.ts";

function resultado(partial: Partial<EstoqueGiroResultado> & Pick<EstoqueGiroResultado, "faixa">): EstoqueGiroResultado {
  return {
    diasEmEstoque: 40,
    dadosIncompletos: [],
    custoAtual: 80_000,
    custoFinanceiroAcumulado: 400,
    comissaoEstimada: 1_000,
    margemVarejoHoje: 5_000,
    referenciaRepasse: null,
    valorRepasseHoje: null,
    margemRepasseHoje: null,
    margemVarejo30d: 3_000,
    margemRepasse30d: null,
    ipvaProjetado: 0,
    ipvaViradaValor: null,
    ipvaViradaDiasRestantes: null,
    ipvaBaseFonte: null,
    ipvaAliquotaEfetivaPct: null,
    ipvaAliquotaRotulo: null,
    ipvaConferirDocumento: false,
    custoDeEsperar30d: 2_000,
    indiceRisco: 55,
    indiceSemDado: [],
    recomendacao: "Revisar preço e anúncio",
    porque: "",
    precoSugerido7d: null,
    passos: [],
    ...partial,
  };
}

Deno.test("G90-2 — mensagem inclui faixas, risco e link", () => {
  const ag = agregarGiroResumo([
    {
      label: "Corolla XEI",
      dias: 41,
      faixa: "atencao",
      resultado: resultado({ faixa: "atencao", recomendacao: "Revisar preço e anúncio" }),
    },
    {
      label: "BMW 428i",
      dias: 64,
      faixa: "risco",
      resultado: resultado({
        faixa: "risco",
        indiceRisco: 90,
        recomendacao: "Reduzir para R$ 145.900 por 7 dias",
      }),
    },
  ], "2026-10-23");
  const msg = montarMensagemGiroResumo(ag, "2026-10-23");
  assert(msg.includes("📊"));
  assert(msg.includes("🟡 1"));
  assert(msg.includes("Risco projetado"));
  assert(msg.includes("amzofertas.com.br/gestao/lucro?aba=giro"));
  assert(msg.includes("BMW 428i"));
});

Deno.test("G90-2 — IPVA só entra na mensagem quando agregado", () => {
  const ag = agregarGiroResumo([{
    label: "Civic",
    dias: 50,
    faixa: "atencao",
    resultado: resultado({
      faixa: "atencao",
      ipvaViradaValor: 4_000,
      ipvaViradaDiasRestantes: 69,
    }),
  }], "2026-10-23");
  const msg = montarMensagemGiroResumo(ag, "2026-10-23");
  assert(msg.includes("IPVA da virada"));
  const agSem = agregarGiroResumo([{
    label: "Civic",
    dias: 50,
    faixa: "atencao",
    resultado: resultado({ faixa: "atencao" }),
  }], "2026-06-01");
  const msgJun = montarMensagemGiroResumo(agSem, "2026-06-01");
  assert(!msgJun.includes("IPVA da virada"));
});

Deno.test("G90-2 — dados incompletos só contam", () => {
  const ag = agregarGiroResumo([
    {
      label: "Sem custo",
      dias: 10,
      faixa: "saudavel",
      resultado: resultado({ faixa: "saudavel", dadosIncompletos: ["custo de compra"] }),
    },
    {
      label: "Sem preço",
      dias: 10,
      faixa: "saudavel",
      resultado: resultado({ faixa: "saudavel", dadosIncompletos: ["preço anunciado"] }),
    },
  ], "2026-10-23");
  const msg = montarMensagemGiroResumo(ag, "2026-10-23");
  assert(msg.includes("sem custo de compra"));
  assert(msg.includes("sem preço anunciado"));
});

Deno.test("G90-2 — idempotência no mesmo dia", () => {
  assert(resumoJaEnviadoHoje("2026-10-23", "2026-10-23"));
  assert(!resumoJaEnviadoHoje("2026-10-22", "2026-10-23"));
});

Deno.test("G90-2 — sem envio fora da janela sem template", () => {
  const now = Date.parse("2026-10-23T12:00:00Z");
  assertEquals(
    decidirModoEnvioResumo("2026-10-20T12:00:00Z", false, now),
    "bloqueado",
  );
  assertEquals(
    decidirModoEnvioResumo("2026-10-22T12:00:01Z", false, now),
    "texto_livre",
  );
  assertEquals(
    decidirModoEnvioResumo("2026-10-20T12:00:00Z", true, now),
    "template",
  );
});

Deno.test("G90-2 — exemplo real da mensagem agregada", () => {
  const items = [
    ...Array.from({ length: 7 }, () => ({
      label: "Genérico",
      dias: 10,
      faixa: "saudavel" as const,
      resultado: resultado({ faixa: "saudavel", custoDeEsperar30d: 100 }),
      custoFinanceiroDiario: 1240 / 10,
    })),
    {
      label: "Corolla XEI",
      dias: 41,
      faixa: "atencao" as const,
      resultado: resultado({ faixa: "atencao", indiceRisco: 40, recomendacao: "Revisar preço e anúncio" }),
      custoFinanceiroDiario: 50,
    },
    {
      label: "BMW 428i",
      dias: 64,
      faixa: "risco" as const,
      resultado: resultado({
        faixa: "risco",
        indiceRisco: 95,
        recomendacao: "Reduzir para R$ 145.900 por 7 dias",
        ipvaViradaValor: 52300 / 10,
        ipvaViradaDiasRestantes: 69,
      }),
      custoFinanceiroDiario: 50,
    },
  ];
  const ag = agregarGiroResumo(items, "2026-10-23");
  ag.riscoProjetado30d = 18_400;
  ag.custoFinanceiroHoje = 1_240;
  ag.ipvaViradaEstoque = 52_300;
  ag.ipvaDiasRestantes = 69;
  ag.faixas = { saudavel: 7, atencao: 2, risco: 1, decisao: 0 };
  ag.total = 10;
  const msg = montarMensagemGiroResumo(ag, "2026-10-23");
  assert(msg.includes("10 carros"));
  assert(msg.includes("Corolla XEI"));
  assert(msg.includes("145.900"));
});

Deno.test("G90-2 — horário configurável 18h SP", () => {
  const before = new Date("2026-10-23T20:59:00Z"); // 17:59 SP
  const after = new Date("2026-10-23T21:00:00Z"); // 18:00 SP
  assertEquals(horaResumoAtingida("18:00:00", before), false);
  assertEquals(horaResumoAtingida("18:00:00", after), true);
});

Deno.test("G90-2.1 — variáveis do template Meta sem quebra de linha", () => {
  const dirty = sanitizarVariavelTemplateMeta("linha1\nlinha2\t tab    spaces");
  assert(!dirty.includes("\n"));
  assert(!dirty.includes("\t"));
  assert(!dirty.includes("    "));

  const ag = agregarGiroResumo([
    {
      label: "Corolla",
      dias: 40,
      faixa: "atencao",
      resultado: resultado({ faixa: "atencao", custoDeEsperar30d: 18_400 }),
      custoFinanceiroDiario: 124,
    },
  ], "2026-10-23");
  const vars = montarVariaveisTemplateGiroResumo(ag, "2026-10-23");
  assertEquals(vars.length, 5);
  for (const v of vars) {
    assert(!/[\n\r\t]/.test(v));
    assert(!/ {4,}/.test(v));
  }
  assert(GESTAO_GIRO_RESUMO_TEMPLATE_CORPO.includes("{{1}}"));
  assert(GESTAO_GIRO_RESUMO_TEMPLATE_CORPO.includes("{{5}}"));
});
