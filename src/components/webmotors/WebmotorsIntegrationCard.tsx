import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
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

const COCKPIT_CREDENTIAL_URL =
  "https://www.cockpit.com.br/integration/credential/thirdparty-inventory";

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
            ? "Sua loja está na lista de homologação do servidor. Credenciais de teste não aparecem no navegador."
            : "Integração em produção: use o usuário criado no Cockpit Webmotors (estoque terceiro)."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!homologacao && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-2">
            <p className="font-medium">Como criar o usuário no Cockpit</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>
                Acesse{" "}
                <a
                  href="https://www.cockpit.com.br/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline inline-flex items-center gap-0.5"
                >
                  cockpit.com.br
                  <ExternalLink className="h-3 w-3" />
                </a>{" "}
                com o login da loja.
              </li>
              <li>
                Vá em <strong>Integrações → Estoque terceiro</strong>{" "}
                <a
                  href={COCKPIT_CREDENTIAL_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  (abrir tela)
                </a>
                .
              </li>
              <li>Crie um usuário e senha dedicados à integração (PTS-1463).</li>
              <li>
                Cadastre abaixo o <strong>CNPJ</strong> (se o login exigir),{" "}
                <strong>usuário</strong> e <strong>senha</strong> do Cockpit.
              </li>
              <li>Use <strong>Testar conexão</strong> (somente login) antes de publicar.</li>
            </ol>
          </div>
        )}

        {!homologacao && (
          <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
            Contatos dos compradores chegam pelo telefone/WhatsApp cadastrado no
            seu Cockpit — cadastre lá o número do Jarvis. Integração automática
            de leads fica para uma próxima fase.
          </p>
        )}

        {!homologacao && status?.integration_email && (
          <p className="text-sm text-muted-foreground">
            {status.cnpj_masked && <>CNPJ {status.cnpj_masked} · </>}
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
              <Label htmlFor="wm-email">Usuário Cockpit (integração)</Label>
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
              <Label htmlFor="wm-pass">Senha Cockpit</Label>
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
