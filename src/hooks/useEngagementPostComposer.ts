import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SocialPostMode = "engajamento" | "promocional";

export const ENGAGEMENT_STYLES = [
  { id: "escassez", emoji: "🔥", label: "Escassez" },
  { id: "curiosidade", emoji: "❓", label: "Curiosidade" },
  { id: "pergunta", emoji: "🤔", label: "Pergunta" },
  { id: "polemica", emoji: "⚡", label: "Polêmica" },
  { id: "dado", emoji: "📊", label: "Dado" },
  { id: "tabu", emoji: "🤫", label: "Tabu" },
] as const;

const PREVIEW_RATE_LIMIT = 5;
const PREVIEW_CACHE_MIN = 30;

type PreviewCacheEntry = { caption: string; estilo: string; ts: number };
type PreviewRateEntry = { ts: number };

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export function useEngagementPostComposer(params: {
  open: boolean;
  productId: string;
  initialMode: SocialPostMode;
  allowedStyles?: string[] | null;
}) {
  const [mode, setMode] = useState<SocialPostMode>(params.initialMode);
  const [style, setStyle] = useState("aleatorio");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewCaption, setPreviewCaption] = useState<string | null>(null);
  const [previewStyle, setPreviewStyle] = useState<string | null>(null);
  const [previewFromCache, setPreviewFromCache] = useState(false);

  const styles = useMemo(() => {
    if (!params.allowedStyles?.length) return [...ENGAGEMENT_STYLES];
    const allowed = new Set(params.allowedStyles);
    return ENGAGEMENT_STYLES.filter((item) => allowed.has(item.id));
  }, [params.allowedStyles]);

  useEffect(() => {
    if (!params.open) return;
    setMode(params.initialMode);
    setStyle("aleatorio");
    setPreviewCaption(null);
    setPreviewStyle(null);
    setPreviewFromCache(false);
  }, [params.open, params.initialMode]);

  const generatePreview = useCallback(async () => {
    if (!styles.length) {
      toast.error("Este produto não tem estilos de engajamento configurados.");
      return;
    }
    const finalStyle = style === "aleatorio"
      ? styles[Math.floor(Math.random() * styles.length)].id
      : style;
    const cacheKey = `engagement_preview_cache:${params.productId}:${finalStyle}`;
    const cached = loadJson<PreviewCacheEntry | null>(cacheKey, null);
    if (cached && (Date.now() - cached.ts) / 60000 <= PREVIEW_CACHE_MIN) {
      setPreviewCaption(cached.caption);
      setPreviewStyle(cached.estilo);
      setPreviewFromCache(true);
      return;
    }

    const rateKey = `engagement_preview_rate:${params.productId}`;
    const cutoff = Date.now() - 60 * 60 * 1000;
    const rate = loadJson<PreviewRateEntry[]>(rateKey, []).filter((entry) => entry.ts > cutoff);
    if (rate.length >= PREVIEW_RATE_LIMIT) {
      const minRest = Math.max(1, Math.ceil((Math.min(...rate.map((entry) => entry.ts)) + 60 * 60 * 1000 - Date.now()) / 60000));
      toast.error(`Limite de prévias atingido. Aguarde ${minRest} min antes de gerar outra.`);
      return;
    }

    setPreviewLoading(true);
    setPreviewFromCache(false);
    try {
      const { data, error } = await supabase.functions.invoke("generate-social-post-engagement", {
        body: { produto_id: params.productId, estilo: finalStyle },
      });
      if (error) throw error;
      const response = data as { success?: boolean; caption?: string; estilo?: string; error?: string } | null;
      if (!response?.success || !response.caption) {
        throw new Error(response?.error || "Falha ao gerar prévia.");
      }
      const generatedStyle = response.estilo || finalStyle;
      setPreviewCaption(response.caption);
      setPreviewStyle(generatedStyle);
      localStorage.setItem(cacheKey, JSON.stringify({ caption: response.caption, estilo: generatedStyle, ts: Date.now() }));
      localStorage.setItem(rateKey, JSON.stringify([...rate, { ts: Date.now() }]));
    } catch (error) {
      console.error("[engagement-preview]", error);
      toast.error("Não foi possível gerar a caption. Verifique os dados do produto e tente novamente.");
    } finally {
      setPreviewLoading(false);
    }
  }, [params.productId, style, styles]);

  return {
    mode,
    setMode,
    style,
    setStyle,
    styles,
    previewLoading,
    previewCaption,
    previewStyle,
    previewFromCache,
    generatePreview,
  };
}
