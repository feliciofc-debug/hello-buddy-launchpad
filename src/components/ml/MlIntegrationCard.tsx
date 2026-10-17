import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MlCepField } from "@/components/ml/MlCepField";
import { useMlConnection } from "@/components/ml/useMlConnection";

export function MlIntegrationCard() {
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
            {status?.has_location ? (
              <p className="text-sm text-muted-foreground">
                Localização / CEP:{" "}
                <strong>{formattedStoreZip ?? "configurada"}</strong>
              </p>
            ) : (
              <div className="rounded-md border border-dashed p-3">
                <p className="mb-3 text-sm text-muted-foreground">
                  Informe o CEP da loja para publicar veículos (obrigatório nos anúncios ML).
                </p>
                <MlCepField busy={busy} onSave={saveCep} />
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
