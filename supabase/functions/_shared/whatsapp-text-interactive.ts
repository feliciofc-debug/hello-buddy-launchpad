export function textThenInteractivePayloads(input: {
  to: string;
  message?: string | null;
  interactivePayload: Record<string, unknown>;
}): Array<Record<string, unknown>> {
  const message = String(input.message || "").trim();
  if (!message) return [input.interactivePayload];
  return [{
    messaging_product: "whatsapp",
    to: input.to.replace(/\D/g, ""),
    type: "text",
    text: { body: message },
  }, input.interactivePayload];
}
