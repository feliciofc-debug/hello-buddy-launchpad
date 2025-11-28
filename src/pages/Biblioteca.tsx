import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft, Search, Repeat, Trash2, Download, 
  TrendingUp, MessageCircle, Users, Package,
  ExternalLink, Calendar, BarChart3, Target
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BibliotecaCampanha {
  id: string;
  produto_id: string | null;
  campanha_id: string | null;
  produto_nome: string;
  produto_descricao: string | null;
  produto_preco: number | null;
  produto_imagem_url: string | null;
  produto_imagens: unknown[];
  produto_categoria: string | null;
  produto_link_marketplace: string | null;
  campanha_nome: string;
  mensagem_template: string | null;
  frequencia: string | null;
  listas_ids: string[] | null;
  total_enviados: number;
  total_respostas: number;
  total_conversoes: number;
  taxa_resposta: number;
  taxa_conversao: number;
  status: string;
  disponivel_remarketing: boolean;
  enviado_google_ads: boolean;
  google_ads_campaign_id: string | null;
  data_campanha: string;
  created_at: string;
}

const Biblioteca = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("Todas");
  const [statusFilter, setStatusFilter] = useState<string>("Todos");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [campanhas, setCampanhas] = useState<BibliotecaCampanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalhesModal, setDetalhesModal] = useState<BibliotecaCampanha | null>(null);
  const [googleAdsModal, setGoogleAdsModal] = useState<BibliotecaCampanha | null>(null);

  useEffect(() => {
    loadCampanhas();
  }, []);

  const loadCampanhas = async () => {
    try {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await supabase
        .from('biblioteca_campanhas')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('data_campanha', { ascending: false });

      if (error) throw error;

      // Cast the data to the correct type
      const typedData = (data || []) as unknown as BibliotecaCampanha[];
      setCampanhas(typedData);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar biblioteca");
    } finally {
      setLoading(false);
    }
  };

  const categorias = [...new Set(campanhas.map(c => c.produto_categoria).filter(Boolean))];

  const filteredCampanhas = campanhas.filter(campanha => {
    const matchSearch = campanha.produto_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        campanha.campanha_nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategoria = categoriaFilter === "Todas" || campanha.produto_categoria === categoriaFilter;
    const matchStatus = statusFilter === "Todos" || campanha.status === statusFilter;
    return matchSearch && matchCategoria && matchStatus;
  });

  const stats = {
    total: campanhas.length,
    ativas: campanhas.filter(c => c.status === "ativa").length,
    finalizadas: campanhas.filter(c => c.status === "finalizada").length,
    totalEnviados: campanhas.reduce((sum, c) => sum + c.total_enviados, 0),
    totalRespostas: campanhas.reduce((sum, c) => sum + c.total_respostas, 0),
    totalConversoes: campanhas.reduce((sum, c) => sum + c.total_conversoes, 0),
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredCampanhas.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredCampanhas.map(c => c.id));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleRemarketing = async (campanha: BibliotecaCampanha) => {
    // Navegar para criar nova campanha com dados pré-preenchidos
    localStorage.setItem('remarketing_campanha', JSON.stringify({
      produto_id: campanha.produto_id,
      produto_nome: campanha.produto_nome,
      produto_imagem_url: campanha.produto_imagem_url,
      mensagem_template: campanha.mensagem_template,
      listas_ids: campanha.listas_ids
    }));
    navigate('/meus-produtos');
    toast.success("Dados carregados para remarketing!");
  };

  const handleGoogleAds = (campanha: BibliotecaCampanha) => {
    setGoogleAdsModal(campanha);
  };

  const criarCampanhaGoogleAds = async () => {
    if (!googleAdsModal) return;
    
    // Salvar dados para a página de Google Ads
    localStorage.setItem('google_ads_campanha', JSON.stringify({
      produto_nome: googleAdsModal.produto_nome,
      produto_descricao: googleAdsModal.produto_descricao,
      produto_preco: googleAdsModal.produto_preco,
      produto_imagem_url: googleAdsModal.produto_imagem_url,
      produto_link_marketplace: googleAdsModal.produto_link_marketplace,
      campanha_id: googleAdsModal.id
    }));
    
    navigate('/google-ads');
    toast.success("Dados carregados para Google Ads!");
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta campanha da biblioteca?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('biblioteca_campanhas')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setCampanhas(prev => prev.filter(c => c.id !== id));
      setSelectedItems(prev => prev.filter(i => i !== id));
      toast.success("Campanha removida da biblioteca!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao remover campanha");
    }
  };

  const handleExportCSV = () => {
    const headers = ['Produto', 'Campanha', 'Categoria', 'Preço', 'Enviados', 'Respostas', 'Conversões', 'Taxa Resposta', 'Taxa Conversão', 'Data'];
    const rows = filteredCampanhas.map(c => [
      c.produto_nome,
      c.campanha_nome,
      c.produto_categoria || '',
      c.produto_preco || '',
      c.total_enviados,
      c.total_respostas,
      c.total_conversoes,
      c.taxa_resposta + '%',
      c.taxa_conversao + '%',
      new Date(c.data_campanha).toLocaleDateString('pt-BR')
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'biblioteca_campanhas.csv';
    a.click();
    toast.success("CSV exportado!");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ativa": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
      case "finalizada": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100";
      case "pausada": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <Button
          onClick={() => navigate('/dashboard')}
          variant="ghost"
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para o Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">📚 Biblioteca de Campanhas</h1>
          <p className="text-muted-foreground">Gerencie campanhas para remarketing e Google Ads</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Cards de Métricas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-purple-500" />
                    <span className="text-sm text-muted-foreground">Campanhas</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{stats.total}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-green-500" />
                    <span className="text-sm text-muted-foreground">Enviados</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{stats.totalEnviados}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-500" />
                    <span className="text-sm text-muted-foreground">Respostas</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{stats.totalRespostas}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-orange-500" />
                    <span className="text-sm text-muted-foreground">Conversões</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{stats.totalConversoes}</p>
                </CardContent>
              </Card>
            </div>

            {/* Filtros */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar produto ou campanha..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todas">Todas Categorias</SelectItem>
                      {categorias.map(cat => (
                        <SelectItem key={cat} value={cat!}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todos">Todos Status</SelectItem>
                      <SelectItem value="ativa">Ativas</SelectItem>
                      <SelectItem value="finalizada">Finalizadas</SelectItem>
                      <SelectItem value="pausada">Pausadas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Ações em Massa */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={selectedItems.length === filteredCampanhas.length && filteredCampanhas.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                    <span className="text-sm font-medium">Selecionar todos</span>
                  </div>
                  <div className="flex-1" />
                  <Button onClick={handleExportCSV} variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Exportar CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Grid de Campanhas */}
            {loading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Carregando...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCampanhas.map((campanha) => (
                  <Card key={campanha.id} className="group relative overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="absolute top-2 left-2 z-10">
                      <Checkbox 
                        checked={selectedItems.includes(campanha.id)}
                        onCheckedChange={() => toggleSelectItem(campanha.id)}
                      />
                    </div>
                    <CardHeader className="p-0">
                      <div className="aspect-video bg-muted flex items-center justify-center relative overflow-hidden">
                        {campanha.produto_imagem_url ? (
                          <img 
                            src={campanha.produto_imagem_url} 
                            alt={campanha.produto_nome}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="h-12 w-12 text-muted-foreground" />
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button size="sm" variant="secondary" onClick={() => setDetalhesModal(campanha)}>
                            <BarChart3 className="h-4 w-4 mr-1" />
                            Detalhes
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => handleRemarketing(campanha)}>
                            <Repeat className="h-4 w-4 mr-1" />
                            Remarketing
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <h3 className="font-semibold line-clamp-1">{campanha.produto_nome}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-1">{campanha.campanha_nome}</p>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        <Badge className={getStatusColor(campanha.status)}>{campanha.status}</Badge>
                        {campanha.produto_preco && (
                          <Badge variant="outline">R$ {campanha.produto_preco.toFixed(2)}</Badge>
                        )}
                      </div>

                      {/* Métricas */}
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-muted/50 rounded p-2">
                          <p className="font-bold">{campanha.total_enviados}</p>
                          <p className="text-muted-foreground">Enviados</p>
                        </div>
                        <div className="bg-muted/50 rounded p-2">
                          <p className="font-bold">{campanha.taxa_resposta}%</p>
                          <p className="text-muted-foreground">Resposta</p>
                        </div>
                        <div className="bg-muted/50 rounded p-2">
                          <p className="font-bold">{campanha.taxa_conversao}%</p>
                          <p className="text-muted-foreground">Conversão</p>
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => handleGoogleAds(campanha)}
                        >
                          <Target className="h-4 w-4 mr-1" />
                          Google Ads
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleDelete(campanha.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        {new Date(campanha.data_campanha).toLocaleDateString('pt-BR')}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {filteredCampanhas.length === 0 && !loading && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">Nenhuma campanha na biblioteca</p>
                  <p className="text-sm text-muted-foreground">
                    Campanhas de produtos serão salvas aqui automaticamente
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Estatísticas */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>📊 Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total de campanhas:</span>
                  <span className="text-2xl font-bold">{stats.total}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Ativas:</span>
                  <span className="text-xl font-bold text-green-600">{stats.ativas}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Finalizadas:</span>
                  <span className="text-xl font-bold text-blue-600">{stats.finalizadas}</span>
                </div>
                <hr className="my-4" />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Taxa média de resposta:</p>
                  <p className="text-xl font-bold text-primary">
                    {stats.total > 0 
                      ? (campanhas.reduce((sum, c) => sum + c.taxa_resposta, 0) / stats.total).toFixed(1)
                      : 0}%
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Taxa média de conversão:</p>
                  <p className="text-xl font-bold text-primary">
                    {stats.total > 0 
                      ? (campanhas.reduce((sum, c) => sum + c.taxa_conversao, 0) / stats.total).toFixed(1)
                      : 0}%
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modal Detalhes */}
      <Dialog open={!!detalhesModal} onOpenChange={() => setDetalhesModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Campanha</DialogTitle>
            <DialogDescription>Métricas e informações completas</DialogDescription>
          </DialogHeader>
          {detalhesModal && (
            <div className="space-y-4">
              <div className="flex gap-4">
                {detalhesModal.produto_imagem_url && (
                  <img 
                    src={detalhesModal.produto_imagem_url} 
                    alt={detalhesModal.produto_nome}
                    className="w-32 h-32 object-cover rounded"
                  />
                )}
                <div>
                  <h3 className="font-bold text-lg">{detalhesModal.produto_nome}</h3>
                  <p className="text-muted-foreground">{detalhesModal.campanha_nome}</p>
                  {detalhesModal.produto_preco && (
                    <p className="text-xl font-bold text-primary mt-2">
                      R$ {detalhesModal.produto_preco.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-muted rounded p-3 text-center">
                  <p className="text-2xl font-bold">{detalhesModal.total_enviados}</p>
                  <p className="text-sm text-muted-foreground">Enviados</p>
                </div>
                <div className="bg-muted rounded p-3 text-center">
                  <p className="text-2xl font-bold">{detalhesModal.total_respostas}</p>
                  <p className="text-sm text-muted-foreground">Respostas</p>
                </div>
                <div className="bg-muted rounded p-3 text-center">
                  <p className="text-2xl font-bold">{detalhesModal.total_conversoes}</p>
                  <p className="text-sm text-muted-foreground">Conversões</p>
                </div>
                <div className="bg-muted rounded p-3 text-center">
                  <p className="text-2xl font-bold">{detalhesModal.taxa_conversao}%</p>
                  <p className="text-sm text-muted-foreground">Conversão</p>
                </div>
              </div>

              {detalhesModal.mensagem_template && (
                <div>
                  <p className="text-sm font-medium mb-2">Mensagem:</p>
                  <p className="bg-muted p-3 rounded text-sm">{detalhesModal.mensagem_template}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={() => handleRemarketing(detalhesModal)} className="flex-1">
                  <Repeat className="h-4 w-4 mr-2" />
                  Fazer Remarketing
                </Button>
                <Button onClick={() => { setDetalhesModal(null); handleGoogleAds(detalhesModal); }} variant="outline" className="flex-1">
                  <Target className="h-4 w-4 mr-2" />
                  Criar Google Ads
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Google Ads - Formulário Completo */}
      <Dialog open={!!googleAdsModal} onOpenChange={() => setGoogleAdsModal(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>🎯 Criar Campanha Google Ads</DialogTitle>
            <DialogDescription>
              Configure a campanha de anúncios para "{googleAdsModal?.produto_nome}"
            </DialogDescription>
          </DialogHeader>
          {googleAdsModal && (
            <GoogleAdsForm 
              campanha={googleAdsModal} 
              onClose={() => setGoogleAdsModal(null)}
              onSuccess={() => {
                setGoogleAdsModal(null);
                loadCampanhas();
                toast.success("Campanha Google Ads criada!");
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Componente do formulário Google Ads
function GoogleAdsForm({ 
  campanha, 
  onClose, 
  onSuccess 
}: { 
  campanha: BibliotecaCampanha; 
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome_campanha: `Google Ads - ${campanha.produto_nome}`,
    objetivo: 'vendas',
    orcamento_diario: '50',
    duracao_dias: '30',
    headline1: campanha.produto_nome.substring(0, 30),
    headline2: campanha.produto_preco ? `A partir de R$ ${campanha.produto_preco.toFixed(2)}` : 'Confira agora!',
    headline3: 'Compre Online',
    descricao1: campanha.produto_descricao?.substring(0, 90) || 'Produto de qualidade com entrega rápida.',
    descricao2: 'Aproveite as melhores ofertas. Compre agora!',
    url_final: campanha.produto_link_marketplace || '',
    palavras_chave: campanha.produto_categoria || '',
    localizacao: 'Brasil',
    idade_min: '18',
    idade_max: '65',
    genero: 'todos'
  });

  const handleSalvar = async () => {
    try {
      setIsLoading(true);
      
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error('Usuário não autenticado');
        return;
      }

      // Salvar campanha Google Ads no banco
      const { error } = await supabase
        .from('campanhas')
        .insert({
          user_id: userData.user.id,
          nome: formData.nome_campanha,
          plataforma: 'google_ads',
          status: 'rascunho',
          orcamento: parseFloat(formData.orcamento_diario) * parseInt(formData.duracao_dias),
          publico: {
            localizacao: formData.localizacao,
            idade_min: parseInt(formData.idade_min),
            idade_max: parseInt(formData.idade_max),
            genero: formData.genero,
            palavras_chave: formData.palavras_chave.split(',').map(p => p.trim())
          },
          metricas: {
            objetivo: formData.objetivo,
            headlines: [formData.headline1, formData.headline2, formData.headline3],
            descricoes: [formData.descricao1, formData.descricao2],
            url_final: formData.url_final,
            produto_imagem: campanha.produto_imagem_url,
            biblioteca_campanha_id: campanha.id
          },
          posts_ids: []
        });

      if (error) throw error;

      // Marcar na biblioteca que foi enviado para Google Ads
      await supabase
        .from('biblioteca_campanhas')
        .update({ 
          enviado_google_ads: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', campanha.id);

      onSuccess();
    } catch (error) {
      console.error('Erro ao criar campanha:', error);
      toast.error('Erro ao criar campanha Google Ads');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 py-4">
      {/* Preview do Produto */}
      <div className="flex gap-4 p-4 bg-muted rounded-lg">
        {campanha.produto_imagem_url && (
          <img 
            src={campanha.produto_imagem_url} 
            alt={campanha.produto_nome}
            className="w-24 h-24 object-cover rounded"
          />
        )}
        <div className="flex-1">
          <h3 className="font-bold">{campanha.produto_nome}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">{campanha.produto_descricao}</p>
          {campanha.produto_preco && (
            <p className="text-lg font-bold text-green-600 mt-1">
              R$ {campanha.produto_preco.toFixed(2)}
            </p>
          )}
        </div>
      </div>

      {/* Configurações Básicas */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="text-sm font-medium">Nome da Campanha</label>
          <Input 
            value={formData.nome_campanha}
            onChange={(e) => setFormData({...formData, nome_campanha: e.target.value})}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Objetivo</label>
          <Select value={formData.objetivo} onValueChange={(v) => setFormData({...formData, objetivo: v})}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vendas">💰 Vendas</SelectItem>
              <SelectItem value="leads">📋 Leads</SelectItem>
              <SelectItem value="trafego">🌐 Tráfego</SelectItem>
              <SelectItem value="awareness">📢 Reconhecimento</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Orçamento Diário (R$)</label>
          <Input 
            type="number"
            value={formData.orcamento_diario}
            onChange={(e) => setFormData({...formData, orcamento_diario: e.target.value})}
            className="mt-1"
          />
        </div>
      </div>

      {/* Headlines */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Headlines (Títulos do Anúncio)</label>
        <Input 
          value={formData.headline1}
          onChange={(e) => setFormData({...formData, headline1: e.target.value})}
          placeholder="Headline 1 (max 30 caracteres)"
          maxLength={30}
        />
        <Input 
          value={formData.headline2}
          onChange={(e) => setFormData({...formData, headline2: e.target.value})}
          placeholder="Headline 2 (max 30 caracteres)"
          maxLength={30}
        />
        <Input 
          value={formData.headline3}
          onChange={(e) => setFormData({...formData, headline3: e.target.value})}
          placeholder="Headline 3 (max 30 caracteres)"
          maxLength={30}
        />
      </div>

      {/* Descrições */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Descrições</label>
        <Input 
          value={formData.descricao1}
          onChange={(e) => setFormData({...formData, descricao1: e.target.value})}
          placeholder="Descrição 1 (max 90 caracteres)"
          maxLength={90}
        />
        <Input 
          value={formData.descricao2}
          onChange={(e) => setFormData({...formData, descricao2: e.target.value})}
          placeholder="Descrição 2 (max 90 caracteres)"
          maxLength={90}
        />
      </div>

      {/* URL e Palavras-chave */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="text-sm font-medium">URL Final (Link do Produto)</label>
          <Input 
            value={formData.url_final}
            onChange={(e) => setFormData({...formData, url_final: e.target.value})}
            placeholder="https://..."
            className="mt-1"
          />
        </div>
        <div className="col-span-2">
          <label className="text-sm font-medium">Palavras-chave (separadas por vírgula)</label>
          <Input 
            value={formData.palavras_chave}
            onChange={(e) => setFormData({...formData, palavras_chave: e.target.value})}
            placeholder="produto, categoria, marca..."
            className="mt-1"
          />
        </div>
      </div>

      {/* Público-alvo */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium">Localização</label>
          <Input 
            value={formData.localizacao}
            onChange={(e) => setFormData({...formData, localizacao: e.target.value})}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Idade Mín.</label>
          <Input 
            type="number"
            value={formData.idade_min}
            onChange={(e) => setFormData({...formData, idade_min: e.target.value})}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Idade Máx.</label>
          <Input 
            type="number"
            value={formData.idade_max}
            onChange={(e) => setFormData({...formData, idade_max: e.target.value})}
            className="mt-1"
          />
        </div>
      </div>

      {/* Preview do Anúncio */}
      <div className="border rounded-lg p-4 bg-background">
        <p className="text-xs text-muted-foreground mb-2">Preview do Anúncio:</p>
        <div className="space-y-1">
          <p className="text-blue-600 font-medium text-lg">{formData.headline1} | {formData.headline2}</p>
          <p className="text-green-700 text-sm">{formData.url_final || 'www.seusite.com.br'}</p>
          <p className="text-sm text-muted-foreground">{formData.descricao1}</p>
        </div>
      </div>

      {/* Botões */}
      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Cancelar
        </Button>
        <Button onClick={handleSalvar} disabled={isLoading} className="flex-1">
          {isLoading ? 'Salvando...' : '🚀 Criar Campanha'}
        </Button>
      </div>
    </div>
  );
}

export default Biblioteca;