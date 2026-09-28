import type { BrandSiteIdentity } from "./brand-site-identity.ts";
import {
  type IdentidadeSite,
  lerIdentidadeDoSite,
  precisaCamadaB,
} from "./site-identidade.ts";

type CompleteSiteIdentityOptions = {
  maxWaitMs?: number;
  pollMs?: number;
  readLayerA?: (url: string) => Promise<IdentidadeSite>;
  wait?: (ms: number) => Promise<void>;
};

function colorsFromDetailedIdentity(identity: IdentidadeSite): string[] {
  return [
    ...new Set(
      (identity.cores_detectadas ?? [])
        .map((color) => String(color?.hex ?? "").toLowerCase())
        .filter((color) => /^#[0-9a-f]{6}$/.test(color)),
    ),
  ];
}

function mergeDetailedIdentity(
  fast: BrandSiteIdentity,
  detailed: IdentidadeSite,
): BrandSiteIdentity {
  const colors = colorsFromDetailedIdentity(detailed);
  return {
    url: detailed.url || fast.url,
    colors: colors.length ? colors : fast.colors,
    brand_name: String(detailed.nome_empresa || "").trim() || fast.brand_name,
    logo_url: detailed.logo_url || fast.logo_url,
    logo_data_url: detailed.logo_data_url || fast.logo_data_url,
    logo_confidence: detailed.logo_data_url ? "high" : fast.logo_confidence,
  };
}

/**
 * Aciona a leitura renderizada apenas quando a leitura rápida não encontrou
 * logo confiável nem cor. O timeout devolve a melhor identidade disponível,
 * sem transformar a ausência de dados em uma pergunta para o usuário.
 */
export async function completeSiteIdentityWithRenderedPage(
  sb: any,
  userId: string,
  fast: BrandSiteIdentity,
  options: CompleteSiteIdentityOptions = {},
): Promise<BrandSiteIdentity> {
  if (fast.logo_confidence === "high" || fast.colors.length > 0) return fast;

  const readLayerA = options.readLayerA ?? lerIdentidadeDoSite;
  const detailed = await readLayerA(fast.url);
  const layerAResult = mergeDetailedIdentity(fast, detailed);
  if (!precisaCamadaB(detailed)) return layerAResult;

  const { data: job, error: enqueueError } = await sb
    .from("site_render_jobs")
    .insert({
      user_id: userId,
      url: detailed.url,
      identidade_a: detailed,
    })
    .select("id")
    .single();
  if (enqueueError || !job?.id) {
    console.warn(
      "[video-setup][site-render-enqueue]",
      enqueueError?.message || "job ausente",
    );
    return layerAResult;
  }

  const wait = options.wait ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const maxWaitMs = options.maxWaitMs ?? 15_000;
  const pollMs = options.pollMs ?? 750;
  const deadline = Date.now() + maxWaitMs;
  do {
    const { data, error } = await sb
      .from("site_render_jobs")
      .select("status, identidade, erro")
      .eq("id", job.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.warn("[video-setup][site-render-status]", error.message);
      break;
    }
    if (data?.status === "concluido" && data.identidade) {
      return mergeDetailedIdentity(fast, data.identidade as IdentidadeSite);
    }
    if (data?.status === "erro") {
      console.warn(
        "[video-setup][site-render-failed]",
        String(data.erro || "erro sem detalhe"),
      );
      break;
    }
    if (Date.now() >= deadline) break;
    await wait(pollMs);
  } while (Date.now() <= deadline);

  return layerAResult;
}
