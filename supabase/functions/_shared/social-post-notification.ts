import { formatScheduledDate, formatSocialNetworks } from "./social-schedule.ts";

export type ScheduledPostNotificationRow = {
  id: string;
  platform: string;
  status: string | null;
  scheduled_at: string | null;
  error_message?: string | null;
  fb_post_id?: string | null;
  notificado_em?: string | null;
};

export type ScheduledPostNotification = {
  kind: "success" | "partial" | "failure";
  text: string;
  scheduledDateText: string;
  templateResult: string;
};

const FINAL_STATUSES = new Set(["publicado", "erro", "cancelado"]);

export function friendlySocialPostError(value: unknown): string {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("produto_deletado") || raw.includes("produto deletado")) {
    return "o conteúdo original não está mais disponível";
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
    || rows.some((row) => !FINAL_STATUSES.has(String(row.status)))
    || rows.some((row) => !!row.notificado_em)
  ) return null;

  const scheduledAt = rows.find((row) => row.scheduled_at)?.scheduled_at;
  if (!scheduledAt) return null;
  const when = formatScheduledDate(new Date(scheduledAt));
  const published = rows.filter((row) => row.status === "publicado");
  const failed = rows.filter((row) => row.status === "erro" || row.status === "cancelado");
  const allNetworks = formatSocialNetworks(rows.map((row) => row.platform));
  const publishedNetworks = formatSocialNetworks(published.map((row) => row.platform));
  const failedNetworks = formatSocialNetworks(failed.map((row) => row.platform));
  const reason = friendlySocialPostError(failed[0]?.error_message);
  const facebookId = published.find((row) => row.platform === "facebook")?.fb_post_id;
  const facebookLink = facebookId ? `\nhttps://facebook.com/${facebookId}` : "";

  if (failed.length === 0) {
    const result = `publicado no ${allNetworks}`;
    return {
      kind: "success",
      text: `✅ Seu post agendado para ${when} foi ${result}.${facebookLink}`,
      scheduledDateText: when,
      templateResult: result,
    };
  }
  if (published.length > 0) {
    const result = `publicado no ${publishedNetworks}, mas falhou no ${failedNetworks}: ${reason}`;
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
