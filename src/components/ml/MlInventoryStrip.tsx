import { CheckCircle2, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useMlConnection } from "@/components/ml/useMlConnection";

export function MlInventoryStrip() {
  const { loading, status } = useMlConnection();

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Mercado Livre…
      </p>
    );
  }

  if (!status?.connected) {
    return (
      <p className="text-sm text-muted-foreground">
        Mercado Livre não conectado ·{" "}
        <Link className="font-medium text-primary underline-offset-4 hover:underline" to="/configuracoes/integracoes">
          Gerenciar integrações →
        </Link>
      </p>
    );
  }

  return (
    <p className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden />
      <span>
        Mercado Livre conectado
        {!status.has_location && " (CEP pendente)"}
      </span>
      <span>·</span>
      <Link className="font-medium text-primary underline-offset-4 hover:underline" to="/configuracoes/integracoes">
        Gerenciar integrações →
      </Link>
    </p>
  );
}
