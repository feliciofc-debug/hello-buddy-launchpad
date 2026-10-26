export type WebmotorsPortalHistoryAction =
  | "publicar"
  | "sincronizar"
  | "tirar_do_ar"
  | "voltar_anunciar";

export async function recordWebmotorsPortalHistory(
  sb: { from: (table: string) => { insert: (row: unknown) => PromiseLike<unknown> } },
  input: {
    userId: string;
    veiculoId: string;
    acao: WebmotorsPortalHistoryAction;
    externalId?: string | null;
    detail?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await sb.from("webmotors_portal_historico").insert({
      user_id: input.userId,
      veiculo_id: input.veiculoId,
      acao: input.acao,
      external_id: input.externalId ?? null,
      detail: input.detail ?? {},
    });
  } catch {
    // Histórico não deve bloquear publish/sync/unpublish.
  }
}
