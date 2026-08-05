// ============================================================================
// Ebook de presente — MULTI-TENANT
// Cada tenant tem o próprio ebook (tabela tenant_ebooks, escopada por user_id).
// Entrega 100% Meta Cloud API oficial (type:document), dentro da janela de 24h.
// Idempotente: tenant_ebook_entregas tem UNIQUE(user_id, telefone).
// ============================================================================

export interface TenantEbook {
  id: string;
  nome: string;
  arquivo_url: string | null;
  arquivo_path: string | null;
  arquivo_nome: string | null;
  texto_convite: string | null;
  ativo: boolean;
}

const BUCKET = "tenant-ebooks";
const SIGNED_TTL_SEG = 60 * 60 * 24 * 7; // 7 dias — a Meta busca o arquivo pelo link

/** Ebook ativo do tenant, ou null se o tenant não configurou (feature opcional). */
export async function getTenantEbook(sb: any, userId: string): Promise<TenantEbook | null> {
  const { data } = await sb
    .from("tenant_ebooks")
    .select("id, nome, arquivo_url, arquivo_path, arquivo_nome, texto_convite, ativo")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data?.ativo) return null;
  if (!data?.arquivo_path && !data?.arquivo_url) return null;
  return data as TenantEbook;
}

/**
 * URL de download do PDF DO TENANT.
 * Bucket é PRIVADO: gera URL assinada a partir do arquivo_path daquele tenant.
 * Nunca há caminho fixo/global — o path sempre vem da linha do tenant do contato.
 */
async function resolverUrlEbook(sb: any, ebook: TenantEbook): Promise<string | null> {
  if (ebook.arquivo_path) {
    const { data, error } = await sb.storage
      .from(BUCKET)
      .createSignedUrl(ebook.arquivo_path, SIGNED_TTL_SEG);
    if (error) {
      console.error("[ebook] signed url falhou:", error.message);
      return ebook.arquivo_url ?? null;
    }
    return data?.signedUrl ?? null;
  }
  return ebook.arquivo_url ?? null; // legado
}


/** Já recebeu / recusou / foi ofertado? (registro único por telefone no tenant) */
export async function getEntregaEbook(
  sb: any,
  userId: string,
  telefone: string,
): Promise<{ status: string } | null> {
  const { data } = await sb
    .from("tenant_ebook_entregas")
    .select("status")
    .eq("user_id", userId)
    .eq("telefone", telefone)
    .maybeSingle();
  return data ?? null;
}

async function marcarEntrega(
  sb: any,
  userId: string,
  telefone: string,
  ebookId: string | null,
  status: string,
  origem: string,
) {
  await sb
    .from("tenant_ebook_entregas")
    .upsert(
      { user_id: userId, telefone, ebook_id: ebookId, status, origem },
      { onConflict: "user_id,telefone" },
    );
}

/** Marca que o ebook já foi OFERTADO (ou recusado) — guardrail de 1x por contato. */
export async function registrarOfertaEbook(
  sb: any,
  userId: string,
  telefone: string,
  ebookId: string | null,
  status: "ofertado" | "recusado",
  origem: string,
) {
  try {
    await marcarEntrega(sb, userId, telefone, ebookId, status, origem);
  } catch (e) {
    console.warn("[ebook][oferta] falhou:", (e as Error).message);
  }
}

/**
 * Entrega o PDF do ebook DO TENANT como documento oficial + mensagem.
 * Retorna o resultado para log; nunca lança (não pode derrubar atendimento).
 */
export async function entregarEbookTenant(opts: {
  sb: any;
  userId: string;
  telefone: string;
  origem: string;
  supabaseUrl: string;
  serviceKey: string;
}): Promise<{ enviado: boolean; motivo?: string; ebook?: TenantEbook }> {
  const { sb, userId, telefone, origem, supabaseUrl, serviceKey } = opts;

  try {
    const ebook = await getTenantEbook(sb, userId);
    if (!ebook) return { enviado: false, motivo: "tenant_sem_ebook" };

    const entrega = await getEntregaEbook(sb, userId, telefone);
    if (entrega?.status === "entregue") {
      return { enviado: false, motivo: "ja_entregue", ebook };
    }
    if (entrega?.status === "recusado") {
      return { enviado: false, motivo: "recusado", ebook };
    }

    const caption = `Prontinho! 🎉 Aqui está seu ebook "${ebook.nome}". Aproveita!`;
    const filename = ebook.arquivo_nome || `${ebook.nome}.pdf`;

    const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
      },
      body: JSON.stringify({
        user_id: userId,
        to: telefone,
        message: caption,
        document_url: ebook.arquivo_url,
        document_filename: filename,
      }),
    });

    const txt = await res.text();
    let okDoc = res.ok;
    try {
      const j = JSON.parse(txt);
      if (j?.success === false) okDoc = false;
    } catch { /* corpo não-JSON */ }

    if (!okDoc) {
      // Fallback: manda o link em texto (melhor entregar de algum jeito).
      console.warn(`[ebook] documento falhou, fallback link: ${txt.slice(0, 200)}`);
      await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
          "apikey": serviceKey,
        },
        body: JSON.stringify({
          user_id: userId,
          to: telefone,
          message: `${caption}\n\n📥 ${ebook.arquivo_url}`,
        }),
      });
    }

    await marcarEntrega(sb, userId, telefone, ebook.id, "entregue", origem);
    return { enviado: true, ebook };
  } catch (e) {
    console.error("[ebook] erro na entrega:", (e as Error).message);
    return { enviado: false, motivo: (e as Error).message };
  }
}
