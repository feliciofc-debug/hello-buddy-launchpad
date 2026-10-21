/** Status de `video_render_jobs` (texto livre no banco; sem migration). */
export const VIDEO_RENDER_JOB_STATUS_LABEL: Record<string, string> = {
  pendente: "Na fila",
  processando: "Renderizando",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovado: "Aprovado",
  concluido: "Pronto",
  publicado: "Publicado",
  publicado_parcial: "Publicado em parte",
  erro_publicacao: "Erro na publicação",
  cancelado: "Cancelado",
};

export function videoRenderJobStatusLabel(status: string): string {
  return VIDEO_RENDER_JOB_STATUS_LABEL[status] ?? status;
}

/** Republicar via `video-publicar-aprovado` só tenta redes ainda sem post em metadata.publicados. */
export function videoRenderJobRepublishAllowed(status: string): boolean {
  return status === "publicado_parcial" ||
    status === "erro_publicacao" ||
    status === "aprovado";
}
