// ============================================================
// ESTILO DE COPY POR TENANT (multi-tenant, isolado por user_id)
//
// voz_copy = 'empresa' → 1ª pessoa do PLURAL (padrão, comportamento antigo)
// voz_copy = 'pessoa'  → 1ª pessoa do SINGULAR ("me chama", "eu te ajudo"),
//                        assinando com nome_assinatura.
//
// Link de atendimento: empresa_config.link_post; se vazio, o wa.me montado a
// partir do whatsapp_config.display_phone DO PRÓPRIO user_id.
// NUNCA número/constante fixa no código.
// ============================================================

export type VozCopy = "empresa" | "pessoa";

export type CopyStyle = {
  voz: VozCopy;
  assinatura: string | null;
  /** link de atendimento do tenant (https://wa.me/... ou link_post salvo) */
  link: string | null;
  /** bloco pronto para injetar no prompt da IA */
  promptBlock: string;
};

export const COPY_STYLE_PADRAO: CopyStyle = {
  voz: "empresa",
  assinatura: null,
  link: null,
  promptBlock: "",
};

/** Extrai o user_id (sub) do JWT do request, sem chamada de rede. */
export function userIdDoRequest(req: Request): string | null {
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    const parte = token.split(".")[1];
    if (!parte) return null;
    const json = JSON.parse(
      atob(parte.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((parte.length + 3) % 4)),
    );
    const sub = String(json?.sub || "").trim();
    return /^[0-9a-f-]{36}$/i.test(sub) ? sub : null;
  } catch {
    return null;
  }
}

function montarPromptBlock(voz: VozCopy, assinatura: string | null, link: string | null): string {
  const linhas: string[] = ["", "=== VOZ E FORMATO DA COPY (OBRIGATÓRIO) ==="];

  if (voz === "pessoa") {
    linhas.push(
      "- Escreva em PRIMEIRA PESSOA DO SINGULAR, como um consultor autônomo falando com o cliente:",
      '  "me chama", "eu te ajudo", "eu te mostro", "fale comigo". ',
      '- É PROIBIDO usar plural de empresa: "nós", "nossa equipe", "fale com a gente", "ajudamos você", "aqui na <empresa>".',
      assinatura
        ? `- Assine a copy no final com "— ${assinatura}" (antes das hashtags).`
        : "- Não assine com nome de empresa.",
    );
  } else {
    linhas.push(
      "- Escreva em primeira pessoa do PLURAL, como empresa (\"nossa equipe\", \"fale com a gente\").",
    );
  }

  if (link) {
    linhas.push(
      `- Comece a copy com uma chamada CURTA já com o link de WhatsApp: ${link}`,
      "- O link tem que estar nos primeiros ~120 caracteres (o Instagram corta a legenda com \"... mais\").",
      "- Nunca deixe o link só no fim do texto.",
    );
  }

  linhas.push("- Ordem da copy: 1) chamada curta com o link, 2) corpo, 3) hashtags.", "");
  return linhas.join("\n");
}

export async function getCopyStyle(sb: any, userId: string | null | undefined): Promise<CopyStyle> {
  if (!userId) return COPY_STYLE_PADRAO;

  let voz: VozCopy = "empresa";
  let assinatura: string | null = null;
  let link: string | null = null;

  try {
    const { data } = await sb
      .from("empresa_config")
      .select("voz_copy, nome_assinatura, link_post")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      voz = data.voz_copy === "pessoa" ? "pessoa" : "empresa";
      assinatura = (data.nome_assinatura || "").trim() || null;
      const lp = (data.link_post || "").trim();
      if (/^https?:\/\//i.test(lp)) link = lp;
    }
  } catch (e) {
    console.warn("⚠️ getCopyStyle: empresa_config indisponível:", (e as Error).message);
  }

  if (!link) {
    try {
      const { data } = await sb
        .from("whatsapp_config")
        .select("display_phone")
        .eq("user_id", userId)
        .maybeSingle();
      const digits = String(data?.display_phone || "").replace(/\D/g, "");
      if (digits.length >= 10) link = `https://wa.me/${digits}`;
    } catch (e) {
      console.warn("⚠️ getCopyStyle: whatsapp_config indisponível:", (e as Error).message);
    }
  }

  return { voz, assinatura, link, promptBlock: montarPromptBlock(voz, assinatura, link) };
}

/**
 * Garante o link no INÍCIO da legenda e a assinatura pessoal no fim.
 * Idempotente: se o link/assinatura já estiverem no texto, não duplica.
 */
export function aplicarEstiloCopy(texto: string | null | undefined, style: CopyStyle): string {
  let base = (texto || "").trim();
  if (!base) return style.link || "";

  if (style.link && !base.includes(style.link)) {
    const chamada = style.voz === "pessoa" ? "Me chama no WhatsApp" : "Fale com a gente no WhatsApp";
    base = `${chamada}: ${style.link}\n\n${base}`;
  }

  if (style.voz === "pessoa" && style.assinatura && !base.includes(style.assinatura)) {
    base = `${base}\n\n— ${style.assinatura}`;
  }

  return base;
}
