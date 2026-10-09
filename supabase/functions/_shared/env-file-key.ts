export function parseNumericEnvFileKey(
  contents: string,
  requestedKey: string,
): string | null {
  for (const rawLine of String(contents || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const assignment = line.match(
      /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/,
    );
    if (!assignment || assignment[1] !== requestedKey) continue;

    const rawValue = assignment[2].trim();
    const quoted = rawValue.match(/^(['"])(.*?)\1(?:\s+#.*)?$/);
    const value = quoted ? quoted[2] : rawValue.replace(/\s+#.*$/, "").trim();
    return /^\d{5,30}$/.test(value) ? value : null;
  }
  return null;
}
