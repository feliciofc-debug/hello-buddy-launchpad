import { syncVeiculoVideoFromUrl } from "./sync-veiculo-video.ts";
import { syncProdutoVideoFromMidia } from "./sync-produto-video.ts";
import {
  isVeiculoVideoJobMetadata,
  veiculoIdFromJobMetadata,
} from "./veiculo-video-job-metadata.ts";

type JobLike = {
  user_id: string;
  titulo?: string | null;
  legenda_post?: string | null;
  metadata?: unknown;
};

export async function persistMotionVideoToLibrary(
  supabase: any,
  job: JobLike,
  videoUrl: string,
  duracaoSegundos: number | null,
  registrarMidiasProduto: () => Promise<string>,
): Promise<{ midiaId: string | null; veiculoVideoId: string | null }> {
  if (!isVeiculoVideoJobMetadata(job.metadata)) {
    const midiaId = await registrarMidiasProduto();
    await syncProdutoVideoFromMidia(supabase, midiaId);
    return { midiaId, veiculoVideoId: null };
  }

  const veiculoId = veiculoIdFromJobMetadata(job.metadata);
  if (!veiculoId) {
    throw new Error("metadata veículo sem veiculo_id");
  }

  const synced = await syncVeiculoVideoFromUrl(supabase, {
    userId: job.user_id,
    veiculoId,
    videoUrl,
    titulo: job.titulo,
    legenda: job.legenda_post,
    duracaoSegundos,
  });
  return { midiaId: null, veiculoVideoId: synced.id };
}

export async function persistRenderVideoToLibrary(
  supabase: any,
  job: JobLike,
  videoUrl: string,
  duracaoSegundos: number | null,
  registrarMidiasProduto: () => Promise<string>,
): Promise<{ midiaId: string | null; veiculoVideoId: string | null }> {
  return persistMotionVideoToLibrary(
    supabase,
    job,
    videoUrl,
    duracaoSegundos,
    registrarMidiasProduto,
  );
}
