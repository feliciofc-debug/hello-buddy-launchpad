import { useEffect } from "react";
import { ArrowLeft, Plug } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FocusNfeIntegrationCard } from "@/components/integracoes/FocusNfeIntegrationCard";
import { ZapSignIntegrationCard } from "@/components/integracoes/ZapSignIntegrationCard";
import { MlIntegrationCard } from "@/components/ml/MlIntegrationCard";
import { ProcedenciaIntegrationCard } from "@/components/procedencia/ProcedenciaIntegrationCard";
import { OlxIntegrationCard } from "@/components/olx/OlxIntegrationCard";
import { WebmotorsIntegrationCard } from "@/components/webmotors/WebmotorsIntegrationCard";
import { LojaCepIntegracaoField } from "@/components/integracoes/LojaCepIntegracaoField.tsx";
import { useSmartBack } from "@/lib/app-back-nav.ts";
import {
  PLANNED_PORTAL_INTEGRATIONS,
  PORTAL_STATUS_LABEL,
} from "@/lib/portal-integrations-config";

type Foco = "nfe" | "contratos" | "zapsign" | null;

function parseFoco(raw: string | null): Foco {
  if (raw === "nfe") return "nfe";
  if (raw === "contratos") return "contratos";
  if (raw === "zapsign") return "zapsign";
  return null;
}

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
  const goBack = useSmartBack("/dashboard");
  const [searchParams, setSearchParams] = useSearchParams();
  const foco = parseFoco(searchParams.get("foco"));
  const focusedOnly = foco != null;

  useEffect(() => {
    const olx = searchParams.get("olx");
    if (olx === "ok") {
      toast.success("Conta OLX conectada.");
      searchParams.delete("olx");
      setSearchParams(searchParams, { replace: true });
    } else if (olx === "erro") {
      toast.error("Não foi possível conectar a OLX. Tente novamente.");
      searchParams.delete("olx");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const showZapsign = !focusedOnly || foco === "contratos" || foco === "zapsign";
  const showFocus = !focusedOnly || foco === "nfe";

  return (
    <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <button
          type="button"
          onClick={goBack}
          className="mb-2 flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium">Voltar</span>
        </button>

        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Integrações</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Portais, contratos e serviços conectados à sua revenda.
          </p>
          {focusedOnly && (
            <Button variant="link" className="mt-2 h-auto px-0" asChild>
              <Link to="/configuracoes/integracoes">Ver todas as integrações</Link>
            </Button>
          )}
        </div>

        {(showZapsign || showFocus) && (
          <div className="space-y-3">
            {!focusedOnly && (
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Contratos e fiscal
              </h2>
            )}
            {showZapsign && <ZapSignIntegrationCard />}
            {showFocus && <FocusNfeIntegrationCard />}
          </div>
        )}

        {!focusedOnly && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Veículos
            </h2>
            <ProcedenciaIntegrationCard />
          </div>
        )}

        {!focusedOnly && (
          <>
            <div className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Portais de anúncio
              </h2>
            </div>

            <LojaCepIntegracaoField />

            <MlIntegrationCard />

            <OlxIntegrationCard />

            <WebmotorsIntegrationCard />

            {PLANNED_PORTAL_INTEGRATIONS.map((portal) => (
              <PlannedPortalCard
                key={portal.id}
                name={portal.name}
                description={portal.description}
                statusLabel={PORTAL_STATUS_LABEL[portal.status]}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
