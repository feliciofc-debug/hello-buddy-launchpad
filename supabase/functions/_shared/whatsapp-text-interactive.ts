export function textThenInteractivePayloads(input: {
  to: string;
  message?: string | null;
  interactivePayload: Record<string, unknown>;
  sendTextFirst?: boolean;
  maxInteractiveBodyLength?: number;
}): Array<Record<string, unknown>> {
  const message = String(input.message || "").trim();
  const limit = input.maxInteractiveBodyLength ?? 1024;
  const tooLong = [...message].length > limit;
  if (!message || (!input.sendTextFirst && !tooLong)) {
    return [input.interactivePayload];
  }
  return [{
    messaging_product: "whatsapp",
    to: input.to.replace(/\D/g, ""),
    type: "text",
    text: { body: message },
  }, input.interactivePayload];
}
