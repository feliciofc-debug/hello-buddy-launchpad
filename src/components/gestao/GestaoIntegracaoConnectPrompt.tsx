import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GestaoHelpTip } from "@/components/gestao/GestaoHelpTip.tsx";
import { VendorIntegrationPricingBlock } from "@/components/integracoes/VendorIntegrationPricingBlock";
import { withVoltarParam } from "@/lib/app-back-nav.ts";
import { VENDOR_INTEGRATION_PRICING } from "@/lib/vendor-integration-pricing";

type VendorKey = "focusnfe" | "zapsign";

const COPY: Record<
  VendorKey,
  { title: string; description: string; help: string; cta: string; foco: string }
> = {
  focusnfe: {
    title: "Ativar emissão de nota fiscal",
    description: "Emita a nota da venda com 1 clique.",
    help: "A conexão usa Focus NFe: certificado digital fica no painel deles; aqui você só cola o token da loja.",
    cta: "Conectar NF-e",
    foco: "nfe",
  },
  zapsign: {
    title: "Ativar contratos com assinatura no celular",
    description: "O cliente assina pelo celular, sem papel.",
    help: "Integração com ZapSign: cada loja usa sua própria conta e token de API.",
    cta: "Conectar contratos",
    foco: "contratos",
  },
};

const STEPS: Record<VendorKey, string[]> = {
  focusnfe: [
    "Crie sua conta na Focus NFe (homologação gratuita).",
    "Envie o certificado A1 no painel da Focus — não precisa subir certificado aqui.",
    "Cole o token da loja abaixo e teste a conexão.",
  ],
  zapsign: [
    "Crie sua conta ZapSign (ambiente de teste gratuito).",
    "Gere o API token no painel da ZapSign.",
    "Cole o token abaixo e comece a enviar contratos para assinatura.",
  ],
};

type Props = {
  vendor: VendorKey;
  onConectar?: () => void;
};

export function GestaoIntegracaoConnectPrompt({ vendor, onConectar }: Props) {
  const location = useLocation();
  const meta = COPY[vendor];
  const pricing = VENDOR_INTEGRATION_PRICING[vendor];
  const returnTo = `${location.pathname}${location.search}`;
  const integracoesUrl = withVoltarParam(
    `/configuracoes/integracoes?foco=${meta.foco}`,
    returnTo,
  );

  return (
    <Card className="border-dashed border-primary/30 bg-muted/20">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {meta.title}
          <GestaoHelpTip text={meta.help} />
        </CardTitle>
        <CardDescription>{meta.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <VendorIntegrationPricingBlock vendor={pricing} />
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          {STEPS[vendor].map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {onConectar ? (
          <Button size="lg" className="w-full sm:w-auto" onClick={onConectar}>
            {meta.cta}
          </Button>
        ) : (
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link to={integracoesUrl}>{meta.cta}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
