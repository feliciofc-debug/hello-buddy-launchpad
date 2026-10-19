import { Car, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProcedenciaConnection } from "@/components/procedencia/useProcedenciaConnection";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";

export function ProcedenciaIntegrationCard() {
  const { loading, busy, status, saveCredential, testConnection, listConsultas } =
    useProcedenciaConnection();
  const [email, setEmail] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [limite, setLimite] = useState("30");
  const [consultas, setConsultas] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    if (status?.limite_mensal) setLimite(String(status.limite_mensal));
  }, [status?.limite_mensal]);

  useEffect(() => {
    if (!status?.ativo) return;
    void listConsultas().then(setConsultas);
  }, [status?.ativo, listConsultas]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Procedência veicular…
        </CardContent>
      </Card>
    );
  }

  const connected = !!status?.ativo;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Car className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-lg">Procedência veicular</CardTitle>
              <CardDescription className="mt-1">
                Consulta leilão, sinistro, roubo, gravame e Renajud via Consultar Placa — créditos
                da sua conta.
              </CardDescription>
            </div>
          </div>
          <Badge variant={connected ? "default" : "secondary"}>
            {connected ? "Ativo" : "Não configurado"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Custo estimado por consulta completa:{" "}
          {formatGestaoMoney(status?.custo_estimado ?? 38.8)} · Limite mensal:{" "}
          {status?.consultas_mes ?? 0}/{status?.limite_mensal ?? 30}
        </p>
        {connected && status.email_masked && (
          <p className="text-sm">
            Conta: {status.email_masked} · API key {status.api_key_hint}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="proc-email">E-mail Consultar Placa</Label>
            <Input
              id="proc-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={status?.email_masked ?? "conta@loja.com.br"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proc-key">API key (não é exibida depois)</Label>
            <Input
              id="proc-key"
              type="password"
              autoComplete="new-password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={connected ? "••••••••" : "Cole a API key"}
            />
          </div>
        </div>
        <div className="space-y-2 max-w-xs">
          <Label htmlFor="proc-limite">Limite mensal de consultas</Label>
          <Input
            id="proc-limite"
            type="number"
            min={0}
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || (!apiKey && !connected) || !email.trim()}
            onClick={() =>
              void saveCredential({
                email: email.trim(),
                api_key: apiKey,
                limite_mensal: Number(limite) || 30,
              }).then((ok) => {
                if (ok) setApiKey("");
              })
            }
          >
            Salvar
          </Button>
          <Button variant="secondary" disabled={busy || !connected} onClick={() => void testConnection()}>
            Testar conexão
          </Button>
          <Button variant="link" className="px-0" asChild>
            <a
              href="https://consultarplaca.com.br"
              target="_blank"
              rel="noopener noreferrer"
            >
              Criar conta na Consultar Placa
              <ExternalLink className="ml-1 inline h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
        {consultas.length > 0 && (
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Consultas do mês</p>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
              {consultas.map((c) => (
                <li key={String(c.id)} className="flex flex-wrap gap-x-2 text-muted-foreground">
                  <span>{String(c.placa)}</span>
                  <span>{String(c.status)}</span>
                  <span>{String(c.solicitado_por ?? "")}</span>
                  {c.custo_estimado != null && (
                    <span>{formatGestaoMoney(Number(c.custo_estimado))}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
