import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertGestaoTrocaLaudoTravaUpdate,
  GESTAO_TROCA_LAUDO_TRAVA_MSG,
} from "./gestao-troca-laudo-trava-logic.ts";

const baseRow = (): Record<string, unknown> => ({
  laudo_status: "rascunho",
  laudo_numero: null,
  laudo_versao: 0,
  laudo_finalizado_por: null,
  laudo_finalizado_em: null,
  laudo_reaberto_motivo: null,
  checklist_json: {},
  fotos_json: [],
  kbb_troca: 10000,
  kbb_loja: 12000,
  kbb_km_caracteristico: 50000,
  fipe_valor: 11000,
  fipe_mes_ref: "2026-10",
  preparacao_estimada: 0,
  valor_proposto: 9000,
  valor_sugerido: 9500,
  faixa_verde_min: 8000,
  faixa_verde_max: 10000,
  teto: 10500,
  semaforo: "verde",
  justificativas_json: [],
  km: 48000,
  placa: "ABC1D23",
  marca: "Fiat",
  modelo: "Argo",
  versao: null,
  ano_fabricacao: 2022,
  ano_modelo: 2023,
  cor: "Branco",
  categoria: "hatch",
  status: "em_avaliacao",
  valor_aprovado: null,
  valor_fechado: null,
  destino: null,
  veiculo_id: null,
});

Deno.test("usuário comum não altera laudo_status", () => {
  const oldRow = baseRow();
  const newRow = { ...oldRow, laudo_status: "finalizado" };
  assertThrows(
    () => assertGestaoTrocaLaudoTravaUpdate({ isServiceRole: false, oldRow, newRow }),
    Error,
    GESTAO_TROCA_LAUDO_TRAVA_MSG,
  );
});

Deno.test("laudo finalizado bloqueia kbb e checklist", () => {
  const oldRow = { ...baseRow(), laudo_status: "finalizado", laudo_numero: "2026-000001" };
  const newRow = { ...oldRow, kbb_troca: 99999 };
  assertThrows(
    () => assertGestaoTrocaLaudoTravaUpdate({ isServiceRole: false, oldRow, newRow }),
    Error,
    GESTAO_TROCA_LAUDO_TRAVA_MSG,
  );
  const newRow2 = { ...oldRow, checklist_json: { pneus: { condicao: "ruim" } } };
  assertThrows(
    () => assertGestaoTrocaLaudoTravaUpdate({ isServiceRole: false, oldRow, newRow: newRow2 }),
    Error,
    GESTAO_TROCA_LAUDO_TRAVA_MSG,
  );
});

Deno.test("laudo finalizado permite fluxo comercial (status)", () => {
  const oldRow = { ...baseRow(), laudo_status: "finalizado" };
  const newRow = { ...oldRow, status: "aguardando_aprovacao" };
  assertGestaoTrocaLaudoTravaUpdate({ isServiceRole: false, oldRow, newRow });
  assertEquals(newRow.status, "aguardando_aprovacao");
});

Deno.test("laudo finalizado permite valor_aprovado e destino", () => {
  const oldRow = { ...baseRow(), laudo_status: "finalizado", status: "aprovada" };
  const newRow = {
    ...oldRow,
    valor_aprovado: 8800,
    valor_fechado: 8800,
    destino: "estoque",
    veiculo_id: "00000000-0000-4000-8000-000000000001",
  };
  assertGestaoTrocaLaudoTravaUpdate({ isServiceRole: false, oldRow, newRow });
});

Deno.test("service_role finaliza e reabre laudo", () => {
  const oldRow = baseRow();
  const finalize = {
    ...oldRow,
    laudo_status: "finalizado",
    laudo_numero: "2026-000001",
    laudo_versao: 1,
    laudo_finalizado_por: "00000000-0000-4000-8000-000000000099",
    laudo_finalizado_em: "2026-10-19T15:00:00.000Z",
  };
  assertGestaoTrocaLaudoTravaUpdate({ isServiceRole: true, oldRow, newRow: finalize });

  const reopen = {
    ...finalize,
    laudo_status: "rascunho",
    laudo_reaberto_motivo: "Correção de item no checklist",
  };
  assertGestaoTrocaLaudoTravaUpdate({ isServiceRole: true, oldRow: finalize, newRow: reopen });
});

Deno.test("rascunho permite alterar kbb", () => {
  const oldRow = baseRow();
  const newRow = { ...oldRow, kbb_troca: 15000 };
  assertGestaoTrocaLaudoTravaUpdate({ isServiceRole: false, oldRow, newRow });
});
