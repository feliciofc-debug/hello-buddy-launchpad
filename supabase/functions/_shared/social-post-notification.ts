import { formatScheduledDate, formatSocialNetworks } from "./social-schedule.ts";

export type ScheduledPostNotificationRow = {
  id: string;
  platform: string;
  status: string | null;
  scheduled_at: string | null;
  error_message?: string | null;
  fb_post_id?: string | null;
  notificado_em?: string | null;
  tiktok_publish_status?: string | null;
  tiktok_fail_reason?: string | null;
};

export type ScheduledPostNotification = {
  kind: "success" | "partial" | "failure";
  text: string;
  scheduledDateText: string;
  templateResult: string;
};

const FINAL_STATUSES = new Set(["publicado", "erro", "cancelado"]);

function isFinalNotificationRow(row: ScheduledPostNotificationRow): boolean {
  if (!FINAL_STATUSES.has(String(row.status))) return false;
  if (row.platform !== "tiktok" || row.status !== "publicado") return true;
  return row.tiktok_publish_status === "PUBLISH_COMPLETE"
    || row.tiktok_publish_status === "SEND_TO_USER_INBOX";
}

export function friendlySocialPostError(value: unknown): string {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("produto_deletado") || raw.includes("produto deletado")) {
    return "o conteúdo original não está mais disponível";
  }
  if (raw.includes("tiktok_processing_timeout")) {
    return "o TikTok não concluiu o processamento em até 2 horas";
  }
  if (raw.includes("tiktok_retry_timeout")) {
    return "o TikTok não aceitou o envio após 24 horas de tentativas";
  }
  if (raw.includes("token") || raw.includes("permission") || raw.includes("autoriz")) {
    return "a conexão com a rede social precisa ser renovada";
  }
  if (raw.includes("image") || raw.includes("imagem") || raw.includes("video") || raw.includes("mídia") || raw.includes("media")) {
    return "a rede social recusou a mídia";
  }
  if (raw.includes("timeout") || raw.includes("network") || raw.includes("fetch") || raw.includes("rede")) {
    return "a rede social não respondeu a tempo";
  }
  return "a rede social não concluiu a publicação";
}

export function buildScheduledPostNotification(
  rows: ScheduledPostNotificationRow[],
): ScheduledPostNotification | null {
  if (
    rows.length === 0
    || rows.some((row) => !isFinalNotificationRow(row))
    || rows.some((row) => !!row.notificado_em)
  ) return null;

  const scheduledAt = rows.find((row) => row.scheduled_at)?.scheduled_at;
  if (!scheduledAt) return null;
  const when = formatScheduledDate(new Date(scheduledAt));
  const published = rows.filter((row) => row.status === "publicado");
  const drafts = published.filter((row) =>
    row.platform === "tiktok" && row.tiktok_publish_status === "SEND_TO_USER_INBOX"
  );
  const actuallyPublished = published.filter((row) => !drafts.includes(row));
  const failed = rows.filter((row) => row.status === "erro" || row.status === "cancelado");
  const publishedNetworks = formatSocialNetworks(actuallyPublished.map((row) => row.platform));
  const failedNetworks = formatSocialNetworks(failed.map((row) => row.platform));
  const reason = friendlySocialPostError(
    failed[0]?.tiktok_fail_reason || failed[0]?.error_message,
  );
  const facebookId = published.find((row) => row.platform === "facebook")?.fb_post_id;
  const facebookLink = facebookId ? `\nhttps://facebook.com/${facebookId}` : "";

  if (failed.length === 0) {
    const resultParts = [
      actuallyPublished.length > 0 ? `publicado no ${formatSocialNetworks(actuallyPublished.map((row) => row.platform))}` : "",
      drafts.length > 0 ? "enviado para os rascunhos do seu TikTok, é só abrir o app e publicar" : "",
    ].filter(Boolean);
    const result = resultParts.join("; ");
    return {
      kind: "success",
      text: `✅ Seu post agendado para ${when} foi ${result}.${facebookLink}`,
      scheduledDateText: when,
      templateResult: result,
    };
  }
  if (published.length > 0) {
    const successParts = [
      actuallyPublished.length > 0 ? `publicado no ${publishedNetworks}` : "",
      drafts.length > 0 ? "enviado para os rascunhos do seu TikTok" : "",
    ].filter(Boolean).join("; ");
    const result = `${successParts}, mas falhou no ${failedNetworks}: ${reason}`;
    return {
      kind: "partial",
      text: `⚠️ Seu post agendado para ${when} foi ${result}.${facebookLink}`,
      scheduledDateText: when,
      templateResult: result,
    };
  }
  const result = `não foi publicado: ${reason}`;
  return {
    kind: "failure",
    text: `❌ Seu post agendado para ${when} ${result}.`,
    scheduledDateText: when,
    templateResult: result,
  };
}
