type VideoPublishLink = {
  plataforma: string;
  url: string;
};

const NETWORK_LABELS: Record<string, string> = {
  facebook: "FACEBOOK",
  instagram: "INSTAGRAM",
};

function networkLabel(network: string): string {
  return NETWORK_LABELS[network.toLowerCase()] || network.toUpperCase();
}

export function formatVideoPublishMessage(input: {
  published?: string[];
  links?: VideoPublishLink[];
  errors?: string[];
}): string {
  const published = input.published || [];
  const links = input.links || [];
  const errors = input.errors || [];
  const blocks: string[] = [];

  for (const network of published) {
    const link = links.find((item) =>
      item.plataforma.toLowerCase() === network.toLowerCase()
    )?.url;
    blocks.push(
      [`✅ *${networkLabel(network)}*`, link].filter(Boolean).join("\n"),
    );
  }

  for (const error of errors) {
    const match = String(error).match(/^([^:]+):\s*(.+)$/);
    const network = match?.[1] || "publicação";
    const reason = match?.[2] || String(error);
    blocks.push(`❌ *${networkLabel(network)}* — ${reason}`);
  }

  const header = published.length
    ? "🎉 *POSTAGEM REALIZADA COM SUCESSO!* 🎉"
    : "⚠️ *POSTAGEM NÃO CONCLUÍDA*";
  return [header, ...blocks].join("\n\n");
}
