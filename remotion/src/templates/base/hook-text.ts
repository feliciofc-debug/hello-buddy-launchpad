const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function stripDuplicateHighlight(
  lines: string[],
  highlight?: string,
): string[] {
  if (!highlight || lines.length === 0) return lines;
  const next = [...lines];
  const words = next.at(-1)!.split(/\s+/);
  const normalizedHighlight = normalize(highlight);
  for (let start = 0; start < words.length; start++) {
    if (normalize(words.slice(start).join(" ")) !== normalizedHighlight) {
      continue;
    }
    const prefix = words.slice(0, start).join(" ")
      .replace(/[\s,.;:!?\-–—]+$/, "");
    if (prefix) next[next.length - 1] = prefix;
    else next.pop();
    break;
  }
  return next;
}
