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
