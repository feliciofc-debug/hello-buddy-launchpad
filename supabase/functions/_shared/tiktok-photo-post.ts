export type TikTokPhotoPostInput = {
  imageUrls: string[];
  caption: string;
  directPost: boolean;
  privacyLevel?: string;
  disableComment?: boolean;
  brandOrganic?: boolean;
  brandedContent?: boolean;
};

export function buildTikTokPhotoPostPayload(
  input: TikTokPhotoPostInput,
): Record<string, unknown> {
  const images = input.imageUrls.map((url) => String(url).trim()).filter(Boolean)
    .slice(0, 35);
  if (!images.length) throw new Error("Nenhuma imagem válida foi informada.");

  const caption = String(input.caption || "").trim().slice(0, 2200);
  const postInfo: Record<string, unknown> = {
    title: caption.slice(0, 90),
    description: caption,
  };
  if (input.directPost) {
    postInfo.privacy_level = input.privacyLevel || "SELF_ONLY";
    postInfo.disable_comment = !!input.disableComment;
    postInfo.auto_add_music = true;
    postInfo.brand_content_toggle = !!input.brandedContent;
    postInfo.brand_organic_toggle = !!input.brandOrganic;
  }

  return {
    post_info: postInfo,
    source_info: {
      source: "PULL_FROM_URL",
      photo_cover_index: 0,
      photo_images: images,
    },
    post_mode: input.directPost ? "DIRECT_POST" : "MEDIA_UPLOAD",
    media_type: "PHOTO",
  };
}

export function tikTokPhotoInitErrorMessage(
  status: number,
  error: { code?: unknown; message?: unknown } | null | undefined,
): string {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  if (
    /url|domain|ownership|pull/i.test(`${code} ${message}`) &&
    /verif|owner|domain|url|source/i.test(`${code} ${message}`)
  ) {
    return "Não consegui importar a foto: verifique o domínio no painel do TikTok.";
  }
  if (code === "access_token_invalid") {
    return "A conexão com o TikTok expirou. Reconecte a conta e tente novamente.";
  }
  if (code === "scope_not_authorized") {
    return "Permissão video.publish não autorizada. Desconecte e reconecte a conta TikTok.";
  }
  return message || `Erro ao iniciar publicação da foto no TikTok (status ${status}).`;
}
