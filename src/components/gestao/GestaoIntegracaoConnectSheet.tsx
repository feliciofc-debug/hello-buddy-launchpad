import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FocusNfeIntegrationCard } from "@/components/integracoes/FocusNfeIntegrationCard";
import { ZapSignIntegrationCard } from "@/components/integracoes/ZapSignIntegrationCard";

export type GestaoConnectVendor = "focusnfe" | "zapsign";

const TITLES: Record<GestaoConnectVendor, { title: string; description: string }> = {
  focusnfe: {
    title: "Ativar emissão de nota fiscal",
    description: "Emita a nota da venda com 1 clique. O certificado digital fica na conta do emissor (Focus NFe).",
  },
  zapsign: {
    title: "Ativar contratos com assinatura no celular",
    description: "O cliente assina pelo celular, sem papel.",
  },
};

type Props = {
  vendor: GestaoConnectVendor | null;
  onOpenChange: (open: boolean) => void;
  onConnectSuccess?: () => void;
};

export function GestaoIntegracaoConnectSheet({ vendor, onOpenChange, onConnectSuccess }: Props) {
  const meta = vendor ? TITLES[vendor] : null;

  return (
    <Sheet open={!!vendor} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {meta && (
          <SheetHeader className="text-left">
            <SheetTitle>{meta.title}</SheetTitle>
            <SheetDescription>{meta.description}</SheetDescription>
          </SheetHeader>
        )}
        <div className="mt-6">
          {vendor === "focusnfe" && (
            <FocusNfeIntegrationCard embedInGestao onConnectSuccess={onConnectSuccess} />
          )}
          {vendor === "zapsign" && (
            <ZapSignIntegrationCard embedInGestao onConnectSuccess={onConnectSuccess} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
