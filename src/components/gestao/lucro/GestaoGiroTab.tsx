import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  CarFront,
  Loader2,
  RefreshCw,
  Settings2,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { classificarIpvaCombustivelAuto } from "../../../../supabase/functions/_shared/estoque-giro-ipva.ts";
import type { GestaoVeiculoEnriched } from "@/lib/gestao-lucro-types.ts";
import { vehicleLabel } from "@/lib/gestao-lucro-data.ts";
import {
  formatResumoDiarioUltimoLabel,
  loadGestaoGiro,
  refreshGestaoGiroFipeCompleto,
  formatIpvaPctBr,
  saveGestaoGiroConfig,
  saveGestaoGiroReferenciaManual,
  saveVeiculoGiroIpvaAjuste,
  type GestaoGiroConfigRow,
  type GestaoGiroItem,
  type VeiculoGiroIpvaAjusteRow,
} from "@/lib/estoque-giro-data.ts";

type Props = {
  userId: string;
  veiculos: GestaoVeiculoEnriched[];
  refreshKey?: number;
};

const money = (value: number | null) =>
  value == null
    ? "—"
    : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const faixaLabel: Record<GestaoGiroItem["resultado"]["faixa"], string> = {
  saudavel: "Saudável",
  atencao: "Atenção",
  risco: "Risco",
  decisao: "Decisão",
};

const emptyConfig = (): GestaoGiroConfigRow => ({
  faixa_atencao_dias: 30,
  faixa_risco_dias: 60,
  faixa_decisao_dias: 90,
  custo_financeiro_mensal_pct: null,
  desvalorizacao_mensal_pct: null,
  repasse_desconto_fipe_pct: null,
  uf: null,
  ipva_aliquota_pct: null,
  ipva_aliquota_hibrido_pct: null,
  ipva_aliquota_eletrico_pct: null,
  ipva_loja_paga_virada: false,
  custo_vaga_dia: null,
  resumo_diario_ativo: false,
  resumo_diario_hora: "18:00:00",
});

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function ConfigField(props: {
  id: string;
  label: string;
  description: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Input
        id={props.id}
        type="number"
        min="0"
        step="0.01"
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">{props.description}</p>
    </div>
  );
}

