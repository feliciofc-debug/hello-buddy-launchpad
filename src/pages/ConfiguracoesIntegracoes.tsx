import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FocusNfeIntegrationCard } from "@/components/integracoes/FocusNfeIntegrationCard";
import { MolicarIntegrationCard } from "@/components/integracoes/MolicarIntegrationCard";
import { ZapSignIntegrationCard } from "@/components/integracoes/ZapSignIntegrationCard";
import { MlIntegrationCard } from "@/components/ml/MlIntegrationCard";
import { ProcedenciaIntegrationCard } from "@/components/procedencia/ProcedenciaIntegrationCard";
import { OlxIntegrationCard } from "@/components/olx/OlxIntegrationCard";
import { WebmotorsIntegrationCard } from "@/components/webmotors/WebmotorsIntegrationCard";
import { LojaCepIntegracaoField } from "@/components/integracoes/LojaCepIntegracaoField.tsx";
import { useSmartBack } from "@/lib/app-back-nav.ts";

type Foco = "nfe" | "contratos" | "zapsign" | "molicar" | "olx" | "ml" | "webmotors" | null;

function parseFoco(raw: string | null): Foco {
  if (raw === "nfe") return "nfe";
  if (raw === "contratos") return "contratos";
  if (raw === "zapsign") return "zapsign";
  if (raw === "molicar") return "molicar";
  if (raw === "olx") return "olx";
  if (raw === "ml") return "ml";
  if (raw === "webmotors") return "webmotors";
  return null;
}

export default function ConfiguracoesIntegracoes() {
  const goBack = useSmartBack("/dashboard");
  const [searchParams, setSearchParams] = useSearchParams();
  const foco = parseFoco(searchParams.get("foco"));
  const focusedOnly = foco != null;
  const portalFoco = foco === "olx" || foco === "ml" || foco === "webmotors" ? foco : null;

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

  useEffect(() => {
    if (!portalFoco) return;
    const t = window.setTimeout(() => {
      document.getElementById(`integracao-${portalFoco}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 200);
    return () => window.clearTimeout(t);
  }, [portalFoco]);

  const showZapsign = !focusedOnly || foco === "contratos" || foco === "zapsign";
  const showFocus = !focusedOnly || foco === "nfe";
  const showVehicles = !focusedOnly || foco === "molicar";
  const showMolicar = !focusedOnly || foco === "molicar";
  const showPortals = !focusedOnly || portalFoco != null;
  const showMl = !focusedOnly || foco === "ml";
  const showOlx = !focusedOnly || foco === "olx";
  const showWebmotors = !focusedOnly || foco === "webmotors";
  const showLojaCep = !focusedOnly || foco === "olx" || foco === "ml" || foco === "webmotors";

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

        {showVehicles && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Veículos
            </h2>
            {!focusedOnly && <ProcedenciaIntegrationCard />}
            {showMolicar && (
              <div id="integracao-molicar">
                <MolicarIntegrationCard />
              </div>
            )}
          </div>
        )}

        {showPortals && (
          <>
            {!focusedOnly && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Portais de anúncio
                </h2>
              </div>
            )}

            {showLojaCep && <LojaCepIntegracaoField />}

            {showMl && (
              <div id="integracao-ml">
                <MlIntegrationCard />
              </div>
            )}

            {showOlx && (
              <div id="integracao-olx">
                <OlxIntegrationCard />
              </div>
            )}

            {showWebmotors && (
              <div id="integracao-webmotors">
                <WebmotorsIntegrationCard />
              </div>
            )}

            {!focusedOnly && (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">TikTok</CardTitle>
                    <CardDescription>
                      Conecte sua conta e publique vídeos do estoque e da biblioteca de mídia.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" asChild>
                      <Link to="/configuracoes/redes-sociais">Abrir Redes sociais (TikTok)</Link>
                    </Button>
                  </CardContent>
                </Card>

                <p className="text-center text-sm text-muted-foreground">
                  Próximos portais: Chaves na Mão, SóCarrão.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
