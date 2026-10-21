import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("HOTFIX — contexto automotivo do dono no turno de texto não usa textVerticalDecision antes da declaração", () => {
  const source = Deno.readTextFileSync(
    new URL(
      "../whatsapp-cloud-inbound-processor/index.ts",
      import.meta.url,
    ),
  );
  const automotiveIdx = source.indexOf("const automotiveOwnerAccount");
  const verticalIdx = source.indexOf(
    "const textVerticalDecision = resolveVertical",
  );
  assert(automotiveIdx >= 0, "automotiveOwnerAccount ausente");
  assert(verticalIdx >= 0, "textVerticalDecision ausente");
  const beforeResolve = source.slice(automotiveIdx, verticalIdx);
  assert(
    !beforeResolve.includes("textVerticalDecision"),
    "textVerticalDecision referenciado antes de ser inicializado",
  );
});
