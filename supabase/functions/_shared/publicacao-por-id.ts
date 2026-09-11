// ============================================================
// Publicação estritamente por IDENTIFICADOR.
// Nunca "a última mídia", nunca "a mídia do contexto": só o item
// cujo ID foi mostrado ao dono e aprovado por ele.
// ============================================================

/** Publicação liberada somente nos caminhos que validam o asset por ID. */
export const JARVIS_PUBLICACAO_ATIVA = true;

export type AssetPublicavel = {
  id: string;
  idCurto: string;
  tipo: "foto" | "video";
  url: string;
  arquivoNome: string;
  thumbnail: string | null;
  criadoEm: string | null;
  origem: string | null;
  bloqueado: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ehUuid(valor: unknown): valor is string {
  return typeof valor === "string" && UUID_RE.test(valor);
}

/** ID curto (8 caracteres) que o dono compara entre a geração e a confirmação. */
export function idCurto(id: string): string {
  return String(id || "").replace(/-/g, "").slice(0, 8).toUpperCase();
}

/**
 * Linha OBRIGATÓRIA em toda mídia entregue ao dono: sem o código curto ele não
 * tem o que digitar e acaba pedindo em linguagem natural — foi assim que um post
 * saiu pelo caminho frouxo do catálogo. Determinística: nunca depende do modelo.
 */
export function linhaCodigoMidia(id: string, tipo: "foto" | "video"): string {
  const codigo = idCurto(id);
  const nomeTipo = tipo === "video" ? "Vídeo" : "Foto";
  return `🆔 *ID da mídia: ${codigo}* • ${nomeTipo} — use este código para publicar (ex.: "publica a mídia ${codigo} no instagram").`;
}


export function nomeDoArquivo(url: string): string {
  try {
    const caminho = new URL(url).pathname;
    return decodeURIComponent(caminho.split("/").pop() || "arquivo");
  } catch {
    return String(url || "").split("/").pop() || "arquivo";
  }
}

const EXT_VIDEO = /\.(mp4|mov|m4v|webm|avi|mkv|3gp)(\?|$)/i;
const EXT_IMAGEM = /\.(jpg|jpeg|png|webp|gif|avif|heic)(\?|$)/i;

export function tipoPelaExtensao(url: string): "foto" | "video" | null {
  if (EXT_VIDEO.test(url)) return "video";
  if (EXT_IMAGEM.test(url)) return "foto";
  return null;
}

/**
 * Busca o asset pelo ID E pelo dono. Não existe caminho alternativo:
 * item ausente, de outro cliente, bloqueado ou sem arquivo devolve erro.
 */
export async function resolverAsset(
  sb: any,
  userId: string,
  assetId: string,
): Promise<{ asset?: AssetPublicavel; erro?: string; mensagem?: string }> {
  if (!ehUuid(assetId)) {
    return {
      erro: "midia_nao_identificada",
      mensagem: "Não recebi a identificação da mídia. Nada foi publicado.",
    };
  }
  const { data, error } = await sb
    .from("midias_whatsapp")
    .select("id, user_id, tipo, midia_url, thumbnail_url, arquivo_nome, status, created_at, contexto_original")
    .eq("user_id", userId)
    .eq("id", assetId)
    .limit(1);
  if (error) return { erro: "db_falhou", mensagem: `Não consegui conferir a mídia: ${error.message}` };
  const row = data?.[0];
  if (!row) {
    return {
      erro: "midia_nao_encontrada",
      mensagem: "Não encontrei essa mídia na sua biblioteca. Nada foi publicado.",
    };
  }
  const bloqueado = typeof row.status === "string" && /bloquead/i.test(row.status);
  if (bloqueado) {
    return { erro: "midia_bloqueada", mensagem: "Essa mídia está bloqueada e não pode ser publicada." };
  }
  if (!row.midia_url) {
    return { erro: "midia_sem_arquivo", mensagem: "Essa mídia não tem arquivo disponível. Nada foi publicado." };
  }
  const tipo: "foto" | "video" = row.tipo === "video" ? "video" : "foto";
  return {
    asset: {
      id: row.id,
      idCurto: idCurto(row.id),
      tipo,
      url: row.midia_url,
      arquivoNome: row.arquivo_nome || nomeDoArquivo(row.midia_url),
      thumbnail: row.thumbnail_url ?? null,
      criadoEm: row.created_at ?? null,
      origem: row.contexto_original ?? null,
      bloqueado: false,
    },
  };
}

/**
 * Tipo aprovado x tipo real x arquivo real precisam ser a mesma coisa.
 * Vídeo aprovado nunca sai como imagem e imagem aprovada nunca sai como vídeo.
 */
export function validarTipoAprovado(
  tipoAprovado: "foto" | "video" | null | undefined,
  asset: AssetPublicavel,
): string | null {
  if (!tipoAprovado) return "tipo_aprovado_ausente";
  if (tipoAprovado !== asset.tipo) return `tipo_aprovado_${tipoAprovado}_difere_do_asset_${asset.tipo}`;
  const tipoArquivo = tipoPelaExtensao(asset.url);
  if (tipoArquivo && tipoArquivo !== asset.tipo) return `arquivo_${tipoArquivo}_difere_do_tipo_${asset.tipo}`;
  return null;
}

/** Resumo que o dono lê antes de aprovar — e confere de novo na confirmação. */
export function resumoDaMidia(asset: AssetPublicavel): string {
  const tipoTexto = asset.tipo === "video" ? "Vídeo" : "Imagem";
  const quando = asset.criadoEm ? new Date(asset.criadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "sem data";
  return `🆔 *${asset.idCurto}*\n${tipoTexto} • ${asset.arquivoNome}\nGerada em ${quando}`;
}
