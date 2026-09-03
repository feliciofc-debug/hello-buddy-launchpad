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
  duracaoEstimada,
  gerarRoteiroMotion,
  normalizarProps,
  nomesOficiais,
  type MotionProps,
} from "./video-motion.ts";

export const PLATAFORMAS_OK = ["instagram", "facebook", "linkedin", "tiktok"];

/** Fila ativa por usuário. WhatsApp é mais restrito: worker é single-thread. */
export const LIMITE_FILA_PLATAFORMA = 3;
export const LIMITE_FILA_WHATSAPP = 1;
/** Cota diária por tenant, somando as duas origens. */
export const COTA_DIARIA_POR_TENANT = 5;
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
    usou_ia: boolean;
  }
  | { ok: false; status: number; error: string; motivo?: string };

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

const normalizarTema = (t: string) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ").trim();

/** Gera o roteiro (IA ou props editadas) sem tocar na fila. */
export async function montarRoteiroMotion(input: EnfileirarInput): Promise<{
  props: MotionProps;
  legendaPost: string;
  usouIA: boolean;
}> {
  const { sb, userId, tema } = input;
  const logoPath = await logoDoTenant(sb, userId);
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
      },
    );
  } else {
    const r = await gerarRoteiroMotion(sb, userId, tema, {
      nomeFallback: input.nomeFallback ?? null,
      marca: String(input.marca ?? "").trim() || null,
    });
    props = normalizarProps(
      { ...r.props, cores: input.cores ?? r.props.cores },
      { marca: r.props.marca, site: r.props.site, nomes: r.nomes },
    );
    usouIA = r.usouIA;
    if (!legendaPost) legendaPost = r.legendaPost;
  }

  // `site` precisa existir mesmo vazio para sobrescrever defaultProps antigos do bundle.
  props = { ...props, site: props.site || "", logo_path: logoPath, logoUrl: undefined };
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

  const inicioDoDia = new Date();
  inicioDoDia.setUTCHours(0, 0, 0, 0);
  const { count: hoje } = await sb
    .from("video_motion_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("status", "cancelado")
    .gte("created_at", inicioDoDia.toISOString());

  if ((hoje ?? 0) >= COTA_DIARIA_POR_TENANT) {
    return {
      status: 429,
      motivo: "cota_diaria",
      error: `Cota de ${COTA_DIARIA_POR_TENANT} vídeos por dia atingida. Amanhã libera de novo.`,
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
      template: "template-agente",
      titulo: tema.slice(0, 140),
      props,
      legenda_post: legendaPost || null,
      plataformas,
      formato: ["reels", "story", "feed"].includes(String(input.formato))
        ? String(input.formato)
        : "reels",
      metadata: { usou_ia: usouIA, origem },
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
    usou_ia: usouIA,
  };
}
