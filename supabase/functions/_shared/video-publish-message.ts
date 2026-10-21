type VideoPublishLink = {
  plataforma: string;
  url: string;
};

import { metaVideoPlatformLabel } from "./video-publish-platforms.ts";

function networkLabel(network: string): string {
  return metaVideoPlatformLabel(network).toUpperCase();
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

  const publishedKeys = new Set(
    published.map((network) => network.toLowerCase()),
  );
  for (const error of errors) {
    const match = String(error).match(/^([^:]+):\s*(.+)$/);
    const network = match?.[1] || "publicação";
    if (publishedKeys.has(network.toLowerCase())) continue;
    const reason = match?.[2] || String(error);
    blocks.push(`❌ *${networkLabel(network)}* — ${reason}`);
  }

  const hasErrors = blocks.some((block) => block.startsWith("❌"));
  const header = published.length && hasErrors
    ? "⚠️ *PUBLICADO EM PARTE*"
    : published.length
    ? "🎉 *POSTAGEM REALIZADA COM SUCESSO!* 🎉"
    : "⚠️ *POSTAGEM NÃO CONCLUÍDA*";
  return [header, ...blocks].join("\n\n");
}
