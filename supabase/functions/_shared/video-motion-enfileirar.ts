// ============================================================
// Núcleo compartilhado de criação de job de vídeo MOTION.
//
// Usado por:
//   - video-motion-create (tela da plataforma, com JWT do usuário)
//   - whatsapp-cloud-inbound-processor (agente, service role)
//
// O user_id NUNCA vem do body: quem chama já resolveu a identidade.
// ============================================================

import {
  DURACOES_MOTION,
  duracaoEstimada,
  duracaoPedidaNoTexto,
  ESTILOS_MOTION,
  estiloPedidoNoTexto,
  gerarRoteiroMotion,
  normalizarProps,
  nomesOficiais,
  TEMPLATE_POR_ESTILO,
  type DuracaoMotion,
  type EstiloMotion,
  type MotionProps,
} from "./video-motion.ts";

export const PLATAFORMAS_OK = ["instagram", "facebook", "linkedin", "tiktok"];

/** Fila ativa por usuário. WhatsApp é mais restrito: worker é single-thread. */
export const LIMITE_FILA_PLATAFORMA = 3;
export const LIMITE_FILA_WHATSAPP = 1;
export const STATUS_QUE_CONSOMEM_COTA = ["pendente", "processando", "concluido", "aguardando_aprovacao", "publicado"];
/** Janela de anti-duplicidade para o mesmo tema. */
const JANELA_DUPLICIDADE_MIN = 10;

export type OrigemMotion = "plataforma" | "whatsapp";

export type EnfileirarInput = {
  sb: any;
  userId: string;
  tema: string;
  origem?: OrigemMotion;
  telefone?: string | null;
  /** roteiro já editado pelo usuário; ausente = IA gera */
  props?: Partial<MotionProps> | null;
  marca?: string | null;
  cores?: MotionProps["cores"] | null;
  legendaPost?: string | null;
  formato?: string | null;
  plataformas?: unknown;
  nomeFallback?: string | null;
  trilhaId?: string | null;
  semTrilha?: boolean;
  trilhaVolume?: number | null;
  /** tom de voz que o roteiro deve seguir (ex.: lido do site do cliente) */
  tomDeVoz?: string | null;
  /** estilo da biblioteca de templates; vazio/"auto" = a IA escolhe pelo tema */
  estilo?: string | null;
  /** arranjo de cena (1..3); vazio = sorteado para variar o visual */
  arranjo?: number | null;
  /** duração: "curto" (padrão), "medio" ou "longo" */
  duracao?: string | null;
  /** logo específica desta peça (prospecção), sempre dentro da pasta do usuário */
  logoPath?: string | null;
  /** peça de prospecção: nunca cai na logo cadastrada do tenant */
  prospect?: boolean;
  /** o usuário pediu para tirar a logo deste vídeo */
  semLogo?: boolean;
  /** proveniência obrigatória da identidade/logo desta peça */
  identitySource?: "tenant" | "prospect" | "none";
  /** identifica o site/origem da marca de prospecção */
  identityKey?: string | null;
  /** só devolve o roteiro, não enfileira */
  apenasRoteiro?: boolean;
};

export type EnfileirarResult =
  | {
    ok: true;
    apenas_roteiro: true;
    props: MotionProps;
    legenda_post: string;
    duracao_estimada: number;
    usou_ia: boolean;
  }
  | {
    ok: true;
    apenas_roteiro?: false;
    job_id: string;
    props: MotionProps;
    legenda_post: string;
    duracao_estimada: number;
    posicao_fila: number;
    cota_aviso: string;
    cota_limite: number;
    cota_usado: number;
    cota_restante: number | null;
    usou_ia: boolean;
  }
  | { ok: false; status: number; error: string; motivo?: string };

export type CotaMotion = { limite: number; origem: string; usado: number };

export function mensagemCotaMotion(cota: CotaMotion, numeroDoVideo = cota.usado + 1): string {
  if (cota.limite === -1) return "Vídeos ilimitados nesta conta.";
  const restante = Math.max(0, cota.limite - numeroDoVideo);
  return `Este é seu ${numeroDoVideo}º de ${cota.limite} vídeos hoje. ${restante === 1 ? "Restará 1." : `Restarão ${restante}.`}`;
}

export async function buscarCotaMotion(sb: any, userId: string): Promise<CotaMotion> {
  const inicioSaoPaulo = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  inicioSaoPaulo.setHours(0, 0, 0, 0);
  const inicioUtc = new Date(inicioSaoPaulo.getTime() + 3 * 60 * 60 * 1000).toISOString();

  const [{ data: configuracao, error: configError }, { count: usado, error: usoError }] = await Promise.all([
    sb.rpc("video_motion_cota_efetiva", { p_user_id: userId }),
    sb.from("video_motion_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", STATUS_QUE_CONSOMEM_COTA)
      .gte("created_at", inicioUtc),
  ]);

  if (configError || usoError) {
    console.error("[video-motion] falha ao resolver cota; acesso liberado por segurança", configError ?? usoError);
    return { limite: -1, origem: "indisponivel", usado: usado ?? 0 };
  }
  const row = Array.isArray(configuracao) ? configuracao[0] : configuracao;
  return { limite: Number(row?.limite ?? -1), origem: String(row?.origem ?? "sem_plano"), usado: usado ?? 0 };
}

