import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOlxConnection } from "@/components/olx/useOlxConnection";

export function OlxIntegrationCard() {
  const { loading, busy, status, connect, disconnect } = useOlxConnection();

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          OLX…
        </CardContent>
      </Card>
    );
  }

  const connected = !!status?.connected;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">OLX</CardTitle>
          <Badge variant={connected ? "default" : "secondary"}>
            {connected ? "Conectado" : "Não conectado"}
          </Badge>
        </div>
        <CardDescription>
          Publique veículos do estoque manualmente na OLX (conta profissional).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-amber-700 dark:text-amber-500">
          Requer conta OLX com plano profissional para empresas.
        </p>
        {connected ? (
          <>
            <p className="text-sm text-muted-foreground">
              Conectado como <strong>{status?.nome ?? "conta OLX"}</strong>
              {status?.email_mascarado ? (
                <span> · {status.email_mascarado}</span>
              ) : null}
            </p>
            <Button variant="outline" disabled={busy} onClick={() => void disconnect()}>
              Desconectar
            </Button>
          </>
        ) : (
          <Button disabled={busy} onClick={() => void connect()}>
            Conectar OLX
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
