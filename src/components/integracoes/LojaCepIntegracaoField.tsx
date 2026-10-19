import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MlCepField } from "@/components/ml/MlCepField";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInvokeErrorToast, invokeFunctionComCorpo } from "@/lib/invoke-function-com-corpo.ts";
import { formatBrazilCep } from "../../../supabase/functions/_shared/ml-location.ts";

export function LojaCepIntegracaoField() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);
  const [storeZip, setStoreZip] = useState<string | null>(null);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await invokeFunctionComCorpo("ml-status");
    if (r.success && r.data) {
      setHasLocation(!!r.data.has_location);
      setStoreZip(r.data.store_zip != null ? String(r.data.store_zip) : null);
      const city = r.data.location_city_name ? String(r.data.location_city_name) : "";
      const state = r.data.location_state_name ? String(r.data.location_state_name) : "";
      const place = r.data.location_place ? String(r.data.location_place) : "";
      setPlaceLabel(place || (city && state ? `${city}/${state}` : city || state || null));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveCep = async (cepRaw: string) => {
    setBusy(true);
    const r = await invokeFunctionComCorpo("ml-location-set", { body: { cep: cepRaw } });
    setBusy(false);
    if (!r.success) {
      toast.error(formatInvokeErrorToast({ error: r.error, blocking: r.blocking, fallback: "Não foi possível salvar o CEP." }));
      return false;
    }
    toast.success(String(r.data?.message ?? "CEP da loja salvo."));
    void refresh();
    return true;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Localização da loja…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">CEP da loja</CardTitle>
        <CardDescription>
          Usado em Mercado Livre, OLX e Webmotors. Não depende de conectar o ML primeiro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasLocation && (
          <p className="text-sm text-muted-foreground">
            Atual: <strong>{placeLabel ?? "configurado"}</strong>
            {storeZip ? ` · CEP ${formatBrazilCep(storeZip)}` : ""}
          </p>
        )}
        <MlCepField busy={busy} onSave={saveCep} />
      </CardContent>
    </Card>
  );
}
