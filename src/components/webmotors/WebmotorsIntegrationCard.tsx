import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWebmotorsConnection } from "@/components/webmotors/useWebmotorsConnection";

export function WebmotorsIntegrationCard() {
  const { loading, busy, status, saveCredentials, testConnection, disconnect } =
    useWebmotorsConnection();
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
  const homologacao = status?.server_environment === "homologacao";

  const handleSave = async () => {
    const ok = await saveCredentials({
      cnpj,
      integration_email: email,
      password,
    });
    if (ok) setPassword("");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">Webmotors</CardTitle>
          <Badge variant={connected ? "default" : "secondary"}>
            {homologacao
              ? "Em homologação"
              : connected
              ? "Conectado"
              : "Não conectado"}
          </Badge>
        </div>
        <CardDescription>
          {homologacao
            ? "Ambiente de homologação configurado no servidor. As credenciais de teste não são expostas no navegador."
            : "Conecte as credenciais de integração da própria loja para publicar o estoque."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!homologacao && status?.integration_email && (
          <p className="text-sm text-muted-foreground">
            {status.cnpj_masked && <>CNPJ {status.cnpj_masked} ·</>}
            <strong>{status.integration_email}</strong>
            {" · "}
            Produção
          </p>
        )}
        {!homologacao && (
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
                placeholder={connected
                  ? "Nova senha (opcional ao testar)"
                  : "Senha"}
                disabled={busy}
              />
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {!homologacao && (
            <Button
              disabled={busy}
              onClick={() => void handleSave()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          )}
          <Button
            disabled={busy}
            variant="outline"
            onClick={() => void testConnection()}
          >
            Testar conexão
          </Button>
          {!homologacao && connected && (
            <Button
              disabled={busy}
              variant="ghost"
              onClick={() => void disconnect()}
            >
              Desconectar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
