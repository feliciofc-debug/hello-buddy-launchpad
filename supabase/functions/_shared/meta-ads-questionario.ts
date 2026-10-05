import type { MetaAdsDraft, MetaAdsTarget } from "./meta-ads-create.ts";

export const META_ADS_QUESTIONARIO_TTL_MS = 24 * 60 * 60 * 1000;
export const META_ADS_QUESTIONARIO_PREFIX = "meta_ads_q:";

export type MetaAdsQuestionarioEtapa =
  | "objetivo"
  | "url_site"
  | "publico"
  | "cidade"
  | "confirmar_cidade"
  | "raio"
  | "idade"
  | "idade_personalizada"
  | "orcamento"
  | "duracao"
  | "midia"
  | "texto"
  | "texto_manual"
  | "resumo";

export type MetaAdsQuestionarioMidia = {
  id: string;
  url: string;
  tipo: "image" | "video";
  titulo: string;
  thumbnail_url?: string;
};

export type MetaAdsQuestionario = {
  etapa: MetaAdsQuestionarioEtapa;
  criado_em: string;
  atualizado_em: string;
  objetivo?: "whatsapp" | "site";
  destination_url?: string;
  pacote_publico?: string;
  publicos_sugeridos?: Array<{ nome: string; interesses: MetaAdsTarget[] }>;
  interesses?: MetaAdsTarget[];
  cidades_encontradas?: MetaAdsTarget[];
  cidade?: MetaAdsTarget;
  raio_km?: number;
  age_min?: number;
  age_max?: number;
  orcamento_diario?: number;
  duracao_dias?: number;
  midia?: MetaAdsQuestionarioMidia;
  titulo?: string;
  texto_principal?: string;
  resumo_hash?: string;
};

export type QuestionarioRow = {
  id: string;
  status?: string | null;
  criado_em?: string | null;
  rascunho?: Record<string, unknown> | null;
};

export type QuestionarioList = {
  body: string;
  button: string;
  header?: string;
  footer?: string;
  section_title?: string;
  rows: Array<{ id: string; title: string; description?: string }>;
};

export type QuestionarioButtons = {
  body: string;
  header?: string;
  footer?: string;
  buttons: Array<{ id: string; title: string }>;
};

export type MetaAdsQuestionarioAmbiguidade = {
  texto_original: string;
  criado_em: string;
};

export type MetaAdsQuestionarioAmbiguidadeEscolha = {
  destino: "meta_ads" | "jarvis";
  textoOriginal: string;
} | null;

export const META_ADS_AMBIGUIDADE_TTL_MS = 15 * 60 * 1000;
export const META_ADS_LIMIT_PROPOSAL_TTL_MS = 15 * 60 * 1000;
export const META_ADS_LIMIT_MIN = 50;
export const META_ADS_LIMIT_MAX = 10_000;

export type MetaAdsLimitProposal = {
  token: string;
  limite_atual: number;
  novo_limite: number;
  gasto_mes: number;
  criado_em: string;
};

export type MetaAdsLimitValueRequest = {
  criado_em: string;
};

export type MetaAdsLimitAction = {
  action: "confirm" | "cancel";
  proposal: MetaAdsLimitProposal;
} | null;

export type MetaAdsLimitValueInputAction = "consume" | "clear" | "ignore";

