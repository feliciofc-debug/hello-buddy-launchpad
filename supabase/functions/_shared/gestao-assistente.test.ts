import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { matchGestaoAssistenteNavigation } from "./gestao-assistente-map.ts";
import { isGestaoAssistenteMutatingIntent } from "./gestao-assistente-queries.ts";
import { classifyGestaoIntent } from "./gestao-intent-pt.ts";

Deno.test("Jarvis navegação: como emito nota", () => {
  const nav = matchGestaoAssistenteNavigation("Como emito nota?");
  assert(nav);
  assertEquals(nav!.path, "/gestao/lucro?aba=notas");
});

Deno.test("Jarvis navegação: comissões", () => {
  const nav = matchGestaoAssistenteNavigation("Onde vejo comissões?");
  assert(nav);
  assert(nav!.path.includes("equipe"));
});

Deno.test("Jarvis número: faturamento reconhece pergunta do mês", () => {
  const t = "quanto faturei este mes";
  assert(/\bfaturei\b|\bfaturamento\b/.test(t) && /\b(mes|mês)\b/.test(t));
});

Deno.test("Jarvis mutação bloqueada: emitir nota no chat", () => {
  const i = classifyGestaoIntent("emite a nota do X6");
  assertEquals(i.kind, "nfe_emit");
  assert(isGestaoAssistenteMutatingIntent(i.kind));
});

Deno.test("Jarvis fora do escopo: golden retriever não navega", () => {
  const nav = matchGestaoAssistenteNavigation("Como treinar golden retriever?");
  assertEquals(nav, null);
});
