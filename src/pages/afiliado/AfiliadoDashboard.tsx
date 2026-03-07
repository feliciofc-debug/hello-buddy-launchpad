import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AfiliadoLayout } from "@/components/afiliado/AfiliadoLayout";
import {
  Package,
  DollarSign,
  TrendingUp,
  Megaphone,
  Send,
  Sparkles,
  Eye,
  CheckCircle,
  XCircle,
  Smartphone,
} from "lucide-react";

export default function AfiliadoDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProdutos: 0,
    totalVendas: 0,
    valorVendas: 0,
    campanhasAtivas: 0,
    whatsappConectado: false,
  });
  const [campanhas, setCampanhas] = useState<any[]>([]);
  const [ultimosEnvios, setUltimosEnvios] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }

      const [produtosRes, vendasRes, campanhasRes, enviosRes, clienteRes] = await Promise.all([
        supabase.from("afiliado_produtos").select("id", { count: "exact" }).eq("user_id", user.id),
        supabase.from("afiliado_vendas").select("valor").eq("user_id", user.id),
        supabase.from("afiliado_campanhas").select("id, nome, status, ativa, total_enviados, proxima_execucao, produto_id").eq("user_id", user.id).eq("ativa", true).order("created_at", { ascending: false }).limit(5),
        supabase.from("historico_envios").select("id, whatsapp, tipo, mensagem, sucesso, erro, timestamp").order("timestamp", { ascending: false }).limit(5),
        supabase.from("clientes_afiliados").select("wuzapi_jid, status").eq("user_id", user.id).maybeSingle(),
      ]);

      const totalVendas = vendasRes.data?.length || 0;
      const valorVendas = vendasRes.data?.reduce((acc, v) => acc + Number(v.valor || 0), 0) || 0;

      setStats({
        totalProdutos: produtosRes.count || 0,
        totalVendas,
        valorVendas,
        campanhasAtivas: campanhasRes.data?.length || 0,
        whatsappConectado: !!clienteRes.data?.wuzapi_jid,
      });

      setCampanhas(campanhasRes.data || []);
      setUltimosEnvios((enviosRes.data || []) as any[]);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AfiliadoLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </AfiliadoLayout>
    );
  }

  const metricCards = [
    { label: "Produtos", value: stats.totalProdutos, icon: Package, color: "text-orange-500", bg: "bg-orange-100 dark:bg-orange-900/30" },
    { label: "Vendas", value: stats.totalVendas, icon: DollarSign, color: "text-green-500", bg: "bg-green-100 dark:bg-green-900/30" },
    { label: "Faturamento", value: `R$ ${stats.valorVendas.toFixed(0)}`, icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30" },
    { label: "Campanhas Ativas", value: stats.campanhasAtivas, icon: Megaphone, color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-900/30" },
  ];

  return (
    <AfiliadoLayout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">AMZ Ofertas Afiliados</h1>
            <p className="text-sm text-muted-foreground">Painel de controle</p>
          </div>
          <Badge
            variant={stats.whatsappConectado ? "default" : "secondary"}
            className="gap-1.5"
          >
            <Smartphone className="h-3.5 w-3.5" />
            {stats.whatsappConectado ? "WhatsApp conectado" : "WhatsApp desconectado"}
          </Badge>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {metricCards.map((m) => (
            <Card key={m.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${m.bg}`}>
                  <m.icon className={`h-5 w-5 ${m.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{m.value}</p>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Campanhas Ativas + Últimos Envios */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Campanhas Ativas */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-purple-500" />
                Campanhas Ativas
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/afiliado/campanhas")}>
                Ver Todas
              </Button>
            </CardHeader>
            <CardContent>
              {campanhas.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma campanha ativa</p>
              ) : (
                <div className="space-y-3">
                  {campanhas.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{c.nome}</p>
                        <p className="text-xs text-muted-foreground">{c.total_enviados || 0} enviados</p>
                      </div>
                      <Badge variant={c.ativa ? "default" : "secondary"} className="text-xs">
                        {c.ativa ? "Ativa" : "Pausada"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Últimos Envios */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4 text-green-500" />
                Últimos Envios
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ultimosEnvios.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum envio registrado</p>
              ) : (
                <div className="space-y-3">
                  {ultimosEnvios.map((e) => (
                    <div key={e.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{e.whatsapp}</p>
                        <p className="text-xs text-muted-foreground truncate">{e.mensagem?.slice(0, 50)}...</p>
                      </div>
                      {e.sucesso ? (
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-4">
          <Button
            variant="outline"
            className="h-auto py-6 flex flex-col gap-2"
            onClick={() => navigate("/afiliado/whatsapp")}
          >
            <Send className="h-6 w-6 text-green-500" />
            <span className="text-sm font-medium">Novo Envio</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-6 flex flex-col gap-2"
            onClick={() => navigate("/afiliado/ia-marketing")}
          >
            <Sparkles className="h-6 w-6 text-purple-500" />
            <span className="text-sm font-medium">Gerar Post com IA</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-6 flex flex-col gap-2"
            onClick={() => navigate("/afiliado/produtos")}
          >
            <Eye className="h-6 w-6 text-orange-500" />
            <span className="text-sm font-medium">Ver Produtos</span>
          </Button>
        </div>
      </div>
    </AfiliadoLayout>
  );
}
