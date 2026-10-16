import {
  isVehiclePublishableItem,
  type PublishableItem,
} from "@/lib/publishable-item";

export function buildGerarPostsInvokeBody(item: PublishableItem) {
  if (!isVehiclePublishableItem(item)) {
    return {
      produto: {
        nome: item.nome,
        preco: item.preco,
        descricao: item.descricao || "",
      },
    };
  }
  const veiculo = item.veiculo;
  if (!veiculo?.marca || !veiculo.modelo) {
    throw new Error("Dados do veículo incompletos para gerar copy.");
  }
  return {
    item_tipo: "veiculo" as const,
    produto: {
      nome: item.nome,
      descricao: item.descricao || "",
    },
    veiculo,
  };
}
