import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Calendar,
  Megaphone,
  UserPlus
} from "lucide-react";
import { toast } from "sonner";

interface LeadCapturado {
  id: string;
  phone: string;
  nome: string | null;
  created_at: string;
}

export default function AfiliadoDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProdutos: 0,
    totalVendas: 0,
    valorVendas: 0,
    disparosAgendados: 0,
    campanhasDisparadas: 0,
    conversasAtivas: 0,
    whatsappConectado: false
  });
  const [leadsCapturados, setLeadsCapturados] = useState<LeadCapturado[]>([]);

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
      const [produtosRes, vendasRes, disparosRes, campanhasRes, clientesRes] = await Promise.all([
        supabase.from('afiliado_produtos').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('afiliado_vendas').select('valor').eq('user_id', user.id),
        supabase.from('afiliado_disparos').select('id', { count: 'exact' }).eq('user_id', user.id).eq('status', 'agendado'),
        // Campanhas já executadas (total_enviados > 0)
        supabase.from('afiliado_campanhas').select('id, total_enviados').eq('user_id', user.id),
        // Leads captados (últimos 30 dias) - usa leads_ebooks que é a tabela correta
        supabase.from('leads_ebooks')
          .select('id, phone, nome, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10)
      ]);

      const totalVendas = vendasRes.data?.length || 0;
      const valorVendas = vendasRes.data?.reduce((acc, v) => acc + Number(v.valor || 0), 0) || 0;
      const campanhasDisparadas = campanhasRes.data?.filter(c => (c.total_enviados || 0) > 0).length || 0;

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
        campanhasDisparadas,
        conversasAtivas: 0,
        whatsappConectado: !!cliente?.wuzapi_jid
      });

      // Mapear leads capturados
      const leads: LeadCapturado[] = (clientesRes.data || []).map(c => ({
        id: c.id,
        phone: c.phone,
        nome: c.nome,
        created_at: c.created_at
      }));
      setLeadsCapturados(leads);

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
      title: "Produtos Amazon", 
      icon: Package, 
      path: "/afiliado/produtos/amazon",
      description: "Produtos Amazon",
      color: "bg-orange-500"
    },
    { 
      title: "Produtos Magalu", 
      icon: Package, 
      path: "/afiliado/produtos/magalu",
      description: "Magazine Luiza",
      color: "bg-blue-500"
    },
    { 
      title: "Produtos M. Livre", 
      icon: Package, 
      path: "/afiliado/produtos/mercado-livre",
      description: "Mercado Livre",
      color: "bg-yellow-500"
    },
    { 
      title: "Produtos Boticário", 
      icon: Package, 
      path: "/afiliado/produtos/boticario",
      description: "O Boticário",
      color: "bg-pink-500"
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
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

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <Megaphone className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.campanhasDisparadas}</p>
                  <p className="text-xs text-muted-foreground">Campanhas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Leads Capturados */}
        {leadsCapturados.length > 0 && (
          <Card className="mb-8">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserPlus className="h-5 w-5 text-green-500" />
                Leads Capturados ({leadsCapturados.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-3">
                  {leadsCapturados.map((lead) => (
                    <div key={lead.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {lead.nome || 'Lead'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lead.phone}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

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
