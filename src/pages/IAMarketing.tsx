import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Instagram, MessageCircle, Smartphone } from "lucide-react";
import { toast } from "sonner";

interface ProductAnalysis {
  produto: {
    titulo: string;
    preco: number;
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
  const [link, setLink] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);

  const handleAnalyze = async () => {
    if (!link.trim()) {
      toast.error("Por favor, cole um link válido");
      return;
    }

    setIsAnalyzing(true);
    
    try {
      const response = await fetch("https://amz-ofertas-robo.onrender.com/analisar-produto", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ link }),
      });

      if (!response.ok) {
        throw new Error("Erro ao analisar produto");
      }

      const data = await response.json();
      setAnalysis(data);
      toast.success("Posts gerados com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao analisar o produto. Tente novamente.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Texto do ${type} copiado!`);
  };

  const handleWhatsAppSend = (text: string) => {
    const encodedText = encodeURIComponent(text);
    window.open(`https://web.whatsapp.com/send?text=${encodedText}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="max-w-7xl mx-auto">
        {/* Seção de Análise */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-8 bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
            🤖 IA Marketing - Transforme Links em Posts Virais
          </h1>
          
          <Card className="max-w-3xl mx-auto">
            <CardContent className="pt-6 space-y-4">
              <Input
                type="text"
                placeholder="Cole o link do produto que você escolheu aqui..."
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="h-14 text-lg"
              />
              
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full h-14 text-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Analisando produto e gerando posts... ⏳
                  </>
                ) : (
                  "✨ ANALISAR E GERAR POSTS"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Seção de Resultado da Análise */}
        {analysis && (
          <>
            <Card className="max-w-3xl mx-auto mb-12">
              <CardHeader>
                <CardTitle>Análise do Produto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-6">
                  <img
                    src={analysis.produto.imagem}
                    alt={analysis.produto.titulo}
                    className="w-full md:w-48 h-48 object-cover rounded-lg"
                  />
                  
                  <div className="flex-1 space-y-3">
                    <h3 className="text-xl font-bold">{analysis.produto.titulo}</h3>
                    <p className="text-3xl font-bold text-green-600">
                      R$ {analysis.produto.preco.toFixed(2)}
                    </p>
                    <p className="text-lg font-semibold">
                      📊 Score de Conversão: {analysis.produto.score}/10
                    </p>
                    <div
                      className={`inline-block px-4 py-2 rounded-full font-bold ${
                        analysis.produto.score >= 8
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {analysis.produto.score >= 8 ? "✅ ÓTIMO POTENCIAL" : "⚠️ REVISAR"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Seção de Posts Gerados */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card Instagram */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Instagram className="h-5 w-5" />
                    Instagram
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-lg min-h-[200px]">
                    {analysis.posts.instagram}
                  </p>
                  <div className="space-y-2">
                    <Button
                      onClick={() => handleCopy(analysis.posts.instagram, "Instagram")}
                      variant="outline"
                      className="w-full"
                    >
                      📋 Copiar
                    </Button>
                    <Button variant="outline" className="w-full">
                      ✏️ Editar
                    </Button>
                    <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600">
                      📤 Usar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Card Stories */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    Stories
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-lg min-h-[200px]">
                    {analysis.posts.stories}
                  </p>
                  <div className="space-y-2">
                    <Button
                      onClick={() => handleCopy(analysis.posts.stories, "Stories")}
                      variant="outline"
                      className="w-full"
                    >
                      📋 Copiar
                    </Button>
                    <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600">
                      📤 Usar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Card WhatsApp */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    WhatsApp
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-lg min-h-[200px]">
                    {analysis.posts.whatsapp}
                  </p>
                  <div className="space-y-2">
                    <Button
                      onClick={() => handleCopy(analysis.posts.whatsapp, "WhatsApp")}
                      variant="outline"
                      className="w-full"
                    >
                      📋 Copiar
                    </Button>
                    <Button
                      onClick={() => handleWhatsAppSend(analysis.posts.whatsapp)}
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
