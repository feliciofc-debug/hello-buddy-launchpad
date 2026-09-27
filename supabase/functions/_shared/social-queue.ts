export function buildSocialQueueNetworkRows(
  networks: string[],
  scripts: Record<string, string>,
): Array<{ platform: string; post_text: string }> {
  return [...new Set(networks)].map((platform) => ({
    platform,
    post_text: scripts[platform] || "",
  }));
}
