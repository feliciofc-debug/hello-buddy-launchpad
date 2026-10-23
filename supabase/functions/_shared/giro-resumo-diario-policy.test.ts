import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classificarStatusResumo,
  deveProcessarResumoHoje,
  filtrarPhonesSemEnvio,
  isErroTecnicoEnvio,
  todosFalharamTecnico,
} from "./giro-resumo-diario-policy.ts";

Deno.test("G90-2.1 — dono bloqueado + gestor ok não repete no mesmo dia", () => {
  const hoje = "2026-10-23";
  const phonesGestor = ["5511999990001"];
  assertEquals(
    deveProcessarResumoHoje({
      hojeYmd: hoje,
      resumoUltimoEnvio: hoje,
      resumoUltimoStatus: "parcial",
      tentativasTecnico: 0,
    }),
    "nao",
  );
  assertEquals(filtrarPhonesSemEnvio(["5511999990001", "5511888880002"], phonesGestor), [
    "5511888880002",
  ]);
  assertEquals(
    classificarStatusResumo({ ownerOk: false, ownerBlocked24h: true, algumOk: true }),
    "parcial",
  );
});

Deno.test("G90-2.1 — falha técnica total permite até 2 novas tentativas", () => {
  const hoje = "2026-10-23";
  assertEquals(
    deveProcessarResumoHoje({
      hojeYmd: hoje,
      resumoUltimoEnvio: hoje,
      resumoUltimoStatus: "falha",
      tentativasTecnico: 0,
    }),
    "retentativa_tecnica",
  );
  assertEquals(
    deveProcessarResumoHoje({
      hojeYmd: hoje,
      resumoUltimoEnvio: hoje,
      resumoUltimoStatus: "falha",
      tentativasTecnico: 1,
    }),
    "retentativa_tecnica",
  );
  assertEquals(
    deveProcessarResumoHoje({
      hojeYmd: hoje,
      resumoUltimoEnvio: hoje,
      resumoUltimoStatus: "falha",
      tentativasTecnico: 2,
    }),
    "nao",
  );
});

Deno.test("G90-2.1 — erro HTTP é técnico; janela 24h não", () => {
  assertEquals(isErroTecnicoEnvio({ ok: false, error: "502 Bad Gateway" }), true);
  assertEquals(
    isErroTecnicoEnvio({ ok: false, error: "fora da janela 24h sem template aprovado" }),
    false,
  );
  assertEquals(
    todosFalharamTecnico([
      { ok: false, error: "500" },
      { ok: false, error: "timeout" },
    ]),
    true,
  );
  assertEquals(
    todosFalharamTecnico([
      { ok: false, error: "fora da janela 24h" },
      { ok: true, error: undefined },
    ]),
    false,
  );
});
