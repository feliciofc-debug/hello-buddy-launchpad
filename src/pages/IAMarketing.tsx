import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Instagram, Smartphone, MessageCircle, ArrowLeft, AlertCircle, Calendar as CalendarIcon, Download, Trash2, Search, Upload, Link as LinkIcon, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { SchedulePostsModal } from "@/components/SchedulePostsModal";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VideoGenerator } from "@/components/VideoGenerator";

interface ProductAnalysis {
  produto: {
    titulo: string;
    preco?: number;
    imagem: string;
    score: number;
    recomendacao: string;
  };
  posts: {
    instagram: string;
    stories: string;
    whatsapp: string;
  };
  url?: string;
}

interface HistoryItem {
  id: string;
  date: string;
  produto: string;
  posts: {
    instagram: string;
    stories: string;
    whatsapp: string;
  };
  status: 'rascunho' | 'agendado' | 'postado';
  scheduledDate?: string;
}

interface BulkResult extends ProductAnalysis {
  selected: boolean;
}

const IAMarketing = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<ProductAnalysis | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Estados para permitir edição dos posts
  const [editableInstagram, setEditableInstagram] = useState("");
  const [editableStories, setEditableStories] = useState("");
  const [editableWhatsApp, setEditableWhatsApp] = useState("");
  const [editingInstagram, setEditingInstagram] = useState(false);
  const [editingStories, setEditingStories] = useState(false);
  const [editingWhatsApp, setEditingWhatsApp] = useState(false);

  // Estados para análise em massa
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkUrls, setBulkUrls] = useState("");
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Estados para agendamento
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Estados para histórico
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'todos' | 'agendado' | 'postado' | 'rascunho'>('todos');
  const [historySearch, setHistorySearch] = useState("");

  // Estados para Upload (apenas empresas)
  const [uploadMode, setUploadMode] = useState<'link' | 'upload'>('link');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string>("");
  const [productData, setProductData] = useState({
    nome: "",
    preco: "",
    descricao: "",
    categoria: ""
  });

  // Carregar perfil do usuário
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setUserProfile(profile);
      }
    };
    fetchProfile();
  }, []);

  // Carregar histórico do localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('ia-marketing-history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Salvar no histórico
  const saveToHistory = (result: ProductAnalysis, status: 'rascunho' | 'agendado' | 'postado' = 'rascunho', scheduledDate?: string) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      produto: result.produto.titulo,
      posts: result.posts,
      status,
      scheduledDate,
    };
    const updatedHistory = [newItem, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('ia-marketing-history', JSON.stringify(updatedHistory));
  };

  const handleAnalyze = async () => {
    if (!url.trim()) {
      toast.error("Por favor, cole um link válido");
      return;
    }

    setLoading(true);
    setError("");
    setResultado(null);
    
    console.log('🔍 Enviando URL para análise:', url.trim());
    
    try {
      const response = await axios.post(
        "https://amz-ofertas-robo.onrender.com/analisar-produto",
        { 
          url: url.trim(),
          usuario_id: 'user123'
        },
        { 
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Resposta recebida:', response.data);

      if (response.data.success) {
        setResultado(response.data);
        setEditableInstagram(response.data.posts.instagram);
        setEditableStories(response.data.posts.stories);
        setEditableWhatsApp(response.data.posts.whatsapp);
        toast.success("Análise concluída com sucesso!");
      } else {
        setError(response.data.error || 'Erro desconhecido');
        toast.error(response.data.error || 'Erro desconhecido');
      }
    } catch (err: any) {
      console.error('❌ Erro completo:', err);
      
      let errorMessage = '';
      
      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Tempo esgotado. Link demorou muito para responder.';
      } else if (err.response) {
        errorMessage = err.response.data?.error || 'Erro no servidor';
        console.error('Erro do servidor:', err.response.data);
      } else if (err.request) {
        errorMessage = 'Sem resposta do servidor. Verifique sua conexão.';
      } else {
        errorMessage = err.message || 'Erro desconhecido';
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    console.log('📋 Texto copiado:', type);
    toast.success(`✅ ${type} copiado para a área de transferência!`);
  };

  const handleWhatsAppSend = (text: string) => {
    const encodedText = encodeURIComponent(text);
    window.open(`https://web.whatsapp.com/send?text=${encodedText}`, "_blank");
  };

  // Análise em massa
  const handleBulkAnalyze = async () => {
    const urls = bulkUrls.split('\n').filter(u => u.trim()).slice(0, 10);
    if (urls.length === 0) {
      toast.error("Cole pelo menos um link!");
      return;
    }

    setBulkLoading(true);
    setBulkResults([]);
    
    for (const singleUrl of urls) {
      try {
        const response = await axios.post(
          "https://amz-ofertas-robo.onrender.com/analisar-produto",
          { 
            url: singleUrl.trim(),
            usuario_id: 'user123'
          },
          { 
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' }
          }
        );

        if (response.data.success) {
          setBulkResults(prev => [...prev, { ...response.data, url: singleUrl, selected: false }]);
        }
      } catch (err) {
        console.error('Erro ao analisar:', singleUrl, err);
      }
    }
    
    setBulkLoading(false);
    toast.success(`${urls.length} links analisados!`);
  };

  const toggleBulkSelection = (index: number) => {
    setBulkResults(prev => prev.map((r, i) => i === index ? { ...r, selected: !r.selected } : r));
  };

  const copySelected = () => {
    const selected = bulkResults.filter(r => r.selected);
    if (selected.length === 0) {
      toast.error("Selecione pelo menos um resultado!");
      return;
    }
    const text = selected.map(r => 
      `${r.produto.titulo}\n\nInstagram:\n${r.posts.instagram}\n\nStories:\n${r.posts.stories}\n\nWhatsApp:\n${r.posts.whatsapp}\n\n---\n\n`
    ).join('');
    navigator.clipboard.writeText(text);
    toast.success(`${selected.length} posts copiados!`);
  };

  const downloadAll = () => {
    const text = bulkResults.map(r => 
      `${r.produto.titulo}\n\nInstagram:\n${r.posts.instagram}\n\nStories:\n${r.posts.stories}\n\nWhatsApp:\n${r.posts.whatsapp}\n\n---\n\n`
    ).join('');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `posts-gerados-${Date.now()}.txt`;
    a.click();
    toast.success("Arquivo baixado!");
  };

  // Agendamento - agora é gerenciado pelo SchedulePostsModal

  // Histórico
  const filteredHistory = history
    .filter(item => historyFilter === 'todos' || item.status === historyFilter)
    .filter(item => item.produto.toLowerCase().includes(historySearch.toLowerCase()));

  const deleteHistoryItem = (id: string) => {
    const updatedHistory = history.filter(item => item.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem('ia-marketing-history', JSON.stringify(updatedHistory));
    toast.success("Item removido!");
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
    if (score >= 5) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100";
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100";
  };

  const getRecommendation = (score: number) => {
    return score >= 8 ? "✅ Produto recomendado para divulgação" : "⚠️ Revise antes de divulgar";
  };

  // Handlers para Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];
    if (!validTypes.includes(file.type)) {
      toast.error('Formato não suportado. Use JPG, PNG, WEBP ou MP4');
      return;
    }

    // Validar tamanho (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 50MB');
      return;
    }

    setUploadedFile(file);
    
    // Criar preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    
    toast.success('Arquivo carregado!');
  };

  const handleGenerateFromUpload = async () => {
    if (!uploadedFile) {
      toast.error('Faça upload de uma imagem ou vídeo');
      return;
    }

    if (!productData.nome || !productData.preco || !productData.descricao) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    toast.info('Gerando campanha com IA... Aguarde');

    // TODO: Implementar edge function para processar upload
    // Por enquanto, simular resultado
    setTimeout(() => {
      const mockResult: ProductAnalysis = {
        produto: {
          titulo: productData.nome,
          preco: parseFloat(productData.preco),
          imagem: uploadPreview,
          score: 9,
          recomendacao: 'Produto próprio - altamente recomendado'
        },
        posts: {
          instagram: `🔥 ${productData.nome}\n\n${productData.descricao}\n\n💰 Apenas R$ ${productData.preco}\n\n✨ Compre agora e aproveite!\n\n#produto #oferta #promoção`,
          stories: `⚡ NOVO!\n\n${productData.nome}\n\nR$ ${productData.preco}\n\n👆 Deslize para cima!`,
          whatsapp: `Olá! 👋\n\nConheça nosso ${productData.nome}!\n\n${productData.descricao}\n\n💰 Preço: R$ ${productData.preco}\n\nInteressado? Entre em contato!`
        }
      };

      setResultado(mockResult);
      setEditableInstagram(mockResult.posts.instagram);
      setEditableStories(mockResult.posts.stories);
      setEditableWhatsApp(mockResult.posts.whatsapp);
      setLoading(false);
      toast.success('Campanha gerada com sucesso!');
    }, 2000);
  };

  const clearUpload = () => {
    setUploadedFile(null);
    setUploadPreview('');
    setProductData({ nome: '', preco: '', descricao: '', categoria: '' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <Tabs defaultValue="gerar" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="gerar">Gerar Posts</TabsTrigger>
            <TabsTrigger value="historico">Meus Posts</TabsTrigger>
          </TabsList>

          <TabsContent value="gerar">
            {/* Header da Página */}
            <div className="mb-8">
              <Button
                onClick={() => navigate('/dashboard')}
                variant="ghost"
                className="mb-4 hover:bg-muted"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o Dashboard
              </Button>
              
              <div className="text-center space-y-2">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent">
                  🤖 IA Marketing
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground">
                  Transforme qualquer link de produto em posts virais com IA
                </p>
              </div>
            </div>

            {/* Seção de Análise do Produto */}
            <Card className="max-w-3xl mx-auto mb-8 shadow-lg">
              <CardContent className="pt-6 space-y-4">
                {/* Tabs Analisar Link / Upload (para empresas e fábricas) */}
                {(userProfile?.tipo === 'empresa' || userProfile?.tipo === 'fabrica') ? (
                  <Tabs value={uploadMode} onValueChange={(v) => setUploadMode(v as 'link' | 'upload')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger value="link" className="flex items-center gap-2">
                        <LinkIcon className="w-4 h-4" />
                        🔗 ANALISAR LINK
                      </TabsTrigger>
                      <TabsTrigger value="upload" className="flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        📤 UPLOAD MEU PRODUTO
                      </TabsTrigger>
                    </TabsList>

                    {/* Tab: Analisar Link */}
                    <TabsContent value="link" className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="bulk-mode" className="text-base font-semibold">Analisar múltiplos links</Label>
                        <Switch id="bulk-mode" checked={bulkMode} onCheckedChange={setBulkMode} />
                      </div>

                      {!bulkMode ? (
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Cole o link do produto que você quer promover:
                          </label>
                          <Input
                            type="text"
                            placeholder="https://shopee.com.br/produto... ou qualquer link de afiliado"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="h-12 text-base"
                            disabled={loading}
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Cole até 10 links, um por linha:
                          </label>
                          <Textarea
                            placeholder="https://shopee.com.br/produto1&#10;https://shopee.com.br/produto2&#10;https://shopee.com.br/produto3"
                            value={bulkUrls}
                            onChange={(e) => setBulkUrls(e.target.value)}
                            className="min-h-[200px] text-base"
                            disabled={bulkLoading}
                          />
                        </div>
                      )}
                      
                      <Button
                        onClick={bulkMode ? handleBulkAnalyze : handleAnalyze}
                        disabled={loading || bulkLoading}
                        className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg"
                      >
                        {(loading || bulkLoading) ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            🔍 Analisando produto... Aguarde 10-20 segundos
                          </>
                        ) : bulkMode ? (
                          `✨ ANALISAR TODOS (${bulkUrls.split('\n').filter(u => u.trim()).length}/10)`
                        ) : (
                          "✨ ANALISAR COM IA"
                        )}
                      </Button>
                    </TabsContent>

                    {/* Tab: Upload */}
                    <TabsContent value="upload" className="space-y-6">
                      {/* Upload Zone */}
                      {!uploadedFile ? (
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Upload de Imagem ou Vídeo *
                          </label>
                          <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center hover:border-purple-500 transition-colors cursor-pointer">
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,video/mp4"
                              onChange={handleFileUpload}
                              className="hidden"
                              id="file-upload"
                            />
                            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-4">
                              <Upload className="w-12 h-12 text-muted-foreground" />
                              <div>
                                <p className="text-lg font-semibold mb-1">
                                  Clique para fazer upload ou arraste o arquivo
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  JPG, PNG, WEBP ou MP4 (máx. 50MB)
                                </p>
                              </div>
                            </label>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Preview */}
                          <div className="relative">
                            <label className="block text-sm font-medium mb-2">
                              Preview
                            </label>
                            <div className="relative rounded-lg overflow-hidden border border-muted">
                              {uploadedFile.type.startsWith('image/') ? (
                                <img src={uploadPreview} alt="Preview" className="w-full h-64 object-cover" />
                              ) : (
                                <video src={uploadPreview} className="w-full h-64 object-cover" controls />
                              )}
                              <Button
                                onClick={clearUpload}
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Formulário de Dados do Produto */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <Label htmlFor="nome">Nome do Produto *</Label>
                          <Input
                            id="nome"
                            value={productData.nome}
                            onChange={(e) => setProductData(prev => ({ ...prev, nome: e.target.value }))}
                            placeholder="Ex: Tênis Esportivo Premium"
                          />
                        </div>

                        <div>
                          <Label htmlFor="preco">Preço (R$) *</Label>
                          <Input
                            id="preco"
                            type="number"
                            step="0.01"
                            value={productData.preco}
                            onChange={(e) => setProductData(prev => ({ ...prev, preco: e.target.value }))}
                            placeholder="199.90"
                          />
                        </div>

                        <div>
                          <Label htmlFor="categoria">Categoria</Label>
                          <Select 
                            value={productData.categoria}
                            onValueChange={(value) => setProductData(prev => ({ ...prev, categoria: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="moda">Moda</SelectItem>
                              <SelectItem value="eletronicos">Eletrônicos</SelectItem>
                              <SelectItem value="casa">Casa e Decoração</SelectItem>
                              <SelectItem value="beleza">Beleza</SelectItem>
                              <SelectItem value="esportes">Esportes</SelectItem>
                              <SelectItem value="livros">Livros</SelectItem>
                              <SelectItem value="alimentos">Alimentos</SelectItem>
                              <SelectItem value="outros">Outros</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="col-span-2">
                          <Label htmlFor="descricao">Descrição Curta *</Label>
                          <Textarea
                            id="descricao"
                            value={productData.descricao}
                            onChange={(e) => setProductData(prev => ({ ...prev, descricao: e.target.value }))}
                            placeholder="Descreva as principais características do produto..."
                            rows={3}
                          />
                        </div>
                      </div>

                      <Button
                        onClick={handleGenerateFromUpload}
                        disabled={loading || !uploadedFile}
                        className="w-full h-14 text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Gerando campanha...
                          </>
                        ) : (
                          "✨ GERAR CAMPANHA COM IA"
                        )}
                      </Button>
                    </TabsContent>
                  </Tabs>
                ) : (
                  // Para afiliados, mostrar apenas análise de link
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <Label htmlFor="bulk-mode" className="text-base font-semibold">Analisar múltiplos links</Label>
                      <Switch id="bulk-mode" checked={bulkMode} onCheckedChange={setBulkMode} />
                    </div>

                    {!bulkMode ? (
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Cole o link do produto que você quer promover:
                        </label>
                        <Input
                          type="text"
                          placeholder="https://shopee.com.br/produto... ou qualquer link de afiliado"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          className="h-12 text-base"
                          disabled={loading}
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Cole até 10 links, um por linha:
                        </label>
                        <Textarea
                          placeholder="https://shopee.com.br/produto1&#10;https://shopee.com.br/produto2&#10;https://shopee.com.br/produto3"
                          value={bulkUrls}
                          onChange={(e) => setBulkUrls(e.target.value)}
                          className="min-h-[200px] text-base"
                          disabled={bulkLoading}
                        />
                      </div>
                    )}
                    
                    <Button
                      onClick={bulkMode ? handleBulkAnalyze : handleAnalyze}
                      disabled={loading || bulkLoading}
                      className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg"
                    >
                      {(loading || bulkLoading) ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          🔍 Analisando produto... Aguarde 10-20 segundos
                        </>
                      ) : bulkMode ? (
                        `✨ ANALISAR TODOS (${bulkUrls.split('\n').filter(u => u.trim()).length}/10)`
                      ) : (
                        "✨ ANALISAR COM IA"
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Resultados em massa */}
            {bulkMode && bulkResults.length > 0 && (
              <Card className="max-w-6xl mx-auto mb-8 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>📊 Resultados da Análise ({bulkResults.length})</span>
                    <div className="flex gap-2">
                      <Button onClick={copySelected} variant="outline" size="sm">
                        📋 Copiar Selecionados
                      </Button>
                      <Button onClick={downloadAll} variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Baixar Todos
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Preço</TableHead>
                        <TableHead>Posts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bulkResults.map((result, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Checkbox 
                              checked={result.selected}
                              onCheckedChange={() => toggleBulkSelection(index)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{result.produto.titulo}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${getScoreColor(result.produto.score)}`}>
                              {result.produto.score}/10
                            </span>
                          </TableCell>
                          <TableCell>
                            {result.produto.preco ? `R$ ${result.produto.preco.toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setResultado(result);
                                setEditableInstagram(result.posts.instagram);
                                setEditableStories(result.posts.stories);
                                setEditableWhatsApp(result.posts.whatsapp);
                              }}
                            >
                              Ver Posts
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Estado de Erro */}
            {error && (
              <Alert variant="destructive" className="max-w-3xl mx-auto mb-8">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>❌ {error}</span>
                  <Button
                    onClick={handleAnalyze}
                    variant="outline"
                    size="sm"
                    className="ml-4"
                  >
                    Tentar Novamente
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Seção de Informações do Produto */}
            {resultado && (
              <>
                <Card className="max-w-3xl mx-auto mb-8 shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl">📦 Informações do Produto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-6">
                  <img
                    src={resultado.produto.imagem}
                    alt={resultado.produto.titulo}
                    className="w-full md:w-[200px] h-[200px] object-cover rounded-xl shadow-md"
                  />
                  
                  <div className="flex-1 space-y-4">
                    <h3 className="text-xl font-bold leading-tight">
                      {resultado.produto.titulo}
                    </h3>
                    
                    {resultado.produto.preco && (
                      <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                        R$ {resultado.produto.preco.toFixed(2)}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">
                        📊 Score: {resultado.produto.score}/10
                      </span>
                      <span className={`px-4 py-1 rounded-full text-sm font-bold ${getScoreColor(resultado.produto.score)}`}>
                        {resultado.produto.score >= 8 ? "Alto" : resultado.produto.score >= 5 ? "Médio" : "Baixo"}
                      </span>
                    </div>
                    
                    <p className="text-base font-semibold">
                      {getRecommendation(resultado.produto.score)}
                    </p>
                  </div>
                </div>
                  </CardContent>
                </Card>

                {/* Botão de Agendamento */}
                <div className="max-w-3xl mx-auto mb-8 flex justify-center">
                  <Button 
                    onClick={() => setShowScheduleModal(true)}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    📅 Agendar Postagens
                  </Button>
                </div>

                {/* Modal de Agendamento Completo */}
                <SchedulePostsModal
                  open={showScheduleModal}
                  onOpenChange={setShowScheduleModal}
                  postContent={{
                    instagram: editableInstagram,
                    stories: editableStories,
                    whatsapp: editableWhatsApp,
                  }}
                />

                {/* Seção de Posts Gerados */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Card Instagram Post */}
              <Card className="shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Instagram className="h-5 w-5 text-pink-600" />
                    📷 Instagram Post
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editingInstagram ? (
                    <Textarea
                      value={editableInstagram}
                      onChange={(e) => setEditableInstagram(e.target.value)}
                      className="min-h-[200px] text-sm"
                    />
                  ) : (
                    <div className="bg-muted/50 p-4 rounded-xl min-h-[200px] text-sm whitespace-pre-wrap border-2 border-border">
                      {editableInstagram}
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Button
                      onClick={() => handleCopy(editableInstagram, "Instagram Post")}
                      variant="outline"
                      className="w-full"
                    >
                      📋 Copiar
                    </Button>
                    <Button
                      onClick={() => setEditingInstagram(!editingInstagram)}
                      variant="outline"
                      className="w-full"
                    >
                      ✏️ {editingInstagram ? "Salvar" : "Editar"}
                    </Button>
                    <Button 
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      onClick={() => toast.success("Pronto para usar!")}
                    >
                      📱 Usar Agora
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Card Instagram Story */}
              <Card className="shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Smartphone className="h-5 w-5 text-purple-600" />
                    📲 Instagram Story
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editingStories ? (
                    <Textarea
                      value={editableStories}
                      onChange={(e) => setEditableStories(e.target.value)}
                      className="min-h-[200px] text-sm"
                    />
                  ) : (
                    <div className="bg-muted/50 p-4 rounded-xl min-h-[200px] text-sm whitespace-pre-wrap border-2 border-border">
                      {editableStories}
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Button
                      onClick={() => handleCopy(editableStories, "Instagram Story")}
                      variant="outline"
                      className="w-full"
                    >
                      📋 Copiar
                    </Button>
                    <Button
                      onClick={() => setEditingStories(!editingStories)}
                      variant="outline"
                      className="w-full"
                    >
                      ✏️ {editingStories ? "Salvar" : "Editar"}
                    </Button>
                    <Button 
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      onClick={() => toast.success("Pronto para usar!")}
                    >
                      📱 Usar Agora
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Card WhatsApp */}
              <Card className="shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <MessageCircle className="h-5 w-5 text-green-600" />
                    💬 WhatsApp
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editingWhatsApp ? (
                    <Textarea
                      value={editableWhatsApp}
                      onChange={(e) => setEditableWhatsApp(e.target.value)}
                      className="min-h-[200px] text-sm"
                    />
                  ) : (
                    <div className="bg-muted/50 p-4 rounded-xl min-h-[200px] text-sm whitespace-pre-wrap border-2 border-border">
                      {editableWhatsApp}
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Button
                      onClick={() => handleCopy(editableWhatsApp, "WhatsApp")}
                      variant="outline"
                      className="w-full"
                    >
                      📋 Copiar
                    </Button>
                    <Button
                      onClick={() => setEditingWhatsApp(!editingWhatsApp)}
                      variant="outline"
                      className="w-full"
                    >
                      ✏️ {editingWhatsApp ? "Salvar" : "Editar"}
                    </Button>
                    <Button
                      onClick={() => handleWhatsAppSend(editableWhatsApp)}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      📱 Enviar Agora
                    </Button>
                  </div>
                </CardContent>
                  </Card>
                </div>

                {/* Gerador de Vídeos */}
                <div className="max-w-3xl mx-auto mt-8">
                  <VideoGenerator 
                    productImage={resultado.produto.imagem}
                    productName={resultado.produto.titulo}
                  />
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="historico">
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-4">📚 Meus Posts Gerados</h2>
              
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex gap-2">
                  <Button variant={historyFilter === 'todos' ? 'default' : 'outline'} onClick={() => setHistoryFilter('todos')}>Todos</Button>
                  <Button variant={historyFilter === 'agendado' ? 'default' : 'outline'} onClick={() => setHistoryFilter('agendado')}>Agendados</Button>
                  <Button variant={historyFilter === 'postado' ? 'default' : 'outline'} onClick={() => setHistoryFilter('postado')}>Postados</Button>
                  <Button variant={historyFilter === 'rascunho' ? 'default' : 'outline'} onClick={() => setHistoryFilter('rascunho')}>Rascunhos</Button>
                </div>
                
                <div className="flex-1 max-w-md">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Buscar por produto..." 
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {filteredHistory.length === 0 ? (
                <Card className="p-12 text-center">
                  <p className="text-muted-foreground">Nenhum post encontrado. Comece gerando posts na aba "Gerar Posts"!</p>
                </Card>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Agendado Para</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHistory.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{format(new Date(item.date), "dd/MM/yyyy HH:mm")}</TableCell>
                          <TableCell className="font-medium">{item.produto}</TableCell>
                          <TableCell>
                            <span className={cn(
                              "px-2 py-1 rounded-full text-xs font-bold",
                              item.status === 'postado' && "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
                              item.status === 'agendado' && "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
                              item.status === 'rascunho' && "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100"
                            )}>
                              {item.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            {item.scheduledDate ? format(new Date(item.scheduledDate), "dd/MM/yyyy HH:mm") : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setResultado({
                                    produto: { titulo: item.produto, imagem: '', score: 0, recomendacao: '' },
                                    posts: item.posts
                                  });
                                  setEditableInstagram(item.posts.instagram);
                                  setEditableStories(item.posts.stories);
                                  setEditableWhatsApp(item.posts.whatsapp);
                                }}
                              >
                                Ver Posts
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => deleteHistoryItem(item.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default IAMarketing;
