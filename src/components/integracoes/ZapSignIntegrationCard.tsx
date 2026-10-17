import { FileSignature, Loader2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VendorIntegrationPricingBlock } from "@/components/integracoes/VendorIntegrationPricingBlock";
import { useGestaoZapsignConnection } from "@/components/integracoes/useGestaoZapsignConnection";
import { VENDOR_INTEGRATION_PRICING } from "@/lib/vendor-integration-pricing";

const vendor = VENDOR_INTEGRATION_PRICING.zapsign;

type Props = {
  embedInGestao?: boolean;
  onConnectSuccess?: () => void;
};

export function ZapSignIntegrationCard({ embedInGestao, onConnectSuccess }: Props = {}) {
  const { loading, busy, status, save, testConnection, disconnect } = useGestaoZapsignConnection();
  const [token, setToken] = useState("");
  const [ambiente, setAmbiente] = useState<"sandbox" | "producao">("sandbox");

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Assinatura digital — ZapSign…
        </CardContent>
      </Card>
    );
  }

  const connected = !!status?.connected;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <FileSignature className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-lg">
                {embedInGestao ? "Contratos com assinatura no celular" : "Assinatura digital — ZapSign"}
              </CardTitle>
              <CardDescription className="mt-1">
                {embedInGestao
                  ? "O cliente assina pelo celular, sem papel."
                  : vendor.description}
              </CardDescription>
            </div>
          </div>
          <Badge variant={connected ? "default" : "secondary"}>
            {connected ? "Conectado" : "Não conectado"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <VendorIntegrationPricingBlock vendor={vendor} />

        <Button asChild variant="outline" className="w-full sm:w-auto">
          <a href={vendor.signupUrl} target="_blank" rel="noopener noreferrer">
            Criar minha conta ZapSign
          </a>
        </Button>

        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground opacity-60">
          Usar conta AMZ (compartilhada) — em breve. Cada loja conecta a própria conta ZapSign.
        </div>

        {connected && (
          <p className="text-sm text-muted-foreground">
            Ambiente: <strong>{status?.ambiente === "producao" ? "Produção" : "Teste (sandbox)"}</strong>
          </p>
        )}

        <div className="grid gap-3">
          <div>
            <Label>API token</Label>
            <Input
              type="password"
              placeholder={connected ? "Novo token (opcional)" : "Cole o token da ZapSign"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={busy}
              autoComplete="off"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              O token é cifrado no servidor e nunca é exibido de novo.
            </p>
          </div>
          <div>
            <Label>Ambiente</Label>
            <Select value={ambiente} onValueChange={(v) => setAmbiente(v as typeof ambiente)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Teste (sandbox)</SelectItem>
                <SelectItem value="producao">Produção</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || token.trim().length < 8}
            onClick={() => {
              const wasConnected = connected;
              void save(token.trim(), ambiente).then((ok) => {
                if (ok && !wasConnected) onConnectSuccess?.();
              });
            }}
          >
            {connected ? "Atualizar token" : "Conectar"}
          </Button>
          {connected && (
            <>
              <Button variant="outline" disabled={busy} onClick={() => void testConnection()}>
                Testar conexão
              </Button>
              <Button variant="destructive" disabled={busy} onClick={() => void disconnect()}>
                Desconectar
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
