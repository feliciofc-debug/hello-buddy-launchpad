import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import type { GestaoVeiculoEnriched } from "@/lib/gestao-lucro-types.ts";
import {
  hojeSaoPaulo,
  intervaloCompetencia,
} from "../../../../supabase/functions/_shared/gestao-date-br.ts";
import {
  competenciaFromDate,
  loadComissaoAutoMes,
  loadComissaoRegra,
  loadGestaoVendedores,
  loadMetaMensal,
  saveComissaoRegra,
  saveMetaMensal,
  vendedorTemRegraPropria,
  type GestaoVendedor,
  DEFAULT_COMISSAO_REGRA,
} from "@/lib/gestao-equipe-load.ts";
import { GestaoComissaoRegraForm } from "@/components/gestao/lucro/GestaoComissaoRegraForm.tsx";
import { GestaoMetaForm } from "@/components/gestao/lucro/GestaoMetaForm.tsx";
import type { GestaoComissaoRegraJson } from "../../../../supabase/functions/_shared/gestao-comissao-calc.ts";
import { buildRankingVendedores } from "../../../../supabase/functions/_shared/gestao-equipe-stats.ts";
import { calcMetaProgresso, type GestaoMetaConfigJson } from "../../../../supabase/functions/_shared/gestao-meta-calc.ts";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  userId: string;
  veiculos: GestaoVeiculoEnriched[];
};

const defaultMeta: GestaoMetaConfigJson = {
  tipo: "qtd",
  metaValor: 8,
  bonusEscalonado: [
    { pctMeta: 100, bonus: 1000 },
    { pctMeta: 120, bonus: 2500 },
  ],
  bonusCarroParado90: 500,
};

