export interface VideoRenderLogoClaim {
  download_url: string;
  posicao: "topo";
  largura_ratio: 0.22;
  margem_ratio: 0.04;
}

type SignLogoUrl = (
  bucket: string,
  path: string,
  ttlSeconds: number,
) => Promise<string | null>;

/**
 * Monta o bloco opcional consumido pelo worker. Metadados incompletos ou fora
 * da pasta do tenant são ignorados para a logo nunca impedir o vídeo.
 */
export async function buildVideoRenderLogoClaim(
  job: {
    user_id?: unknown;
    metadata?: Record<string, unknown> | null;
  },
  sign: SignLogoUrl,
): Promise<VideoRenderLogoClaim | null> {
  const metadata = job.metadata || {};
  if (metadata.com_logo !== true) return null;

  const userId = String(job.user_id || "");
  const bucket = String(metadata.logo_bucket || "");
  const path = String(metadata.logo_path || "");
  if (!userId || !bucket || !path || !path.startsWith(`${userId}/`)) return null;

  const downloadUrl = await sign(bucket, path, 3600);
  if (!downloadUrl) return null;
  return {
    download_url: downloadUrl,
    posicao: "topo",
    largura_ratio: 0.22,
    margem_ratio: 0.04,
  };
}
