import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GestaoDespesaRow, GestaoVeiculoEnriched } from "@/lib/gestao-lucro-types.ts";
import { vehicleLabel } from "@/lib/gestao-lucro-data.ts";
import { GESTAO_DESPESA_CATEGORIAS, gestaoCategoriaLabel } from "@/lib/gestao-lucro-categories.ts";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";

type Props = {
  despesas: GestaoDespesaRow[];
  veiculos: GestaoVeiculoEnriched[];
};

export function GestaoLucroDespesasTab({ despesas, veiculos }: Props) {
  const [cat, setCat] = useState<string>("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const byId = useMemo(() => new Map(veiculos.map((v) => [v.id, v])), [veiculos]);

  const filtered = useMemo(() => {
    return despesas.filter((d) => {
      if (cat !== "all" && d.categoria !== cat) return false;
      if (start && d.data < start) return false;
      if (end && d.data > end) return false;
      return true;
    });
  }, [despesas, cat, start, end]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of filtered) {
      map.set(d.categoria, (map.get(d.categoria) ?? 0) + Number(d.valor));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const total = filtered.reduce((a, d) => a + Number(d.valor), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {GESTAO_DESPESA_CATEGORIAS.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total filtrado</p>
          <p className="text-2xl font-bold">{formatGestaoMoney(total)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="mb-2 text-sm font-medium">Por categoria</p>
          <ul className="space-y-1 text-sm">
            {byCategory.map(([c, v]) => (
              <li key={c} className="flex justify-between">
                <span>{gestaoCategoriaLabel(c)}</span>
                <span>{formatGestaoMoney(v)}</span>
              </li>
            ))}
            {!byCategory.length && (
              <li className="text-muted-foreground">Nenhuma despesa no filtro.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-3">Data</th>
              <th className="pb-2 pr-3">Veículo</th>
              <th className="pb-2 pr-3">Categoria</th>
              <th className="pb-2 pr-3">Valor</th>
              <th className="pb-2">Origem</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const v = byId.get(d.veiculo_id);
              return (
                <tr key={d.id} className="border-b">
                  <td className="py-2 pr-3">{d.data}</td>
                  <td className="py-2 pr-3">{v ? vehicleLabel(v) : d.veiculo_id.slice(0, 8)}</td>
                  <td className="py-2 pr-3">{gestaoCategoriaLabel(d.categoria)}</td>
                  <td className="py-2 pr-3">{formatGestaoMoney(Number(d.valor))}</td>
                  <td className="py-2">{d.origem_lancamento}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
