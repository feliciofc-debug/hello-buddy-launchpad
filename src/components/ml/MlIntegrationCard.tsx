import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MlCepField } from "@/components/ml/MlCepField";
import { useMlConnection } from "@/components/ml/useMlConnection";

function locationLine(
  place: string | null,
  city: string | null,
  state: string | null,
): string | null {
  if (place) return place;
  if (city && state) return `${city}/${state}`;
  return city ?? state;
}

export function MlIntegrationCard() {
  const [editingCep, setEditingCep] = useState(false);
  const { loading, busy, status, formattedStoreZip, connect, disconnect, saveCep } =
    useMlConnection();

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Mercado Livre…
        </CardContent>
      </Card>
    );
  }

  const connected = !!status?.connected;
  const showCepForm = connected && (!status?.has_location || editingCep);
  const placeLabel = locationLine(
    status?.location_place ?? null,
    status?.location_city_name ?? null,
    status?.location_state_name ?? null,
  );

  const handleSaveCep = async (cep: string) => {
    const ok = await saveCep(cep);
    if (ok) setEditingCep(false);
    return ok;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">Mercado Livre</CardTitle>
          <Badge variant={connected ? "default" : "secondary"}>
            {connected ? "Conectado" : "Não conectado"}
          </Badge>
        </div>
        <CardDescription>
          Publique veículos do estoque como anúncios classificados no Mercado Livre.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {connected ? (
          <>
            <p className="text-sm text-muted-foreground">
              Conectado como <strong>{status?.nickname ?? "conta ML"}</strong>
              {status?.status === "needs_reauth" && (
                <span className="text-amber-600"> · reconecte a conta</span>
              )}
            </p>
            {status?.has_location && !editingCep && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>
                  Localização:{" "}
                  <strong>
                    {placeLabel ?? "configurada"}
                    {formattedStoreZip ? ` · CEP ${formattedStoreZip}` : ""}
                  </strong>
                </span>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-primary"
                  disabled={busy}
                  onClick={() => setEditingCep(true)}
                >
                  Alterar CEP
                </Button>
              </div>
            )}
            {showCepForm && (
              <div className="rounded-md border border-dashed p-3">
                {!status?.has_location && (
                  <p className="mb-3 text-sm text-muted-foreground">
                    Informe o CEP da loja para publicar veículos (obrigatório nos anúncios ML).
                  </p>
                )}
                {editingCep && status?.has_location && (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <p className="text-sm text-muted-foreground">Novo CEP da loja:</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto px-2 py-0"
                      disabled={busy}
                      onClick={() => setEditingCep(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                )}
                <MlCepField busy={busy} onSave={handleSaveCep} />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {status?.status === "needs_reauth" && (
                <Button disabled={busy} onClick={() => void connect()}>
                  Reconectar
                </Button>
              )}
              <Button variant="outline" disabled={busy} onClick={() => void disconnect()}>
                Desconectar
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Conecte sua conta de vendedor para publicar e sincronizar anúncios.
            </p>
            <Button disabled={busy} onClick={() => void connect()}>
              Conectar Mercado Livre
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
