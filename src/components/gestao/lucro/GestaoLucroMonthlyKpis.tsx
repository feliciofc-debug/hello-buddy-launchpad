import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";

type Props = {
  lucroMes: number;
  despesasMes: number;
  vendasMes: number;
  loading?: boolean;
};

export function GestaoLucroMonthlyKpis({ lucroMes, despesasMes, vendasMes, loading }: Props) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Lucro no mês (vendidos)
          </CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{formatGestaoMoney(lucroMes)}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Despesas no mês
          </CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{formatGestaoMoney(despesasMes)}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Vendas registradas no mês
          </CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">{vendasMes}</CardContent>
      </Card>
    </div>
  );
}
