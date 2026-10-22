/** FIX-VEIC-3 B1: toque em botão/lista não deve acionar heurísticas de texto. */

export function inboundHasInteractiveId(text: unknown): boolean {
  return /<<INTERACTIVE_ID:[^>]+>>/i.test(String(text ?? ""));
}

export function shouldSkipOwnerMediaTextHeuristics(text: unknown): boolean {
  return inboundHasInteractiveId(text);
}
