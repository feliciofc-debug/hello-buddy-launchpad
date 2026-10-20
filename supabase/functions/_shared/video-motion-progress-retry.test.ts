import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  aceitaProgressoMonotonico,
  pctEnviando,
  pctPreparando,
  pctRenderizando,
} from "./video-motion-progress-scale.ts";
import {
  jobAindaAtivo,
  jobMotionStale,
  jobPermiteRetry,
  retryDeveMarcarAntigoComoSubstituido,
} from "./video-motion-retry-eligibility.ts";

Deno.test("pctRenderizando mapeia 0→10 e 1→90", () => {
  assertEquals(pctRenderizando(0), 10);
  assertEquals(pctRenderizando(1), 90);
});

Deno.test("enviando fica acima de render max", () => {
  assertEquals(pctEnviando("inicio") >= 90, true);
  assertEquals(pctEnviando("inicio") > pctRenderizando(1), true);
});

Deno.test("progresso monotônico rejeita regressão", () => {
  assertEquals(aceitaProgressoMonotonico(99, 92), false);
  assertEquals(aceitaProgressoMonotonico(50, 60), true);
});

Deno.test("preparando dentro de 0–10", () => {
  assertEquals(pctPreparando("inicio") <= 10, true);
  assertEquals(pctPreparando("fim"), 10);
});

Deno.test("retry recusado em job ativo recente", () => {
  const now = Date.now();
  const job = {
    status: "processando",
    claimed_at: new Date(now - 60_000).toISOString(),
    progresso_atualizado_em: new Date(now - 60_000).toISOString(),
  };
  assertEquals(jobPermiteRetry(job, now), false);
  assertEquals(jobAindaAtivo(job, now), true);
});

Deno.test("retry permitido em job stale", () => {
  const now = Date.now();
  const job = {
    status: "processando",
    claimed_at: new Date(now - 11 * 60_000).toISOString(),
    progresso_atualizado_em: new Date(now - 11 * 60_000).toISOString(),
  };
  assertEquals(jobPermiteRetry(job, now), true);
  assertEquals(jobAindaAtivo(job, now), false);
});

Deno.test("retry permitido em falha", () => {
  assertEquals(jobPermiteRetry({ status: "falha" }), true);
});