export async function logoDoTenant(sb: any, userId: string): Promise<string | undefined> {
  const { data } = await sb
    .from("tenant_logos")
    .select("storage_path")
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();
  const path = typeof data?.storage_path === "string" ? data.storage_path : "";
  return path.startsWith(`${userId}/`) ? path : undefined;
}

export function logoEhDeProspect(userId: string, path?: string): boolean {
  if (!path?.startsWith(`${userId}/`)) return false;
  const relativo = path.slice(userId.length + 1);
  return relativo.startsWith("prospect/") || relativo.startsWith("prospect-") || /(?:^|\/)\d+-logo-site\./i.test(relativo);
}

export function validarProvenienciaLogo(
  userId: string,
  path: string | undefined,
  origem: "tenant" | "prospect" | "none",
  logoOficial?: string,
): string | null {
  if (!path) return null;
  if (!path.startsWith(`${userId}/`)) return "A logo não pertence a esta conta.";
  if (origem === "none") return "Este vídeo foi marcado para sair sem logo.";
  if (origem === "prospect" && !logoEhDeProspect(userId, path)) {
    return "A logo não corresponde à identidade de prospecção escolhida.";
  }
  if (origem === "tenant" && path !== logoOficial) {
    return "A logo selecionada não corresponde à marca oficial desta conta.";
  }
  return null;
}

/** Estilo pedido explicitamente; "auto"/vazio devolve o que o texto sugerir. */
export function estiloEscolhido(input: EnfileirarInput): EstiloMotion | null {
  const pedido = String(input.estilo ?? "").trim().toLowerCase();
  if (ESTILOS_MOTION.includes(pedido as EstiloMotion)) return pedido as EstiloMotion;
  if (pedido && pedido !== "auto" && pedido !== "automatico" && pedido !== "automático") return null;
  return estiloPedidoNoTexto(String(input.tema ?? ""));
}

/** Duração pedida explicitamente; vazio cai no que o texto sugerir (ou curto). */
export function duracaoEscolhida(input: EnfileirarInput): DuracaoMotion {
  const pedido = String(input.duracao ?? "").trim().toLowerCase().replace("é", "e");
  if (DURACOES_MOTION.includes(pedido as DuracaoMotion)) return pedido as DuracaoMotion;
  return duracaoPedidaNoTexto(String(input.tema ?? "")) ?? "curto";
}

/** Minutos aproximados de render na VPS (~10s de render por 1s de vídeo). */
export function minutosRenderEstimado(segundos: number): number {
  return Math.max(3, Math.round((segundos * 10) / 60));
}

const normalizarTema = (t: string) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ").trim();

/** Resolve uma faixa válida do catálogo sem aceitar caminhos arbitrários do cliente. */
export async function resolverTrilha(sb: any, userId: string, input: EnfileirarInput): Promise<{ id: string; path: string; volume: number } | null> {
  if (input.semTrilha) return null;
  const propsTrilhaId = typeof (input.props as any)?.trilha_id === "string" ? (input.props as any).trilha_id : null;
  const trilhaId = input.trilhaId || propsTrilhaId;
  let query = sb.from("trilhas_sonoras").select("id, user_id, storage_path, ativo").eq("ativo", true);
  if (trilhaId) {
    query = query.eq("id", trilhaId);
  } else {
    const { data: config } = await sb.from("empresa_config").select("trilha_padrao_id").eq("user_id", userId).maybeSingle();
    if (config?.trilha_padrao_id) {
      query = query.eq("id", config.trilha_padrao_id);
    } else {
      // Sem padrão da empresa: usa a faixa padrão da plataforma para o vídeo nunca sair mudo.
      query = query.is("user_id", null).eq("padrao_global", true);
    }
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`não consegui carregar a trilha: ${error.message}`);
  if (!data) {
    if (trilhaId) throw new Error("A trilha selecionada não está disponível para esta conta.");
    return null;
  }
  const path = String(data.storage_path ?? "");
  const pertenceAoUsuario = data.user_id === null || data.user_id === userId;
  const caminhoSeguro = path.startsWith("global/") || path.startsWith(`${userId}/`);
  if (!pertenceAoUsuario || !caminhoSeguro) throw new Error("A trilha selecionada não está disponível para esta conta.");
  return {
    id: String(data.id),
    path,
    volume: Math.min(1, Math.max(0, input.trilhaVolume ?? (input.props as any)?.trilha_volume ?? 0.28)),
  };
}

