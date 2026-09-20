// Identificação determinística de mídias exibida ao dono no WhatsApp.
// O código curto é apenas uma forma amigável do prefixo do UUID; a resolução
// e a autorização continuam sendo feitas pelo UUID completo e pelo user_id.

export function idCurto(id: string): string {
  return String(id || "").replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function linhaCodigoMidia(id: string, tipo: "foto" | "video"): string {
  const nomeTipo = tipo === "video" ? "Vídeo" : "Imagem";
  return `ID da mídia: ${idCurto(id)} — ${nomeTipo}`;
}
