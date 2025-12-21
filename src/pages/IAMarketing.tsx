import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Instagram, MessageCircle, ArrowLeft, Copy, Calendar as CalendarIcon, Upload, Video, Facebook, Sparkles, Download } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SchedulePostsModal } from "@/components/SchedulePostsModal";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { VideoGenerator } from "@/components/VideoGenerator";

interface PostVariations {
  opcaoA: string;
  opcaoB: string;
  opcaoC: string;
}

interface ProductAnalysis {
  produto: {
    titulo: string;
    preco: string;
    url: string;
    originalUrl: string;
    imagem?: string | null;
  };
  instagram: PostVariations;
  facebook: PostVariations;
  story: PostVariations;
  whatsapp: PostVariations;
  generatedImage?: string | null;
}

const IAMarketing = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ProductAnalysis | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [userType, setUserType] = useState<string>('empresa');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [selectedVariations, setSelectedVariations] = useState({
    instagram: 'opcaoA' as keyof PostVariations,
    facebook: 'opcaoA' as keyof PostVariations,
    story: 'opcaoA' as keyof PostVariations,
    whatsapp: 'opcaoA' as keyof PostVariations
  });

  // Estados editáveis para cada variação
  const [editableTexts, setEditableTexts] = useState({
    instagram: { opcaoA: '', opcaoB: '', opcaoC: '' },
    facebook: { opcaoA: '', opcaoB: '', opcaoC: '' },
    story: { opcaoA: '', opcaoB: '', opcaoC: '' },
    whatsapp: { opcaoA: '', opcaoB: '', opcaoC: '' }
  });

  // Carregar tipo do usuário
  useState(() => {
    const loadUserType = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tipo')
          .eq('id', user.id)
          .single();
        
        if (profile?.tipo) {
          setUserType(profile.tipo);
        }
      }
    };
    loadUserType();
  });

  const handleAnalyze = async () => {
    if (!url.trim()) {
      toast.error("Digite uma descrição ou cole um link");
      return;
    }

    setLoading(true);
    setResultado(null);
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error("Você precisa estar logado");
        return;
      }

      // Converter imagens para base64
      const imagesBase64: string[] = [];
      for (const file of uploadedFiles) {
        if (file.type.startsWith('image/')) {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          imagesBase64.push(base64);
        }
      }

      // 🚀 PILAR 1: Detectar se é URL da Shopee
      const isShopeeUrl = url.trim().toLowerCase().includes('shopee.com');
      
      const { data, error } = await supabase.functions.invoke('analisar-produto', {
        body: { 
          url: url.trim(),
          images: imagesBase64,
          source: isShopeeUrl ? 'shopee' : 'generic' // Passar source para edge function
        }
      });

      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao analisar produto');
      }

      console.log('✅ Dados recebidos:', data);

      // Criar estrutura de análise com os dados corretos
      const analysisResult: ProductAnalysis = {
        produto: data.produto || { titulo: "Produto", preco: "0", url: url, originalUrl: url },
        instagram: data.instagram || { opcaoA: '', opcaoB: '', opcaoC: '' },
        facebook: data.facebook || { opcaoA: '', opcaoB: '', opcaoC: '' },
        story: data.story || { opcaoA: '', opcaoB: '', opcaoC: '' },
        whatsapp: data.whatsapp || { opcaoA: '', opcaoB: '', opcaoC: '' },
        generatedImage: data.generatedImage || null
      };

      setResultado(analysisResult);
      
      // Se uma imagem foi gerada, mostrar para o usuário
      if (data.generatedImage) {
        toast.success("🎨 Imagem gerada com IA!");
      }
      
      // Inicializar textos editáveis
      setEditableTexts({
        instagram: analysisResult.instagram,
        facebook: analysisResult.facebook,
        story: analysisResult.story,
        whatsapp: analysisResult.whatsapp
      });

      // Salvar no banco
      const { error: insertError } = await supabase
        .from('posts')
        .insert({
          user_id: userData.user.id,
          titulo: analysisResult.produto.titulo,
          link_produto: analysisResult.produto.originalUrl,
          link_afiliado: analysisResult.produto.url,
          texto_instagram: JSON.stringify(analysisResult.instagram),
          texto_story: JSON.stringify(analysisResult.story),
          texto_facebook: JSON.stringify(analysisResult.facebook),
          texto_whatsapp: JSON.stringify(analysisResult.whatsapp),
          status: 'rascunho'
        });

      if (insertError) {
        console.error("Erro ao salvar:", insertError);
      }


      toast.success("✅ Posts gerados e salvos!");
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao analisar produto';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files).filter(file => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) {
        toast.error(`${file.name} não é uma imagem ou vídeo válido`);
        return false;
      }
      return true;
    });

    setUploadedFiles(prev => [...prev, ...newFiles]);
    toast.success(`${newFiles.length} arquivo(s) adicionado(s)`);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCopy = (text: string, type: string) => {
    const fullText = `${text}\n\n🔗 ${resultado?.produto?.originalUrl || url}`;
    navigator.clipboard.writeText(fullText);
    toast.success(`${type} copiado com link!`);
  };

  const handleDownloadImage = () => {
    if (!resultado?.generatedImage) return;
    
    // Criar um link temporário para download
    const link = document.createElement('a');
    link.href = resultado.generatedImage;
    link.download = `imagem-ia-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("Imagem baixada com sucesso!");
  };

  const handleScheduleAll = () => {
    if (!resultado) return;
    setShowScheduleModal(true);
  };

  const updateText = (platform: 'instagram' | 'facebook' | 'story' | 'whatsapp', variation: keyof PostVariations, text: string) => {
    setEditableTexts(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [variation]: text
      }
    }));
  };

  // 🚀 PILAR 2: Criar Campanha a partir do texto do WhatsApp
  const handleCreateCampaign = () => {
    const textoSelecionado = editableTexts.whatsapp[selectedVariations.whatsapp];
    
    if (!textoSelecionado.trim()) {
      toast.error("Selecione uma variação de texto primeiro");
      return;
    }

    // Salvar no localStorage
    localStorage.setItem('campaignMessageTemplate', textoSelecionado);
    
    toast.success("Texto salvo! Redirecionando para criar campanha...");
    
    // Navegar para página de campanhas
    setTimeout(() => {
      navigate('/campanhas-prospeccao');
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <Tabs defaultValue="gerar" className="w-full">
          <TabsList className="grid w-full max-w-lg mx-auto grid-cols-3 mb-8">
            <TabsTrigger value="gerar">Gerar Posts</TabsTrigger>
            <TabsTrigger value="video">🎬 Gerar Vídeo</TabsTrigger>
            <TabsTrigger value="historico">Meus Posts</TabsTrigger>
          </TabsList>

          <TabsContent value="gerar">
            {/* Header */}
            <div className="mb-8">
              <Button
                onClick={() => navigate('/dashboard')}
                variant="ghost"
                className="mb-4"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              
              <div className="text-center space-y-2">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent">
                  ✨ IA Marketing
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground">
                  Cole um link OU envie fotos + descrição para receber 3 variações de posts
                </p>
              </div>
            </div>

            {/* Campo Principal */}
            <Card className="max-w-4xl mx-auto mb-8 shadow-2xl border-2">
              <CardContent className="pt-8 space-y-6">
                <div className="space-y-4">
                  <Textarea
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Cole um link OU escreva uma descrição (ex: 'crie posts para minha marca de lubrificantes automotivos')"
                    className="text-lg p-6 min-h-[100px]"
                    disabled={loading}
                  />
                  
                  {/* Upload de Arquivos */}
                  <div className="border-2 border-dashed rounded-lg p-6 space-y-4">
                    <div className="flex items-center justify-center gap-4">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          multiple
                          accept="image/*,video/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors">
                          <Upload className="h-5 w-5" />
                          <span className="font-medium">Upload Fotos/Vídeos</span>
                        </div>
                      </label>
                    </div>

                    {uploadedFiles.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {uploadedFiles.map((file, index) => (
                          <div key={index} className="relative group">
                            <div className="aspect-square rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                              {file.type.startsWith('image/') ? (
                                <img 
                                  src={URL.createObjectURL(file)} 
                                  alt={file.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Video className="h-8 w-8 text-muted-foreground" />
                              )}
                            </div>
                            <button
                              onClick={() => removeFile(index)}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ✕
                            </button>
                            <p className="text-xs text-center mt-1 truncate">{file.name}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <Button
                    onClick={handleAnalyze}
                    disabled={loading || !url.trim()}
                    size="lg"
                    className="w-full text-lg py-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Analisando com IA...
                      </>
                    ) : (
                      <>
                        ✨ ANALISAR COM IA
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Resultados */}
            {resultado && (
              <div className="max-w-7xl mx-auto space-y-6">
                {/* Imagem Gerada */}
                {resultado.generatedImage && (
                  <Card className="shadow-xl border-2 border-purple-500">
                    <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        🎨 Imagem Gerada com IA
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <img 
                        src={resultado.generatedImage} 
                        alt="Imagem gerada"
                        className="w-full rounded-lg shadow-lg"
                      />
                      <Button
                        onClick={handleDownloadImage}
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                      >
                        <Download className="mr-2 h-5 w-5" />
                        💾 Salvar Imagem no Computador
                      </Button>
                    </CardContent>
                  </Card>
                )}
                
                {/* Grid de Cards - 4 colunas (Instagram, Facebook, Story, WhatsApp) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Card Instagram */}
                  <Card className="shadow-xl border-2 hover:border-pink-500 transition-colors">
                    <CardHeader className="bg-gradient-to-r from-pink-500 to-purple-500 text-white">
                      <CardTitle className="flex items-center gap-2">
                        <Instagram className="h-5 w-5" />
                        📱 Post Instagram
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <RadioGroup
                        value={selectedVariations.instagram}
                        onValueChange={(value) => setSelectedVariations({ ...selectedVariations, instagram: value as keyof PostVariations })}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="opcaoA" id="inst-a" />
                          <Label htmlFor="inst-a" className="cursor-pointer">Opção A: Direto/Urgente</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="opcaoB" id="inst-b" />
                          <Label htmlFor="inst-b" className="cursor-pointer">Opção B: Storytelling</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="opcaoC" id="inst-c" />
                          <Label htmlFor="inst-c" className="cursor-pointer">Opção C: Educativo</Label>
                        </div>
                      </RadioGroup>

                      <Textarea
                        value={editableTexts.instagram[selectedVariations.instagram]}
                        onChange={(e) => updateText('instagram', selectedVariations.instagram, e.target.value)}
                        className="min-h-[200px] text-sm"
                      />

                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleCopy(editableTexts.instagram[selectedVariations.instagram], 'Instagram')}
                          variant="outline"
                          className="flex-1"
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copiar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card Facebook */}
                  <Card className="shadow-xl border-2 hover:border-blue-500 transition-colors">
                    <CardHeader className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
                      <CardTitle className="flex items-center gap-2">
                        <Facebook className="h-5 w-5" />
                        📘 Post Facebook
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <RadioGroup
                        value={selectedVariations.facebook}
                        onValueChange={(value) => setSelectedVariations({ ...selectedVariations, facebook: value as keyof PostVariations })}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="opcaoA" id="fb-a" />
                          <Label htmlFor="fb-a" className="cursor-pointer">Opção A: Casual/Amigável</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="opcaoB" id="fb-b" />
                          <Label htmlFor="fb-b" className="cursor-pointer">Opção B: Profissional</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="opcaoC" id="fb-c" />
                          <Label htmlFor="fb-c" className="cursor-pointer">Opção C: Promocional</Label>
                        </div>
                      </RadioGroup>

                      <Textarea
                        value={editableTexts.facebook[selectedVariations.facebook]}
                        onChange={(e) => updateText('facebook', selectedVariations.facebook, e.target.value)}
                        className="min-h-[200px] text-sm"
                      />

                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleCopy(editableTexts.facebook[selectedVariations.facebook], 'Facebook')}
                          variant="outline"
                          className="flex-1"
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copiar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card Story */}
                  <Card className="shadow-xl border-2 hover:border-orange-500 transition-colors">
                    <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        📖 Story Instagram
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <RadioGroup
                        value={selectedVariations.story}
                        onValueChange={(value) => setSelectedVariations({ ...selectedVariations, story: value as keyof PostVariations })}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="opcaoA" id="story-a" />
                          <Label htmlFor="story-a" className="cursor-pointer">Opção A: Curto/Impactante</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="opcaoB" id="story-b" />
                          <Label htmlFor="story-b" className="cursor-pointer">Opção B: Pergunta Interativa</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="opcaoC" id="story-c" />
                          <Label htmlFor="story-c" className="cursor-pointer">Opção C: Contagem Regressiva</Label>
                        </div>
                      </RadioGroup>

                      <Textarea
                        value={editableTexts.story[selectedVariations.story]}
                        onChange={(e) => updateText('story', selectedVariations.story, e.target.value)}
                        className="min-h-[150px] text-sm"
                        maxLength={80}
                      />
                      <p className="text-xs text-muted-foreground text-right">
                        {editableTexts.story[selectedVariations.story].length}/80 caracteres
                      </p>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleCopy(editableTexts.story[selectedVariations.story], 'Story')}
                          variant="outline"
                          className="flex-1"
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copiar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card WhatsApp */}
                  <Card className="shadow-xl border-2 hover:border-green-500 transition-colors">
                    <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                      <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5" />
                        💬 Mensagem WhatsApp
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <RadioGroup
                        value={selectedVariations.whatsapp}
                        onValueChange={(value) => setSelectedVariations({ ...selectedVariations, whatsapp: value as keyof PostVariations })}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="opcaoA" id="wpp-a" />
                          <Label htmlFor="wpp-a" className="cursor-pointer">Opção A: Curto e Direto</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="opcaoB" id="wpp-b" />
                          <Label htmlFor="wpp-b" className="cursor-pointer">Opção B: Amigável</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="opcaoC" id="wpp-c" />
                          <Label htmlFor="wpp-c" className="cursor-pointer">Opção C: Com Call-to-Action</Label>
                        </div>
                      </RadioGroup>

                      {/* Exibir imagem do produto se disponível */}
                      {resultado?.produto?.imagem && (
                        <div className="border rounded-lg p-2 bg-muted/30">
                          <p className="text-xs text-muted-foreground mb-2">📷 Imagem do produto:</p>
                          <img 
                            src={resultado.produto.imagem} 
                            alt={resultado.produto.titulo}
                            className="w-full h-32 object-cover rounded-md"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            💡 Copie esta imagem e cole no WhatsApp junto com o texto
                          </p>
                        </div>
                      )}

                      <Textarea
                        value={editableTexts.whatsapp[selectedVariations.whatsapp]}
                        onChange={(e) => updateText('whatsapp', selectedVariations.whatsapp, e.target.value)}
                        className="min-h-[200px] text-sm"
                      />

                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleCopy(editableTexts.whatsapp[selectedVariations.whatsapp], 'WhatsApp')}
                            variant="outline"
                            className="flex-1"
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Copiar
                          </Button>
                        </div>
                        
                        {/* Botão Envio em Massa WhatsApp */}
                        <Button
                          onClick={() => {
                            const texto = editableTexts.whatsapp[selectedVariations.whatsapp];
                            const imagemProduto = resultado?.generatedImage || resultado?.produto?.imagem;
                            const tituloProduto = resultado?.produto?.titulo;
                            
                            // Navegar para página WhatsApp com dados da campanha
                            navigate('/whatsapp', {
                              state: {
                                messageTemplate: texto,
                                productImage: imagemProduto,
                                productTitle: tituloProduto,
                                campaignName: `Campanha ${tituloProduto || 'Marketing'}`,
                                fromIAMarketing: true
                              }
                            });
                            
                            toast.success('✅ Redirecionando para WhatsApp...');
                          }}
                          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                        >
                          <MessageCircle className="mr-2 h-4 w-4" />
                          📤 Enviar para WhatsApp (Grupos)
                        </Button>
                        
                        {/* 🚀 PILAR 2: Botão Criar Campanha de Prospecção */}
                        <Button
                          onClick={handleCreateCampaign}
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          🚀 Criar Campanha de Prospecção
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Botão Principal - Rodapé */}
                <div className="flex justify-center pt-4">
                  <Button
                    onClick={handleScheduleAll}
                    size="lg"
                    className="bg-green-600 hover:bg-green-700 text-lg px-12 py-6"
                  >
                    <CalendarIcon className="mr-2 h-6 w-6" />
                    📅 AGENDAR TODOS OS SELECIONADOS
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="video">
            <div className="max-w-4xl mx-auto">
              <Button
                onClick={() => navigate('/dashboard')}
                variant="ghost"
                className="mb-4"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              
              <VideoGenerator />
            </div>
          </TabsContent>

          <TabsContent value="historico">
            <div className="max-w-4xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="text-center">📚 Histórico de Posts</CardTitle>
                </CardHeader>
                <CardContent className="text-center py-20 text-muted-foreground">
                  Em breve: veja todos os seus posts salvos e agendados
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de Agendamento */}
      {resultado && (
        <SchedulePostsModal
          open={showScheduleModal}
          onOpenChange={setShowScheduleModal}
          postContent={{
            instagram: editableTexts.instagram[selectedVariations.instagram],
            facebook: editableTexts.facebook[selectedVariations.facebook],
            story: editableTexts.story[selectedVariations.story],
            whatsapp: editableTexts.whatsapp[selectedVariations.whatsapp]
          }}
          userType={userType}
        />
      )}
    </div>
  );
};

export default IAMarketing;
