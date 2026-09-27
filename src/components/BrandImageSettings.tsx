import { Link } from "react-router-dom";
import { Loader2, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { SiteBrandPreview } from "@/hooks/useBrandImageSettings";

type Props = {
  hasSavedLogo: boolean;
  useSavedLogo: boolean;
  onUseSavedLogoChange: (checked: boolean) => void;
  savedLogoPreview: string | null;
  savedColors: string[];
  siteUrl: string;
  onSiteUrlChange: (value: string) => void;
  sitePreview: SiteBrandPreview | null;
  loading: boolean;
  readingSite: boolean;
  savingLogo: boolean;
  onPreviewSite: () => Promise<unknown>;
  onSaveSiteLogo: () => Promise<unknown>;
};

function ColorSamples({ colors }: { colors: string[] }) {
  if (!colors.length) return null;
  return (
    <div className="flex items-center gap-2" aria-label="Cores da marca">
      {colors.slice(0, 4).map((color) => (
        <span
          key={color}
          title={color}
          className="h-7 w-7 rounded-full border shadow-sm"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

export function BrandImageSettings({
  hasSavedLogo,
  useSavedLogo,
  onUseSavedLogoChange,
  savedLogoPreview,
  savedColors,
  siteUrl,
  onSiteUrlChange,
  sitePreview,
  loading,
  readingSite,
  savingLogo,
  onPreviewSite,
  onSaveSiteLogo,
}: Props) {
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="use-saved-logo">Usar minha logo</Label>
          <p className="text-xs text-muted-foreground">
            A logo original cadastrada na plataforma será aplicada pelo servidor, sem ser redesenhada pela IA.
          </p>
          {!hasSavedLogo && !loading && (
            <Link to="/pj/minha-marca" className="text-xs font-medium text-primary underline">
              Cadastrar minha logo
            </Link>
          )}
        </div>
        <Switch
          id="use-saved-logo"
          checked={useSavedLogo}
          disabled={!hasSavedLogo || loading}
          onCheckedChange={onUseSavedLogoChange}
        />
      </div>

      {useSavedLogo && hasSavedLogo ? (
        <div className="flex items-center gap-4 rounded-md bg-muted/40 p-3">
          {savedLogoPreview && (
            <img src={savedLogoPreview} alt="Logo cadastrada" className="h-14 w-24 object-contain" />
          )}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Identidade cadastrada</p>
            <ColorSamples colors={savedColors} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="brand-site-url">Site da sua marca (opcional)</Label>
            <p className="text-xs text-muted-foreground">
              Usaremos apenas cores públicas do site. Nenhuma logo será salva ou aplicada sem sua confirmação.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="brand-site-url"
              type="url"
              value={siteUrl}
              onChange={(event) => onSiteUrlChange(event.target.value)}
              placeholder="https://suaempresa.com.br"
            />
            <Button
              type="button"
              variant="outline"
              disabled={!siteUrl.trim() || readingSite}
              onClick={() => void onPreviewSite()}
            >
              {readingSite
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Palette className="mr-2 h-4 w-4" />}
              Ler identidade
            </Button>
          </div>
          {sitePreview && (
            <div className="space-y-3 rounded-md bg-muted/40 p-3">
              <ColorSamples colors={sitePreview.colors} />
              {sitePreview.logo_confidence === "high" && sitePreview.logo_data_url && (
                <div className="flex flex-wrap items-center gap-3">
                  <img
                    src={sitePreview.logo_data_url}
                    alt="Logo encontrada no site"
                    className="h-14 w-24 rounded bg-background object-contain p-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={savingLogo}
                    onClick={() => void onSaveSiteLogo()}
                  >
                    {savingLogo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar como minha logo
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
