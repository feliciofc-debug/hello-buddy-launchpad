import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import type { MetaAdsDraft } from "./meta-ads-create.ts";

export class MetaAdsMediaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaAdsMediaError";
  }
}

const httpsUrl = (value: unknown) => {
  const text = String(value ?? "").trim();
  try {
    return new URL(text).protocol === "https:" ? text : "";
  } catch {
    return "";
  }
};

const storageLocation = (value: string) => {
  try {
    const url = new URL(value);
    const match = url.pathname.match(
      /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/,
    );
    return match
      ? {
        bucket: decodeURIComponent(match[1]),
        path: decodeURIComponent(match[2]),
      }
      : null;
  } catch {
    return null;
  }
};

export async function resolveMetaAdsMediaUrl(
  admin: SupabaseClient,
  userId: string,
  draft: MetaAdsDraft,
): Promise<MetaAdsDraft> {
  const source = draft.media_source;
  const mediaId = String(draft.media_id ?? "").trim();
  if (!source || !mediaId) {
    if (!httpsUrl(draft.media_url)) {
      throw new MetaAdsMediaError("A mídia não possui uma URL HTTPS válida.");
    }
    return draft;
  }

  if (source === "midias_whatsapp") {
    const { data, error } = await admin.from("midias_whatsapp")
      .select("midia_url,tipo,status")
      .eq("id", mediaId)
      .eq("user_id", userId)
      .maybeSingle();
    if (
      error || !data || data.status === "arquivado" ||
      !["foto", "video"].includes(String(data.tipo))
    ) {
      throw new MetaAdsMediaError("A mídia selecionada não está disponível.");
    }
    const mediaUrl = httpsUrl(data.midia_url);
    if (!mediaUrl) {
      throw new MetaAdsMediaError("A mídia selecionada não possui URL HTTPS.");
    }
    const location = storageLocation(mediaUrl);
    if (!location) return { ...draft, media_url: mediaUrl };
    const { data: signed, error: signError } = await admin.storage
      .from(location.bucket)
      .createSignedUrl(location.path, 3_600);
    const signedUrl = httpsUrl(signed?.signedUrl);
    if (signError || !signedUrl) {
      throw new MetaAdsMediaError(
        "Não foi possível preparar a mídia para envio à Meta.",
      );
    }
    return {
      ...draft,
      media_url: signedUrl,
      media_bucket: location.bucket,
      media_path: location.path,
    };
  }

  const { data, error } = await admin.from(source)
    .select("resultado_bucket,resultado_path,status")
    .eq("id", mediaId)
    .eq("user_id", userId)
    .eq("status", "concluido")
    .maybeSingle();
  if (error || !data?.resultado_bucket || !data?.resultado_path) {
    throw new MetaAdsMediaError("O vídeo gerado não está disponível.");
  }
  const { data: signed, error: signError } = await admin.storage
    .from(String(data.resultado_bucket))
    .createSignedUrl(String(data.resultado_path), 3_600);
  const signedUrl = httpsUrl(signed?.signedUrl);
  if (signError || !signedUrl) {
    throw new MetaAdsMediaError(
      "Não foi possível preparar o vídeo para envio à Meta.",
    );
  }
  return {
    ...draft,
    media_url: signedUrl,
    media_bucket: String(data.resultado_bucket),
    media_path: String(data.resultado_path),
  };
}
