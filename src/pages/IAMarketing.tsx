import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Instagram, Smartphone, MessageCircle, ArrowLeft, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import axios from "axios";

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
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<ProductAnalysis | null>(null);
  
  // Estados para permitir edição dos posts
  const [editableInstagram, setEditableInstagram] = useState("");
  const [editableStories, setEditableStories] = useState("");
  const [editableWhatsApp, setEditableWhatsApp] = useState("");
  const [editingInstagram, setEditingInstagram] = useState(false);
  const [editingStories, setEditingStories] = useState(false);
  const [editingWhatsApp, setEditingWhatsApp] = useState(false);

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

  const getScoreColor = (score: number) => {
    if (score >= 8) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
    if (score >= 5) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100";
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100";
  };

  const getRecommendation = (score: number) => {
    return score >= 8 ? "✅ Produto recomendado para divulgação" : "⚠️ Revise antes de divulgar";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header da Página */}
        <div className="mb-8">
          <Button
            onClick={() => navigate('/')}
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
            
            <Button
              onClick={handleAnalyze}
              disabled={loading}
              className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  🔍 Analisando produto... Aguarde 10-20 segundos
                </>
              ) : (
                "✨ ANALISAR COM IA"
              )}
            </Button>
          </CardContent>
        </Card>

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
          </>
        )}
      </div>
    </div>
  );
};

export default IAMarketing;
