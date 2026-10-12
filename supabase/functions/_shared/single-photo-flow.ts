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

export function clearImageEditStateForNewMedia() {
  return {
    pending_image_edit: null,
    pending_image_adjustment: null,
  };
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

export type SinglePhotoEditMode =
  | "aplicar_logo"
  | "aplicar_logo_cenario"
  | "projeto_ambiente"
  | "cena_produto"
  | "melhoria";

function normalizedEditText(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function singlePhotoEditMode(
  instruction: string,
  sourceDescription = "",
): SinglePhotoEditMode {
  const text = normalizedEditText(instruction);
  const vision = normalizedEditText(sourceDescription);
  const asksLogo = /\b(logo|logotipo|logomarca)\b/.test(text) ||
    /\bminha\s+marca\b/.test(text);
  const asksInteriorProject =
    /\b(projeto|arquitet[oa]|arquitetura|reforma|armarios?|decoracao|decorar|marcenaria|parede|teto)\b/
      .test(text) ||
    /\biluminacao\s+(?:do|de|para\s+o)\s+ambiente\b/.test(text) ||
    /\b(?:minha|meu|nossa|nosso|esta|este|a|o)\s+(?:sala(?:\s+de\s+jantar)?|cozinha|quarto|escritorio|loja)\b/
      .test(text);
  const sourceIsInterior =
    /\b(sala(?:\s+de\s+jantar)?|cozinha|quarto|comodo|ambiente\s+interno|interior\s+(?:de|do|da)|escritorio|loja)\b/
      .test(vision);
  const asksIsolatedProduct =
    /\b(produtos?|embalagens?|frascos?|desodorantes?|cosmeticos?|garrafas?|caixas?|latas?|itens?)\b/
      .test(text);
  const asksScene =
    /\b(ambiente|cenario|fundo|projeto|decoracao|decorar|escritorio|sala|quarto|cozinha|mesa|bancada|piso)\b/
      .test(text) ||
    /^(mantenha|mantem|preserve|crie|cria)\b.{0,80}\b(ambiente|cenario|fundo|projeto|decoracao)\b/
      .test(text);
  if (asksLogo && asksScene) return "aplicar_logo_cenario";
  if (asksLogo) return "aplicar_logo";
  if (asksInteriorProject || (sourceIsInterior && !asksIsolatedProduct)) {
    return "projeto_ambiente";
  }
  return asksScene ? "cena_produto" : "melhoria";
}

export function interiorProjectEditDirective(): string {
  return `🎯 MODO PROJETO DE INTERIORES — é o MESMO cômodo da foto, redecorado:
- Mantenha EXATAMENTE a arquitetura: mesmas paredes, mesma porta e aberturas, mesmo teto, mesmas dimensões, mesmo ângulo de câmera e enquadramento. É PROIBIDO criar janelas, portas, cortinas ou aberturas que não existem, ampliar o cômodo ou mudar a perspectiva.
- Mantenha os itens que o dono mandou manter ou tratar (por exemplo: mesa, cadeiras, piso e parede), com o mesmo modelo, material, cor, formato, proporção e posição.
- "Tratar" significa somente limpar, corrigir luz, brilho e manchas e apresentar melhor o MESMO item; não autoriza substituí-lo.
- Para o piso original: mantenha o MESMO material, a MESMA cor, o MESMO tamanho e paginação das peças e o MESMO rejunte. É PROIBIDO trocar o piso por outro material, cor ou formato.
- Aplique SOMENTE o que foi pedido: móveis planejados/armários, decoração, quadros, iluminação e acabamentos, no estilo pedido, encaixados nas paredes existentes.
- Resultado fotorealista, como foto de projeto de arquitetura daquele mesmo cômodo.
- Mantenha exatamente o formato e a proporção da foto original.`;
}
