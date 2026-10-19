import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  blockingFieldLabels,
  formatInvokeErrorToast,
  type InvokeBlockingField,
} from "./function-invoke-error-format.ts";

Deno.test("formatInvokeErrorToast — 422 com blocking", () => {
  const blocking: InvokeBlockingField[] = [
    { field: "cor", message: "Informe a cor." },
    { field: "cep", message: "Falta CEP" },
  ];
  const msg = formatInvokeErrorToast({
    error: "Complete os campos obrigatórios.",
    blocking,
  });
  assertEquals(msg.includes("Complete os campos"), true);
  assertEquals(msg.includes("Cor"), true);
  assertEquals(msg.includes("CEP"), true);
});

Deno.test("blockingFieldLabels deduplica", () => {
  const labels = blockingFieldLabels([
    { field: "location", message: "x" },
    { field: "cep", message: "y" },
  ]);
  assertEquals(labels, ["CEP"]);
});
