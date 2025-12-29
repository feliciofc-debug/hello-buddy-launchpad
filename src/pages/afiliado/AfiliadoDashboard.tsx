import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  Send, 
  DollarSign, 
  MessageSquare, 
  Smartphone, 
  Sparkles, 
  BookOpen,
  TrendingUp,
  Users,
  Calendar
} from "lucide-react";
import { toast } from "sonner";

export default function AfiliadoDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProdutos: 0,
    totalVendas: 0,
    valorVendas: 0,
    disparosAgendados: 0,
    conversasAtivas: 0,
    whatsappConectado: false
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // Carregar estatísticas
      const [produtosRes, vendasRes, disparosRes] = await Promise.all([
        supabase.from('afiliado_produtos').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('afiliado_vendas').select('valor').eq('user_id', user.id),
        supabase.from('afiliado_disparos').select('id', { count: 'exact' }).eq('user_id', user.id).eq('status', 'agendado')
      ]);

      const totalVendas = vendasRes.data?.length || 0;
      const valorVendas = vendasRes.data?.reduce((acc, v) => acc + Number(v.valor || 0), 0) || 0;

      // Verificar conexão WhatsApp
      const { data: cliente } = await supabase
        .from('clientes_afiliados')
        .select('wuzapi_jid, status')
        .eq('user_id', user.id)
        .single();

      setStats({
        totalProdutos: produtosRes.count || 0,
        totalVendas,
        valorVendas,
        disparosAgendados: disparosRes.count || 0,
        conversasAtivas: 0,
        whatsappConectado: !!cliente?.wuzapi_jid
      });
    } catch (error) {
      console.error('Erro ao carregar stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    { 
      title: "Conectar Celular", 
      icon: Smartphone, 
      path: "/afiliado/conectar-celular",
      description: "Conecte seu WhatsApp",
      color: "bg-green-500"
    },
    { 
      title: "WhatsApp", 
      icon: MessageSquare, 
      path: "/afiliado/whatsapp",
      description: "Enviar mensagens",
      color: "bg-emerald-500"
    },
    { 
      title: "IA Marketing", 
      icon: Sparkles, 
      path: "/afiliado/ia-marketing",
      description: "Gerar posts com IA",
      color: "bg-purple-500"
    },
    { 
      title: "Produtos", 
      icon: Package, 
      path: "/afiliado/produtos",
      description: "Gerenciar produtos",
      color: "bg-orange-500"
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">AMZ Ofertas Afiliados</h1>
          <p className="text-muted-foreground mt-1">Painel de controle</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <Package className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalProdutos}</p>
                  <p className="text-xs text-muted-foreground">Produtos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalVendas}</p>
                  <p className="text-xs text-muted-foreground">Vendas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">R$ {stats.valorVendas.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Faturamento</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Calendar className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.disparosAgendados}</p>
                  <p className="text-xs text-muted-foreground">Agendados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status WhatsApp */}
        <Card className={`mb-8 ${stats.whatsappConectado ? 'border-green-500' : 'border-yellow-500'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stats.whatsappConectado ? 'bg-green-100 dark:bg-green-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'}`}>
                  <Smartphone className={`h-5 w-5 ${stats.whatsappConectado ? 'text-green-500' : 'text-yellow-500'}`} />
                </div>
                <div>
                  <p className="font-medium">WhatsApp</p>
                  <p className={`text-sm ${stats.whatsappConectado ? 'text-green-500' : 'text-yellow-500'}`}>
                    {stats.whatsappConectado ? 'Conectado' : 'Não conectado'}
                  </p>
                </div>
              </div>
              {!stats.whatsappConectado && (
                <Button onClick={() => navigate('/afiliado/conectar-celular')} size="sm">
                  Conectar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Menu Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {menuItems.map((item) => (
            <Card 
              key={item.path}
              className="cursor-pointer hover:shadow-lg transition-all hover:scale-105"
              onClick={() => navigate(item.path)}
            >
              <CardContent className="p-6 text-center">
                <div className={`w-12 h-12 mx-auto mb-3 rounded-xl ${item.color} flex items-center justify-center`}>
                  <item.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Logout */}
        <div className="mt-8 text-center">
          <Button 
            variant="outline" 
            onClick={async () => {
              await supabase.auth.signOut();
              navigate('/login');
            }}
          >
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
