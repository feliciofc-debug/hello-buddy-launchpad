import { Fragment, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import type { GestaoVeiculoEnriched } from "@/lib/gestao-lucro-types.ts";
import { vehicleDays, vehicleLabel } from "@/lib/gestao-lucro-data.ts";
import {
  formatGestaoMoney,
  formatGestaoPct,
  gestaoLucroTone,
} from "@/lib/gestao-format.ts";
import { GestaoVendaRaioXPanel } from "@/components/gestao/lucro/GestaoVendaRaioXPanel.tsx";

function monthBounds(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

type Props = {
  veiculos: GestaoVeiculoEnriched[];
  periodStart?: string;
  periodEnd?: string;
};

export function GestaoLucroVendidosTab({ veiculos, periodStart, periodEnd }: Props) {
  const defaults = monthBounds();
  const [start, setStart] = useState(periodStart ?? defaults.start);
  const [end, setEnd] = useState(periodEnd ?? defaults.end);

  const sold = useMemo(() => {
    return veiculos.filter((v) => {
      if (!v.dataVenda) return false;
      return v.dataVenda >= start && v.dataVenda <= end;
    });
  }, [veiculos, start, end]);

  const totals = useMemo(() => {
    let lucro = 0;
    let venda = 0;
    for (const v of sold) {
      venda += v.valorVenda ?? 0;
      lucro += v.lucro.lucroLiquido ?? 0;
    }
    return { lucro, venda, qtd: sold.length };
  }, [sold]);

  if (!sold.length) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          Nenhuma venda no período. Registre vendas na aba Estoque ou na gaveta de detalhes.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-3">Veículo</th>
              <th className="pb-2 pr-3">Data venda</th>
              <th className="pb-2 pr-3">Valor</th>
              <th className="pb-2 pr-3">Lucro</th>
              <th className="pb-2 pr-3">Margem</th>
              <th className="pb-2 pr-3">Dias estoque</th>
              <th className="pb-2">Vendedor</th>
            </tr>
          </thead>
          <tbody>
            {sold.map((v) => (
              <Fragment key={v.id}>
                <tr className="border-b">
                  <td className="py-2 pr-3 font-medium">{vehicleLabel(v)}</td>
                  <td className="py-2 pr-3">{v.dataVenda}</td>
                  <td className="py-2 pr-3">{formatGestaoMoney(v.valorVenda)}</td>
                  <td className={`py-2 pr-3 ${gestaoLucroTone(v.lucro.lucroLiquido)}`}>
                    {formatGestaoMoney(v.lucro.lucroLiquido)}
                  </td>
                  <td className={`py-2 pr-3 ${gestaoLucroTone(v.lucro.margemPct)}`}>
                    {formatGestaoPct(v.lucro.margemPct)}
                  </td>
                  <td className="py-2 pr-3">{v.lucro.diasEstoque ?? vehicleDays(v)}</td>
                  <td className="py-2">{v.vendedor ?? "—"}</td>
                </tr>
                <tr className="border-b bg-muted/20">
                  <td colSpan={7} className="p-3">
                    <GestaoVendaRaioXPanel
                      compact
                      valorVenda={v.valorVenda}
                      valorCompra={v.valorCompra}
                      despesas={v.despesas.map((d) => ({
                        valor: Number(d.valor),
                        categoria: d.categoria,
                      }))}
                    />
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-medium">
              <td colSpan={2} className="py-2">Totais ({totals.qtd})</td>
              <td className="py-2">{formatGestaoMoney(totals.venda)}</td>
              <td className={`py-2 ${gestaoLucroTone(totals.lucro)}`}>{formatGestaoMoney(totals.lucro)}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
