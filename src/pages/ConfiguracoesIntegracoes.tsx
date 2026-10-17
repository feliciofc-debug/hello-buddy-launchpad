import { ArrowLeft, Plug } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MlIntegrationCard } from "@/components/ml/MlIntegrationCard";
import {
  PLANNED_PORTAL_INTEGRATIONS,
  PORTAL_STATUS_LABEL,
} from "@/lib/portal-integrations-config";

function PlannedPortalCard({
  name,
  description,
  statusLabel,
}: {
  name: string;
  description: string;
  statusLabel: string;
}) {
  return (
    <Card className="opacity-90">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Plug className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-lg">{name}</CardTitle>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
          </div>
          <Badge variant="outline">{statusLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Button disabled variant="secondary">
          Indisponível
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ConfiguracoesIntegracoes() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <button
          type="button"
          onClick={() => navigate("/configuracoes")}
          className="mb-2 flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium">Voltar às configurações</span>
        </button>

        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Integrações</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Portais de anúncio e marketplaces conectados à sua revenda.
          </p>
        </div>

        <MlIntegrationCard />

        {PLANNED_PORTAL_INTEGRATIONS.map((portal) => (
          <PlannedPortalCard
            key={portal.id}
            name={portal.name}
            description={portal.description}
            statusLabel={PORTAL_STATUS_LABEL[portal.status]}
          />
        ))}
      </div>
    </div>
  );
}
