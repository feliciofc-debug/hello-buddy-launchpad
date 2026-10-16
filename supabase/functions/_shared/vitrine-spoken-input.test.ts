import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isFinanciamentoSpokenSkip,
  normalizeSpokenEmail,
  parseSpokenBirthDateInput,
} from "./vitrine-spoken-input.ts";

Deno.test("isFinanciamentoSpokenSkip reconhece pular por voz", () => {
  assert(isFinanciamentoSpokenSkip("prefiro não informar"));
  assert(isFinanciamentoSpokenSkip("pular essa etapa"));
  assertEquals(isFinanciamentoSpokenSkip("maria silva"), false);
});

Deno.test("normalizeSpokenEmail converte arroba e ponto", () => {
  assertEquals(
    normalizeSpokenEmail("ana ponto silva arroba gmail ponto com"),
    "ana.silva@gmail.com",
  );
});

Deno.test("parseSpokenBirthDateInput aceita data por extenso", () => {
  assertEquals(
    parseSpokenBirthDateInput("15 de março de 1980"),
    "1980-03-15",
  );
});
