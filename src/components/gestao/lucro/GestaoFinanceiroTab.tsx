import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hojeSaoPaulo, intervaloCompetencia } from "../../../../supabase/functions/_shared/gestao-date-br.ts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GestaoMoneyInput } from "@/components/gestao/lucro/GestaoMoneyInput.tsx";
import { formatGestaoMoney, formatGestaoPct } from "@/lib/gestao-format.ts";
import { parseGestaoMoneyField } from "@/lib/gestao-money.ts";
import type { GestaoVeiculoEnriched } from "@/lib/gestao-lucro-types.ts";
import {
  contasToDreOperacional,
  contasToFluxo,
  createRecorrenciaSerie,
  encerrarRecorrenciaSerie,
  loadContadorTokens,
  loadGestaoContas,
  loadRecorrenciaSeries,
  revogarContadorToken,
  veiculosToDreVendas,
  type GestaoContaLancamento,
  type GestaoContaRecorrenciaSerie,
  type GestaoContadorTokenRow,
} from "@/lib/gestao-financeiro-load.ts";
import {
  GESTAO_CATEGORIAS_PAGAR,
  GESTAO_CATEGORIAS_RECEBER,
  gestaoOperacionalCategoriaLabel,
} from "../../../../supabase/functions/_shared/gestao-operacional-categorias.ts";
import { calcDreMes, calcDreSerie } from "../../../../supabase/functions/_shared/gestao-dre-calc.ts";
import { calcFluxoDiario, calcSaldoProjetado } from "../../../../supabase/functions/_shared/gestao-fluxo-calc.ts";
import { competenciaFromDate } from "../../../../supabase/functions/_shared/gestao-meta-calc.ts";
import { GESTAO_CONTADOR_AVISO } from "../../../../supabase/functions/_shared/gestao-contador-token.ts";
import {
  buildContadorPacoteFromApp,
  downloadContadorXlsx,
} from "@/lib/gestao-contador-export.ts";
import { downloadRelatorioMesPdf } from "@/lib/gestao-relatorio-mes-pdf.ts";
import { loadConciliacaoResumoCompetencia } from "@/lib/gestao-conciliacao-load.ts";
import { supabase } from "@/integrations/supabase/client";
import { GestaoConciliacaoTab } from "@/components/gestao/lucro/GestaoConciliacaoTab.tsx";
import { GestaoHelpTip } from "@/components/gestao/GestaoHelpTip.tsx";

type Props = {
  userId: string;
  veiculos: GestaoVeiculoEnriched[];
  /** Aba interna controlada pelo topo da Gestão (ex.: Resultado) */
  section?: string;
  onSectionChange?: (section: string) => void;
  /** Sincroniza competência com o seletor do topo */
  competenciaSync?: string;
};

const emptyForm = {
  tipo: "pagar" as "pagar" | "receber",
  categoria: "aluguel",
  valor: "",
  vencimento: hojeSaoPaulo(),
  forma_pagamento: "",
  recorrencia_dia_mes: "",
  observacao: "",
  veiculo_id: "",
};

function last12Competencias(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(competenciaFromDate(d));
  }
  return out;
}

