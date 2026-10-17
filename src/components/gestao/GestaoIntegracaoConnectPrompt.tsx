import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VendorIntegrationPricingBlock } from "@/components/integracoes/VendorIntegrationPricingBlock";
import { VENDOR_INTEGRATION_PRICING } from "@/lib/vendor-integration-pricing";

type VendorKey = "focusnfe" | "zapsign";

const STEPS: Record<VendorKey, string[]> = {
  focusnfe: [
    "Crie sua conta na Focus NFe (homologação gratuita).",
    "Envie o certificado A1 no painel da Focus — não precisa subir certificado aqui.",
    "Cole o token da loja em Integrações e teste a conexão.",
  ],
  zapsign: [
    "Crie sua conta ZapSign (ambiente de teste gratuito).",
    "Gere o API token no painel da ZapSign.",
    "Cole o token em Integrações e comece a enviar contratos para assinatura.",
  ],
};

type Props = {
  vendor: VendorKey;
  title: string;
  description: string;
};

export function GestaoIntegracaoConnectPrompt({ vendor, title, description }: Props) {
  const pricing = VENDOR_INTEGRATION_PRICING[vendor];

  return (
    <Card className="border-dashed border-primary/30 bg-muted/20">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <VendorIntegrationPricingBlock vendor={pricing} />
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          {STEPS[vendor].map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link to="/configuracoes/integracoes">Conectar agora</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
