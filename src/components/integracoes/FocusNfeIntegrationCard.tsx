import { Receipt, Loader2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { VendorIntegrationPricingBlock } from "@/components/integracoes/VendorIntegrationPricingBlock";
import { useGestaoFocusnfeConnection } from "@/components/integracoes/useGestaoFocusnfeConnection";
import { VENDOR_INTEGRATION_PRICING } from "@/lib/vendor-integration-pricing";

const vendor = VENDOR_INTEGRATION_PRICING.focusnfe;

export function FocusNfeIntegrationCard() {
  const { loading, busy, status, save, testConnection, disconnect } = useGestaoFocusnfeConnection();
  const [token, setToken] = useState("");
  const [ambiente, setAmbiente] = useState<"homolog" | "producao">("homolog");
  const [producaoConfirmOpen, setProducaoConfirmOpen] = useState(false);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Notas fiscais — Focus NFe…
        </CardContent>
      </Card>
    );
  }

  const connected = !!status?.connected;

  const onConnect = () => {
    if (ambiente === "producao") {
      setProducaoConfirmOpen(true);
      return;
    }
    void save(token.trim(), ambiente);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Receipt className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <CardTitle className="text-lg">{vendor.name}</CardTitle>
                <CardDescription className="mt-1">{vendor.description}</CardDescription>
              </div>
            </div>
            <Badge variant={connected ? "default" : "secondary"}>
              {connected ? "Conectado" : "Não conectado"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <VendorIntegrationPricingBlock vendor={vendor} />

          <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            O certificado digital A1 fica no painel da Focus NFe — não enviamos certificado para este servidor.
          </p>

          <Button asChild variant="outline" className="w-full sm:w-auto">
            <a href={vendor.signupUrl} target="_blank" rel="noopener noreferrer">
              Criar conta Focus NFe
            </a>
          </Button>

          {connected && (
            <>
              <p className="text-sm text-muted-foreground">
                Ambiente:{" "}
                <strong>{status?.ambiente === "producao" ? "Produção" : "Homologação (teste Sefaz)"}</strong>
              </p>
              <Button asChild variant="secondary" size="sm">
                <Link to="/gestao/configuracao-fiscal">Configuração fiscal da loja</Link>
              </Button>
            </>
          )}

          <div className="grid gap-3">
            <div>
              <Label>Token da loja</Label>
              <Input
                type="password"
                placeholder={connected ? "Novo token (opcional)" : "Cole o token da Focus NFe"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={busy}
                autoComplete="off"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Cifrado com GESTAO_INTEGRACOES_KEY no servidor; não é exibido de novo.
              </p>
            </div>
            <div>
              <Label>Ambiente</Label>
              <Select value={ambiente} onValueChange={(v) => setAmbiente(v as typeof ambiente)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="homolog">Homologação (padrão)</SelectItem>
                  <SelectItem value="producao">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || token.trim().length < 8} onClick={onConnect}>
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

      <AlertDialog open={producaoConfirmOpen} onOpenChange={setProducaoConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ativar produção?</AlertDialogTitle>
            <AlertDialogDescription>
              Notas em produção têm validade fiscal. Confirme que o contador validou CFOP, natureza e regime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void save(token.trim(), "producao", true).then(() => setProducaoConfirmOpen(false))}
            >
              Sim, usar produção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
