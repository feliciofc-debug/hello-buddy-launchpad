type PostVariationsMap = Record<string, Record<string, string>>;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSourceFragments(sourceInput?: string) {
  if (!sourceInput) return [] as string[];

  const compact = sourceInput.replace(/\s+/g, " ").trim();
  if (!compact) return [] as string[];

  const fragments = compact
    .split(/[\n,;|]+/)
    .map((segment) =>
      segment
        .replace(/^[-–•\d.()\s]+/, "")
        .replace(/\betc\.?$/i, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((segment) => segment.length >= 16);

  return Array.from(new Set([compact, ...fragments])).sort((a, b) => b.length - a.length);
}

function isInstructionLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return true;

  const patterns = [
    /^(contexto|prompt|descrição|descricao|brief|objetivo|importante|atenção|atencao|observação|observacao|formato)\s*:?\s*$/i,
    /^analise esta imagem\b/i,
    /^crie posts?\b/i,
    /^crie um post\b/i,
    /^gere \d+\s+variações\b/i,
    /^(instagram|facebook|story(?: instagram)?|whatsapp)\s*\(\d+\s+variações?\)\s*:?\s*$/i,
    /^-?\s*opção\s*[abc]\b/i,
    /^-?\s*opcao\s*[abc]\b/i,
    /^retorne apenas\b/i,
    /^responda somente\b/i,
    /^nunca inclua\b/i,
    /^todos os textos devem\b/i,
    /^use emojis\b/i,
    /^mantenha o tom\b/i,
    /^sempre termine com\b/i,
    /^sempre inclua\b/i,
    /^json válido\b/i,
    /^json valido\b/i,
    /^max\s+\d+/i,
    /^você é um especialista\b/i,
    /^voce é um especialista\b/i,
    /^lead(?:\s*\(|\s*:|\b)/i,
    /^(produto\/serviço|produto\/servico|rede social)\s*:?\s*$/i,
    /^sem\s+["“”']?post:?/i,
    /^-?\s*(nome|profissão|profissao|especialidade|cidade)\s*:/i,
    /^-?\s*(o post será publicado|o post sera publicado|o lead verá|o lead vera|deve ser orgânico|deve ser organico|tom\s*:|máximo\s+\d+\s+caracteres|maximo\s+\d+\s+caracteres|foco no valor)\b/i,
    /^\d+\.\s*(aborde|mencione|gere|termine|use|cite|ensine|inclua)\b/i,
  ];

  const normalized = trimmed.toLowerCase();

  return (
    patterns.some((pattern) => pattern.test(trimmed)) ||
    normalized.includes("contexto resumido") ||
    normalized.includes("idioma obrigatório") ||
    normalized.includes("idioma obrigatorio") ||
    normalized.includes("schema json") ||
    normalized.includes("conteúdo final do post") ||
    normalized.includes("conteudo final do post")
  );
}

function stripPromptBlocks(text: string) {
  return text
    .replace(
      /LEAD\s*\([^)]*\)\s*:[\s\S]*?(?=\n\s*(?:PRODUTO\/SERVIÇO|PRODUTO\/SERVICO|OBJETIVO|REDE SOCIAL|IMPORTANTE|CRIE UM POST|FORMATO)\b|$)/gi,
      "\n"
    )
    .replace(
      /PRODUTO\/SERVI[ÇC]O\s*:[\s\S]*?(?=\n\s*(?:OBJETIVO|REDE SOCIAL|IMPORTANTE|CRIE UM POST|FORMATO)\b|$)/gi,
      "\n"
    )
    .replace(/OBJETIVO\s*:[\s\S]*?(?=\n\s*(?:REDE SOCIAL|IMPORTANTE|CRIE UM POST|FORMATO)\b|$)/gi, "\n")
    .replace(/REDE SOCIAL\s*:[\s\S]*?(?=\n\s*(?:IMPORTANTE|CRIE UM POST|FORMATO)\b|$)/gi, "\n")
    .replace(/IMPORTANTE\s*:[\s\S]*?(?=\n\s*(?:CRIE UM POST|FORMATO)\b|$)/gi, "\n")
    .replace(/CRIE UM POST[^\n]*[\s\S]*?(?=\n\s*FORMATO\s*:|$)/gi, "\n")
    .replace(/FORMATO\s*:[\s\S]*$/gi, "\n")
    .replace(
      /Crie posts? promocionais? para o seguinte produto:\s*[\s\S]*?(?=\n\s*Gere\s+\d+\s+variações\b|$)/gi,
      "\n"
    )
    .replace(/Gere\s+\d+\s+variações[\s\S]*?(?=\n\s*Retorne APENAS\b|$)/gi, "\n")
    .replace(
      /Crie\s+(?:uma legenda de Instagram|uma mensagem de WhatsApp|um post de Facebook|um script de TikTok|um email marketing)\s+para promover este produto:\s*[\s\S]*?(?=\n\s*(?:A legenda deve|A mensagem deve|O post deve|O script deve|O email deve incluir)\s*:|$)/gi,
      "\n"
    )
    .replace(/(?:A legenda deve|A mensagem deve|O post deve|O script deve|O email deve incluir)\s*:[\s\S]*$/gi, "\n");
}

export function sanitizeGeneratedPostText(text: string, sourceInput?: string) {
  if (!text) return "";

  let cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/```/g, "")
    .replace(/^(Aqui está|Segue|Claro|Certo|Ok|Entendido|Com certeza)[^\n]*\n*/i, "")
    .replace(/(?:^|\n)\s*(?:Contexto|Prompt|Descrição|Descricao|Brief)\s*:\s*/gim, "\n")
    .replace(/Analise esta imagem e crie posts? promocionais? basead[oa]s? neste contexto resumido:\s*["“”]?/gi, "")
    .replace(/Crie posts? promocionais? para o seguinte produto:\s*/gi, "")
    .replace(/IDIOMA OBRIGATÓRIO:[^\n]*/gi, "")
    .replace(/IDIOMA OBRIGATORIO:[^\n]*/gi, "")
    .replace(/Retorne APENAS[^\n]*/gi, "")
    .replace(/Responda SOMENTE[^\n]*/gi, "")
    .replace(/\bNUNCA inclua[^\n]*/gi, "")
    .replace(/\bTODOS os textos devem[^\n]*/gi, "")
    .replace(/\r/g, "")
    .trim();

  cleaned = stripPromptBlocks(cleaned);

  for (const fragment of buildSourceFragments(sourceInput)) {
    cleaned = cleaned.replace(new RegExp(escapeRegExp(fragment), "gi"), "");
  }

  cleaned = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !isInstructionLine(line))
    .join("\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/^[\s,:;\-"“”]+/, "")
    .replace(/[\s"“”]+$/, "")
    .trim();

  return cleaned;
}

export function sanitizeGeneratedPostVariations<T extends PostVariationsMap>(posts: T, sourceInput?: string) {
  return Object.fromEntries(
    Object.entries(posts).map(([platform, options]) => [
      platform,
      Object.fromEntries(
        Object.entries(options).map(([key, value]) => [key, sanitizeGeneratedPostText(value, sourceInput)])
      ),
    ])
  ) as T;
}