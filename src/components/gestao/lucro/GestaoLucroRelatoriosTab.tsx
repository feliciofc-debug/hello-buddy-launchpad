import { useMemo } from "react";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GestaoVeiculoEnriched } from "@/lib/gestao-lucro-types.ts";
import { gestaoCategoriaLabel } from "@/lib/gestao-lucro-categories.ts";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";
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

export function GestaoLucroRelatoriosTab({ veiculos }: Props) {
  const months = last12Months();

  const lucroPorMes = useMemo(() => {
    return months.map((ym) => {
      const [y, m] = ym.split("-").map(Number);
      const start = `${ym}-01`;
      const end = new Date(y, m, 0).toISOString().slice(0, 10);
      let lucro = 0;
      for (const v of veiculos) {
        if (!v.dataVenda || v.dataVenda < start || v.dataVenda > end) continue;
        lucro += v.lucro.lucroLiquido ?? 0;
      }
      return { ym, lucro };
    });
  }, [veiculos, months]);

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
      "marca,lucro",
      ...lucroPorMarca.map(([m, l]) => `${m},${l}`),
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
    doc.text("Lucro por mês (12 meses)", 14, y);
    y += 6;
    for (const row of lucroPorMes) {
      doc.text(`${row.ym}: ${formatGestaoMoney(row.lucro)}`, 18, y);
      y += 5;
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
            {!lucroPorMarca.length && (
              <p className="text-muted-foreground">Sem vendas com lucro calculado.</p>
            )}
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
          <p className="text-sm text-muted-foreground">
            Média de dias entre compra e venda nos veículos vendidos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
