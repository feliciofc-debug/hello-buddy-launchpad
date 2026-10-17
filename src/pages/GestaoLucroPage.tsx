import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CarFront, Loader2, Plus, TrendingUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GestaoEstoqueHojeSection } from "@/components/gestao/GestaoEstoqueHojeSection.tsx";
import { GestaoLucroMonthlyKpis } from "@/components/gestao/lucro/GestaoLucroMonthlyKpis.tsx";
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
import { loadGestaoLucroBundle } from "@/lib/gestao-lucro-data.ts";
import { buildGestaoLucroAlerts } from "@/lib/gestao-lucro-alerts.ts";
import type { GestaoLucroAlertKind } from "@/lib/gestao-lucro-types.ts";
import type { GestaoVeiculoEnriched } from "@/lib/gestao-lucro-types.ts";
import { supabase } from "@/integrations/supabase/client";

function monthBounds(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

export default function GestaoLucroPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [veiculos, setVeiculos] = useState<GestaoVeiculoEnriched[]>([]);
  const [despesasFlat, setDespesasFlat] = useState<Awaited<ReturnType<typeof loadGestaoLucroBundle>>["despesasFlat"]>([]);
  const [activeAlert, setActiveAlert] = useState<GestaoLucroAlertKind | null>(null);
  const [tab, setTab] = useState("estoque");
  const [drawerVehicle, setDrawerVehicle] = useState<GestaoVeiculoEnriched | null>(null);
  const [despesaOpen, setDespesaOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [despesaPreselect, setDespesaPreselect] = useState<string | null>(null);
  const { start, end } = monthBounds();

  const load = useCallback(async () => {
    setLoading(true);
    const { data: session } = await supabase.auth.getSession();
    const user = session.session?.user;
    if (!user) {
      navigate("/login");
      return;
    }
    setUserId(user.id);
    const bundle = await loadGestaoLucroBundle(user.id);
    setVeiculos(bundle.veiculos);
    setDespesasFlat(bundle.despesasFlat);
    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const alerts = useMemo(() => buildGestaoLucroAlerts(veiculos), [veiculos]);

  const highlightIds = useMemo(() => {
    if (!activeAlert) return new Set<string>();
    const a = alerts.find((x) => x.kind === activeAlert);
    return new Set(a?.veiculoIds ?? []);
  }, [activeAlert, alerts]);

  const kpis = useMemo(() => {
    let lucroMes = 0;
    let vendasMes = 0;
    let despesasMes = 0;
    for (const v of veiculos) {
      if (v.dataVenda && v.dataVenda >= start && v.dataVenda <= end) {
        vendasMes += 1;
        lucroMes += v.lucro.lucroLiquido ?? 0;
      }
    }
    for (const d of despesasFlat) {
      if (d.data >= start && d.data <= end) despesasMes += Number(d.valor);
    }
    return { lucroMes, vendasMes, despesasMes };
  }, [veiculos, despesasFlat, start, end]);

  const drawerVeiculo = useMemo(() => {
    if (!drawerVehicle) return null;
    return veiculos.find((v) => v.id === drawerVehicle.id) ?? drawerVehicle;
  }, [drawerVehicle, veiculos]);

  const onAlertSelect = (kind: GestaoLucroAlertKind | null) => {
    setActiveAlert(kind);
    if (kind) setTab("estoque");
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
                Estoque, vendas e despesas · {start} a {end}
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
        {userId ? <GestaoEstoqueHojeSection userId={userId} /> : null}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <GestaoLucroMonthlyKpis {...kpis} />
            <GestaoLucroAlerts
              alerts={alerts}
              activeKind={activeAlert}
              onSelect={onAlertSelect}
            />

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                <TabsTrigger value="estoque">Estoque</TabsTrigger>
                <TabsTrigger value="vendidos">Vendidos</TabsTrigger>
                <TabsTrigger value="despesas">Despesas</TabsTrigger>
                <TabsTrigger value="equipe">Equipe</TabsTrigger>
                <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
                <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
              </TabsList>

              <TabsContent value="estoque" className="mt-4">
                {userId && (
                  <GestaoLucroEstoqueTab
                    veiculos={veiculos}
                    userId={userId}
                    highlightIds={highlightIds}
                    onRefresh={() => void load()}
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
                {userId && <GestaoFinanceiroTab userId={userId} veiculos={veiculos} />}
              </TabsContent>
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
            onSaved={() => void load()}
          />
          <GestaoBatchDespesaDialog
            open={despesaOpen}
            onOpenChange={setDespesaOpen}
            userId={userId}
            veiculos={veiculos}
            preselectedId={despesaPreselect}
            onSaved={() => void load()}
          />
          <GestaoImportPlanilhaDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            userId={userId}
            veiculos={veiculos}
            onSaved={() => void load()}
          />
        </>
      )}
    </div>
  );
}
