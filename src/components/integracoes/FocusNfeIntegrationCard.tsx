import { Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VendorIntegrationPricingBlock } from "@/components/integracoes/VendorIntegrationPricingBlock";
import { VENDOR_INTEGRATION_PRICING } from "@/lib/vendor-integration-pricing";

const vendor = VENDOR_INTEGRATION_PRICING.focusnfe;

export function FocusNfeIntegrationCard() {
  return (
    <Card className="opacity-95">
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
          <Badge variant="outline">G6 — em breve</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <VendorIntegrationPricingBlock vendor={vendor} />
        <Button asChild variant="secondary">
          <a href={vendor.signupUrl} target="_blank" rel="noopener noreferrer">
            Criar minha conta
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
