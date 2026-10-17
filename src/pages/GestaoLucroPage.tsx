import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CarFront, Download, Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calcGestaoLucro } from "../../supabase/functions/_shared/gestao-lucro-calc.ts";
import { formatGestaoMoney, formatGestaoPct } from "@/lib/gestao-format.ts";
import { supabase } from "@/integrations/supabase/client";

type VeiculoRow = {
  id: string;
  marca: string;
  modelo: string;
  versao: string | null;
  preco: number | null;
  status: string;
};

type RankRow = {
  veiculo: VeiculoRow;
  investido: number;
  lucroLiquido: number | null;
  lucroProjetado: number | null;
  margemPct: number | null;
  vendido: boolean;
};

function monthBounds(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export default function GestaoLucroPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RankRow[]>([]);
  const [despesasMes, setDespesasMes] = useState(0);
  const { start, end } = monthBounds();

  const load = useCallback(async () => {
    setLoading(true);
    const { data: session } = await supabase.auth.getSession();
    const user = session.session?.user;
    if (!user) {
      navigate("/login");
      return;
    }

    const [{ data: veiculos }, { data: compras }, { data: despesas }, { data: vendas }] =
      await Promise.all([
        supabase.from("veiculos_estoque").select("id, marca, modelo, versao, preco, status")
          .eq("user_id", user.id),
        supabase.from("veiculo_compra" as "veiculos_estoque").select("veiculo_id, valor_compra, data_compra")
          .eq("user_id", user.id),
        supabase.from("veiculo_despesas" as "veiculos_estoque")
          .select("veiculo_id, valor, data, categoria")
          .eq("user_id", user.id)
          .is("deleted_at", null),
        supabase.from("veiculo_venda" as "veiculos_estoque").select("veiculo_id, valor_venda, data_venda")
          .eq("user_id", user.id),
      ]);

    const compraBy = new Map(
      (compras ?? []).map((c: { veiculo_id: string; valor_compra: number; data_compra: string }) => [
        c.veiculo_id,
        c,
      ]),
    );
    const vendaBy = new Map(
      (vendas ?? []).map((v: { veiculo_id: string; valor_venda: number; data_venda: string }) => [
        v.veiculo_id,
        v,
      ]),
    );
    const despesasBy = new Map<string, Array<{ valor: number; categoria: string }>>();
    let despesasNoMes = 0;
    for (const d of despesas ?? []) {
      const line = d as { veiculo_id: string; valor: number; data: string; categoria: string };
      const list = despesasBy.get(line.veiculo_id) ?? [];
      list.push({ valor: Number(line.valor), categoria: line.categoria });
      despesasBy.set(line.veiculo_id, list);
      if (line.data >= start && line.data <= end) {
        despesasNoMes += Number(line.valor) || 0;
      }
    }

    const ranked: RankRow[] = (veiculos ?? []).map((v) => {
      const veiculo = v as VeiculoRow;
      const compra = compraBy.get(veiculo.id);
      const venda = vendaBy.get(veiculo.id);
      const dList = despesasBy.get(veiculo.id) ?? [];
      const lucro = calcGestaoLucro({
        valorCompra: compra ? Number(compra.valor_compra) : null,
        despesas: dList,
        valorVenda: venda ? Number(venda.valor_venda) : null,
        precoAnunciado: veiculo.preco,
        dataCompra: compra?.data_compra ?? null,
        dataVenda: venda?.data_venda ?? null,
        statusVeiculo: veiculo.status,
      });
      return {
        veiculo,
        investido: lucro.investido,
        lucroLiquido: lucro.lucroLiquido,
        lucroProjetado: lucro.lucroProjetado,
        margemPct: lucro.margemPct,
        vendido: lucro.vendido,
      };
    });

    ranked.sort((a, b) => {
      const av = a.lucroLiquido ?? a.lucroProjetado ?? -Infinity;
      const bv = b.lucroLiquido ?? b.lucroProjetado ?? -Infinity;
      return bv - av;
    });

    setRows(ranked);
    setDespesasMes(despesasNoMes);
    setLoading(false);
  }, [navigate, start, end]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(() => {
    let lucroMes = 0;
    let vendasMes = 0;
    for (const row of rows) {
      const venda = row.vendido ? row.lucroLiquido : null;
      if (venda != null) {
        lucroMes += venda;
        vendasMes += 1;
      }
    }
    return { lucroMes, vendasMes, despesasMes };
  }, [rows, despesasMes]);

  const exportCsv = () => {
    const header = [
      "marca",
      "modelo",
      "versao",
      "status",
      "investido",
      "lucro_liquido",
      "lucro_projetado",
      "margem_pct",
    ].join(",");
    const lines = rows.map((r) => {
      return [
        escapeCsv(r.veiculo.marca),
        escapeCsv(r.veiculo.modelo),
        escapeCsv(r.veiculo.versao ?? ""),
        escapeCsv(r.veiculo.status),
        String(r.investido),
        r.lucroLiquido != null ? String(r.lucroLiquido) : "",
        r.lucroProjetado != null ? String(r.lucroProjetado) : "",
        r.margemPct != null ? r.margemPct.toFixed(2) : "",
      ].join(",");
    });
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gestao-lucro-${start}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado.");
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
                Visão interna por veículo · {start} a {end}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/veiculos")}>
              <CarFront className="mr-2 h-4 w-4" />
              Estoque
            </Button>
            <Button variant="outline" onClick={exportCsv} disabled={loading || !rows.length}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Lucro (veículos vendidos)
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">
                  {formatGestaoMoney(kpis.lucroMes)}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Despesas no mês
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">
                  {formatGestaoMoney(kpis.despesasMes)}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Veículos com venda registrada
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">{kpis.vendasMes}</CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Ranking por lucro</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4">Veículo</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Investido</th>
                      <th className="pb-2 pr-4">Lucro</th>
                      <th className="pb-2">Margem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.veiculo.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">
                          {[r.veiculo.marca, r.veiculo.modelo, r.veiculo.versao]
                            .filter(Boolean)
                            .join(" ")}
                        </td>
                        <td className="py-2 pr-4 capitalize">{r.veiculo.status}</td>
                        <td className="py-2 pr-4">{formatGestaoMoney(r.investido)}</td>
                        <td className="py-2 pr-4">
                          {r.vendido
                            ? formatGestaoMoney(r.lucroLiquido)
                            : formatGestaoMoney(r.lucroProjetado)}
                        </td>
                        <td className="py-2">{formatGestaoPct(r.margemPct)}</td>
                      </tr>
                    ))}
                    {!rows.length && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          Nenhum veículo no estoque.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