export function GestaoEquipeTab({ userId, veiculos }: Props) {
  const vendedorFormRef = useRef<HTMLDivElement>(null);
  const [vendedores, setVendedores] = useState<GestaoVendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [competencia, setCompetencia] = useState(competenciaFromDate());
  const [comissaoMap, setComissaoMap] = useState<Map<string, number>>(new Map());
  const [form, setForm] = useState({ nome: "", whatsapp: "", is_gerente: false });
  const [regraPadrao, setRegraPadrao] = useState<GestaoComissaoRegraJson>(DEFAULT_COMISSAO_REGRA);
  const [regrasVendedor, setRegrasVendedor] = useState<Record<string, GestaoComissaoRegraJson>>({});
  const [regraPropria, setRegraPropria] = useState<Record<string, boolean>>({});
  const [meta, setMeta] = useState<GestaoMetaConfigJson>(defaultMeta);
  const [metaSalva, setMetaSalva] = useState(false);
  const [metaVendedorId, setMetaVendedorId] = useState<string>("");

  const reload = useCallback(async () => {
    setLoading(true);
    const [v, cm, regra, metaCfg] = await Promise.all([
      loadGestaoVendedores(userId),
      loadComissaoAutoMes(userId, competencia),
      loadComissaoRegra(userId, null),
      loadMetaMensal(userId, competencia, metaVendedorId || null),
    ]);
    setVendedores(v);
    setComissaoMap(cm);
    setRegraPadrao(regra);
    setMeta(metaCfg ?? defaultMeta);
    setMetaSalva(metaCfg != null);

    const flags: Record<string, boolean> = {};
    const porVendedor: Record<string, GestaoComissaoRegraJson> = {};
    await Promise.all(v.map(async (seller) => {
      const has = await vendedorTemRegraPropria(userId, seller.id);
      flags[seller.id] = has;
      if (has) porVendedor[seller.id] = await loadComissaoRegra(userId, seller.id);
    }));
    setRegraPropria(flags);
    setRegrasVendedor(porVendedor);
    setLoading(false);
  }, [userId, competencia, metaVendedorId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const vendasLines = useMemo(() => {
    const { start, end } = intervaloCompetencia(competencia);
    return veiculos
      .filter((v) => v.dataVenda && v.dataVenda >= start && v.dataVenda <= end)
      .map((v) => ({
        veiculo_id: v.id,
        valor_venda: v.valorVenda ?? 0,
        data_venda: v.dataVenda!,
        vendedor_id: v.vendedor_id,
        lucro_liquido: v.lucro.lucroLiquido,
      }));
  }, [veiculos, competencia]);

  const ranking = useMemo(() => {
    const nomes = new Map(vendedores.map((v) => [v.id, v.nome]));
    return buildRankingVendedores(vendasLines, comissaoMap, nomes, competencia);
  }, [vendasLines, comissaoMap, vendedores, competencia]);

  const metaProgress = useMemo(() => {
    const realizado = meta.tipo === "qtd"
      ? vendasLines.length
      : meta.tipo === "faturamento"
      ? vendasLines.reduce((a, v) => a + v.valor_venda, 0)
      : vendasLines.reduce((a, v) => a + (v.lucro_liquido ?? 0), 0);
    return calcMetaProgresso(meta, realizado);
  }, [meta, vendasLines]);

  const addVendedor = async () => {
    if (!form.nome.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    const { error } = await supabase.from("gestao_vendedores" as "veiculos_estoque").insert({
      user_id: userId,
      nome: form.nome.trim(),
      whatsapp_e164: form.whatsapp.trim() || null,
      is_gerente: form.is_gerente,
      ativo: true,
    });
    if (error) {
      toast.error("Não foi possível salvar vendedor.");
      return;
    }
    setForm({ nome: "", whatsapp: "", is_gerente: false });
    void reload();
  };

  const saveRegraPadrao = async () => {
    await saveComissaoRegra(userId, null, regraPadrao);
    toast.success("Regra padrão salva.");
  };

  const saveRegraVendedor = async (vendedorId: string) => {
    await saveComissaoRegra(userId, vendedorId, regrasVendedor[vendedorId] ?? DEFAULT_COMISSAO_REGRA);
    toast.success("Regra do vendedor salva.");
  };

  const toggleRegraPropria = async (vendedorId: string, enabled: boolean) => {
    setRegraPropria({ ...regraPropria, [vendedorId]: enabled });
    if (enabled && !regrasVendedor[vendedorId]) {
      setRegrasVendedor({ ...regrasVendedor, [vendedorId]: regraPadrao });
    }
    if (!enabled) {
      await supabase.from("gestao_comissao_regra" as "veiculos_estoque").delete()
        .eq("user_id", userId).eq("vendedor_id", vendedorId);
      toast.success("Vendedor passou a usar a regra padrão.");
    }
  };

  const saveMeta = async () => {
    await saveMetaMensal(userId, competencia, metaVendedorId || null, meta);
    setMetaSalva(true);
    toast.success("Meta salva.");
  };

  const marcarPago = async (vendedorId: string) => {
    const valor = comissaoMap.get(vendedorId) ?? 0;
    await supabase.from("gestao_comissao_extrato" as "veiculos_estoque").upsert({
      user_id: userId,
      vendedor_id: vendedorId,
      competencia,
      valor_comissao: valor,
      valor_pago: valor,
      pago_em: hojeSaoPaulo(),
    }, { onConflict: "user_id,vendedor_id,competencia" });
    toast.success("Marcado como pago.");
  };

  const exportCsv = () => {
    const lines = [
      "vendedor,qtd,faturamento,comissao",
      ...ranking.map((r) =>
        `${r.nome},${r.qtd},${r.faturamento},${r.comissao}`
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `equipe-${competencia}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.text(`Equipe — ${competencia}`, 14, 16);
    let y = 28;
    for (const r of ranking) {
      doc.text(`${r.nome}: ${r.qtd} vendas, ${formatGestaoMoney(r.comissao)}`, 14, y);
      y += 6;
    }
    doc.save(`equipe-${competencia}.pdf`);
  };

  if (loading) {
    return <div className="h-32 animate-pulse rounded-lg bg-muted" />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label>Competência</Label>
            <Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
          </div>
          <Button variant="outline" onClick={exportCsv}>CSV</Button>
          <Button variant="outline" onClick={exportPdf}>PDF</Button>
        </div>
        <Button
          onClick={() => {
            vendedorFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          + Adicionar vendedor
        </Button>
      </div>

      <GestaoComissaoRegraForm
        title="Regra de comissão padrão da loja"
        regra={regraPadrao}
        onChange={setRegraPadrao}
        onSave={() => void saveRegraPadrao()}
      />

      <section className="space-y-3 rounded-lg border p-4">
        <h3 className="font-semibold">Ranking do mês</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-3">Vendedor</th>
                <th className="pb-2 pr-3">Carros</th>
                <th className="pb-2 pr-3">Faturamento</th>
                <th className="pb-2 pr-3">Lucro</th>
                <th className="pb-2 pr-3">Comissão</th>
                <th className="pb-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r) => (
                <tr key={String(r.vendedor_id)} className="border-b">
                  <td className="py-2 pr-3 font-medium">{r.nome}</td>
                  <td className="py-2 pr-3">{r.qtd}</td>
                  <td className="py-2 pr-3">{formatGestaoMoney(r.faturamento)}</td>
                  <td className="py-2 pr-3">{formatGestaoMoney(r.lucroGerado)}</td>
                  <td className="py-2 pr-3">{formatGestaoMoney(r.comissao)}</td>
                  <td className="py-2">
                    {r.vendedor_id && (
                      <Button size="sm" variant="outline" onClick={() => void marcarPago(r.vendedor_id!)}>
                        Marcar pago
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {!ranking.length && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    Nenhuma venda no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div ref={vendedorFormRef} className="space-y-3 rounded-lg border p-4">
          <h3 className="font-semibold">Cadastro de vendedores</h3>
          <Input placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <Input placeholder="WhatsApp com DDD" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.is_gerente} onCheckedChange={(c) => setForm({ ...form, is_gerente: !!c })} />
            É gerente
          </label>
          <Button onClick={() => void addVendedor()}>Salvar vendedor</Button>
          <ul className="space-y-3 text-sm">
            {vendedores.map((v) => (
              <li key={v.id} className="rounded border p-2">
                <div className="flex justify-between gap-2">
                  <span>{v.nome}{v.is_gerente ? " (gerente)" : ""}</span>
                  <span className={v.ativo ? "text-emerald-600" : "text-muted-foreground"}>
                    {v.ativo ? "ativo" : "inativo"}
                  </span>
                </div>
                <label className="mt-2 flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={!!regraPropria[v.id]}
                    onCheckedChange={(c) => void toggleRegraPropria(v.id, !!c)}
                  />
                  Usar regra própria
                </label>
                {regraPropria[v.id] && (
                  <div className="mt-2">
                    <GestaoComissaoRegraForm
                      title={`Regra — ${v.nome}`}
                      regra={regrasVendedor[v.id] ?? regraPadrao}
                      onChange={(r) => setRegrasVendedor({ ...regrasVendedor, [v.id]: r })}
                      onSave={() => void saveRegraVendedor(v.id)}
                      saveLabel="Salvar regra do vendedor"
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <h3 className="font-semibold">Meta e projeção</h3>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={metaVendedorId}
            onChange={(e) => setMetaVendedorId(e.target.value)}
          >
            <option value="">Meta da loja</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>{v.nome}</option>
            ))}
          </select>
          {!metaSalva && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40">
              Meta sugerida — clique em Salvar para ativar
            </p>
          )}
          <GestaoMetaForm meta={meta} onChange={setMeta} onSave={() => void saveMeta()} />
          <div>
            <p className="text-sm text-muted-foreground">
              Atingido: {metaProgress.pctAtingido}% · Projeção: {metaProgress.projecaoPct}%
            </p>
            <Progress value={Math.min(100, metaProgress.pctAtingido)} className="mt-2" />
            <p className="mt-1 text-xs text-muted-foreground">
              No ritmo atual fecha em {metaProgress.projecaoPct}% da meta.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
