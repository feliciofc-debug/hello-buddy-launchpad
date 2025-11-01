import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Instagram, MessageCircle, ArrowLeft, Copy, Calendar as CalendarIcon, Send } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SchedulePostsModal } from "@/components/SchedulePostsModal";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

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
}

const IAMarketing = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ProductAnalysis | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Estados editáveis
  const [editableInstagram, setEditableInstagram] = useState("");
  const [editableStories, setEditableStories] = useState("");
  const [editableWhatsApp, setEditableWhatsApp] = useState("");

  const handleAnalyze = async () => {
    if (!url.trim()) {
      toast.error("Cole um link de produto");
      return;
    }

    setLoading(true);
    setResultado(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('analisar-produto', {
        body: { url: url.trim() }
      });

      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao analisar produto');
      }

      setResultado(data);
      setEditableInstagram(data.posts.instagram);
      setEditableStories(data.posts.story);
      setEditableWhatsApp(data.posts.whatsapp);
      toast.success("✅ Posts gerados pela IA!");
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao analisar produto';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${type} copiado!`);
  };

  const handleWhatsAppSend = (text: string) => {
    const encodedText = encodeURIComponent(text);
    window.open(`https://web.whatsapp.com/send?text=${encodedText}`, "_blank");
  };

  const handleScheduleAll = () => {
    if (!resultado) return;
    setShowScheduleModal(true);
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
                  Cole qualquer link de produto e receba posts prontos
                </p>
              </div>
            </div>

            {/* Campo Principal */}
            <Card className="max-w-4xl mx-auto mb-8 shadow-2xl border-2">
              <CardContent className="pt-8 space-y-6">
                <div className="space-y-4">
                  <Input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()}
                    placeholder="Cole aqui o link do seu produto (Shopee, Amazon, Magazine, etc)"
                    className="text-lg p-6 h-auto"
                    disabled={loading}
                  />
                  
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
              <div className="max-w-6xl mx-auto space-y-6">
                {/* Botão Agendar Todos */}
                <div className="flex justify-center">
                  <Button
                    onClick={handleScheduleAll}
                    size="lg"
                    className="bg-green-600 hover:bg-green-700 text-lg px-8"
                  >
                    <CalendarIcon className="mr-2 h-5 w-5" />
                    📅 AGENDAR TODOS
                  </Button>
                </div>

                {/* Grid de Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Post Instagram */}
                  <Card className="shadow-xl border-2 hover:border-purple-500 transition-colors">
                    <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                      <CardTitle className="flex items-center gap-2">
                        <Instagram className="h-5 w-5" />
                        Post Instagram
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      {resultado.produto?.imagem && !resultado.produto.imagem.includes('placeholder') ? (
                        <img 
                          src={resultado.produto.imagem} 
                          alt={resultado.produto.titulo}
                          className="w-full h-48 object-cover rounded-lg shadow-md"
                        />
                      ) : (
                        <div className="w-full h-48 bg-muted rounded-lg shadow-md flex items-center justify-center text-muted-foreground text-sm text-center p-4">
                          📸 Imagem não disponível<br />Use o link completo do produto
                        </div>
                      )}
                      <Textarea
                        value={editableInstagram}
                        onChange={(e) => setEditableInstagram(e.target.value)}
                        className="min-h-[200px] text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleCopy(editableInstagram, 'Post Instagram')}
                          variant="outline"
                          className="flex-1"
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copiar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Story Instagram */}
                  <Card className="shadow-xl border-2 hover:border-orange-500 transition-colors">
                    <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                      <CardTitle className="flex items-center gap-2">
                        <Instagram className="h-5 w-5" />
                        Story Instagram
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      {resultado.produto?.imagem && !resultado.produto.imagem.includes('placeholder') ? (
                        <img 
                          src={resultado.produto.imagem} 
                          alt={resultado.produto.titulo}
                          className="w-full h-48 object-cover rounded-lg shadow-md"
                        />
                      ) : (
                        <div className="w-full h-48 bg-muted rounded-lg shadow-md flex items-center justify-center text-muted-foreground text-sm text-center p-4">
                          📸 Imagem não disponível<br />Use o link completo do produto
                        </div>
                      )}
                      <Textarea
                        value={editableStories}
                        onChange={(e) => setEditableStories(e.target.value)}
                        className="min-h-[200px] text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleCopy(editableStories, 'Story')}
                          variant="outline"
                          className="flex-1"
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copiar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* WhatsApp */}
                  <Card className="shadow-xl border-2 hover:border-green-500 transition-colors">
                    <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                      <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5" />
                        WhatsApp
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      {resultado.produto?.imagem && !resultado.produto.imagem.includes('placeholder') ? (
                        <img 
                          src={resultado.produto.imagem} 
                          alt={resultado.produto.titulo}
                          className="w-full h-48 object-cover rounded-lg shadow-md"
                        />
                      ) : (
                        <div className="w-full h-48 bg-muted rounded-lg shadow-md flex items-center justify-center text-muted-foreground text-sm text-center p-4">
                          📸 Imagem não disponível<br />Use o link completo do produto
                        </div>
                      )}
                      <Textarea
                        value={editableWhatsApp}
                        onChange={(e) => setEditableWhatsApp(e.target.value)}
                        className="min-h-[200px] text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleCopy(editableWhatsApp, 'WhatsApp')}
                          variant="outline"
                          className="flex-1"
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copiar
                        </Button>
                        <Button
                          onClick={() => handleWhatsAppSend(editableWhatsApp)}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Enviar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
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
            instagram: editableInstagram,
            stories: editableStories,
            whatsapp: editableWhatsApp
          }}
        />
      )}
    </div>
  );
};

export default IAMarketing;
