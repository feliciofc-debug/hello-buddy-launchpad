const NAME_STOPWORDS = new Set([
  "sim", "nao", "não", "ok", "okay", "obrigado", "obrigada", "valeu", "bom", "boa",
  "dia", "tarde", "noite", "oi", "ola", "olá", "consorcio", "consórcio", "orcamento",
  "orçamento", "quanto", "quero", "preciso", "aguardo", "espero", "certo", "beleza",
  "tudo", "bem", "pode", "ser", "claro", "talvez", "depois", "agora", "isso", "nada",
  "ainda", "legal", "perfeito", "entendi", "de", "do", "da", "dos", "das", "um", "uma",
]);

const SHORT_REPLY_VERBS = new Set([
  "sou", "estou", "tenho", "quero", "preciso", "moro", "trabalho", "faço", "faco",
  "vendo", "compro", "gostaria", "posso", "pode", "vamos", "vou", "falo", "falamos",
]);

function capitalizeName(value: string): string {
  return value
    .split(/\s+/)
    .map((word) =>
      word.length > 2
        ? word[0].toUpperCase() + word.slice(1).toLowerCase()
        : word.toLowerCase()
    )
    .join(" ")
    .trim();
}

function validNameWords(value: string): boolean {
  const words = value.split(/\s+/).filter(Boolean);
  return words.length >= 1 && words.length <= 3 &&
    words.every((word) =>
      word.length >= 2 &&
      !NAME_STOPWORDS.has(word.toLowerCase()) &&
      !SHORT_REPLY_VERBS.has(word.toLowerCase())
    );
}

export function asksForLeadName(text: string): boolean {
  const normalized = String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return /\b(?:como posso te chamar|qual (?:e )?(?:o )?seu nome|com quem eu falo|me diz seu nome)\b/.test(normalized);
}

export function extractLeadName(text: string, acceptsShortReply = false): string | null {
  const value = String(text || "").trim();
  if (!value) return null;
  const explicit = value.match(
    /(?:meu nome (?:é|eh|e)|me chamo|pode me chamar de|aqui (?:é|eh|e) (?:o |a )?|sou (?:o |a )?|nome:)\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’]{1,}(?:\s+(?:d[aeoi]s?\s+)?[A-Za-zÀ-ÿ'’]{2,}){0,2})/i,
  );
  if (explicit?.[1] && validNameWords(explicit[1].trim())) {
    return capitalizeName(explicit[1].trim());
  }
  if (!acceptsShortReply || value.includes("?")) return null;
  const clean = value.replace(/[^A-Za-zÀ-ÿ'’\s]/g, " ").replace(/\s+/g, " ").trim();
  return validNameWords(clean) ? capitalizeName(clean) : null;
}

export function findLeadNameInConversation(
  messages: Array<{ direction: string; content: string | null }>,
): string | null {
  let awaitingName = false;
  let found: string | null = null;
  for (const message of messages) {
    const content = String(message.content || "").trim();
    if (message.direction === "outbound") {
      awaitingName = asksForLeadName(content);
      continue;
    }
    if (message.direction !== "inbound" || !content) continue;
    const candidate = extractLeadName(content, awaitingName);
    if (candidate) found = candidate;
    awaitingName = false;
  }
  return found;
}
