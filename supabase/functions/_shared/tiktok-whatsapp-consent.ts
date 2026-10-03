const INTERACTIVE_ID_RE = /<<INTERACTIVE_ID:([^>]+)>>/i;

export type TikTokDisclosure = "non_commercial" | "brand_organic" | "branded_content";
export type TikTokInteractiveList = {
  body: string;
  button: string;
  header?: string;
  section_title?: string;
  rows: Array<{ id: string; title: string; description?: string }>;
};

const PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Todos",
  MUTUAL_FOLLOW_FRIENDS: "Amigos",
  FOLLOWER_OF_CREATOR: "Seguidores",
  SELF_ONLY: "Somente eu",
};

export function tiktokInteractiveId(text: string): string | null {
  const id = String(text || "").match(INTERACTIVE_ID_RE)?.[1] || "";
  return /^tiktok_(?:privacy|disclosure):/i.test(id) ? id : null;
}

export function textWithoutInteractiveMarker(text: string): string {
  return String(text || "").replace(/<<INTERACTIVE_ID:[^>]+>>/gi, "").trim();
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseTikTokDisclosure(text: string): TikTokDisclosure | null {
  const id = tiktokInteractiveId(text);
  const candidate = normalize(
    id?.replace(/^tiktok_disclosure:/i, "")
      || textWithoutInteractiveMarker(text),
  );
  if (candidate === "non commercial" || /\bnao (?:e )?comercial\b/.test(candidate) || /\bsem publicidade\b/.test(candidate)) {
    return "non_commercial";
  }
  if (candidate === "brand organic" || /\b(minha marca|propria marca)\b/.test(candidate)) {
    return "brand_organic";
  }
  if (candidate === "branded content" || /\b(outra marca|terceir[oa]s?)\b/.test(candidate)) {
    return "branded_content";
  }
  return null;
}

export function privacyChoiceText(text: string): string {
  const id = tiktokInteractiveId(text);
  if (id?.toLowerCase().startsWith("tiktok_privacy:")) {
    return id.slice("tiktok_privacy:".length);
  }
  return textWithoutInteractiveMarker(text);
}

export function tiktokInteractiveListFromToolResult(raw: string): TikTokInteractiveList | undefined {
  try {
    const data = JSON.parse(raw);
    if (data?.status === "aguardando_declaracao_tiktok") {
      return {
        header: "Conteúdo no TikTok",
        body: data.mensagem || "Informe se o vídeo é comercial.",
        button: "Escolher declaração",
        section_title: "Declaração",
        rows: [
          { id: "tiktok_disclosure:non_commercial", title: "Não é comercial" },
          { id: "tiktok_disclosure:brand_organic", title: "Promove minha marca" },
          { id: "tiktok_disclosure:branded_content", title: "Promove outra marca" },
        ],
      };
    }
    if (data?.status !== "aguardando_privacidade_tiktok" || !Array.isArray(data?.privacy_options)) {
      return undefined;
    }
    const options = data.privacy_options
      .filter((option: unknown): option is string => typeof option === "string" && !!option.trim());
    if (options.length === 0) return undefined;
    return {
      header: "Privacidade do TikTok",
      body: data.mensagem || "Escolha quem poderá ver o vídeo.",
      button: "Escolher privacidade",
      section_title: "Opções da sua conta",
      rows: options.slice(0, 10).map((option: string) => ({
        id: `tiktok_privacy:${option}`,
        title: (PRIVACY_LABELS[option] || option).slice(0, 24),
        description: option,
      })),
    };
  } catch {
    return undefined;
  }
}
