import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  DollarSign,
  Eye,
  Loader2,
  MessageCircle,
  MousePointerClick,
  RefreshCw,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Period = "hoje" | "ontem" | "7_dias" | "30_dias" | "este_mes";

type DashboardData = {
  ok: true;
  cached: boolean;
  account: { id: string; name: string | null; currency: string };
  has_data: boolean;
  summary: {
    spend: number;
    impressions: number;
    reach: number;
    frequency: number;
    clicks: number;
    ctr: number;
    cpc: number;
    cpm: number;
    conversations: number | null;
    leads: number | null;
    purchases: number | null;
    roas: number | null;
    results: number | null;
    cost_per_result: number | null;
  } | null;
  daily: Array<{
    date: string;
    spend: number;
    clicks: number;
    conversations: number;
  }>;
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    spend: number;
    clicks: number;
    ctr: number;
    cpc: number;
    results: number | null;
    cost_per_result: number | null;
  }>;
};

type DashboardError = {
  ok: false;
  code: string;
  message: string;
};

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "7_dias", label: "7 dias" },
  { value: "30_dias", label: "30 dias" },
  { value: "este_mes", label: "Este mês" },
];

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value ?? 0);

const integer = (value: number | null | undefined) =>
  Math.round(value ?? 0).toLocaleString("pt-BR");

const decimal = (value: number | null | undefined) =>
  (value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  ARCHIVED: "Arquivada",
  DELETED: "Excluída",
  CAMPAIGN_PAUSED: "Pausada",
  ADSET_PAUSED: "Conjunto pausado",
};

export default function MetaAdsDashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("7_dias");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<DashboardError | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: response, error: invokeError } =
        await supabase.functions.invoke("meta-ads-insights", {
          body: { period },
        });
      if (invokeError) throw invokeError;
      if (!response?.ok) {
        setData(null);
        setError(response as DashboardError);
      } else {
        setData(response as DashboardData);
      }
    } catch {
      setData(null);
      setError({
        ok: false,
        code: "request_failed",
        message: "Não foi possível carregar os anúncios agora.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [period]);

  const metrics = data?.summary;
  const cards = metrics
    ? [
      { label: "Gasto", value: money(metrics.spend), icon: DollarSign },
      { label: "Alcance", value: integer(metrics.reach), icon: Users },
      {
        label: "Impressões",
        value: integer(metrics.impressions),
        icon: Eye,
      },
      { label: "Cliques", value: integer(metrics.clicks), icon: MousePointerClick },
      { label: "CTR", value: `${decimal(metrics.ctr)}%`, icon: TrendingUp },
      { label: "CPC", value: money(metrics.cpc), icon: BarChart3 },
      {
        label: "Conversas",
        value: metrics.conversations === null
          ? "—"
          : integer(metrics.conversations),
        icon: MessageCircle,
      },
      {
        label: "Custo por resultado",
        value: metrics.cost_per_result === null
          ? "—"
          : money(metrics.cost_per_result),
        icon: DollarSign,
      },
      ...(metrics.leads === null
        ? []
        : [{ label: "Leads", value: integer(metrics.leads), icon: Users }]),
      ...(metrics.purchases === null
        ? []
        : [{
          label: "Compras",
          value: integer(metrics.purchases),
          icon: TrendingUp,
        }]),
      ...(metrics.roas === null
        ? []
        : [{
          label: "ROAS",
          value: `${decimal(metrics.roas)}x`,
          icon: TrendingUp,
        }]),
    ]
    : [];

  const chartData = (data?.daily ?? []).map((item) => ({
    ...item,
    label: item.date
      ? new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      })
      : "",
  }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Button
              variant="ghost"
              className="mb-2 -ml-3"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Anúncios Meta
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Métricas somente leitura da conta{" "}
              {data?.account.name || data?.account.id || "selecionada"}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as Period)}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            >
              {PERIODS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw
                className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Atualizar
            </Button>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-16 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              Carregando métricas...
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <p className="font-medium">{error.message}</p>
              {[
                "not_connected",
                "account_not_selected",
                "token_expired",
                "permission",
              ].includes(error.code) && (
                <Button onClick={() => navigate("/configuracoes")}>
                  <Settings className="w-4 h-4 mr-2" />
                  Ir para Configurações
                </Button>
              )}
            </CardContent>
          </Card>
        ) : data && !data.has_data ? (
          <Card>
            <CardContent className="py-16 text-center">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-lg font-semibold">Nenhum anúncio no período</p>
              <p className="text-sm text-muted-foreground mt-1">
                Selecione outro período para consultar.
              </p>
            </CardContent>
          </Card>
        ) : data && metrics ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {cards.map((card) => (
                <Card key={card.label}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {card.label}
                      </p>
                      <card.icon className="w-4 h-4 text-blue-600" />
                    </div>
                    <p className="text-2xl font-bold mt-2">{card.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Gasto x conversas por dia</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis
                          yAxisId="money"
                          tickFormatter={(value) => `R$ ${value}`}
                        />
                        <YAxis
                          yAxisId="results"
                          orientation="right"
                          allowDecimals={false}
                        />
                        <Tooltip
                          formatter={(value: number, name: string) =>
                            name === "Gasto"
                              ? [money(value), name]
                              : [integer(value), name]}
                        />
                        <Legend />
                        <Line
                          yAxisId="money"
                          type="monotone"
                          dataKey="spend"
                          name="Gasto"
                          stroke="#2563eb"
                          strokeWidth={2}
                        />
                        <Line
                          yAxisId="results"
                          type="monotone"
                          dataKey="conversations"
                          name="Conversas"
                          stroke="#16a34a"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="py-12 text-center text-muted-foreground">
                    Sem série diária para este período.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Campanhas</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {data.campaigns.length ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-3 pr-4">Campanha</th>
                        <th className="py-3 pr-4">Status</th>
                        <th className="py-3 pr-4 text-right">Gasto</th>
                        <th className="py-3 pr-4 text-right">Cliques</th>
                        <th className="py-3 pr-4 text-right">CTR</th>
                        <th className="py-3 pr-4 text-right">CPC</th>
                        <th className="py-3 pr-4 text-right">Resultados</th>
                        <th className="py-3 text-right">Custo/resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.campaigns.map((campaign) => (
                        <tr key={campaign.id} className="border-b last:border-0">
                          <td className="py-3 pr-4 font-medium">
                            {campaign.name}
                          </td>
                          <td className="py-3 pr-4">
                            <Badge
                              variant={campaign.status === "ACTIVE"
                                ? "default"
                                : "secondary"}
                            >
                              {STATUS_LABELS[campaign.status] || campaign.status}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4 text-right">
                            {money(campaign.spend)}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            {integer(campaign.clicks)}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            {decimal(campaign.ctr)}%
                          </td>
                          <td className="py-3 pr-4 text-right">
                            {money(campaign.cpc)}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            {campaign.results === null
                              ? "—"
                              : integer(campaign.results)}
                          </td>
                          <td className="py-3 text-right">
                            {campaign.cost_per_result === null
                              ? "—"
                              : money(campaign.cost_per_result)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="py-8 text-center text-muted-foreground">
                    Nenhuma campanha com entrega no período.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
