export type MediaEditChainNode = {
  id: string;
  midia_pai_id?: string | null;
  midia_url?: string | null;
  origem?: string | null;
  created_at?: string | null;
};

export async function resolveMediaEditChainRoot(
  start: MediaEditChainNode | null | undefined,
  loadParent: (
    parentId: string,
  ) => Promise<MediaEditChainNode | null | undefined>,
  maxDepth = 12,
): Promise<MediaEditChainNode | null> {
  let current = start;
  if (!current?.id) return null;
  for (let depth = 0; depth < maxDepth; depth++) {
    const parentId = String(current.midia_pai_id || "").trim();
    if (!parentId || parentId === current.id) break;
    const parent = await loadParent(parentId);
    if (!parent?.id) break;
    current = parent;
  }
  return current;
}
