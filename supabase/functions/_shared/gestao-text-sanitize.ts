const UUID_TOKEN =
  /\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi;
const MIXED_HYPHENATED_CODE =
  /\b(?=[a-z0-9-]{8,}\b)(?=[a-z0-9-]*[a-z])(?=[a-z0-9-]*\d)[a-z0-9]+(?:-[a-z0-9]+)+\b/gi;
const HEX_HASH =
  /\b(?=[0-9a-f]{12,64}\b)(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]+\b/gi;

/** Remove identificadores opacos antes dos parsers de valor e veículo. */
export function stripGestaoOpaqueTokens(text: unknown): string {
  return String(text ?? "")
    .replace(/<<INTERACTIVE_ID:[^>]+>>/gi, " ")
    .replace(UUID_TOKEN, " ")
    .replace(MIXED_HYPHENATED_CODE, " ")
    .replace(HEX_HASH, " ")
    .replace(/\s+/g, " ")
    .trim();
}
