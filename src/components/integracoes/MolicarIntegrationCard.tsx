import { CarFront, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGestaoMolicarConnection } from "@/components/integracoes/useGestaoMolicarConnection";

type Props = {
  embedInGestao?: boolean;
  onConnectSuccess?: () => void;
};

export function MolicarIntegrationCard({ embedInGestao, onConnectSuccess }: Props = {}) {
  const { loading, busy, status, testConnection, save, disconnect } =
    useGestaoMolicarConnection();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [limiteMensal, setLimiteMensal] = useState("50");
  const [atualizarPrecoDias, setAtualizarPrecoDias] = useState("7");

  useEffect(() => {
    if (!status) return;
    setClientId(status.client_id ?? "");
    setLimiteMensal(String(status.limite_mensal));
    setAtualizarPrecoDias(String(status.atualizar_preco_dias));
  }, [status]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Consulta e preços veiculares — Molicar…
        </CardContent>
      </Card>
    );
  }

  const connected = !!status?.connected;
  const monthlyLimit = Number(limiteMensal);
  const refreshDays = Number(atualizarPrecoDias);
  const credentialsValid = clientId.trim().length > 0 && clientSecret.length > 0;
  const settingsValid =
    Number.isInteger(monthlyLimit) &&
    monthlyLimit >= 1 &&
    monthlyLimit <= 10_000 &&
    Number.isInteger(refreshDays) &&
    refreshDays >= 1 &&
    refreshDays <= 365;

  const credentials = {
    client_id: clientId.trim(),
    client_secret: clientSecret,
  };

  const handleConnect = async () => {
    const wasConnected = connected;
    const valid = await testConnection(credentials);
    if (!valid) return;

    const saved = await save({
      ...credentials,
      limite_mensal: monthlyLimit,
      atualizar_preco_dias: refreshDays,
    });
    if (!saved) return;

    setClientSecret("");
    if (!wasConnected) onConnectSuccess?.();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <CarFront className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-lg">
                {embedInGestao ? "Consulta e preços veiculares" : "Molicar"}
              </CardTitle>
              <CardDescription className="mt-1">
                Consulte dados e referências de preço da Molicar para os veículos da loja.
              </CardDescription>
            </div>
          </div>
          <Badge variant={connected ? "default" : "secondary"}>
            {connected ? "Conectado" : "Não conectado"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-md border p-3 text-sm">
          <span className="text-muted-foreground">Consumo no mês atual: </span>
          <strong>
            {status?.consultas_mes ?? 0} de {status?.limite_mensal ?? monthlyLimit}
          </strong>
          <span className="text-muted-foreground"> consultas</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="molicar-client-id">Client ID</Label>
            <Input
              id="molicar-client-id"
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              disabled={busy}
              autoComplete="off"
              placeholder="Client ID da Molicar"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="molicar-client-secret">Client secret</Label>
            <Input
              id="molicar-client-secret"
              type="password"
              value={clientSecret}
              onChange={(event) => setClientSecret(event.target.value)}
              disabled={busy}
              autoComplete="new-password"
              placeholder={connected ? "Informe para substituir" : "Client secret da Molicar"}
            />
            <p className="text-[11px] text-muted-foreground">
              O segredo é enviado somente às funções seguras e nunca é exibido novamente.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="molicar-monthly-limit">Limite mensal de consultas</Label>
            <Input
              id="molicar-monthly-limit"
              type="number"
              min={1}
              max={10_000}
              step={1}
              value={limiteMensal}
              onChange={(event) => setLimiteMensal(event.target.value)}
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="molicar-refresh-days">Atualizar preços a cada (dias)</Label>
            <Input
              id="molicar-refresh-days"
              type="number"
              min={1}
              max={365}
              step={1}
              value={atualizarPrecoDias}
              onChange={(event) => setAtualizarPrecoDias(event.target.value)}
              disabled={busy}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          O teste valida apenas a emissão do token Molicar e não realiza nem cobra uma consulta
          veicular.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || !credentialsValid || !settingsValid}
            onClick={() => void handleConnect()}
          >
            {connected ? "Atualizar conexão" : "Testar e conectar"}
          </Button>
          <Button
            variant="outline"
            disabled={busy || (!connected && !credentialsValid)}
            onClick={() => void testConnection(credentialsValid ? credentials : undefined)}
          >
            Testar token
          </Button>
          {connected && (
            <Button variant="destructive" disabled={busy} onClick={() => void disconnect()}>
              Desconectar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
