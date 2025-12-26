import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, TrendingUp, Users, MousePointer, DollarSign, Eye, Clock, ShoppingCart, BarChart3 } from "lucide-react";

export default function Analytics() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("7days");

  // Dados zerados
  const metrics = {
    visitors: { value: 0, change: 0 },
    pageViews: { value: 0, change: 0 },
    avgSession: { value: "0m 0s", change: 0 },
    bounceRate: { value: "0%", change: 0 },
    conversions: { value: 0, change: 0 },
    revenue: { value: "R$ 0,00", change: 0 }
  };

  const topPages: { url: string; views: number; conversions: number }[] = [];

  const campaigns: { name: string; clicks: number; conversions: number; roi: string }[] = [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Button
              onClick={() => navigate('/dashboard')}
              variant="ghost"
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
              📊 Analytics Dashboard
            </h1>
            <p className="text-muted-foreground mt-2">
              Métricas e insights do Google Analytics
            </p>
          </div>

          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7days">Últimos 7 dias</SelectItem>
              <SelectItem value="30days">Últimos 30 dias</SelectItem>
              <SelectItem value="90days">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Main Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-8 h-8 text-blue-500" />
                <span className={`text-sm font-semibold ${metrics.visitors.change > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {metrics.visitors.change > 0 ? '+' : ''}{metrics.visitors.change}%
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Visitantes</p>
              <p className="text-3xl font-bold">{metrics.visitors.value.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Eye className="w-8 h-8 text-purple-500" />
                <span className={`text-sm font-semibold ${metrics.pageViews.change > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {metrics.pageViews.change > 0 ? '+' : ''}{metrics.pageViews.change}%
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Visualizações</p>
              <p className="text-3xl font-bold">{metrics.pageViews.value.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-8 h-8 text-orange-500" />
                <span className={`text-sm font-semibold ${metrics.avgSession.change > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {metrics.avgSession.change > 0 ? '+' : ''}{metrics.avgSession.change}%
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Tempo Médio</p>
              <p className="text-3xl font-bold">{metrics.avgSession.value}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <MousePointer className="w-8 h-8 text-red-500" />
                <span className={`text-sm font-semibold ${metrics.bounceRate.change < 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {metrics.bounceRate.change > 0 ? '+' : ''}{metrics.bounceRate.change}%
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Taxa de Rejeição</p>
              <p className="text-3xl font-bold">{metrics.bounceRate.value}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <ShoppingCart className="w-8 h-8 text-green-500" />
                <span className={`text-sm font-semibold ${metrics.conversions.change > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {metrics.conversions.change > 0 ? '+' : ''}{metrics.conversions.change}%
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Conversões</p>
              <p className="text-3xl font-bold">{metrics.conversions.value.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-8 h-8 text-emerald-500" />
                <span className={`text-sm font-semibold ${metrics.revenue.change > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {metrics.revenue.change > 0 ? '+' : ''}{metrics.revenue.change}%
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Receita</p>
              <p className="text-3xl font-bold">{metrics.revenue.value}</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Stats */}
        <Tabs defaultValue="pages" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="pages">Páginas Principais</TabsTrigger>
            <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
          </TabsList>

          <TabsContent value="pages">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Top Páginas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topPages.map((page, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-bold text-muted-foreground">#{index + 1}</span>
                        <div>
                          <p className="font-semibold">{page.url}</p>
                          <p className="text-sm text-muted-foreground">{page.views.toLocaleString()} visualizações</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">{page.conversions}</p>
                        <p className="text-xs text-muted-foreground">conversões</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="campaigns">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Performance de Campanhas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {campaigns.map((campaign, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                      <div>
                        <p className="font-semibold">{campaign.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {campaign.clicks.toLocaleString()} cliques • {campaign.conversions} conversões
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">{campaign.roi}</p>
                        <p className="text-xs text-muted-foreground">ROI</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Integration Info */}
        <Card className="mt-8 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
          <CardContent className="pt-6">
            <h3 className="font-bold text-lg mb-2">📌 Integração Google Analytics</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Para conectar sua conta do Google Analytics, acesse as configurações e adicione seu ID de medição (G-XXXXXXXXXX).
            </p>
            <Button onClick={() => navigate('/configuracoes')}>
              Configurar Integração
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}