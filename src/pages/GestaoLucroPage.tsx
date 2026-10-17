import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CarFront, Loader2, Plus, TrendingUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GestaoEstoqueHojeCollapsible } from "@/components/gestao/GestaoEstoqueHojeCollapsible.tsx";
import { GestaoResultadoMesStrip } from "@/components/gestao/lucro/GestaoResultadoMesStrip.tsx";
import { GestaoLucroAlerts } from "@/components/gestao/lucro/GestaoLucroAlerts.tsx";
import { GestaoLucroEstoqueTab } from "@/components/gestao/lucro/GestaoLucroEstoqueTab.tsx";
import { GestaoLucroVendidosTab } from "@/components/gestao/lucro/GestaoLucroVendidosTab.tsx";
import { GestaoLucroDespesasTab } from "@/components/gestao/lucro/GestaoLucroDespesasTab.tsx";
import { GestaoLucroRelatoriosTab } from "@/components/gestao/lucro/GestaoLucroRelatoriosTab.tsx";
import { GestaoVeiculoDrawer } from "@/components/gestao/lucro/GestaoVeiculoDrawer.tsx";
import { GestaoBatchDespesaDialog } from "@/components/gestao/lucro/GestaoBatchDespesaDialog.tsx";
import { GestaoImportPlanilhaDialog } from "@/components/gestao/lucro/GestaoImportPlanilhaDialog.tsx";
import { GestaoEquipeTab } from "@/components/gestao/lucro/GestaoEquipeTab.tsx";
import { GestaoFinanceiroTab } from "@/components/gestao/lucro/GestaoFinanceiroTab.tsx";
import { GestaoContratosTab } from "@/components/gestao/lucro/GestaoContratosTab.tsx";
import { GestaoNotasFiscaisTab } from "@/components/gestao/lucro/GestaoNotasFiscaisTab.tsx";
import { useGestaoZapsignConnection } from "@/components/integracoes/useGestaoZapsignConnection";
import { useGestaoFocusnfeConnection } from "@/components/integracoes/useGestaoFocusnfeConnection";
import { buildGestaoLucroAlerts } from "@/lib/gestao-lucro-alerts.ts";
import type { GestaoLucroAlertKind } from "@/lib/gestao-lucro-types.ts";
import type { GestaoVeiculoEnriched } from "@/lib/gestao-lucro-types.ts";
import { supabase } from "@/integrations/supabase/client";
import { competenciaFromDate } from "../../supabase/functions/_shared/gestao-meta-calc.ts";
import { useGestaoResultadoStrip } from "@/hooks/useGestaoResultadoStrip";

