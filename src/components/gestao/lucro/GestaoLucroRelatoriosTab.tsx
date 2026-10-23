import { useMemo } from "react";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GestaoVeiculoEnriched } from "@/lib/gestao-lucro-types.ts";
import { gestaoCategoriaLabel } from "@/lib/gestao-lucro-categories.ts";
import { formatGestaoMoney, formatGestaoPct } from "@/lib/gestao-format.ts";
import { intervaloCompetencia } from "../../../../supabase/functions/_shared/gestao-date-br.ts";
import {
  calcVendaRaioX,
  rankPioresNegocios,
  type GestaoVendaRaioXRankItem,
} from "../../../../supabase/functions/_shared/gestao-venda-raio-x.ts";
import { vehicleLabel } from "@/lib/gestao-lucro-data.ts";

type Props = {
  veiculos: GestaoVeiculoEnriched[];
};

function last12Months(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

function raioXItem(v: GestaoVeiculoEnriched): GestaoVendaRaioXRankItem | null {
  const r = calcVendaRaioX({
    valorVenda: v.valorVenda,
    valorCompra: v.valorCompra,
    despesas: v.despesas.map((d) => ({ valor: Number(d.valor), categoria: d.categoria })),
  });
  if (!r) return null;
  return {
    ...r,
    veiculoId: v.id,
    label: vehicleLabel(v),
    vendedorId: v.vendedor_id,
    vendedorNome: v.vendedor,
    dataVenda: v.dataVenda ?? "",
  };
}

export function GestaoLucroRelatoriosTab({ veiculos }: Props) {
  const months = last12Months();

  const lucroPorMes = useMemo(() => {
    return months.map((ym) => {
      const { start, end } = intervaloCompetencia(ym);
      let lucro = 0;
      for (const v of veiculos) {
        if (!v.dataVenda || v.dataVenda < start || v.dataVenda > end) continue;
        lucro += v.lucro.lucroLiquido ?? 0;
      }
      return { ym, lucro };
    });
  }, [veiculos, months]);

  const margemComissaoPorMes = useMemo(() => {
    return months.map((ym) => {
      const { start, end } = intervaloCompetencia(ym);
      let n = 0;
      let somaBruta = 0;
      let somaFinal = 0;
      for (const v of veiculos) {
        if (!v.dataVenda || v.dataVenda < start || v.dataVenda > end) continue;
        const rx = raioXItem(v);
        if (!rx || rx.margemBrutaPct == null || rx.margemFinalPct == null) continue;
        n += 1;
        somaBruta += rx.margemBrutaPct;
        somaFinal += rx.margemFinalPct;
      }
      return {
        ym,
        margemAntes: n ? somaBruta / n : null,
        margemDepois: n ? somaFinal / n : null,
        qtd: n,
      };
    });
  }, [veiculos, months]);

  const porVendedor = useMemo(() => {
    const map = new Map<string, {
      nome: string;
      lucroBruto: number;
      comissao: number;
      qtd: number;
    }>();
    for (const v of veiculos) {
      if (!v.lucro.vendido) continue;
      const rx = raioXItem(v);
      if (!rx) continue;
      const key = v.vendedor_id ?? v.vendedor ?? "sem_vendedor";
      const nome = v.vendedor ?? "Sem vendedor";
      const cur = map.get(key) ?? { nome, lucroBruto: 0, comissao: 0, qtd: 0 };
      cur.lucroBruto += rx.lucroBruto ?? 0;
      cur.comissao += rx.comissao;
      cur.qtd += 1;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.lucroBruto - a.lucroBruto);
  }, [veiculos]);

  const pioresNegocios = useMemo(() => {
    const items = veiculos
      .filter((v) => v.lucro.vendido && v.dataVenda)
      .map(raioXItem)
      .filter((x): x is GestaoVendaRaioXRankItem => x != null);
    return rankPioresNegocios(items, 8);
  }, [veiculos]);

  const lucroPorMarca = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of veiculos) {
      if (!v.lucro.vendido) continue;
      const m = v.marca || "Sem marca";
      map.set(m, (map.get(m) ?? 0) + (v.lucro.lucroLiquido ?? 0));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [veiculos]);

  const despesasPorCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of veiculos) {
      for (const d of v.despesas) {
        map.set(d.categoria, (map.get(d.categoria) ?? 0) + Number(d.valor));
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [veiculos]);

  const giro = useMemo(() => {
    const sold = veiculos.filter((v) => v.lucro.vendido && v.lucro.diasEstoque != null);
    if (!sold.length) return null;
    const avg = sold.reduce((a, v) => a + (v.lucro.diasEstoque ?? 0), 0) / sold.length;
    return Math.round(avg);
  }, [veiculos]);

  const exportCsv = () => {
    const lines = [
      "mes,lucro_liquido",
      ...lucroPorMes.map((r) => `${r.ym},${r.lucro}`),
      "",
      "vendedor,lucro_bruto,comissao,pct_lucro_comissao",
      ...porVendedor.map((r) => {
        const pct = r.lucroBruto > 0 ? (r.comissao / r.lucroBruto) * 100 : 0;
        return `${r.nome},${r.lucroBruto},${r.comissao},${pct.toFixed(1)}`;
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gestao-relatorios.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Gestão — Relatórios", 14, 16);
    doc.setFontSize(10);
    let y = 28;
    doc.text("Piores negócios (lucro final)", 14, y);
    y += 6;
    for (const row of pioresNegocios.slice(0, 5)) {
      doc.text(
        `${row.label}: bruto ${formatGestaoMoney(row.lucroBruto)} → final ${formatGestaoMoney(row.lucroFinal)} (comissão ${formatGestaoMoney(row.comissao)})`,
        18,
        y,
      );
      y += 5;
      if (row.motivoProvavel) {
        doc.text(`Motivo: ${row.motivoProvavel}`, 22, y);
        y += 5;
      }
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    }
    y += 4;
    doc.text(`Giro médio (dias): ${giro ?? "—"}`, 14, y);
    doc.save("gestao-relatorios.pdf");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={exportCsv}>Exportar CSV</Button>
        <Button variant="outline" onClick={exportPdf}>Exportar PDF</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Margem média antes × depois da comissão</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {margemComissaoPorMes.filter((r) => r.qtd > 0).slice(-6).map((r) => (
              <li key={r.ym} className="rounded border px-2 py-2">
                <p className="font-medium">{r.ym}</p>
                <p className="text-muted-foreground">
                  Antes: {formatGestaoPct(r.margemAntes)} · Depois: {formatGestaoPct(r.margemDepois)}
                </p>
                <p className="text-xs text-muted-foreground">{r.qtd} vendas</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lucro bruto × comissão por vendedor</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-3">Vendedor</th>
                <th className="pb-2 pr-3">Carros</th>
                <th className="pb-2 pr-3">Lucro bruto</th>
                <th className="pb-2 pr-3">Comissão</th>
                <th className="pb-2">% lucro → comissão</th>
              </tr>
            </thead>
            <tbody>
              {porVendedor.map((r) => {
                const pct = r.lucroBruto > 0 ? (r.comissao / r.lucroBruto) * 100 : null;
                return (
                  <tr key={r.nome} className="border-b">
                    <td className="py-2 pr-3">{r.nome}</td>
                    <td className="py-2 pr-3">{r.qtd}</td>
                    <td className="py-2 pr-3">{formatGestaoMoney(r.lucroBruto)}</td>
                    <td className="py-2 pr-3">{formatGestaoMoney(r.comissao)}</td>
                    <td className="py-2">{pct != null ? `${pct.toFixed(1)}%` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Piores negócios do período</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pioresNegocios.map((r) => (
            <div key={r.veiculoId} className="rounded border p-3 text-sm">
              <p className="font-medium">{r.label} · {r.dataVenda}</p>
              <p>
                Lucro bruto {formatGestaoMoney(r.lucroBruto)} ({formatGestaoPct(r.margemBrutaPct)})
                {" → "}final {formatGestaoMoney(r.lucroFinal)} ({formatGestaoPct(r.margemFinalPct)})
              </p>
              <p className="text-muted-foreground">
                Comissão {formatGestaoMoney(r.comissao)}
                {r.comissaoPctDoLucro != null ? ` (${r.comissaoPctDoLucro.toFixed(1)}% do lucro bruto)` : ""}
              </p>
              {r.motivoProvavel && (
                <p className="text-xs text-amber-800 dark:text-amber-200">{r.motivoProvavel}</p>
              )}
            </div>
          ))}
          {!pioresNegocios.length && (
            <p className="text-muted-foreground">Sem vendas com raio-X calculável.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lucro por mês (12 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {lucroPorMes.map((r) => (
              <li key={r.ym} className="flex justify-between rounded border px-2 py-1">
                <span>{r.ym}</span>
                <span>{formatGestaoMoney(r.lucro)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lucro por marca (vendidos)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {lucroPorMarca.map(([m, l]) => (
              <div key={m} className="flex justify-between">
                <span>{m}</span>
                <span>{formatGestaoMoney(l)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Despesas por categoria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {despesasPorCat.map(([c, v]) => (
              <div key={c} className="flex justify-between">
                <span>{gestaoCategoriaLabel(c)}</span>
                <span>{formatGestaoMoney(v)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Giro de estoque</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{giro != null ? `${giro} dias (média)` : "—"}</p>
        </CardContent>
      </Card>
    </div>
  );
}
