import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CarFront, Loader2, Search, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GestaoEstoqueHojeCollapsible } from "@/components/gestao/GestaoEstoqueHojeCollapsible.tsx";
import { GestaoComecePorAquiChecklist } from "@/components/gestao/GestaoComecePorAquiChecklist.tsx";
import { GestaoCommandPalette, useGestaoCommandShortcut } from "@/components/gestao/GestaoCommandPalette.tsx";
import { GestaoIntegracaoConnectPrompt } from "@/components/gestao/GestaoIntegracaoConnectPrompt.tsx";
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
import { GestaoTabBar } from "@/components/gestao/lucro/GestaoTabBar.tsx";
import { GestaoActionBar } from "@/components/gestao/lucro/GestaoActionBar.tsx";
import { GestaoVeiculoPickerDialog } from "@/components/gestao/lucro/GestaoVeiculoPickerDialog.tsx";
import { GestaoEmitirNfeDialog } from "@/components/gestao/lucro/GestaoEmitirNfeDialog.tsx";
import { useGestaoZapsignConnection } from "@/components/integracoes/useGestaoZapsignConnection";
import { useGestaoFocusnfeConnection } from "@/components/integracoes/useGestaoFocusnfeConnection";
import { buildGestaoLucroAlerts } from "@/lib/gestao-lucro-alerts.ts";
import type { GestaoLucroAlertKind } from "@/lib/gestao-lucro-types.ts";
import type { GestaoVeiculoEnriched } from "@/lib/gestao-lucro-types.ts";
import { supabase } from "@/integrations/supabase/client";
import { competenciaFromDate } from "../../supabase/functions/_shared/gestao-meta-calc.ts";
import { useGestaoResultadoStrip } from "@/hooks/useGestaoResultadoStrip";
import { parseGestaoLucroAba, type GestaoLucroAba } from "@/lib/gestao-nav.ts";

type PickerMode = "venda" | "nota" | "contrato" | null;

