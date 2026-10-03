import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { selectSocialVariantScripts } from "./social-approval-flow.ts";
import { buildSocialQueueNetworkRows } from "./social-queue.ts";

Deno.test("agendamento LinkedIn conserva a copy escolhida na linha da fila", () => {
  const variants = {
    A: "Copy A profissional",
    B: "Copy B profissional",
    C: "Copy C profissional",
  };
  const selected = selectSocialVariantScripts(variants, "B");
  assertEquals(
    buildSocialQueueNetworkRows(["linkedin"], { linkedin: selected }),
    [{ platform: "linkedin", post_text: "Copy B profissional" }],
  );
});

Deno.test("Instagram e LinkedIn geram linhas independentes no mesmo criativo", () => {
  assertEquals(
    buildSocialQueueNetworkRows(
      ["instagram", "linkedin"],
      { instagram: "Copy Instagram", linkedin: "Copy LinkedIn" },
    ),
    [
      { platform: "instagram", post_text: "Copy Instagram" },
      { platform: "linkedin", post_text: "Copy LinkedIn" },
    ],
  );
});
