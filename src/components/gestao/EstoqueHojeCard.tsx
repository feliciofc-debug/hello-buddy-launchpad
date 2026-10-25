import { Link } from "react-router-dom";
import { CarFront, ChevronRight } from "lucide-react";
import type { GestaoEstoqueSnapshot } from "@/lib/gestao-estoque-load.ts";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const MARCA_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-cyan-500",
];

type Props = {
  snapshot: GestaoEstoqueSnapshot;
  showDetailLink?: boolean;
  compact?: boolean;
};

export function EstoqueHojeCard({ snapshot, showDetailLink, compact }: Props) {
  const { totais, porStatus, porIdade, porMarca, custoPendente } = snapshot;
  const topMarcas = porMarca.slice(0, 6);
  const maxMarcaVenda = topMarcas[0]?.valorVenda ?? 1;

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CarFront className="h-5 w-5 text-primary" />
            Estoque hoje
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Disponível, reservado e em preparação — uso interno da loja
          </p>
        </div>
        {showDetailLink && (
          <Button variant="outline" size="sm" asChild>
            <Link to="/gestao/lucro">
              Ver gestão completa
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric
            label="Valor total anunciado"
            hint="Quanto o estoque vale à venda hoje"
            value={formatGestaoMoney(totais.valorVenda)}
          />
          <Metric
            label="Custo total investido"
            hint="Compra + despesas nos carros ativos"
            value={formatGestaoMoney(totais.valorCusto)}
          />
          <Metric
            label="Lucro projetado"
            hint="Diferença entre venda e custo"
            value={formatGestaoMoney(totais.lucroProjetado)}
            highlight
          />
        </div>

        {custoPendente.quantidade > 0 && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            {custoPendente.quantidade} carro(s) com custo pendente (
            {formatGestaoMoney(custoPendente.valorAnunciado)} anunciados) — não entram no
            custo investido nem no lucro projetado até informar a compra.
          </p>
        )}

        {!compact && (
          <>
            <div>
              <h4 className="mb-2 text-sm font-medium">Por status</h4>
              <div className="grid gap-2 sm:grid-cols-3">
                <StatusBlock title="Disponível" data={porStatus.disponivel} />
                <StatusBlock title="Reservado" data={porStatus.reservado} />
                <StatusBlock title="Em preparação" data={porStatus.em_preparacao} />
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-medium">Idade do estoque (dinheiro parado)</h4>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-3">Faixa (dias)</th>
                      <th className="pb-2 pr-3">Qtd.</th>
                      <th className="pb-2 pr-3">Valor venda</th>
                      <th className="pb-2">Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porIdade.map((row) => (
                      <tr key={row.faixa} className="border-b last:border-0">
                        <td className="py-1.5 pr-3 font-medium">{row.faixa}</td>
                        <td className="py-1.5 pr-3">{row.quantidade}</td>
                        <td className="py-1.5 pr-3">{formatGestaoMoney(row.valorVenda)}</td>
                        <td className="py-1.5">{formatGestaoMoney(row.valorCusto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-medium">Composição por marca</h4>
              {topMarcas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum veículo ativo no estoque.</p>
              ) : (
                <ul className="space-y-2">
                  {topMarcas.map((m, i) => (
                    <li key={m.marca} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium">{m.marca}</span>
                        <span className="text-muted-foreground">
                          {m.quantidade} · {formatGestaoMoney(m.valorVenda)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full ${MARCA_COLORS[i % MARCA_COLORS.length]}`}
                          style={{ width: `${Math.max(4, (m.valorVenda / maxMarcaVenda) * 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        <p className="text-xs text-muted-foreground">
          {totais.quantidade} veículo(s) ativos (disponível + reservado).
        </p>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  hint,
  value,
  highlight,
}: {
  label: string;
  hint: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold ${highlight ? "text-primary" : ""}`}>{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function StatusBlock({
  title,
  data,
}: {
  title: string;
  data: { quantidade: number; valorVenda: number; valorCusto: number };
}) {
  return (
    <div className="rounded-lg border p-3 text-sm">
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground">{data.quantidade} veículo(s)</p>
      <p>Venda: {formatGestaoMoney(data.valorVenda)}</p>
      <p>Custo: {formatGestaoMoney(data.valorCusto)}</p>
    </div>
  );
}