export function GestaoFinanceiroTab({
  userId,
  veiculos,
  section: sectionProp,
  onSectionChange,
  competenciaSync,
}: Props) {
  const [competencia, setCompetencia] = useState(competenciaSync ?? competenciaFromDate());
  const [section, setSection] = useState(sectionProp ?? "contas");

  useEffect(() => {
    if (competenciaSync) setCompetencia(competenciaSync);
  }, [competenciaSync]);

  useEffect(() => {
    if (sectionProp) setSection(sectionProp);
  }, [sectionProp]);

  const setSectionBoth = (v: string) => {
    setSection(v);
    onSectionChange?.(v);
  };
  const [contas, setContas] = useState<GestaoContaLancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [contadorLink, setContadorLink] = useState<string | null>(null);
  const [series, setSeries] = useState<GestaoContaRecorrenciaSerie[]>([]);
  const [contadorTokens, setContadorTokens] = useState<GestaoContadorTokenRow[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    const [c, emp, ser, tok] = await Promise.all([
      loadGestaoContas(userId),
      supabase.from("empresa_config").select("nome_empresa").eq("user_id", userId).maybeSingle(),
      loadRecorrenciaSeries(userId),
      loadContadorTokens(userId),
    ]);
    setContas(c);
    setSeries(ser);
    setContadorTokens(tok);
    setNomeEmpresa(String(emp.data?.nome_empresa ?? "Loja"));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const vendasDre = useMemo(() => veiculosToDreVendas(veiculos), [veiculos]);
  const opsDre = useMemo(() => contasToDreOperacional(contas), [contas]);
  const dreAtual = useMemo(() => calcDreMes(competencia, vendasDre, opsDre), [competencia, vendasDre, opsDre]);
  const dreSerie = useMemo(
    () => calcDreSerie(last12Competencias(), vendasDre, opsDre),
    [vendasDre, opsDre],
  );
  const dreAnterior = dreSerie.find((d) => {
    const [y, m] = competencia.split("-").map(Number);
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    return d.competencia === prev;
  });

  const dreLinhasTabela = useMemo(() => {
    const fat = dreAtual.faturamento;
    const pct = (v: number) => (fat > 0 ? formatGestaoPct((v / fat) * 100) : "—");
    const ant = (pick: (d: typeof dreAtual) => number) =>
      dreAnterior ? formatGestaoMoney(pick(dreAnterior)) : "—";
    return [
      { label: "Faturamento", valor: dreAtual.faturamento, pct: fat > 0 ? formatGestaoPct(100) : "—", anterior: ant((d) => d.faturamento) },
      { label: "Custo carros vendidos", valor: dreAtual.custoCarros, pct: pct(dreAtual.custoCarros), anterior: ant((d) => d.custoCarros) },
      { label: "Despesas dos carros", valor: dreAtual.despesasCarros, pct: pct(dreAtual.despesasCarros), anterior: ant((d) => d.despesasCarros) },
      { label: "Lucro dos carros", valor: dreAtual.lucroCarros, pct: pct(dreAtual.lucroCarros), anterior: ant((d) => d.lucroCarros) },
      { label: "Despesas operacionais", valor: dreAtual.despesasOperacionais, pct: pct(dreAtual.despesasOperacionais), anterior: ant((d) => d.despesasOperacionais) },
      { label: "Lucro líquido da loja", valor: dreAtual.lucroLiquidoLoja, pct: pct(dreAtual.lucroLiquidoLoja), anterior: ant((d) => d.lucroLiquidoLoja), bold: true },
    ];
  }, [dreAtual, dreAnterior]);

  const lucroMedioPorCarro = dreAtual.qtdVendas > 0 ? dreAtual.lucroCarros / dreAtual.qtdVendas : 0;
  const pontoEquilibrio =
    lucroMedioPorCarro > 0 ? Math.ceil(dreAtual.despesasOperacionais / lucroMedioPorCarro) : null;

  const baixarRelatorioMesPdf = async () => {
    const { start, end } = intervaloCompetencia(competencia);
    const conciliacao = await loadConciliacaoResumoCompetencia(userId, start, end);
    downloadRelatorioMesPdf(
      { competencia, nomeEmpresa, veiculos, contas, conciliacao },
      `relatorio-gestao-${competencia}.pdf`,
    );
  };

  const fluxo = useMemo(() => {
    const { start, end } = intervaloCompetencia(competencia);
    return calcFluxoDiario(contasToFluxo(contas), start, end);
  }, [contas, competencia]);

  const seriesFluxo = useMemo(() => series.map((s) => ({
    id: s.id,
    tipo: s.tipo,
    valor: s.valor,
    dia_mes: s.dia_mes,
    encerrada_a_partir_de: s.encerrada_a_partir_de,
  })), [series]);

  const proj = useMemo(() => ({
    p30: calcSaldoProjetado(contasToFluxo(contas), 30, new Date(), seriesFluxo),
    p60: calcSaldoProjetado(contasToFluxo(contas), 60, new Date(), seriesFluxo),
    p90: calcSaldoProjetado(contasToFluxo(contas), 90, new Date(), seriesFluxo),
  }), [contas, seriesFluxo]);

  const saveConta = async () => {
    const valor = parseGestaoMoneyField(form.valor);
    if (valor == null || valor <= 0) {
      toast.error("Informe o valor.");
      return;
    }
    if (form.recorrencia_dia_mes) {
      const dia = Number(form.recorrencia_dia_mes);
      if (dia < 1 || dia > 31) {
        toast.error("Dia de recorrência inválido.");
        return;
      }
      try {
        await createRecorrenciaSerie(userId, {
          tipo: form.tipo,
          categoria_operacional: form.categoria,
          valor,
          dia_mes: dia,
          forma_pagamento: form.forma_pagamento || null,
          observacao: form.observacao || null,
          veiculo_id: form.veiculo_id || null,
        });
      } catch {
        toast.error("Não foi possível criar a recorrência.");
        return;
      }
      setForm(emptyForm);
      toast.success("Recorrência criada — lançamentos do mês gerados.");
      void reload();
      return;
    }

    const { error } = await supabase.from("gestao_conta_lancamento" as "veiculos_estoque").insert({
      user_id: userId,
      tipo: form.tipo,
      categoria_operacional: form.categoria,
      valor,
      vencimento: form.vencimento,
      forma_pagamento: form.forma_pagamento || null,
      observacao: form.observacao || null,
      veiculo_id: form.veiculo_id || null,
      origem: "manual",
    });
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    setForm(emptyForm);
    toast.success("Lançamento salvo.");
    void reload();
  };

  const liquidar = async (c: GestaoContaLancamento) => {
    const today = hojeSaoPaulo();
    const patch = c.tipo === "pagar" ? { pago_em: today } : { recebido_em: today };
    await supabase.from("gestao_conta_lancamento" as "veiculos_estoque").update(patch)
      .eq("id", c.id).eq("user_id", userId);
    void reload();
  };

  const gerarLinkContador = async () => {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gestao-contador-pacote`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ competencia }),
      },
    );
    const json = await res.json() as { appUrl?: string; path?: string; error?: string };
    if (!res.ok) {
      toast.error("Não foi possível gerar o link.");
      return;
    }
    const link = json.appUrl?.startsWith("http")
      ? json.appUrl
      : `${window.location.origin}${json.path ?? json.appUrl}`;
    setContadorLink(link);
    toast.success("Link gerado — encaminhe ao contador.");
    void reload();
  };

  const revogarLink = async (id: string) => {
    await revogarContadorToken(userId, id);
    toast.success("Link revogado.");
    void reload();
  };

  const encerrarSerie = async (serieId: string) => {
    const prox = competenciaFromDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1));
    await encerrarRecorrenciaSerie(userId, serieId, prox);
    toast.success("Recorrência encerrada a partir do próximo mês.");
    void reload();
  };

  const pacote = useMemo(
    () => buildContadorPacoteFromApp(competencia, nomeEmpresa, veiculos, contas),
    [competencia, nomeEmpresa, veiculos, contas],
  );

  const cats = form.tipo === "pagar" ? GESTAO_CATEGORIAS_PAGAR : GESTAO_CATEGORIAS_RECEBER;

  if (loading) {
    return <div className="h-32 animate-pulse rounded-lg bg-muted" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label>Competência</Label>
          <Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
        </div>
      </div>

      <Tabs value={section} onValueChange={setSectionBoth}>
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="contas">Contas</TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo de caixa</TabsTrigger>
          <TabsTrigger value="dre" className="gap-1">
            Resultado
            <GestaoHelpTip text="DRE — resultado do mês (faturamento menos custos e despesas)." />
          </TabsTrigger>
          <TabsTrigger value="conciliacao" className="gap-1">
            Conciliação
            <GestaoHelpTip text="Conciliação — conferir o extrato do banco com o que você lançou aqui." />
          </TabsTrigger>
          <TabsTrigger value="contador">Contador</TabsTrigger>
        </TabsList>

        <TabsContent value="contas" className="mt-4 space-y-4">
          <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-2">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({
                ...form,
                tipo: v as "pagar" | "receber",
                categoria: v === "pagar" ? "aluguel" : "financiamento_receber",
              })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pagar">A pagar</SelectItem>
                  <SelectItem value="receber">A receber</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cats.map((c) => (
                    <SelectItem key={c} value={c}>{gestaoOperacionalCategoriaLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <GestaoMoneyInput label="Valor (R$)" value={form.valor} onChange={(v) => setForm({ ...form, valor: v })} />
            <div>
              <Label>Vencimento</Label>
              <Input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} />
            </div>
            <div>
              <Label>Recorrência mensal (dia fixo — cria série)</Label>
              <Input type="number" min={1} max={31} placeholder="Ex: 10 (aluguel)" value={form.recorrencia_dia_mes}
                onChange={(e) => setForm({ ...form, recorrencia_dia_mes: e.target.value })} />
              <p className="text-[11px] text-muted-foreground">Com dia preenchido, gera lançamentos reais mês a mês (atual + próximo).</p>
            </div>
            <div>
              <Label>Forma pagamento</Label>
              <Input value={form.forma_pagamento} onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })} />
            </div>
            {form.tipo === "receber" && (
              <div>
                <Label>Veículo (opcional)</Label>
                <Select value={form.veiculo_id || "none"} onValueChange={(v) => setForm({ ...form, veiculo_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Venda ligada ao carro" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {veiculos.filter((v) => v.dataVenda).map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.marca} {v.modelo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="md:col-span-2">
              <Label>Observação</Label>
              <Input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
            </div>
            <div className="md:col-span-2 text-xs text-muted-foreground">
              Comprovante: em breve (armazenamento privado a definir). Campo reservado no cadastro.
            </div>
            <Button type="button" onClick={() => void saveConta()}>Salvar lançamento</Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-2">Venc.</th>
                  <th className="pb-2 pr-2">Tipo</th>
                  <th className="pb-2 pr-2">Categoria</th>
                  <th className="pb-2 pr-2">Valor</th>
                  <th className="pb-2 pr-2">Status</th>
                  <th className="pb-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {contas.map((c) => (
                  <tr key={c.id} className="border-b">
                    <td className="py-2 pr-2">{c.vencimento}</td>
                    <td className="py-2 pr-2">{c.tipo === "pagar" ? "Pagar" : "Receber"}</td>
                    <td className="py-2 pr-2">{gestaoOperacionalCategoriaLabel(c.categoria_operacional)}</td>
                    <td className="py-2 pr-2">{formatGestaoMoney(Number(c.valor))}</td>
                    <td className="py-2 pr-2 text-xs">
                      {c.origem === "bonus_g2" ? "Bônus G2 · " : c.origem === "recorrencia" ? `Rec. ${c.competencia ?? ""} · ` : ""}
                      {c.tipo === "pagar"
                        ? (c.pago_em ? `Pago ${c.pago_em}` : "Em aberto")
                        : (c.recebido_em ? `Recebido ${c.recebido_em}` : "Em aberto")}
                    </td>
                    <td className="py-2">
                      {!(c.tipo === "pagar" ? c.pago_em : c.recebido_em) && (
                        <Button size="sm" variant="outline" onClick={() => void liquidar(c)}>
                          {c.tipo === "pagar" ? "Marcar pago" : "Marcar recebido"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {series.length > 0 && (
            <div className="rounded-lg border p-3 text-sm">
              <p className="mb-2 font-medium">Séries recorrentes</p>
              <ul className="space-y-2">
                {series.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                    <span>
                      {gestaoOperacionalCategoriaLabel(s.categoria_operacional)} — dia {s.dia_mes} — {formatGestaoMoney(s.valor)}
                      {s.encerrada_a_partir_de ? ` (encerra ${s.encerrada_a_partir_de})` : ""}
                    </span>
                    {!s.encerrada_a_partir_de && (
                      <Button size="sm" variant="outline" onClick={() => void encerrarSerie(s.id)}>
                        Encerrar recorrência
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        <TabsContent value="fluxo" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[proj.p30, proj.p60, proj.p90].map((p) => (
              <div key={p.dias} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">Projeção {p.dias} dias</p>
                <p className="text-muted-foreground">Entradas prev.: {formatGestaoMoney(p.entradasPrevistas)}</p>
                <p className="text-muted-foreground">Saídas prev.: {formatGestaoMoney(p.saidasPrevistas)}</p>
                <p className="font-semibold">Saldo: {formatGestaoMoney(p.saldoProjetado)}</p>
              </div>
            ))}
          </div>
          <div className="max-h-80 overflow-y-auto rounded border text-xs">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-2 text-left">Dia</th>
                  <th className="p-2">Real. entradas</th>
                  <th className="p-2">Real. saídas</th>
                  <th className="p-2">Prev. entradas</th>
                  <th className="p-2">Prev. saídas</th>
                  <th className="p-2">Saldo acum.</th>
                </tr>
              </thead>
              <tbody>
                {fluxo.map((f) => (
                  <tr key={f.data} className="border-b">
                    <td className="p-2">{f.data}</td>
                    <td className="p-2 text-right">{formatGestaoMoney(f.entradas)}</td>
                    <td className="p-2 text-right">{formatGestaoMoney(f.saidas)}</td>
                    <td className="p-2 text-right">{formatGestaoMoney(f.previstoEntradas)}</td>
                    <td className="p-2 text-right">{formatGestaoMoney(f.previstoSaidas)}</td>
                    <td className="p-2 text-right font-medium">{formatGestaoMoney(f.saldoDia)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="dre" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void baixarRelatorioMesPdf()}>
              Baixar relatório do mês (PDF)
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                  <th className="p-2">Linha</th>
                  <th className="p-2 text-right">Valor</th>
                  <th className="p-2 text-right">% faturamento</th>
                  <th className="p-2 text-right">Mês anterior</th>
                </tr>
              </thead>
              <tbody>
                {dreLinhasTabela.map((row) => (
                  <tr key={row.label} className="border-b last:border-0">
                    <td className={`p-2 ${row.bold ? "font-semibold" : ""}`}>{row.label}</td>
                    <td className={`p-2 text-right ${row.bold ? "font-semibold" : ""}`}>
                      {formatGestaoMoney(row.valor)}
                    </td>
                    <td className="p-2 text-right">{row.pct}</td>
                    <td className="p-2 text-right">{row.anterior}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {dreAtual.margemLiquidaPct != null && (
            <p className="text-sm text-muted-foreground">
              Margem líquida: {formatGestaoPct(dreAtual.margemLiquidaPct)}
            </p>
          )}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
            <p className="font-semibold">Ponto de equilíbrio</p>
            {pontoEquilibrio != null ? (
              <p className="mt-1">
                Sua loja precisa vender{" "}
                <strong>{pontoEquilibrio}</strong> carros/mês para pagar a estrutura (despesas
                operacionais ÷ lucro médio por carro vendido). Vendidos:{" "}
                <strong>{dreAtual.qtdVendas}</strong>.
              </p>
            ) : (
              <p className="mt-1 text-muted-foreground">
                Informe vendas com lucro positivo no mês para calcular o ponto de equilíbrio.
                Vendidos: {dreAtual.qtdVendas}.
              </p>
            )}
          </div>
          <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {dreSerie.slice(-12).map((d) => (
              <li key={d.competencia} className="flex justify-between rounded border px-2 py-1">
                <span>{d.competencia}</span>
                <span>{formatGestaoMoney(d.lucroLiquidoLoja)}</span>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="conciliacao" className="mt-4">
          <GestaoConciliacaoTab
            userId={userId}
            contas={contas}
            veiculos={veiculos}
            onFinanceiroReload={() => void reload()}
          />
        </TabsContent>

        <TabsContent value="contador" className="mt-4 space-y-4">
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
            {GESTAO_CONTADOR_AVISO}
          </p>
          <p className="text-sm text-muted-foreground">
            Envio: o link seguro é exibido aqui e no WhatsApp (Jarvis) para você encaminhar ao contador.
            Não há envio automático por e-mail nesta versão.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void gerarLinkContador()}>Gerar link seguro do mês</Button>
            <Button type="button" variant="outline" onClick={() => downloadContadorXlsx(pacote, `contador-${competencia}.xlsx`)}>
              Baixar XLSX
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void baixarRelatorioMesPdf()}
            >
              Baixar relatório do mês (PDF)
            </Button>
          </div>
          {contadorLink && (
            <div className="rounded border p-3 text-sm break-all">
              <p className="font-medium">Último link gerado:</p>
              <a href={contadorLink} className="text-primary underline" target="_blank" rel="noreferrer">{contadorLink}</a>
            </div>
          )}
          <div className="overflow-x-auto rounded border">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                  <th className="p-2">Competência</th>
                  <th className="p-2">Validade</th>
                  <th className="p-2">Último acesso</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {contadorTokens.map((t) => {
                  const revogado = !!t.revogado_em;
                  const expirado = new Date(t.expires_at) < new Date();
                  return (
                    <tr key={t.id} className="border-b">
                      <td className="p-2">{t.competencia}</td>
                      <td className="p-2">{t.expires_at.slice(0, 10)}</td>
                      <td className="p-2">{t.last_access_at?.slice(0, 10) ?? "—"}</td>
                      <td className="p-2 text-xs">
                        {revogado ? "Revogado" : expirado ? "Expirado" : "Ativo"}
                      </td>
                      <td className="p-2">
                        {!revogado && !expirado && (
                          <Button size="sm" variant="outline" onClick={() => void revogarLink(t.id)}>Revogar</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!contadorTokens.length && (
                  <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Nenhum link gerado ainda.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
