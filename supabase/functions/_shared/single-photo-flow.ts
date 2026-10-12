export function singlePhotoActionButtons() {
  return {
    body: "O que quer fazer com esta foto?",
    buttons: [
      { id: "single_photo:ad", title: "Anúncio" },
      { id: "single_photo:edit", title: "Editar imagem" },
      { id: "single_photo:post", title: "Post nas redes" },
    ],
  };
}

export function singlePhotoFormatButtons() {
  return {
    body: "Selecione uma opção.",
    buttons: [
      { id: "single_photo:format:feed", title: "Feed" },
      { id: "single_photo:format:story", title: "Story" },
    ],
  };
}

export function shouldOfferSinglePhotoActions(input: {
  isOwner: boolean;
  verticalRoute: "geral" | "veiculo";
  incomingPhotoCount: number;
  context: string;
}): boolean {
  return input.isOwner &&
    input.verticalRoute === "geral" &&
    input.incomingPhotoCount > 0 &&
    !input.context;
}

export function pendingImageEditIsActive(
  createdAt: string,
  nowMs = Date.now(),
): boolean {
  const created = new Date(createdAt).getTime();
  return Number.isFinite(created) &&
    created <= nowMs &&
    nowMs - created <= 30 * 60 * 1000;
}

export function singlePhotoEditMode(
  instruction: string,
):
  | "aplicar_logo"
  | "aplicar_logo_cenario"
  | "cena_produto"
  | "melhoria" {
  const text = String(instruction || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const asksLogo = /\b(logo|logotipo|logomarca)\b/.test(text) ||
    /\bminha\s+marca\b/.test(text);
  const asksScene =
    /\b(ambiente|cenario|fundo|projeto|decoracao|decorar|escritorio|sala|quarto|cozinha|mesa|bancada|piso)\b/
      .test(text) ||
    /^(mantenha|mantem|preserve|crie|cria)\b.{0,80}\b(ambiente|cenario|fundo|projeto|decoracao)\b/
      .test(text);
  if (asksLogo && asksScene) return "aplicar_logo_cenario";
  if (asksLogo) return "aplicar_logo";
  return asksScene ? "cena_produto" : "melhoria";
}
