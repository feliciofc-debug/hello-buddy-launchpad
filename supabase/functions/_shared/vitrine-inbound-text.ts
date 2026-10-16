/** Remove prefixo que o processor grava após transcrição de áudio. */
export function stripAudioTranscriptPrefix(text: string): string {
  return String(text || "")
    .replace(/^🎙️\s*Áudio transcrito:\s*/i, "")
    .trim();
}