/** Gera o roteiro (IA ou props editadas) sem tocar na fila. */
export async function montarRoteiroMotion(input: EnfileirarInput): Promise<{
  props: MotionProps;
  legendaPost: string;
  usouIA: boolean;
}> {
  const { sb, userId, tema } = input;
  // A pasta do usuário, sozinha, não prova de qual marca é o arquivo. Toda logo
  // precisa corresponder à proveniência explícita da identidade desta peça.
  const logoInformada = typeof input.logoPath === "string" && input.logoPath.startsWith(`${userId}/`)
    ? input.logoPath
    : undefined;
  const logoDasProps = typeof (input.props as any)?.logo_path === "string" &&
      String((input.props as any).logo_path).startsWith(`${userId}/`)
    ? String((input.props as any).logo_path)
    : undefined;
  // Prospecção: a logo é a do prospect (ou nenhuma). NUNCA a do tenant, para a
  // marca de um cliente não vazar no vídeo do próximo.
  const prospect = input.prospect === true || (input.props as any)?.prospect === true;
  const origemInformada = input.identitySource ?? (input.props as any)?.identity_source;
  const identitySource: "tenant" | "prospect" | "none" = input.semLogo || origemInformada === "none"
    ? "none"
    : (prospect || origemInformada === "prospect" ? "prospect" : "tenant");
  const logoOficial = identitySource === "tenant" ? await logoDoTenant(sb, userId) : undefined;
  const candidata = logoInformada ?? logoDasProps ?? logoOficial;
  const erroLogo = validarProvenienciaLogo(userId, candidata, identitySource, logoOficial);
  if (erroLogo) throw new Error(`${erroLogo} A renderização foi bloqueada para evitar mistura de marcas.`);
  const logoPath = identitySource === "none" ? undefined : candidata;
  const trilha = await resolverTrilha(sb, userId, input);
  let props: MotionProps;
  let legendaPost = String(input.legendaPost ?? "").trim();
  let usouIA = false;

  if (input.props) {
    const p: any = input.props;
    const nomes = nomesOficiais(String(p?.marca ?? input.nomeFallback ?? ""), tema);
    props = normalizarProps(
      { ...p, cores: input.cores ?? p?.cores },
      {
        marca: String(p?.marca ?? ""),
        site: String(p?.site ?? ""),
        telefone: String(p?.cta?.telefone ?? "") || undefined,
        consultor: String(p?.cta?.consultor ?? "") || undefined,
        nomes,
        estilo: estiloEscolhido(input) ?? (p?.estilo ?? null),
        arranjo: input.arranjo ?? p?.arranjo ?? null,
        duracao: duracaoEscolhida(input),
      },
    );
  } else {
    const r = await gerarRoteiroMotion(sb, userId, tema, {
      nomeFallback: input.nomeFallback ?? null,
      marca: String(input.marca ?? "").trim() || null,
      tomDeVoz: String(input.tomDeVoz ?? "").trim() || null,
      estilo: estiloEscolhido(input),
      arranjo: input.arranjo ?? null,
      duracao: duracaoEscolhida(input),
    });
    props = normalizarProps(
      { ...r.props, cores: input.cores ?? r.props.cores },
      {
        marca: r.props.marca,
        site: r.props.site,
        nomes: r.nomes,
        estilo: r.props.estilo ?? null,
        arranjo: r.props.arranjo ?? null,
        duracao: r.props.duracao ?? duracaoEscolhida(input),
      },
    );
    usouIA = r.usouIA;
    if (!legendaPost) legendaPost = r.legendaPost;
  }

  // `site` precisa existir mesmo vazio para sobrescrever defaultProps antigos do bundle.
  // A trilha fica referenciada por ID/path seguro; a URL temporária só nasce no claim.
  props = {
    ...props,
    prospect: prospect || undefined,
    identity_source: identitySource,
    identity_key: identitySource === "prospect"
      ? String(input.identityKey ?? (input.props as any)?.identity_key ?? props.site ?? "").trim() || undefined
      : undefined,
    site: props.site || "",
    logo_path: logoPath,
    logoUrl: undefined,
    trilha_id: trilha?.id,
    trilha_path: trilha?.path,
    trilha_volume: trilha?.volume ?? 0.28,
    trilhaUrl: undefined,
  };
  return { props, legendaPost, usouIA };
}

