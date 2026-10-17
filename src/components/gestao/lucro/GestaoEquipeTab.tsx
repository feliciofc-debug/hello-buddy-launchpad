import { useCallback, useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import type { GestaoVeiculoEnriched } from "@/lib/gestao-lucro-types.ts";
import {
  competenciaFromDate,
  loadComissaoAutoMes,
  loadComissaoRegra,
  loadGestaoVendedores,
  loadMetaMensal,
  saveComissaoRegra,
  saveMetaMensal,
  type GestaoVendedor,
  DEFAULT_COMISSAO_REGRA,
} from "@/lib/gestao-equipe-load.ts";
import { buildRankingVendedores } from "../../../../supabase/functions/_shared/gestao-equipe-stats.ts";
import { calcMetaProgresso, type GestaoMetaConfigJson } from "../../../../supabase/functions/_shared/gestao-meta-calc.ts";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";
import { parseGestaoMoneyField } from "@/lib/gestao-money.ts";
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
  const [vendedores, setVendedores] = useState<GestaoVendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [competencia, setCompetencia] = useState(competenciaFromDate());
  const [comissaoMap, setComissaoMap] = useState<Map<string, number>>(new Map());
  const [form, setForm] = useState({ nome: "", whatsapp: "", is_gerente: false });
  const [regraText, setRegraText] = useState(JSON.stringify(DEFAULT_COMISSAO_REGRA, null, 2));
  const [meta, setMeta] = useState<GestaoMetaConfigJson>(defaultMeta);
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
    setRegraText(JSON.stringify(regra, null, 2));
    setMeta(metaCfg ?? defaultMeta);
    setLoading(false);
  }, [userId, competencia, metaVendedorId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const vendasLines = useMemo(() => {
    const [y, m] = competencia.split("-").map(Number);
    const start = `${competencia}-01`;
    const end = new Date(y, m, 0).toISOString().slice(0, 10);
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

  const saveRegra = async () => {
    try {
      const parsed = JSON.parse(regraText) as typeof DEFAULT_COMISSAO_REGRA;
      await saveComissaoRegra(userId, null, parsed);
      toast.success("Regra padrão salva.");
    } catch {
      toast.error("JSON de regra inválido.");
    }
  };

  const saveMeta = async () => {
    await saveMetaMensal(userId, competencia, metaVendedorId || null, meta);
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
      pago_em: new Date().toISOString().slice(0, 10),
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
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label>Competência</Label>
          <Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
        </div>
        <Button variant="outline" onClick={exportCsv}>CSV</Button>
        <Button variant="outline" onClick={exportPdf}>PDF</Button>
      </div>

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
        <div className="space-y-3 rounded-lg border p-4">
          <h3 className="font-semibold">Cadastro de vendedores</h3>
          <Input placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <Input placeholder="WhatsApp E.164" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.is_gerente} onCheckedChange={(c) => setForm({ ...form, is_gerente: !!c })} />
            É gerente
          </label>
          <Button onClick={() => void addVendedor()}>Adicionar</Button>
          <ul className="text-sm">
            {vendedores.map((v) => (
              <li key={v.id} className="flex justify-between border-b py-1">
                <span>{v.nome}{v.is_gerente ? " (gerente)" : ""}</span>
                <span className={v.ativo ? "text-emerald-600" : "text-muted-foreground"}>
                  {v.ativo ? "ativo" : "inativo"}
                </span>
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
          <Label>Meta (qtd carros)</Label>
          <Input
            type="number"
            value={meta.metaValor}
            onChange={(e) => setMeta({ ...meta, metaValor: Number(e.target.value) })}
          />
          <Label>Bônus 100% (R$)</Label>
          <Input
            value={String(meta.bonusEscalonado[0]?.bonus ?? 0)}
            onChange={(e) => {
              const b = parseGestaoMoneyField(e.target.value) ?? 0;
              setMeta({
                ...meta,
                bonusEscalonado: [
                  { pctMeta: 100, bonus: b },
                  meta.bonusEscalonado[1] ?? { pctMeta: 120, bonus: 2500 },
                ],
              });
            }}
          />
          <div>
            <p className="text-sm text-muted-foreground">
              Atingido: {metaProgress.pctAtingido}% · Projeção: {metaProgress.projecaoPct}%
            </p>
            <Progress value={Math.min(100, metaProgress.pctAtingido)} className="mt-2" />
            <p className="mt-1 text-xs text-muted-foreground">
              No ritmo atual fecha em {metaProgress.projecaoPct}% da meta.
            </p>
          </div>
          <Button variant="outline" onClick={() => void saveMeta()}>Salvar meta</Button>
        </div>
      </section>

      <section className="space-y-2 rounded-lg border p-4">
        <h3 className="font-semibold">Regra de comissão padrão (JSON)</h3>
        <textarea
          className="min-h-[160px] w-full rounded-md border bg-background p-2 font-mono text-xs"
          value={regraText}
          onChange={(e) => setRegraText(e.target.value)}
        />
        <Button variant="outline" onClick={() => void saveRegra()}>Salvar regra</Button>
      </section>
    </div>
  );
}
