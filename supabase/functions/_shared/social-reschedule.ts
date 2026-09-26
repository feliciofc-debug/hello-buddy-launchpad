export type ScheduledSocialGroup = {
  token: string;
  scheduledAt: string;
  networks: string[];
  rowIds: string[];
};

export function chooseSocialSchedule(
  groups: ScheduledSocialGroup[],
  requestedToken?: string,
): { selected?: ScheduledSocialGroup; reason?: "none" | "not_found" | "selection_required" } {
  const requested = String(requestedToken || "").trim().toLowerCase();
  if (requested) {
    const selected = groups.find((group) => group.token.toLowerCase() === requested);
    return selected ? { selected } : { reason: "not_found" };
  }
  if (groups.length === 0) return { reason: "none" };
  if (groups.length > 1) return { reason: "selection_required" };
  return { selected: groups[0] };
}

export function allRowsAreFuturePending(
  rows: Array<{ status: string | null; scheduled_at: string | null }>,
  now = new Date(),
): boolean {
  return rows.length > 0 && rows.every((row) =>
    row.status === "pendente"
    && !!row.scheduled_at
    && new Date(row.scheduled_at).getTime() > now.getTime()
  );
}

export function hasMinimumScheduleLead(
  scheduledDate: Date,
  now = new Date(),
  minutes = 10,
): boolean {
  return scheduledDate.getTime() >= now.getTime() + minutes * 60 * 1000;
}
