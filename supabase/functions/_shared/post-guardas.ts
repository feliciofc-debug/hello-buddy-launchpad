// Guardas de postagem — regras que decidem PARAR quando há dúvida.
//
// Padrão que estas funções corrigem: "na dúvida, o sistema seguiu em frente".
// Aqui é o contrário: casamento fraco não publica, prévia sem procedência não
// é renderizada, e rede incompatível bloqueia TODAS as redes.

export type ForcaCasamento = "exato" | "palavra_inteira" | "fraco";

export function normalizarConsulta(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Casamento FORTE de produto, avaliado contra a lista COMPLETA de nomes do catálogo.
 * - "exato": a consulta inteira é o nome do produto.
 * - "palavra_inteira": o nome (>= 4 caracteres) aparece na consulta como palavras inteiras.
 * - nomes com menos de 4 caracteres ("Kit", "Pro", "TV") só casam por igualdade da
 *   consulta inteira — substring solta nunca conta.
 * Qualquer outra coisa é "fraco" e NÃO pode escolher produto.
 */
export function avaliarCasamentoProduto(
  query: string,
  nomes: string[],
): { forca: ForcaCasamento; indicesFortes: number[] } {
  const q = normalizarConsulta(query);
  if (!q) return { forca: "fraco", indicesFortes: [] };

  const exatos: number[] = [];
  const inteiros: number[] = [];

  nomes.forEach((nomeCru, i) => {
    const nome = normalizarConsulta(nomeCru);
    if (!nome) return;
    if (nome === q) { exatos.push(i); return; }
    if (nome.length < 4) return; // nome curto: só exato
    const re = new RegExp(`(^|\\s)${nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|\\s)`);
    if (re.test(q)) inteiros.push(i);
  });

  if (exatos.length > 0) return { forca: "exato", indicesFortes: exatos };
  if (inteiros.length > 0) return { forca: "palavra_inteira", indicesFortes: inteiros };
  return { forca: "fraco", indicesFortes: [] };
}

// ---- Procedência obrigatória na prévia ----

export type Procedencia = {
  origem: "biblioteca" | "catalogo";
  produtoNome?: string; // obrigatório quando origem = catalogo
  midiaIdCurto: string;
  midiaTipo: "foto" | "video";
  arquivoNome?: string;
};

export class PreviaSemProcedenciaError extends Error {
  constructor(motivo: string) {
    super(`previa_sem_procedencia: ${motivo}`);
    this.name = "PreviaSemProcedenciaError";
  }
}

/** Lança se faltar qualquer campo. Sem procedência, nenhuma prévia sai. */
export function renderProcedencia(p: unknown): string {
  const d = p as Procedencia | undefined;
  if (!d || typeof d !== "object") throw new PreviaSemProcedenciaError("campo ausente");
  if (d.origem !== "biblioteca" && d.origem !== "catalogo") throw new PreviaSemProcedenciaError("origem inválida");
  if (d.origem === "catalogo" && !String(d.produtoNome || "").trim()) {
    throw new PreviaSemProcedenciaError("produto do catálogo sem nome");
  }
  if (!/^[0-9a-f]{8}$/i.test(String(d.midiaIdCurto || ""))) throw new PreviaSemProcedenciaError("id curto da mídia ausente");
  if (d.midiaTipo !== "foto" && d.midiaTipo !== "video") throw new PreviaSemProcedenciaError("tipo da mídia ausente");

  const origemTxt = d.origem === "catalogo"
    ? `produto do catálogo: ${String(d.produtoNome).trim()}`
    : "mídia da biblioteca";
  const tipoTxt = d.midiaTipo === "video" ? "Vídeo" : "Foto";
  const arquivo = d.arquivoNome ? ` • ${d.arquivoNome}` : "";
  return `📌 *Origem:* ${origemTxt}\n🆔 *${String(d.midiaIdCurto).toUpperCase()}* • ${tipoTxt}${arquivo}`;
}

// ---- Compatibilidade de tipo por rede, verificada ANTES de publicar ----

export function verificarCompatibilidadeRedes(
  redes: string[],
  tipo: "foto" | "video",
  formato: "feed" | "story" | "reels" = "feed",
): { compativeis: string[]; incompativeis: Array<{ rede: string; motivo: string }> } {
  const compativeis: string[] = [];
  const incompativeis: Array<{ rede: string; motivo: string }> = [];
  for (const redeCru of redes) {
    const rede = String(redeCru || "").toLowerCase();
    let motivo = "";
    if (rede === "tiktok" && tipo !== "video") motivo = "TikTok só aceita vídeo";
    else if (formato === "reels" && tipo !== "video") motivo = `${rede}: reels exige vídeo`;
    else if (formato === "story" && rede === "tiktok") motivo = "TikTok não tem story";
    else if (formato === "story" && rede === "linkedin") motivo = "LinkedIn não tem story";
    if (motivo) incompativeis.push({ rede, motivo });
    else compativeis.push(rede);
  }
  return { compativeis, incompativeis };
}

// ---- Orquestração testável ----

export type ResultadoPreparo =
  | { ok: true; indice: number }
  | { ok: false; resposta: Record<string, unknown> };

/**
 * Decide se o caminho do CATÁLOGO pode rodar. Só devolve ok quando existe
 * exatamente UM casamento forte. Nenhum pedido é criado fora disso.
 * `listarNomes` só é chamado depois da camada de termos genéricos.
 */
export async function prepararPostDoCatalogo(deps: {
  query: string;
  ehTermoGenerico: (q: string) => boolean;
  listarNomes: () => Promise<string[]>;
  sugestoes?: () => Promise<string[]>;
}): Promise<ResultadoPreparo> {
  const query = String(deps.query || "").trim();
  if (!query || deps.ehTermoGenerico(query)) {
    return {
      ok: false,
      resposta: {
        erro: "produto_nao_nomeado",
        mensagem: "Não entendi de qual item é o post. Se for uma mídia que geramos, me manda o código dela (8 caracteres). Se for produto do catálogo, me diga o nome do produto. Nada foi preparado.",
      },
    };
  }

  const nomes = await deps.listarNomes();
  const { forca, indicesFortes } = avaliarCasamentoProduto(query, nomes);
  if (forca === "fraco" || indicesFortes.length !== 1) {
    const candidatos = indicesFortes.length > 1
      ? indicesFortes.map((i) => nomes[i])
      : (deps.sugestoes ? await deps.sugestoes() : []).slice(0, 7);
    return {
      ok: false,
      resposta: {
        erro: "produto_nao_identificado",
        mensagem: "De qual produto do catálogo é o post? Não escolhi nenhum — na dúvida eu paro.",
        candidatos_do_catalogo: candidatos,
      },
    };
  }
  return { ok: true, indice: indicesFortes[0] };
}

/**
 * Verificação prévia GLOBAL: se alguma rede selecionada não aceita o tipo do item,
 * NENHUMA rede é chamada. O publicador só roda depois da confirmação explícita.
 */
export async function publicarComPreflight(deps: {
  redes: string[];
  tipo: "foto" | "video";
  formato?: "feed" | "story" | "reels";
  somenteCompativeisConfirmado?: boolean;
  redesConfirmadas?: string[] | null;
  publicar: (redes: string[]) => Promise<unknown>;
  marcarCompatPendente?: (compativeis: string[]) => Promise<void>;
}): Promise<{ publicou: false; resposta: Record<string, unknown> } | { publicou: true; resultado: unknown }> {
  const compat = verificarCompatibilidadeRedes(deps.redes, deps.tipo, deps.formato || "feed");
  if (compat.incompativeis.length > 0 && !deps.somenteCompativeisConfirmado) {
    if (deps.marcarCompatPendente) await deps.marcarCompatPendente(compat.compativeis);
    return {
      publicou: false,
      resposta: {
        status: "incompatibilidade_de_tipo",
        mensagem: `O item aprovado é ${deps.tipo === "video" ? "vídeo" : "foto"} e não serve para todas as redes escolhidas. NADA foi publicado.`,
        incompativeis: compat.incompativeis,
        compativeis: compat.compativeis,
        pergunta: compat.compativeis.length
          ? `Quer seguir só com ${compat.compativeis.join(", ")}? Responde *sim* pra publicar apenas nelas.`
          : "Nenhuma rede escolhida aceita esse tipo de item. Nada foi publicado.",
      },
    };
  }
  // Quem manda é a FLAG de confirmação, não o array: redesConfirmadas é gravado
  // junto com somenteCompativeisConfirmado=false ao fazer a pergunta, então
  // array preenchido NÃO significa "o dono confirmou".
  const alvo = (deps.somenteCompativeisConfirmado === true
    ? (deps.redesConfirmadas?.length ? deps.redesConfirmadas : compat.compativeis)
    : deps.redes)
    .filter((r) => compat.compativeis.includes(r));
  if (alvo.length === 0) {
    return {
      publicou: false,
      resposta: {
        status: "nenhuma_rede_compativel",
        mensagem: "Nenhuma rede compatível com o tipo do item. Nada foi publicado.",
      },
    };
  }
  return { publicou: true, resultado: await deps.publicar(alvo) };
}