function normalizar(value: unknown): string {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

function limitar(value: unknown, maximum: number): string {
  return String(value ?? "").trim().slice(0, maximum);
}

export function isMetaAdsQuestionarioTrigger(text: unknown): boolean {
  if (
    interactiveId(text) ===
      `${META_ADS_QUESTIONARIO_PREFIX}ambiguidade:meta`
  ) return true;
  const value = normalizar(text)
    .replace(/<<interactive_id:[^>]+>>/g, "").trim();
  if (!value || isMetaAdsQuestionarioConsulta(value)) return false;
  const paidTerms =
    /\b(?:meta ads|facebook ads|instagram ads|anuncio pago|anuncios pagos|campanha de anuncios|campanha paga|trafego pago|impulsionar|impulsione|impulsionamento|patrocinad[oa]s?|patrocinar)\b/;
  if (paidTerms.test(value)) return true;
  const adIntent = /\b(?:anunciar|anuncie|anuncio|anuncios|campanha)\b/;
  const metaChannel = /\b(?:meta|facebook|instagram)\b/;
  const visualCreation =
    /\b(?:arte|imagem|card|banner|criativo|design|foto)\b/;
  if (/\b(?:anunciar|anuncie)\b/.test(value) && metaChannel.test(value)) {
    return true;
  }
  return adIntent.test(value) && metaChannel.test(value) &&
    !visualCreation.test(value);
}

function isMetaAdsQuestionarioConsulta(value: string): boolean {
  return /^(?:como|quando|onde|qual|quais|por que|porque)\b/.test(value) ||
    /\b(?:como esta|quero saber|consultar|consulta|relatorio|metricas|desempenho|resultado|status|quanto gast|campanha atual|minha campanha)\b/.test(
      value,
    );
}

export function isMetaAdsQuestionarioAmbiguousRequest(
  text: unknown,
): boolean {
  const value = normalizar(text)
    .replace(/<<interactive_id:[^>]+>>/g, "").trim();
  if (
    !value || isMetaAdsQuestionarioTrigger(value) ||
    isMetaAdsQuestionarioConsulta(value)
  ) return false;
  if (
    /\b(?:whatsapp|zap)\b/.test(value) ||
    /\b(?:arte|imagem|card|banner|criativo|design|foto)\b/.test(value)
  ) return false;
  return /\b(?:criar|cria|crie|fazer|faz|faca|montar|monte|quero|nova?)\b.*\b(?:anuncio|anuncios|campanha)\b/.test(
    value,
  );
}

export function metaAdsQuestionarioAmbiguityButtons(): QuestionarioButtons {
  return questionarioButtons({
    body: "Você quer criar um anúncio pago na Meta ou uma arte de anúncio?",
    buttons: [
      {
        id: `${META_ADS_QUESTIONARIO_PREFIX}ambiguidade:meta`,
        title: "Anúncio pago (Meta)",
      },
      {
        id: `${META_ADS_QUESTIONARIO_PREFIX}ambiguidade:arte`,
        title: "Arte de anúncio",
      },
      {
        id: `${META_ADS_QUESTIONARIO_PREFIX}ambiguidade:outra`,
        title: "Outra coisa",
      },
    ],
  });
}

export function resolveMetaAdsQuestionarioAmbiguity(input: {
  text: unknown;
  pending?: MetaAdsQuestionarioAmbiguidade | null;
  now?: Date;
}): MetaAdsQuestionarioAmbiguidadeEscolha {
  if (!input.pending?.texto_original || !input.pending.criado_em) return null;
  const created = Date.parse(input.pending.criado_em);
  const now = (input.now ?? new Date()).getTime();
  if (
    !Number.isFinite(created) || created > now ||
    now - created > META_ADS_AMBIGUIDADE_TTL_MS
  ) return null;
  const id = interactiveId(input.text);
  if (id === `${META_ADS_QUESTIONARIO_PREFIX}ambiguidade:meta`) {
    return { destino: "meta_ads", textoOriginal: input.pending.texto_original };
  }
  if (
    id === `${META_ADS_QUESTIONARIO_PREFIX}ambiguidade:arte` ||
    id === `${META_ADS_QUESTIONARIO_PREFIX}ambiguidade:outra`
  ) {
    return { destino: "jarvis", textoOriginal: input.pending.texto_original };
  }
  return null;
}

export function validarNovoLimiteMensalAnuncios(
  value: unknown,
): number | null {
  const parsed = typeof value === "string"
    ? Number(value.replace(/[^\d,.-]/g, "").replace(",", "."))
    : Number(value);
  if (
    !Number.isFinite(parsed) || parsed < META_ADS_LIMIT_MIN ||
    parsed > META_ADS_LIMIT_MAX
  ) return null;
  return Math.round(parsed * 100) / 100;
}

export function isMetaAdsLimitChangeRequest(text: unknown): boolean {
  const value = normalizar(text)
    .replace(/<<interactive_id:[^>]+>>/g, "").trim();
  return /\b(?:aumentar|aumenta|alterar|altera|mudar|muda|ajustar|ajusta|subir|definir|trocar)\b.*\blimite\b/.test(
    value,
  ) &&
    /\b(?:anuncio|anuncios|meta|campanha|mensal)\b/.test(value);
}

export function metaAdsLimitProposalButtons(
  token: string,
): QuestionarioButtons {
  return questionarioButtons({
    body: "Confirma a alteração do limite mensal de anúncios?",
    buttons: [
      { id: `meta_ads_limit:confirm:${token}`, title: "Confirmar" },
      { id: `meta_ads_limit:cancel:${token}`, title: "Cancelar" },
    ],
  });
}

export function resolveMetaAdsLimitAction(input: {
  text: unknown;
  pending?: MetaAdsLimitProposal | null;
  isOwner: boolean;
  now?: Date;
}): MetaAdsLimitAction {
  if (!input.isOwner || !input.pending?.token || !input.pending.criado_em) {
    return null;
  }
  const created = Date.parse(input.pending.criado_em);
  const now = (input.now ?? new Date()).getTime();
  if (
    !Number.isFinite(created) || created > now ||
    now - created > META_ADS_LIMIT_PROPOSAL_TTL_MS
  ) return null;
  const id = interactiveId(input.text);
  if (id === `meta_ads_limit:confirm:${input.pending.token}`) {
    return { action: "confirm", proposal: input.pending };
  }
  if (id === `meta_ads_limit:cancel:${input.pending.token}`) {
    return { action: "cancel", proposal: input.pending };
  }
  return null;
}

export function resolveMetaAdsLimitValueInput(input: {
  text: unknown;
  pending?: MetaAdsLimitValueRequest | null;
  isOwner: boolean;
  now?: Date;
}): MetaAdsLimitValueInputAction {
  if (!input.isOwner || !input.pending?.criado_em) return "ignore";
  const created = Date.parse(input.pending.criado_em);
  const now = (input.now ?? new Date()).getTime();
  if (
    !Number.isFinite(created) || created > now ||
    now - created > META_ADS_LIMIT_PROPOSAL_TTL_MS
  ) return "clear";
  return /\d/.test(String(input.text ?? "")) ? "consume" : "clear";
}

export function isMetaAdsQuestionarioCancel(text: unknown): boolean {
  const value = normalizar(text).replace(/<<interactive_id:[^>]+>>/g, "").trim();
  return /^(?:cancelar|cancela|desistir|parar|meta_ads_q:cancelar)$/.test(value) ||
    interactiveId(text) === `${META_ADS_QUESTIONARIO_PREFIX}cancelar`;
}

export function isMetaAdsQuestionarioResume(text: unknown): boolean {
  const value = normalizar(text);
  return interactiveId(text) === `${META_ADS_QUESTIONARIO_PREFIX}continuar` ||
    /\bcontinuar (?:a |o )?(?:campanha|anuncio)\b/.test(value);
}

export function interactiveId(text: unknown): string | null {
  const match = String(text ?? "").match(/<<INTERACTIVE_ID:([^>]+)>>/i);
  return match?.[1]?.trim() || null;
}

export function metaAdsQuestionarioExpirado(
  questionario: MetaAdsQuestionario | null | undefined,
  now = new Date(),
): boolean {
  if (!questionario?.criado_em) return true;
  const created = Date.parse(questionario.criado_em);
  return !Number.isFinite(created) || created > now.getTime() ||
    now.getTime() - created > META_ADS_QUESTIONARIO_TTL_MS;
}

export function questionarioAtivo(
  rows: QuestionarioRow[],
  now = new Date(),
): QuestionarioRow | null {
  return rows
    .filter((row) =>
      row.status === "rascunho" &&
      row.rascunho?.questionario &&
      !metaAdsQuestionarioExpirado(
        row.rascunho.questionario as MetaAdsQuestionario,
        now,
      )
    )
    .sort((a, b) =>
      Date.parse(String(b.criado_em ?? "")) -
      Date.parse(String(a.criado_em ?? ""))
    )[0] ?? null;
}

export function novoMetaAdsQuestionario(now = new Date()): MetaAdsQuestionario {
  const iso = now.toISOString();
  return { etapa: "objetivo", criado_em: iso, atualizado_em: iso };
}

export function avancarMetaAdsQuestionario(
  atual: MetaAdsQuestionario,
  etapa: MetaAdsQuestionarioEtapa,
  valores: Partial<MetaAdsQuestionario> = {},
  now = new Date(),
): MetaAdsQuestionario {
  return {
    ...atual,
    ...valores,
    etapa,
    criado_em: atual.criado_em,
    atualizado_em: now.toISOString(),
  };
}

export function questionarioList(input: {
  body: string;
  button?: string;
  header?: string;
  footer?: string;
  sectionTitle?: string;
  rows: Array<{ id: string; title: string; description?: string }>;
}): QuestionarioList {
  return {
    body: limitar(input.body, 1024),
    button: limitar(input.button || "Escolher", 20),
    header: input.header ? limitar(input.header, 60) : undefined,
    footer: input.footer ? limitar(input.footer, 60) : undefined,
    section_title: input.sectionTitle
      ? limitar(input.sectionTitle, 24)
      : undefined,
    rows: input.rows.slice(0, 10).map((row) => ({
      id: limitar(row.id, 200),
      title: limitar(row.title, 24),
      description: row.description
        ? limitar(row.description, 72)
        : undefined,
    })),
  };
}

export function questionarioButtons(input: {
  body: string;
  header?: string;
  footer?: string;
  buttons: Array<{ id: string; title: string }>;
}): QuestionarioButtons {
  return {
    body: limitar(input.body, 1024),
    header: input.header ? limitar(input.header, 60) : undefined,
    footer: input.footer ? limitar(input.footer, 60) : undefined,
    buttons: input.buttons.slice(0, 3).map((button) => ({
      id: limitar(button.id, 200),
      title: limitar(button.title, 20),
    })),
  };
}

export function metaAdsQuestionarioContinuarButtons(): QuestionarioButtons {
  return questionarioButtons({
    body: "Sua campanha ficou salva. Quer continuar de onde parou?",
    buttons: [{
      id: `${META_ADS_QUESTIONARIO_PREFIX}continuar`,
      title: "Continuar campanha",
    }],
  });
}

export function respostaPertenceAoQuestionario(
  text: unknown,
  etapa: MetaAdsQuestionarioEtapa,
): boolean {
  const id = interactiveId(text);
  if (id?.startsWith(META_ADS_QUESTIONARIO_PREFIX)) return true;
  const value = normalizar(text);
  if (!value) return etapa === "midia";
  if (isMetaAdsQuestionarioCancel(value) || isMetaAdsQuestionarioResume(value)) {
    return true;
  }
  if (etapa === "objetivo") return /^(?:whatsapp|conversas?|site|visitas?)$/.test(value);
  if (etapa === "publico") return value === "publico amplo";
  if (etapa === "cidade") {
    return value.length <= 80 && !/[?]/.test(value) &&
      !/\b(?:relatorio|campanha atual|pausar|reativar|publicar|anuncio atual|quanto gastou|me manda|me mostre|preciso|quero saber)\b/.test(value);
  }
  if (etapa === "url_site") {
    return /^(?:https?:\/\/|www\.)|(?:^|\s)[^\s]+\.[a-z]{2,}(?:\/\S*)?$/i
      .test(String(text).trim());
  }
  if (etapa === "idade_personalizada") {
    return /\b\d{2}\s*[-–a]\s*\d{2}\b/i.test(value);
  }
  if (etapa === "texto_manual") {
    return String(text).split(/\n+/).filter((line) => line.trim()).length >= 2;
  }
  if (etapa === "raio" || etapa === "duracao") return /\d/.test(value);
  if (etapa === "idade") return /\d{2}\s*[-–a]\s*\d{2}|^outra$/.test(value);
  if (etapa === "texto") return /^(?:aprovar|reescrever|eu escrevo)$/.test(value);
  if (etapa === "orcamento") return /\d/.test(value);
  return false;
}

export function filtrarInteressesValidados(
  requested: string[],
  found: MetaAdsTarget[],
): MetaAdsTarget[] {
  const wanted = requested.map(normalizar);
  const seen = new Set<string>();
  return found.filter((item) => {
    if (!item?.id || !item?.name || seen.has(item.id)) return false;
    const name = normalizar(item.name);
    if (!wanted.some((term) => name === term || name.includes(term) || term.includes(name))) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

export function metaAdsQuestionarioBudget(input: {
  daily: unknown;
  duration: unknown;
  available: unknown;
}): { ok: true; maximumSpend: number } | {
  ok: false;
  maximumSpend: number;
  available: number;
} {
  const daily = Number(input.daily);
  const duration = Math.trunc(Number(input.duration));
  const available = Math.max(0, Number(input.available) || 0);
  const maximumSpend = Math.round(daily * duration * 100) / 100;
  return Number.isFinite(maximumSpend) && maximumSpend > 0 &&
      maximumSpend <= available
    ? { ok: true, maximumSpend }
    : { ok: false, maximumSpend, available };
}

export function metaAdsMaximoDiarioParaSeteDias(
  available: unknown,
): number {
  const value = Math.max(0, Number(available) || 0);
  return Math.max(1, Math.floor(value / 7));
}

export function avaliarMetaAdsOrcamentoMinimo(input: {
  daily: unknown;
  available: unknown;
}): {
  ok: boolean;
  exhausted: boolean;
  maximumDaily: number;
  available: number;
} {
  const available = Math.max(0, Number(input.available) || 0);
  const daily = Number(input.daily);
  return {
    ok: Number.isFinite(daily) && daily >= 1 && daily * 7 <= available,
    exhausted: available < 7,
    maximumDaily: metaAdsMaximoDiarioParaSeteDias(available),
    available,
  };
}

export function metaAdsBudgetRecoveryButtons(
  exhausted: boolean,
): QuestionarioButtons {
  return questionarioButtons({
    body: exhausted
      ? "O limite mensal está esgotado. O que deseja fazer?"
      : "Esse orçamento não cabe no limite mensal. O que deseja fazer?",
    buttons: [
      ...(exhausted
        ? []
        : [{
          id: `${META_ADS_QUESTIONARIO_PREFIX}budget:mudar`,
          title: "Mudar orçamento",
        }]),
      {
        id: `${META_ADS_QUESTIONARIO_PREFIX}budget:aumentar_limite`,
        title: "Aumentar limite",
      },
      { id: `${META_ADS_QUESTIONARIO_PREFIX}cancelar`, title: "Cancelar" },
    ],
  });
}

export function voltarMetaAdsQuestionarioParaOrcamento(
  questionario: MetaAdsQuestionario,
  now = new Date(),
): MetaAdsQuestionario {
  return avancarMetaAdsQuestionario(
    questionario,
    "orcamento",
    {},
    now,
  );
}

export function metaAdsQuestionarioResumo(
  questionario: MetaAdsQuestionario,
): string {
  const objetivo = questionario.objetivo === "site"
    ? `Visitas ao site (${questionario.destination_url})`
    : "Conversas no WhatsApp";
  const publico = questionario.interesses?.length
    ? questionario.interesses.map((item) => item.name).join(", ")
    : "Público amplo";
  const genero = "Todos";
  const total = (questionario.orcamento_diario ?? 0) *
    (questionario.duracao_dias ?? 0);
  return [
    "Resumo da campanha",
    `Objetivo: ${objetivo}`,
    `Público: ${publico}`,
    `Local: ${questionario.cidade?.name ?? "—"} · ${questionario.raio_km ?? 0} km`,
    `Idade: ${questionario.age_min ?? 18}–${questionario.age_max ?? 65} · ${genero}`,
    `Orçamento: R$ ${(questionario.orcamento_diario ?? 0).toFixed(2).replace(".", ",")}/dia × ${questionario.duracao_dias ?? 0} dias = R$ ${total.toFixed(2).replace(".", ",")}`,
    `Mídia: ${questionario.midia?.titulo ?? "—"}`,
    `Título: ${questionario.titulo ?? "—"}`,
    `Texto: ${questionario.texto_principal ?? "—"}`,
  ].join("\n");
}

export function metaAdsQuestionarioResumoHash(
  questionario: MetaAdsQuestionario,
): string {
  const text = metaAdsQuestionarioResumo(questionario);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function metaAdsDraftDoQuestionario(
  questionario: MetaAdsQuestionario,
  input: { conversationId: string; ownerPhone: string },
): MetaAdsDraft & {
  questionario: MetaAdsQuestionario;
  conversation_id: string;
  solicitante_telefone: string;
} {
  if (
    !questionario.objetivo || !questionario.cidade || !questionario.midia ||
    !questionario.orcamento_diario || !questionario.duracao_dias ||
    !questionario.titulo || !questionario.texto_principal
  ) throw new Error("questionario_incompleto");
  return {
    name: questionario.titulo,
    objective: questionario.objetivo,
    primary_text: questionario.texto_principal,
    headline: questionario.titulo,
    media_url: questionario.midia.url,
    media_type: questionario.midia.tipo,
    thumbnail_url: questionario.midia.thumbnail_url,
    media_id: questionario.midia.id,
    media_source: "midias_whatsapp",
    daily_budget: questionario.orcamento_diario,
    duration_days: questionario.duracao_dias,
    cities: [questionario.cidade],
    interests: questionario.interesses ?? [],
    destination_url: questionario.destination_url,
    radius_km: questionario.raio_km ?? 25,
    age_min: questionario.age_min ?? 18,
    age_max: questionario.age_max ?? 65,
    special_ad_categories: [],
    questionario,
    conversation_id: input.conversationId,
    solicitante_telefone: input.ownerPhone,
  };
}