export default function GestaoLucroPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeAlert, setActiveAlert] = useState<GestaoLucroAlertKind | null>(null);
  const [tab, setTab] = useState("estoque");
  const [financeSection, setFinanceSection] = useState("contas");
  const [competencia, setCompetencia] = useState(competenciaFromDate());
  const [drawerVehicle, setDrawerVehicle] = useState<GestaoVeiculoEnriched | null>(null);
  const [despesaOpen, setDespesaOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [despesaPreselect, setDespesaPreselect] = useState<string | null>(null);
  const zapsign = useGestaoZapsignConnection();
  const focusnfe = useGestaoFocusnfeConnection();

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: session }) => {
      const user = session.session?.user;
      if (!user) {
        navigate("/login");
        return;
      }
      setUserId(user.id);
    });
  }, [navigate]);

  const {
    veiculos,
    despesasFlat,
    metrics,
    prevMetrics,
    loading,
    reload,
  } = useGestaoResultadoStrip(userId, competencia, !!focusnfe.status?.connected);

  const alerts = useMemo(() => buildGestaoLucroAlerts(veiculos), [veiculos]);

  const highlightIds = useMemo(() => {
    if (!activeAlert) return new Set<string>();
    const a = alerts.find((x) => x.kind === activeAlert);
    return new Set(a?.veiculoIds ?? []);
  }, [activeAlert, alerts]);

  const drawerVeiculo = useMemo(() => {
    if (!drawerVehicle) return null;
    return veiculos.find((v) => v.id === drawerVehicle.id) ?? drawerVehicle;
  }, [drawerVehicle, veiculos]);

  const onAlertSelect = (kind: GestaoLucroAlertKind | null) => {
    setActiveAlert(kind);
    if (kind) setTab("estoque");
  };

  const refreshAll = () => {
    void reload();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold">
                <TrendingUp className="h-6 w-6 text-primary" />
                Gestão — Lucro
              </h1>
              <p className="text-sm text-muted-foreground">
                Estoque, vendas e despesas
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/veiculos")}>
              <CarFront className="mr-2 h-4 w-4" />
              Estoque vitrine
            </Button>
            {userId && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDespesaPreselect(null);
                    setDespesaOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Lançar despesa
                </Button>
                <Button variant="outline" onClick={() => setImportOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Importar planilha
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-4 py-8">
        {userId && (
          <GestaoResultadoMesStrip
            competencia={competencia}
            onCompetenciaChange={setCompetencia}
            metrics={metrics}
            prevMetrics={prevMetrics}
            focusConnected={focusnfe.loading ? null : !!focusnfe.status?.connected}
            loading={loading}
            onNavigateVendidos={() => setTab("vendidos")}
            onNavigateEstoque={() => setTab("estoque")}
            onNavigateResultado={() => {
              setTab("financeiro");
              setFinanceSection("dre");
            }}
          />
        )}

        {userId ? <GestaoEstoqueHojeCollapsible userId={userId} /> : null}

        {loading && !veiculos.length ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <GestaoLucroAlerts
              alerts={alerts}
              activeKind={activeAlert}
              onSelect={onAlertSelect}
            />

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-8">
                <TabsTrigger value="estoque">Estoque</TabsTrigger>
                <TabsTrigger value="vendidos">Vendidos</TabsTrigger>
                <TabsTrigger value="despesas">Despesas</TabsTrigger>
                <TabsTrigger value="equipe">Equipe</TabsTrigger>
                <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
                {zapsign.status?.connected && (
                  <TabsTrigger value="contratos">Contratos</TabsTrigger>
                )}
                {focusnfe.status?.connected && (
                  <TabsTrigger value="notas">Notas fiscais</TabsTrigger>
                )}
                <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
              </TabsList>

              <TabsContent value="estoque" className="mt-4">
                {userId && (
                  <GestaoLucroEstoqueTab
                    veiculos={veiculos}
                    userId={userId}
                    highlightIds={highlightIds}
                    onRefresh={refreshAll}
                    onOpenDrawer={setDrawerVehicle}
                    onQuickDespesa={(v) => {
                      setDespesaPreselect(v.id);
                      setDespesaOpen(true);
                    }}
                  />
                )}
              </TabsContent>
              <TabsContent value="vendidos" className="mt-4">
                <GestaoLucroVendidosTab veiculos={veiculos} />
              </TabsContent>
              <TabsContent value="despesas" className="mt-4">
                <GestaoLucroDespesasTab despesas={despesasFlat} veiculos={veiculos} />
              </TabsContent>
              <TabsContent value="equipe" className="mt-4">
                {userId && <GestaoEquipeTab userId={userId} veiculos={veiculos} />}
              </TabsContent>
              <TabsContent value="financeiro" className="mt-4">
                {userId && (
                  <GestaoFinanceiroTab
                    userId={userId}
                    veiculos={veiculos}
                    section={financeSection}
                    onSectionChange={setFinanceSection}
                    competenciaSync={competencia}
                  />
                )}
              </TabsContent>
              {zapsign.status?.connected && (
                <TabsContent value="contratos" className="mt-4">
                  {userId && <GestaoContratosTab userId={userId} veiculos={veiculos} />}
                </TabsContent>
              )}
              {focusnfe.status?.connected && (
                <TabsContent value="notas" className="mt-4">
                  {userId && <GestaoNotasFiscaisTab userId={userId} veiculos={veiculos} />}
                </TabsContent>
              )}
              <TabsContent value="relatorios" className="mt-4">
                <GestaoLucroRelatoriosTab veiculos={veiculos} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>

      {userId && (
        <>
          <GestaoVeiculoDrawer
            open={!!drawerVeiculo}
            veiculo={drawerVeiculo}
            userId={userId}
            onClose={() => setDrawerVehicle(null)}
            onSaved={refreshAll}
          />
          <GestaoBatchDespesaDialog
            open={despesaOpen}
            onOpenChange={setDespesaOpen}
            userId={userId}
            veiculos={veiculos}
            preselectedId={despesaPreselect}
            onSaved={refreshAll}
          />
          <GestaoImportPlanilhaDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            userId={userId}
            veiculos={veiculos}
            onSaved={refreshAll}
          />
        </>
      )}
    </div>
  );
}
