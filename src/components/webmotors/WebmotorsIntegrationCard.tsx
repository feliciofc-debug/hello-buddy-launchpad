import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWebmotorsConnection } from "@/components/webmotors/useWebmotorsConnection";

export function WebmotorsIntegrationCard() {
  const { loading, busy, status, saveCredentials, testConnection, disconnect } =
    useWebmotorsConnection();
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ambiente, setAmbiente] = useState<"homolog" | "producao">("homolog");

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Webmotors…
        </CardContent>
      </Card>
    );
  }

  const connected = !!status?.connected;

  const handleSave = async () => {
    const ok = await saveCredentials({
      cnpj,
      integration_email: email,
      password,
      ambiente,
    });
    if (ok) setPassword("");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">Webmotors</CardTitle>
          <Badge variant={connected ? "default" : "secondary"}>
            {connected ? "Conectado" : "Não conectado"}
          </Badge>
        </div>
        <CardDescription>
          Publique carros do estoque na Webmotors (integração revendedor SOAP). Ambiente de teste
          primeiro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.integration_email && (
          <p className="text-sm text-muted-foreground">
            {status.cnpj_masked && <>CNPJ {status.cnpj_masked} · </>}
            <strong>{status.integration_email}</strong>
            {" · "}
            {status.ambiente === "producao" ? "Produção" : "Homologação"}
          </p>
        )}
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="wm-cnpj">CNPJ da loja</Label>
            <Input
              id="wm-cnpj"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
              disabled={busy}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wm-email">E-mail usuário integração</Label>
            <Input
              id="wm-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="integracao@sualoja.com.br"
              disabled={busy}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wm-pass">Senha</Label>
            <Input
              id="wm-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={connected ? "Nova senha (opcional ao testar)" : "Senha"}
              disabled={busy}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Ambiente</Label>
            <Select
              value={ambiente}
              onValueChange={(v) => setAmbiente(v as "homolog" | "producao")}
              disabled={busy}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="homolog">Homologação (teste)</SelectItem>
                <SelectItem value="producao">Produção</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void handleSave()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
          <Button disabled={busy} variant="outline" onClick={() => void testConnection(password || undefined)}>
            Testar conexão
          </Button>
          {connected && (
            <Button disabled={busy} variant="ghost" onClick={() => void disconnect()}>
              Desconectar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
