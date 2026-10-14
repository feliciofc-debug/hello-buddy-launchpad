export type PublishableItemType = "produto" | "veiculo";

export type PublishableItem = {
  id: string;
  item_tipo?: PublishableItemType;
  nome: string;
  descricao?: string | null;
  preco?: number | null;
  imagem_url?: string | null;
  imagens?: unknown;
  link?: string | null;
  link_marketplace?: string | null;
  incluir_cta_whatsapp?: boolean | null;
  estoque?: number;
  especificacoes?: string | null;
  categoria?: string;
  modo_postagem_fb?: string | null;
  engajamento_estilos?: string[] | null;
  ig_product_id?: string | null;
};

export const publishableItemType = (
  item: Pick<PublishableItem, "item_tipo">,
): PublishableItemType => item.item_tipo === "veiculo" ? "veiculo" : "produto";

export const isVehiclePublishableItem = (
  item: Pick<PublishableItem, "item_tipo">,
) => publishableItemType(item) === "veiculo";

export const publishableQueueLink = (
  item: Pick<PublishableItem, "id" | "item_tipo">,
) => isVehiclePublishableItem(item)
  ? {
    item_tipo: "veiculo" as const,
    veiculo_id: item.id,
    produto_id: null,
    produto_source: "veiculos_estoque",
  }
  : {
    produto_id: item.id,
    produto_source: "produtos",
  };

export const publishableCampaignReference = (
  item: Pick<PublishableItem, "id" | "item_tipo">,
) => isVehiclePublishableItem(item)
  ? { item_tipo: "veiculo" as const, veiculo_id: item.id }
  : { produto_id: item.id };

export const publishableInstagramReference = publishableCampaignReference;

export const publishableImageUrls = (
  item: Pick<PublishableItem, "imagem_url" | "imagens">,
): string[] => {
  const urls = new Set<string>();
  const append = (value: unknown): void => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(append);
      return;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return;
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
          append(JSON.parse(trimmed));
          return;
        } catch {
          // Uma URL pode começar com caracteres incomuns; preserve o original.
        }
      }
      urls.add(trimmed);
      return;
    }
    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      for (const key of ["imagens", "image_urls", "photos", "urls"]) {
        if (key in record) append(record[key]);
      }
    }
  };

  append(item.imagem_url);
  append(item.imagens);
  return [...urls];
};
