import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { edgeFunctionErrorMessage } from "@/lib/edge-function-error";

export type SiteBrandPreview = {
  url: string;
  colors: string[];
  logo_url: string | null;
  logo_data_url: string | null;
  logo_confidence: "high" | "none";
};

export function useBrandImageSettings() {
  const [hasSavedLogo, setHasSavedLogo] = useState(false);
  const [useSavedLogo, setUseSavedLogo] = useState(false);
  const [savedLogoPreview, setSavedLogoPreview] = useState<string | null>(null);
  const [savedColors, setSavedColors] = useState<string[]>([]);
  const [siteUrl, setSiteUrl] = useState("");
  const [sitePreview, setSitePreview] = useState<SiteBrandPreview | null>(null);
  const [loadingBrand, setLoadingBrand] = useState(true);
  const [readingSite, setReadingSite] = useState(false);
  const [savingLogo, setSavingLogo] = useState(false);
  const updateSiteUrl = useCallback((value: string) => {
    setSiteUrl(value);
    setSitePreview(null);
  }, []);

  const loadBrandAssets = useCallback(async () => {
    setLoadingBrand(true);
    try {
      const { data, error } = await supabase.functions.invoke("analisar-produto", {
        body: { action: "brand_assets" },
      });
      if (error) {
        throw new Error(await edgeFunctionErrorMessage(
          error,
          data,
          "Não consegui carregar sua marca agora.",
        ));
      }
      const hasLogo = data?.has_logo === true;
      setHasSavedLogo(hasLogo);
      setUseSavedLogo(hasLogo);
      setSavedLogoPreview(data?.logo_preview || null);
      setSavedColors(Array.isArray(data?.colors) ? data.colors : []);
    } catch (error) {
      console.warn("[brand-settings] não foi possível carregar a marca:", error);
      setHasSavedLogo(false);
      setUseSavedLogo(false);
    } finally {
      setLoadingBrand(false);
    }
  }, []);

  useEffect(() => {
    void loadBrandAssets();
  }, [loadBrandAssets]);

  const previewSite = useCallback(async () => {
    if (!siteUrl.trim()) return null;
    setReadingSite(true);
    try {
      const { data, error } = await supabase.functions.invoke("analisar-produto", {
        body: { action: "preview_site_identity", site_url: siteUrl.trim() },
      });
      if (error) {
        throw new Error(await edgeFunctionErrorMessage(
          error,
          data,
          "Não foi possível ler a identidade do site agora.",
        ));
      }
      if (!data?.success || !data?.identity) {
        throw new Error(data?.error || "Não foi possível ler a identidade do site.");
      }
      setSitePreview(data.identity as SiteBrandPreview);
      return data.identity as SiteBrandPreview;
    } finally {
      setReadingSite(false);
    }
  }, [siteUrl]);

  const saveSiteLogo = useCallback(async () => {
    if (!sitePreview?.logo_data_url || sitePreview.logo_confidence !== "high") {
      throw new Error("Não há uma logo confiável para salvar.");
    }
    setSavingLogo(true);
    try {
      const { data, error } = await supabase.functions.invoke("analisar-produto", {
        body: {
          action: "save_site_logo",
          logo_data_url: sitePreview.logo_data_url,
        },
      });
      if (error) {
        throw new Error(await edgeFunctionErrorMessage(
          error,
          data,
          "Não foi possível salvar a logo agora.",
        ));
      }
      if (!data?.success) throw new Error(data?.error || "Não foi possível salvar a logo.");
      setHasSavedLogo(true);
      setUseSavedLogo(true);
      setSavedLogoPreview(sitePreview.logo_data_url);
      return true;
    } finally {
      setSavingLogo(false);
    }
  }, [sitePreview]);

  return {
    hasSavedLogo,
    useSavedLogo,
    setUseSavedLogo,
    savedLogoPreview,
    savedColors,
    siteUrl,
    setSiteUrl: updateSiteUrl,
    sitePreview,
    loadingBrand,
    readingSite,
    savingLogo,
    previewSite,
    saveSiteLogo,
  };
}
