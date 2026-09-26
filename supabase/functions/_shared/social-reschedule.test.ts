import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  allRowsAreFuturePending,
  chooseSocialSchedule,
  hasMinimumScheduleLead,
  type ScheduledSocialGroup,
} from "./social-reschedule.ts";

const group = (token: string): ScheduledSocialGroup => ({
  token,
  scheduledAt: "2026-10-03T13:00:00.000Z",
  networks: ["facebook", "instagram"],
  rowIds: [`${token}-fb`, `${token}-ig`],
});

Deno.test("remarca diretamente quando existe um único agendamento", () => {
  assertEquals(chooseSocialSchedule([group("aaaaaaaa")]).selected?.token, "aaaaaaaa");
});

Deno.test("pede o código quando existem dois agendamentos", () => {
  assertEquals(
    chooseSocialSchedule([group("aaaaaaaa"), group("bbbbbbbb")]).reason,
    "selection_required",
  );
});

Deno.test("recusa grupo que já publicou ou começou a processar", () => {
  const now = new Date("2026-09-26T12:00:00Z");
  assertEquals(allRowsAreFuturePending([
    { status: "publicado", scheduled_at: "2026-10-03T13:00:00Z" },
    { status: "pendente", scheduled_at: "2026-10-03T13:00:00Z" },
  ], now), false);
});

Deno.test("exige pelo menos dez minutos de antecedência", () => {
  const now = new Date("2026-09-26T12:00:00Z");
  assertEquals(hasMinimumScheduleLead(new Date("2026-09-26T12:09:59Z"), now), false);
  assertEquals(hasMinimumScheduleLead(new Date("2026-09-26T12:10:00Z"), now), true);
});
