import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Rocket, Play, Pause, Edit, Copy, Trash2, TrendingUp, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Campanhas = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPosts();
    loadCampaigns();
  }, []);

  const loadPosts = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedPosts = data.map(post => ({
        id: post.id,
        title: post.titulo,
        image: post.imagem_url || '/placeholder.svg',
        type: 'Post',
        network: 'Instagram',
        dataCriacao: new Date(post.created_at).toLocaleDateString('pt-BR')
      }));

      setPosts(formattedPosts);
    } catch (error) {
      console.error("Erro ao carregar posts:", error);
    }
  };

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await supabase
        .from('campanhas')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedCampaigns = data.map(camp => {
        const metricas = camp.metricas as any;
        return {
          id: camp.id,
          name: camp.nome,
          status: camp.status === 'ativa' ? 'Ativa' : 'Pausada',
          impressions: metricas?.impressoes || '0',
          clicks: metricas?.cliques || '0',
          ctr: metricas?.ctr || '0%',
          spent: `R$ ${camp.orcamento || '0,00'}`
        };
      });

      setCampaigns(formattedCampaigns);
    } catch (error) {
      console.error("Erro ao carregar campanhas:", error);
    } finally {
      setLoading(false);
    }
  };

  const togglePost = (postId: string) => {
    setSelectedPosts(prev => 
      prev.includes(postId) ? prev.filter(id => id !== postId) : [...prev, postId]
    );
  };

  if (currentStep === 0) {
    // Dashboard de Campanhas
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="mr-2" size={18} />
                Voltar
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Campanhas</h1>
                <p className="text-muted-foreground">Gerencie suas campanhas de marketing</p>
              </div>
            </div>
            <Button 
              onClick={() => {
                if (selectedPosts.length === 0) {
                  toast.error("Selecione pelo menos um post para criar a campanha");
                  return;
                }
                navigate('/google-ads', { state: { selectedPosts } });
              }}
              size="lg"
            >
              <Rocket className="mr-2" />
              Nova Campanha
            </Button>
          </div>

          {/* Métricas Gerais */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Campanhas Ativas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{campaigns.filter(c => c.status === 'Ativa').length}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Posts Disponíveis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{posts.length}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Posts Selecionados</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{selectedPosts.length}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Campanhas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{campaigns.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Seleção de Posts */}
          <Card>
            <CardHeader>
              <CardTitle>Selecione os Posts para a Campanha</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {posts.map((post) => (
                  <Card 
                    key={post.id} 
                    className={`cursor-pointer transition-all hover:shadow-lg ${selectedPosts.includes(post.id) ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => togglePost(post.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox checked={selectedPosts.includes(post.id)} />
                        <div className="flex-1">
                          <img src={post.image} alt={post.title} className="w-full h-32 object-cover rounded mb-2" />
                          <h4 className="font-medium text-sm mb-1">{post.title}</h4>
                          <div className="flex gap-2">
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">{post.type}</span>
                            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">{post.network}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {posts.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum post encontrado. Crie posts usando a IA Marketing primeiro.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Lista de Campanhas */}
          <Card>
            <CardHeader>
              <CardTitle>Campanhas Criadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">{campaign.name}</h3>
                        <span className={`text-xs px-2 py-1 rounded ${campaign.status === 'Ativa' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {campaign.status}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          {campaign.status === 'Ativa' ? <Pause size={16} /> : <Play size={16} />}
                        </Button>
                        <Button size="sm" variant="outline">
                          <Edit size={16} />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Impressões</p>
                        <p className="font-semibold">{campaign.impressions}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cliques</p>
                        <p className="font-semibold">{campaign.clicks}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">CTR</p>
                        <p className="font-semibold">{campaign.ctr}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Gasto</p>
                        <p className="font-semibold">{campaign.spent}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {campaigns.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma campanha criada ainda. Crie sua primeira campanha!
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
};

export default Campanhas;