/** Limites de fila/cota/duplicidade. Devolve null quando está liberado. */
export async function checarLimitesMotion(
  sb: any,
  userId: string,
  origem: OrigemMotion,
  tema: string,
): Promise<{ status: number; error: string; motivo: string } | null> {
  const limiteFila = origem === "whatsapp" ? LIMITE_FILA_WHATSAPP : LIMITE_FILA_PLATAFORMA;

  const { count: ativos } = await sb
    .from("video_motion_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["pendente", "processando"]);

  if ((ativos ?? 0) >= limiteFila) {
    return {
      status: 429,
      motivo: "fila_ativa",
      error: limiteFila === 1
        ? "Você já tem um vídeo sendo gerado. Assim que ele ficar pronto eu começo o próximo."
        : `Você já tem ${ativos} vídeo(s) na fila. Aguarde terminar para enviar outro.`,
    };
  }

  const cota = await buscarCotaMotion(sb, userId);
  if (cota.limite !== -1 && cota.usado >= cota.limite) {
    return {
      status: 429,
      motivo: "cota_diaria",
      error: `Você usou os ${cota.limite} vídeos disponíveis hoje no seu plano. O administrador pode ajustar essa cota.`,
    };
  }

  // Anti-duplicidade: o usuário repete o pedido quando não vê resposta imediata.
  const cutoff = new Date(Date.now() - JANELA_DUPLICIDADE_MIN * 60 * 1000).toISOString();
  const { data: recentes } = await sb
    .from("video_motion_jobs")
    .select("id, titulo")
    .eq("user_id", userId)
    .neq("status", "cancelado")
    .gte("created_at", cutoff)
    .limit(10);

  const alvo = normalizarTema(tema);
  if (alvo && (recentes ?? []).some((j: any) => normalizarTema(String(j.titulo ?? "")) === alvo)) {
    return {
      status: 429,
      motivo: "duplicado",
      error: "Esse mesmo vídeo já foi pedido nos últimos minutos — estou cuidando dele.",
    };
  }

  return null;
}

/** Cria o job (ou só o roteiro), aplicando os limites. */
export async function enfileirarVideoMotion(input: EnfileirarInput): Promise<EnfileirarResult> {
  const { sb, userId } = input;
  const tema = String(input.tema ?? "").trim();
  if (!tema || tema.length < 4) {
    return { ok: false, status: 400, error: "Descreva o tema do vídeo (mín. 4 caracteres)", motivo: "tema_curto" };
  }
  const origem: OrigemMotion = input.origem === "whatsapp" ? "whatsapp" : "plataforma";

  const { props, legendaPost, usouIA } = await montarRoteiroMotion({ ...input, tema });

  if (input.apenasRoteiro) {
    return {
      ok: true,
      apenas_roteiro: true,
      props,
      legenda_post: legendaPost,
      duracao_estimada: duracaoEstimada(props),
      usou_ia: usouIA,
    };
  }

  const bloqueio = await checarLimitesMotion(sb, userId, origem, tema);
  if (bloqueio) return { ok: false, ...bloqueio };
  const cota = await buscarCotaMotion(sb, userId);

  const plataformas = Array.isArray(input.plataformas)
    ? (input.plataformas as unknown[])
      .map((p) => String(p).toLowerCase())
      .filter((p) => PLATAFORMAS_OK.includes(p))
    : [];

  const { data: job, error: insErr } = await sb
    .from("video_motion_jobs")
    .insert({
      user_id: userId,
      telefone: String(input.telefone ?? "").replace(/\D/g, "") || null,
      origem,
      template: TEMPLATE_POR_ESTILO[(props.estilo ?? "conversa") as EstiloMotion] ?? "template-agente",
      titulo: tema.slice(0, 140),
      props,
      trilha_id: props.trilha_id ?? null,
      trilha_volume: props.trilha_volume ?? 0.28,
      legenda_post: legendaPost || null,
      plataformas,
      formato: ["reels", "story", "feed"].includes(String(input.formato))
        ? String(input.formato)
        : "reels",
      metadata: {
        usou_ia: usouIA,
        origem,
        sem_trilha: !props.trilha_id,
        estilo: props.estilo ?? "conversa",
        arranjo: props.arranjo ?? 1,
        duracao: props.duracao ?? "curto",
        render_minutos_estimado: minutosRenderEstimado(duracaoEstimada(props)),
      },
    })
    .select()
    .single();

  if (insErr) {
    return { ok: false, status: 500, error: insErr.message ?? "erro ao enfileirar", motivo: "insert" };
  }

  const { data: pos } = await sb.rpc("video_motion_fila_posicao", { p_job_id: job.id });

  return {
    ok: true,
    job_id: job.id,
    props,
    legenda_post: legendaPost,
    duracao_estimada: duracaoEstimada(props),
    posicao_fila: pos ?? 1,
    cota_aviso: mensagemCotaMotion(cota),
    cota_limite: cota.limite,
    cota_usado: cota.usado + 1,
    cota_restante: cota.limite === -1 ? null : Math.max(0, cota.limite - cota.usado - 1),
    usou_ia: usouIA,
  };
}