export function GestaoGiroTab({ userId, veiculos, refreshKey = 0 }: Props) {
  const [items, setItems] = useState<GestaoGiroItem[]>([]);
  const [config, setConfig] = useState<GestaoGiroConfigRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<GestaoGiroItem | null>(null);
  const [fipeRefreshing, setFipeRefreshing] = useState(false);
  const [fipeProgress, setFipeProgress] = useState<string | null>(null);
  const [fipeSummaryOpen, setFipeSummaryOpen] = useState(false);
  const [fipeSummary, setFipeSummary] = useState<{
    gravados: number;
    semFipe: Array<{ veiculo_id: string; motivo: string; label: string }>;
  } | null>(null);
  const [manualItem, setManualItem] = useState<GestaoGiroItem | null>(null);
  const [manualValor, setManualValor] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [ipvaItem, setIpvaItem] = useState<GestaoGiroItem | null>(null);
  const [ipvaTipo, setIpvaTipo] = useState<VeiculoGiroIpvaAjusteRow["ipva_tipo"]>("auto");
  const [ipvaManualPct, setIpvaManualPct] = useState("");
  const [ipvaSaving, setIpvaSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    atencao: "30",
    risco: "60",
    decisao: "90",
    custo: "",
    desvalorizacao: "",
    repasse: "",
    uf: "",
    ipva: "",
    ipvaHibrido: "",
    ipvaEletrico: "",
    custoVagaDia: "",
    pagaVirada: false,
    resumoDiario: false,
    resumoHora: "18:00",
  }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadGestaoGiro(userId, veiculos);
      setItems(data.items);
      setConfig(data.config);
    } catch (error) {
      console.error("gestao_giro_load", error);
      toast.error("Não foi possível carregar o Giro 30-60-90.");
    } finally {
      setLoading(false);
    }
  }, [userId, veiculos]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const openConfig = () => {
    const c = config ?? emptyConfig();
    setForm({
      atencao: String(c.faixa_atencao_dias),
      risco: String(c.faixa_risco_dias),
      decisao: String(c.faixa_decisao_dias),
      custo: c.custo_financeiro_mensal_pct == null ? "" : String(c.custo_financeiro_mensal_pct),
      desvalorizacao: c.desvalorizacao_mensal_pct == null ? "" : String(c.desvalorizacao_mensal_pct),
      repasse: c.repasse_desconto_fipe_pct == null ? "" : String(c.repasse_desconto_fipe_pct),
      uf: c.uf ?? "",
      ipva: c.ipva_aliquota_pct == null ? "" : String(c.ipva_aliquota_pct),
      ipvaHibrido: c.ipva_aliquota_hibrido_pct == null ? "" : String(c.ipva_aliquota_hibrido_pct),
      ipvaEletrico: c.ipva_aliquota_eletrico_pct == null ? "" : String(c.ipva_aliquota_eletrico_pct),
      custoVagaDia: c.custo_vaga_dia == null ? "" : String(c.custo_vaga_dia),
      pagaVirada: c.ipva_loja_paga_virada,
      resumoDiario: c.resumo_diario_ativo ?? false,
      resumoHora: (c.resumo_diario_hora ?? "18:00:00").slice(0, 5),
    });
    setConfigOpen(true);
  };

  const saveConfig = async () => {
    const next: GestaoGiroConfigRow = {
      faixa_atencao_dias: Number(form.atencao),
      faixa_risco_dias: Number(form.risco),
      faixa_decisao_dias: Number(form.decisao),
      custo_financeiro_mensal_pct: optionalNumber(form.custo),
      desvalorizacao_mensal_pct: optionalNumber(form.desvalorizacao),
      repasse_desconto_fipe_pct: optionalNumber(form.repasse),
      uf: form.uf.trim() ? form.uf.trim().toUpperCase() : null,
      ipva_aliquota_pct: optionalNumber(form.ipva),
      ipva_aliquota_hibrido_pct: optionalNumber(form.ipvaHibrido),
      ipva_aliquota_eletrico_pct: optionalNumber(form.ipvaEletrico),
      custo_vaga_dia: optionalNumber(form.custoVagaDia),
      ipva_loja_paga_virada: form.pagaVirada,
      resumo_diario_ativo: form.resumoDiario,
      resumo_diario_hora: form.resumoHora,
    };
    if (
      !Number.isInteger(next.faixa_atencao_dias) ||
      next.faixa_atencao_dias <= 0 ||
      next.faixa_risco_dias <= next.faixa_atencao_dias ||
      next.faixa_decisao_dias <= next.faixa_risco_dias
    ) {
      toast.error("As faixas precisam estar em ordem crescente: 30, 60 e 90.");
      return;
    }
    if (next.uf && !/^[A-Z]{2}$/.test(next.uf)) {
      toast.error("Informe a UF com duas letras, por exemplo SP.");
      return;
    }
    setSaving(true);
    try {
      await saveGestaoGiroConfig(userId, next);
      toast.success("Regras do Giro 30-60-90 salvas.");
      setConfigOpen(false);
      await load();
    } catch (error) {
      console.error("gestao_giro_save", error);
      toast.error("Não foi possível salvar as regras.");
    } finally {
      setSaving(false);
    }
  };

  const counters = useMemo(() => ({
    saudavel: items.filter((i) => i.resultado.faixa === "saudavel").length,
    atencao: items.filter((i) => i.resultado.faixa === "atencao").length,
    risco: items.filter((i) => i.resultado.faixa === "risco").length,
    decisao: items.filter((i) => i.resultado.faixa === "decisao").length,
  }), [items]);
  const riscoTotal = items.reduce(
    (sum, i) => sum + Math.max(0, i.resultado.custoDeEsperar30d ?? 0),
    0,
  );
  const ipvaViradaTotal = items.reduce(
    (sum, i) => sum + Math.max(0, i.resultado.ipvaViradaValor ?? 0),
    0,
  );
  const needsConfig = !config ||
    config.custo_financeiro_mensal_pct == null ||
    config.desvalorizacao_mensal_pct == null ||
    config.repasse_desconto_fipe_pct == null;
  const resumoUltimoLabel = formatResumoDiarioUltimoLabel(config);
  const ipvaAutoDetect = useMemo(() => {
    if (!ipvaItem) return null;
    return classificarIpvaCombustivelAuto({
      combustivel: ipvaItem.veiculo.combustivel,
      versao: ipvaItem.veiculo.versao,
      modelo: ipvaItem.veiculo.modelo,
    });
  }, [ipvaItem]);

  if (loading && !items.length) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Estoque Inteligente 30-60-90</h2>
          <p className="text-sm text-muted-foreground">
            Quanto custa esperar e qual decisão preserva mais margem. Uso interno da Gestão.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={fipeRefreshing}
            onClick={() => void (async () => {
              setFipeRefreshing(true);
              setFipeProgress("Iniciando consulta FIPE…");
              try {
                const labelById = new Map(veiculos.map((v) => [v.id, vehicleLabel(v)]));
                const r = await refreshGestaoGiroFipeCompleto(({ rodada, processados }) => {
                  setFipeProgress(
                    processados > 0
                      ? `Consultando lote ${rodada} (${processados} veículo(s) nesta rodada)…`
                      : `Finalizando (lote ${rodada})…`,
                  );
                });
                setFipeSummary({
                  gravados: r.gravados,
                  semFipe: r.semFipe.map((row) => ({
                    ...row,
                    label: labelById.get(row.veiculo_id) ?? row.veiculo_id.slice(0, 8),
                  })),
                });
                setFipeSummaryOpen(true);
                await load();
              } catch (error) {
                console.error("gestao_giro_fipe_refresh", error);
                toast.error("Não foi possível atualizar a FIPE.");
              } finally {
                setFipeRefreshing(false);
                setFipeProgress(null);
              }
            })()}
          >
            {fipeRefreshing
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <RefreshCw className="mr-2 h-4 w-4" />}
            Atualizar FIPE
          </Button>
          {fipeProgress && (
            <p className="w-full text-xs text-muted-foreground sm:w-auto">{fipeProgress}</p>
          )}
          <Button variant="outline" onClick={openConfig}>
            <Settings2 className="mr-2 h-4 w-4" />
            Configurar regras
          </Button>
        </div>
      </div>

      {needsConfig && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-sm">
            Configure custo financeiro, desvalorização e desconto de repasse. Campos vazios não entram na conta.
          </p>
          <Button size="sm" variant="outline" onClick={openConfig}>Configurar</Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {(["saudavel", "atencao", "risco", "decisao"] as const).map((faixa) => (
          <Card key={faixa}>
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{faixaLabel[faixa]}</p>
              <p className="mt-1 text-2xl font-bold">{counters[faixa]}</p>
            </CardContent>
          </Card>
        ))}
        <Card className="border-destructive/30">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Risco projetado · 30 dias</p>
            <p className="mt-1 text-xl font-bold text-destructive">{money(riscoTotal)}</p>
          </CardContent>
        </Card>
        {ipvaViradaTotal > 0 && (
          <Card className="border-amber-500/40">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">IPVA projetado do estoque</p>
              <p className="mt-1 text-xl font-bold text-amber-800">{money(ipvaViradaTotal)}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {!items.length ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <CarFront className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Nenhum veículo disponível, reservado ou em preparação.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const r = item.resultado;
            return (
              <Card key={item.veiculo.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{vehicleLabel(item.veiculo)}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {item.veiculo.placa || "Sem placa"} · {r.diasEmEstoque} dias em estoque
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.consignado && <Badge variant="outline">Consignado</Badge>}
                      <Badge variant={r.faixa === "decisao" || r.faixa === "risco" ? "destructive" : "secondary"}>
                        {faixaLabel[r.faixa]}
                      </Badge>
                      <Badge variant="outline">Risco {r.indiceRisco}/100</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
                    <div><p className="text-xs text-muted-foreground">Custo atual</p><p className="font-medium">{money(r.custoAtual)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Margem hoje</p><p className="font-medium">{money(r.margemVarejoHoje)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Margem em 30 dias</p><p className="font-medium">{money(r.margemVarejo30d)}</p></div>
                    <div>
                      <p className="text-xs text-muted-foreground">Repasse hoje</p>
                      <p className="font-medium">
                        {r.valorRepasseHoje == null ? "Sem referência" : money(r.valorRepasseHoje)}
                      </p>
                    </div>
                    <div><p className="text-xs text-muted-foreground">Custo de esperar</p><p className="font-medium text-destructive">{money(r.custoDeEsperar30d)}</p></div>
                  </div>
                  {r.ipvaViradaValor != null && r.ipvaViradaDiasRestantes != null && (
                    <p className="text-xs text-amber-800">
                      IPVA na virada: {money(r.ipvaViradaValor)}
                      {r.ipvaAliquotaRotulo && r.ipvaAliquotaEfetivaPct != null
                        ? ` (${r.ipvaAliquotaRotulo} ${formatIpvaPctBr(r.ipvaAliquotaEfetivaPct)})`
                        : ""}
                      {" · "}faltam {r.ipvaViradaDiasRestantes} dias
                      {r.ipvaBaseFonte === "preco_anunciado" ? " · base: preço anunciado" : ""}
                      {r.ipvaConferirDocumento ? " · confira no documento" : ""}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/50 p-3">
                    <div>
                      <p className="font-medium">{r.recomendacao}</p>
                      <p className="text-xs text-muted-foreground">{r.porque}</p>
                      {!!r.indiceSemDado.length && (
                        <p className="mt-1 text-xs text-amber-700">
                          Índice redistribuído sem: {r.indiceSemDado.join(", ")}.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setIpvaItem(item);
                          setIpvaTipo(item.ipvaAjuste.ipva_tipo);
                          setIpvaManualPct(
                            item.ipvaAjuste.ipva_aliquota_manual_pct == null
                              ? ""
                              : String(item.ipvaAjuste.ipva_aliquota_manual_pct),
                          );
                        }}
                      >
                        Ajustar IPVA
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setManualItem(item);
                          setManualValor("");
                        }}
                      >
                        <Wallet className="mr-2 h-4 w-4" /> Informar repasse
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDetail(item)}>
                        <Calculator className="mr-2 h-4 w-4" /> Ver cálculo
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurar regras do Giro 30-60-90</DialogTitle>
            <DialogDescription>
              Nenhum percentual é presumido. Como referência de mercado para avaliar: repasse 10% abaixo da FIPE, desvalorização 1% ao mês e custo financeiro 1,5% ao mês.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-3">
            <ConfigField id="giro-atencao" label="Atenção (dias)" description="Quando revisar preço e anúncio." value={form.atencao} onChange={(atencao) => setForm((f) => ({ ...f, atencao }))} />
            <ConfigField id="giro-risco" label="Risco (dias)" description="Quando testar uma ação por prazo." value={form.risco} onChange={(risco) => setForm((f) => ({ ...f, risco }))} />
            <ConfigField id="giro-decisao" label="Decisão (dias)" description="Quando comparar varejo e repasse." value={form.decisao} onChange={(decisao) => setForm((f) => ({ ...f, decisao }))} />
            <ConfigField id="giro-custo" label="Custo financeiro mensal (%)" description="Juros do capital próprio ou floor plan." value={form.custo} placeholder="Ex.: 1,5" onChange={(custo) => setForm((f) => ({ ...f, custo }))} />
            <ConfigField id="giro-desvalorizacao" label="Desvalorização mensal (%)" description="Queda esperada da referência no próximo mês." value={form.desvalorizacao} placeholder="Ex.: 1" onChange={(desvalorizacao) => setForm((f) => ({ ...f, desvalorizacao }))} />
            <ConfigField id="giro-repasse" label="Repasse abaixo da FIPE (%)" description="Desconto real normalmente obtido no B2B." value={form.repasse} placeholder="Ex.: 10" onChange={(repasse) => setForm((f) => ({ ...f, repasse }))} />
            <div className="space-y-1.5">
              <Label htmlFor="giro-uf">UF</Label>
              <Input id="giro-uf" maxLength={2} value={form.uf} placeholder="Ex.: SP" onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Usada apenas na projeção de obrigações.</p>
            </div>
            <ConfigField id="giro-ipva" label="Alíquota de IPVA geral (%)" description="Gasolina, flex, diesel e padrão quando não houver tipo específico." value={form.ipva} onChange={(ipva) => setForm((f) => ({ ...f, ipva }))} />
            <ConfigField id="giro-ipva-hibrido" label="IPVA híbrido (%)" description="Ex. RJ: geral 4%, híbrido 1,5%, elétrico 0,5% — confira a lei do seu estado." value={form.ipvaHibrido} placeholder="Ex.: 1,5" onChange={(ipvaHibrido) => setForm((f) => ({ ...f, ipvaHibrido }))} />
            <ConfigField id="giro-ipva-eletrico" label="IPVA elétrico (%)" description="Deixe vazio para usar a alíquota geral." value={form.ipvaEletrico} placeholder="Ex.: 0,5" onChange={(ipvaEletrico) => setForm((f) => ({ ...f, ipvaEletrico }))} />
            <ConfigField id="giro-custo-vaga" label="Custo da vaga por dia (R$)" description="Entra no custo de espera dos consignados. Vazio = não considerar." value={form.custoVagaDia} placeholder="Ex.: 35" onChange={(custoVagaDia) => setForm((f) => ({ ...f, custoVagaDia }))} />
            <div className="flex items-start gap-2 pt-7">
              <Checkbox id="giro-virada" checked={form.pagaVirada} onCheckedChange={(v) => setForm((f) => ({ ...f, pagaVirada: v === true }))} />
              <div>
                <Label htmlFor="giro-virada">Loja paga IPVA na virada</Label>
                <p className="text-xs text-muted-foreground">De outubro mostra o IPVA na virada; entra na projeção de 30 dias quando a virada estiver próxima.</p>
              </div>
            </div>
            <div className="col-span-full border-t pt-4">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="giro-resumo-diario"
                  checked={form.resumoDiario}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, resumoDiario: v === true }))}
                />
                <div className="flex-1 space-y-2">
                  <Label htmlFor="giro-resumo-diario">Receber resumo diário no WhatsApp</Label>
                  <p className="text-xs text-muted-foreground">
                    Envia ao dono e gestores (Jarvis), somente texto e link do painel. Fora da janela de 24h da Meta, usa template aprovado se existir.
                  </p>
                  <div className="flex max-w-[10rem] items-center gap-2">
                    <Label htmlFor="giro-resumo-hora" className="text-xs whitespace-nowrap">Horário</Label>
                    <Input
                      id="giro-resumo-hora"
                      type="time"
                      value={form.resumoHora}
                      disabled={!form.resumoDiario}
                      onChange={(e) => setForm((f) => ({ ...f, resumoHora: e.target.value }))}
                    />
                  </div>
                  {resumoUltimoLabel ? (
                    <p className="text-xs text-muted-foreground">{resumoUltimoLabel}</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>Cancelar</Button>
            <Button disabled={saving} onClick={() => void saveConfig()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar regras"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fipeSummaryOpen} onOpenChange={setFipeSummaryOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Atualização FIPE concluída</DialogTitle>
            <DialogDescription>
              {fipeSummary
                ? `${fipeSummary.gravados} atualizado(s), ${fipeSummary.semFipe.length} sem FIPE`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {!!fipeSummary?.semFipe.length && (
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {fipeSummary.semFipe.map((row) => (
                <li key={row.veiculo_id} className="rounded-md border p-2">
                  <p className="font-medium">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{row.motivo}</p>
                </li>
              ))}
            </ul>
          )}
          {!fipeSummary?.semFipe.length && fipeSummary && (
            <p className="text-sm text-muted-foreground">Todos os veículos pendentes receberam FIPE nesta execução.</p>
          )}
          <DialogFooter>
            <Button onClick={() => setFipeSummaryOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!ipvaItem} onOpenChange={(open) => !open && setIpvaItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar IPVA do veículo</DialogTitle>
            <DialogDescription>
              {ipvaItem ? vehicleLabel(ipvaItem.veiculo) : ""}
              {ipvaItem?.veiculo.combustivel
                ? ` · combustível cadastrado: ${ipvaItem.veiculo.combustivel}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Tipo de IPVA</Label>
              <Select
                value={ipvaTipo}
                onValueChange={(v) => setIpvaTipo(v as VeiculoGiroIpvaAjusteRow["ipva_tipo"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automático (sistema decide)</SelectItem>
                  <SelectItem value="geral">Geral</SelectItem>
                  <SelectItem value="hibrido">Híbrido</SelectItem>
                  <SelectItem value="eletrico">Elétrico</SelectItem>
                  <SelectItem value="isento">Isento</SelectItem>
                  <SelectItem value="manual">Alíquota manual (%)</SelectItem>
                </SelectContent>
              </Select>
              {ipvaTipo === "auto" && ipvaAutoDetect && (
                <p className="text-xs text-muted-foreground">
                  Detectado: {ipvaAutoDetect.categoria === "geral" ? "geral" : ipvaAutoDetect.categoria === "hibrido" ? "híbrido" : "elétrico"}
                  {ipvaAutoDetect.conferirDocumento ? " · confira no documento" : ""}
                </p>
              )}
            </div>
            {ipvaTipo === "manual" && (
              <div className="space-y-1.5">
                <Label htmlFor="giro-ipva-manual">Alíquota manual (%)</Label>
                <Input
                  id="giro-ipva-manual"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={ipvaManualPct}
                  placeholder="Ex.: 2"
                  onChange={(e) => setIpvaManualPct(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIpvaItem(null)}>Cancelar</Button>
            <Button
              disabled={ipvaSaving}
              onClick={() => void (async () => {
                if (!ipvaItem) return;
                const manualPct = ipvaTipo === "manual"
                  ? Number(ipvaManualPct.replace(",", "."))
                  : null;
                setIpvaSaving(true);
                try {
                  await saveVeiculoGiroIpvaAjuste(userId, ipvaItem.veiculo.id, {
                    ipva_tipo: ipvaTipo,
                    ipva_aliquota_manual_pct: manualPct,
                  });
                  toast.success("IPVA do veículo atualizado.");
                  setIpvaItem(null);
                  await load();
                } catch (error) {
                  console.error("gestao_giro_ipva_ajuste", error);
                  toast.error(error instanceof Error ? error.message : "Não foi possível salvar o IPVA.");
                } finally {
                  setIpvaSaving(false);
                }
              })()}
            >
              {ipvaSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!manualItem} onOpenChange={(open) => !open && setManualItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Informar valor de repasse</DialogTitle>
            <DialogDescription>
              Valor direto de B2B ou contato de repasse. Fica salvo como referência manual (prioridade abaixo da Molicar B2B).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="giro-manual-valor">Valor de repasse (R$)</Label>
            <Input
              id="giro-manual-valor"
              type="number"
              min="0"
              step="0.01"
              value={manualValor}
              placeholder="Ex.: 85000"
              onChange={(e) => setManualValor(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualItem(null)}>Cancelar</Button>
            <Button
              disabled={manualSaving}
              onClick={() => void (async () => {
                if (!manualItem) return;
                const valor = Number(manualValor.replace(",", "."));
                if (!Number.isFinite(valor) || valor <= 0) {
                  toast.error("Informe um valor válido.");
                  return;
                }
                setManualSaving(true);
                try {
                  await saveGestaoGiroReferenciaManual(userId, manualItem.veiculo.id, valor);
                  toast.success("Referência de repasse salva.");
                  setManualItem(null);
                  await load();
                } catch (error) {
                  console.error("gestao_giro_manual_repasse", error);
                  toast.error("Não foi possível salvar o repasse.");
                } finally {
                  setManualSaving(false);
                }
              })()}
            >
              {manualSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Cálculo · {detail ? vehicleLabel(detail.veiculo) : ""}</DialogTitle>
            <DialogDescription>
              Valores internos. Cada linha mostra a fonte ou a fórmula usada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {detail?.resultado.passos.map((passo) => (
              <div key={passo.rotulo} className="flex items-start justify-between gap-4 border-b py-2 last:border-0">
                <div><p className="text-sm font-medium">{passo.rotulo}</p><p className="text-xs text-muted-foreground">{passo.formula}</p></div>
                <p className="whitespace-nowrap text-sm font-semibold">{money(passo.valor)}</p>
              </div>
            ))}
            {!!detail?.resultado.dadosIncompletos.length && (
              <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Faltam: {detail.resultado.dadosIncompletos.join(", ")}. O sistema não preenche valores por suposição.
              </div>
            )}
            {detail?.resultado.custoDeEsperar30d != null && (
              <div className="flex items-center justify-between rounded-md bg-destructive/10 p-3">
                <span className="flex items-center gap-2 text-sm font-medium"><TrendingDown className="h-4 w-4" /> Risco em 30 dias</span>
                <strong>{money(detail.resultado.custoDeEsperar30d)}</strong>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
