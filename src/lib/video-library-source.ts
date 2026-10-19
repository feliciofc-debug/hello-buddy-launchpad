/** Fonte da biblioteca de vídeos: produto (AMZ tradicional) ou veículo (AMZ Auto). */
export type VideoLibraryKind = "produto" | "veiculo";

export type VideoLibraryTableName = "produto_videos" | "veiculo_videos";

export function videoLibraryTable(kind: VideoLibraryKind): VideoLibraryTableName {
  return kind === "veiculo" ? "veiculo_videos" : "produto_videos";
}

/** Select usado pela grade de Reels do AMZ tradicional — não inclui veiculo_videos. */
export const PRODUTO_REELS_GRID_SELECT =
  "*, produtos(id, nome, imagem_url, preco, link_marketplace)" as const;

export const VEICULO_REELS_GRID_SELECT =
  "*, veiculos_estoque(id, marca, modelo, versao, status, fotos, preco)" as const;

export type VideoSourceTableForModal = "produto_videos" | "videos_produtos" | "veiculo_videos";

export function videoSourceForModal(kind: VideoLibraryKind): VideoSourceTableForModal {
  return kind === "veiculo" ? "veiculo_videos" : "produto_videos";
}
