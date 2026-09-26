export type OwnerMediaAction =
  | "generate"
  | "generate_and_post"
  | "post"
  | "edit"
  | null;

export type OwnerMediaIntent = {
  action: OwnerMediaAction;
  mediaStrategy: "generated" | "last" | null;
};

export function selectLatestImplicitMediaId(
  newestSavedMedia: { id?: string | null; created_at?: string | null } | null,
  lastInteraction: { media_id?: string | null; at?: string | null } | null,
): string | null {
  const savedId = newestSavedMedia?.id || null;
  const interactionId = lastInteraction?.media_id || null;
  const savedAtValue = newestSavedMedia?.created_at
    ? new Date(newestSavedMedia.created_at).getTime()
    : Number.NEGATIVE_INFINITY;
  const savedAt = Number.isFinite(savedAtValue)
    ? savedAtValue
    : Number.NEGATIVE_INFINITY;
  const interactionAt = lastInteraction?.at
    ? new Date(lastInteraction.at).getTime()
    : Number.NEGATIVE_INFINITY;

  if (
    interactionId &&
    Number.isFinite(interactionAt) &&
    interactionAt > savedAt
  ) {
    return interactionId;
  }
  return savedId;
}

function normalizeIntentText(text: string): string {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function withoutConversationalPrefix(text: string): string {
  return normalizeIntentText(text)
    .replace(/^jarvis[,.!:\s-]*/, "")
    .replace(/^por favor[,.!:\s-]*/, "")
    .trim();
}

export function hasImageGenerationRequest(text: string): boolean {
  const value = withoutConversationalPrefix(text);
  return /^(?:(?:eu\s+)?quero\s+(?:que\s+voce\s+)?)?(?:gera|gere|gerar|cria|crie|criar|faz|faca|fazer|monta|monte|montar)\s+(?:uma?\s+)?(?:imagem|arte|foto)\b/
    .test(value);
}

export function hasSocialPostRequest(text: string): boolean {
  const value = withoutConversationalPrefix(text);
  const verb = String.raw`(?:posta|poste|postar|publica|publique|publicar)`;
  if (!new RegExp(`\\b${verb}\\b`).test(value)) return false;

  const imperativeAtStart = new RegExp(`^(?:quero\\s+)?${verb}\\b`).test(value);
  const explicitMediaTarget = new RegExp(
    `\\b${verb}\\s+(?:(?:essa|esta|isso|esse|este)\\b|(?:a|essa|esta)\\s+(?:foto|imagem|midia|video)\\b)`,
  ).test(value);
  const socialDestination =
    /\b(?:no|na|nos|nas|pro|pra|para\s+o|para\s+a|em)\s+(?:facebook|face|fb|instagram|insta|ig|tiktok|tik\s*tok|redes?\s+sociais?)\b/
      .test(value);

  return imperativeAtStart || explicitMediaTarget || socialDestination;
}

export function hasGeneratedImagePostChain(text: string): boolean {
  const value = normalizeIntentText(text);
  return /\b(?:depois|em seguida|na sequencia)\b.{0,40}\b(?:cria|crie|criar|faz|faca|fazer|monta|monte|montar)\b.{0,20}\bpost\b/
    .test(value) ||
    (hasImageGenerationRequest(text) && hasSocialPostRequest(text));
}

export function hasDirectedImageEditRequest(text: string): boolean {
  if (hasImageGenerationRequest(text) || hasSocialPostRequest(text)) {
    return false;
  }
  const value = withoutConversationalPrefix(text);
  const match = value.match(
    /^(?:melhora|melhore|melhorar|edita|edite|editar|trata|trate|tratar|ajusta|ajuste|ajustar|transforma|transforme|transformar|coloca|coloque|colocar|troca|troque|trocar|muda|mude|mudar|aplica|aplique|aplicar|adiciona|adicione|adicionar|deixa|deixe|deixar)\b\s*(.{0,45})/,
  );
  if (!match) return false;
  const target = match[1];
  return /\b(?:(?:essa|esta|a|nessa|nesta|dessa)\s+(?:foto|imagem)|foto|imagem|fundo|cenario|ambiente|estudio|showroom|logo|logotipo|logomarca)\b/
    .test(target);
}

export function extractSocialPostBriefing(text: string): string | undefined {
  const original = String(text || "").replace(/\s+/g, " ").trim();
  const match = original.match(/\b(?:falando\s+que|sobre)\s+(.+)$/i);
  return match?.[1]?.trim() || undefined;
}

export function classifyOwnerMediaIntent(text: string): OwnerMediaIntent {
  if (hasImageGenerationRequest(text)) {
    return {
      action: hasGeneratedImagePostChain(text)
        ? "generate_and_post"
        : "generate",
      mediaStrategy: "generated",
    };
  }
  if (hasSocialPostRequest(text)) {
    return { action: "post", mediaStrategy: "last" };
  }
  if (hasDirectedImageEditRequest(text)) {
    return { action: "edit", mediaStrategy: "last" };
  }
  return { action: null, mediaStrategy: null };
}