export default function GestaoLucroPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeAlert, setActiveAlert] = useState<GestaoLucroAlertKind | null>(null);
  const [competencia, setCompetencia] = useState(competenciaFromDate());
  const [drawerVehicle, setDrawerVehicle] = useState<GestaoVeiculoEnriched | null>(null);
  const [despesaOpen, setDespesaOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [despesaPreselect, setDespesaPreselect] = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [nfeVeiculo, setNfeVeiculo] = useState<GestaoVeiculoEnriched | null>(null);
  const [contratoPrefillId, setContratoPrefillId] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const zapsign = useGestaoZapsignConnection();
  const focusnfe = useGestaoFocusnfeConnection();

  const tab = parseGestaoLucroAba(searchParams.get("aba"));
  const financeSection = searchParams.get("secao") ?? "contas";

  const setTab = useCallback((aba: GestaoLucroAba) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (aba === "estoque") next.delete("aba");
      else next.set("aba", aba);
      if (aba !== "financeiro") next.delete("secao");
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setFinanceSection = useCallback((secao: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("aba", "financeiro");
      next.set("secao", secao);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  useGestaoCommandShortcut(() => setCommandOpen(true), !!userId);

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
    notasPendentes,
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

  const focusConnected = focusnfe.loading ? null : !!focusnfe.status?.connected;
  const zapsignConnected = !!zapsign.status?.connected;

  const goEmitirNota = () => {
    if (!focusConnected) {
      setTab("notas");
      return;
    }
    setPickerMode("nota");
  };

  const onPickVeiculo = (v: GestaoVeiculoEnriched) => {
    if (pickerMode === "venda") {
      setDrawerVehicle(v);
    } else if (pickerMode === "nota") {
      setNfeVeiculo(v);
    } else if (pickerMode === "contrato") {
      setContratoPrefillId(v.id);
      setTab("contratos");
    }
    setPickerMode(null);
  };

  const tabPanel = (aba: GestaoLucroAba, content: ReactNode) => (
    tab === aba ? <div className="mt-4">{content}</div> : null
  );

  return (
    <div className="min-h-screen bg-background">
      <GestaoCommandPalette open={commandOpen} onOpenChange={setCommandOpen} />

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
                Estoque, vendas, notas e financeiro
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setCommandOpen(true)}>
              <Search className="mr-2 h-4 w-4" />
              Busca rápida
              <kbd className="ml-2 hidden rounded border bg-muted px-1.5 text-[10px] sm:inline">Ctrl+K</kbd>
            </Button>
            <Button variant="outline" onClick={() => navigate("/veiculos")}>
              <CarFront className="mr-2 h-4 w-4" />
              Estoque vitrine
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-4 py-8">
        {userId && (
          <>
            <GestaoComecePorAquiChecklist
              userId={userId}
              veiculos={veiculos}
              focusConnected={!!focusConnected}
              zapsignConnected={zapsignConnected}
              onRegistrarVenda={() => setPickerMode("venda")}
              onOpenEstoque={() => setTab("estoque")}
            />

            <GestaoActionBar
              onRegistrarVenda={() => setPickerMode("venda")}
              onEmitirNota={goEmitirNota}
              onLancarDespesa={() => {
                setDespesaPreselect(null);
                setDespesaOpen(true);
              }}
              onNovoContrato={() => {
                if (!zapsignConnected) {
                  setTab("contratos");
                  return;
                }
                setPickerMode("contrato");
              }}
              onImportar={() => setImportOpen(true)}
            />

            <GestaoResultadoMesStrip
              competencia={competencia}
              onCompetenciaChange={setCompetencia}
              metrics={metrics}
              prevMetrics={prevMetrics}
              focusConnected={focusConnected}
              loading={loading}
              onNavigateVendidos={() => setTab("vendidos")}
              onNavigateEstoque={() => setTab("estoque")}
              onVerVendas={() => setTab("vendidos")}
              onEmitirNota={goEmitirNota}
              onNavigateResultado={() => {
                setTab("financeiro");
                setFinanceSection("dre");
              }}
            />
          </>
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

            <GestaoTabBar
              value={tab}
              onChange={setTab}
              vendidosCount={metrics.dre.qtdVendas}
              notasPendentes={notasPendentes}
            />

            {tabPanel("estoque", userId && (
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
            ))}

            {tabPanel("vendidos", <GestaoLucroVendidosTab veiculos={veiculos} />)}
            {tabPanel("despesas", <GestaoLucroDespesasTab despesas={despesasFlat} veiculos={veiculos} />)}
            {tabPanel("equipe", userId && <GestaoEquipeTab userId={userId} veiculos={veiculos} />)}
            {tabPanel("financeiro", userId && (
              <GestaoFinanceiroTab
                userId={userId}
                veiculos={veiculos}
                section={financeSection}
                onSectionChange={setFinanceSection}
                competenciaSync={competencia}
              />
            ))}

            {tabPanel("contratos", userId && (
              zapsignConnected ? (
                <GestaoContratosTab
                  userId={userId}
                  veiculos={veiculos}
                  preselectVeiculoId={contratoPrefillId}
                />
              ) : (
                <GestaoIntegracaoConnectPrompt
                  vendor="zapsign"
                  title="Contratos com assinatura digital"
                  description="Envie contratos de compra e venda para o cliente assinar online, sem papel."
                />
              )
            ))}

            {tabPanel("notas", userId && (
              focusConnected ? (
                <GestaoNotasFiscaisTab userId={userId} veiculos={veiculos} />
              ) : (
                <GestaoIntegracaoConnectPrompt
                  vendor="focusnfe"
                  title="Notas fiscais (NF-e)"
                  description="Emita nota de entrada na compra de PF e nota de saída na venda, com homologação para testes."
                />
              )
            ))}

            {tabPanel("relatorios", <GestaoLucroRelatoriosTab veiculos={veiculos} />)}
          </>
        )}
      </main>

      {userId && (
        <>
          <GestaoVeiculoPickerDialog
            open={pickerMode != null}
            onOpenChange={(o) => !o && setPickerMode(null)}
            title={
              pickerMode === "nota"
                ? "Emitir nota — escolha o veículo"
                : pickerMode === "contrato"
                  ? "Novo contrato — escolha o veículo"
                  : "Registrar venda — escolha o veículo"
            }
            veiculos={veiculos}
            onPick={onPickVeiculo}
          />

          {nfeVeiculo && (
            <GestaoEmitirNfeDialog
              open={!!nfeVeiculo}
              onOpenChange={(o) => !o && setNfeVeiculo(null)}
              veiculo={nfeVeiculo}
              onSuccess={refreshAll}
            />
          )}

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
