import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  inferGestaoCategoria,
  resolveGestaoCategoriaFromUserReply,
} from "./gestao-categoria-pt.ts";

Deno.test("inferGestaoCategoria — funilaria_pintura (martelinho)", () => {
  assertEquals(inferGestaoCategoria("martelinho de ouro no para-choque"), "funilaria_pintura");
});

Deno.test("inferGestaoCategoria — mecanica (bateria)", () => {
  assertEquals(inferGestaoCategoria("troca de bateria BMW"), "mecanica");
});

Deno.test("inferGestaoCategoria — pneus", () => {
  assertEquals(inferGestaoCategoria("pneu novo dianteiro"), "pneus");
});

Deno.test("inferGestaoCategoria — estetica (polimento)", () => {
  assertEquals(inferGestaoCategoria("polimento completo"), "estetica");
});

Deno.test("inferGestaoCategoria — documentacao", () => {
  assertEquals(inferGestaoCategoria("despachante transferencia"), "documentacao");
});

Deno.test("inferGestaoCategoria — transporte", () => {
  assertEquals(inferGestaoCategoria("cegonha SP-RJ"), "transporte");
});

Deno.test("inferGestaoCategoria — anuncio", () => {
  assertEquals(inferGestaoCategoria("impulsionar webmotors"), "anuncio");
});

Deno.test("inferGestaoCategoria — comissao", () => {
  assertEquals(inferGestaoCategoria("comissao vendedor"), "comissao");
});

Deno.test("resolveGestaoCategoriaFromUserReply aceita nome", () => {
  assertEquals(resolveGestaoCategoriaFromUserReply("mecânica"), "mecanica");
  assertEquals(resolveGestaoCategoriaFromUserReply("Funilaria e pintura"), "funilaria_pintura");
});

Deno.test("resolveGestaoCategoriaFromUserReply ignora SIM", () => {
  assertEquals(resolveGestaoCategoriaFromUserReply("sim"), null);
  assertEquals(resolveGestaoCategoriaFromUserReply("s"), null);
  assertEquals(resolveGestaoCategoriaFromUserReply("sim!"), null);
  assertEquals(resolveGestaoCategoriaFromUserReply("sim pode"), null);
  assertEquals(resolveGestaoCategoriaFromUserReply("pode"), null);
});

Deno.test("resolveGestaoCategoriaFromUserReply mecanica sem confundir com s", () => {
  assertEquals(resolveGestaoCategoriaFromUserReply("mecanica"), "mecanica");
});
