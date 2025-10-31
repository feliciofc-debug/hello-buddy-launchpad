import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Download, Play } from "lucide-react";
import { toast } from "sonner";

interface VideoGeneratorProps {
  productImage: string;
  productName: string;
}

export const VideoGenerator = ({ productImage, productName }: VideoGeneratorProps) => {
  const [selectedStyle, setSelectedStyle] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);

  const videoStyles = [
    { id: "zoom", name: "Zoom Dinâmico", description: "Zoom suave com efeitos" },
    { id: "transitions", name: "Transições", description: "Múltiplas transições" },
    { id: "animated-text", name: "Texto Animado", description: "Textos com animação" },
    { id: "glitch", name: "Efeito Glitch", description: "Visual moderno" },
    { id: "particles", name: "Partículas", description: "Efeitos de partículas" }
  ];

  const templates = [
    { id: "tiktok", name: "TikTok Viral", description: "Formato vertical otimizado" },
    { id: "reels", name: "Instagram Reels", description: "Efeitos modernos" },
    { id: "stories", name: "Stories", description: "Dinâmico e rápido" },
    { id: "ecommerce", name: "E-commerce", description: "Produto girando 360°" },
    { id: "flash-sale", name: "Oferta Relâmpago", description: "Countdown timer" },
    { id: "storytelling", name: "Storytelling", description: "Antes/depois" },
    { id: "promocional", name: "Promocional", description: "Destaque de preço" }
  ];

  const handleGenerate = async () => {
    if (!selectedStyle || !selectedTemplate) {
      toast.error("Selecione um estilo e um template");
      return;
    }

    setIsGenerating(true);
    toast.info("Gerando vídeo... Isso pode levar alguns minutos");

    // Simular geração (substituir por API real de geração de vídeo)
    setTimeout(() => {
      setGeneratedVideo("https://www.w3schools.com/html/mov_bbb.mp4"); // Mock
      setIsGenerating(false);
      toast.success("Vídeo gerado com sucesso!");
    }, 5000);
  };

  const handleDownload = () => {
    if (!generatedVideo) return;
    
    const link = document.createElement('a');
    link.href = generatedVideo;
    link.download = `${productName.toLowerCase().replace(/\s+/g, '-')}-video.mp4`;
    link.click();
    toast.success("Download iniciado!");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="w-5 h-5" />
          🎬 Gerar Vídeos para TikTok, Reels e Stories
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Crie vídeos virais otimizados para TikTok, Instagram Reels e Stories em segundos
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preview da Imagem */}
        <div>
          <Label>Imagem do Produto</Label>
          <div className="mt-2 border rounded-lg overflow-hidden">
            <img src={productImage} alt={productName} className="w-full h-48 object-cover" />
          </div>
        </div>

        {/* Seleção de Estilo */}
        <div>
          <Label>Estilo do Vídeo</Label>
          <Select value={selectedStyle} onValueChange={setSelectedStyle}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Escolha um estilo..." />
            </SelectTrigger>
            <SelectContent>
              {videoStyles.map(style => (
                <SelectItem key={style.id} value={style.id}>
                  <div>
                    <div className="font-semibold">{style.name}</div>
                    <div className="text-xs text-muted-foreground">{style.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Seleção de Template */}
        <div>
          <Label>Template</Label>
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Escolha um template..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map(template => (
                <SelectItem key={template.id} value={template.id}>
                  <div>
                    <div className="font-semibold">{template.name}</div>
                    <div className="text-xs text-muted-foreground">{template.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Botão Gerar */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !selectedStyle || !selectedTemplate}
          className="w-full h-12 text-lg font-bold bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Gerando vídeo viral...
            </>
          ) : (
            "🎬 GERAR VÍDEO VIRAL (15-60s)"
          )}
        </Button>

        {/* Preview do Vídeo Gerado */}
        {generatedVideo && (
          <div className="space-y-4">
            <Label>Vídeo Gerado (1080x1920 - Vertical)</Label>
            <div className="border rounded-lg overflow-hidden bg-black">
              <video src={generatedVideo} controls className="w-full max-h-96" />
            </div>
            <Button onClick={handleDownload} className="w-full" variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Baixar Vídeo MP4
            </Button>
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-muted-foreground bg-muted p-4 rounded-lg">
          <p className="font-semibold mb-2">📱 Formatos disponíveis:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>TikTok: 1080x1920 (vertical) - Formato otimizado</li>
            <li>Instagram Reels: 1080x1920 (vertical)</li>
            <li>Stories: 1080x1920 (vertical)</li>
            <li>Feed Instagram: 1080x1080 (quadrado)</li>
            <li>YouTube Shorts: 1080x1920 (vertical)</li>
          </ul>
          <p className="mt-3 text-xs opacity-80">
            ✨ Todos os vídeos são otimizados para máximo engajamento
          </p>
        </div>
      </CardContent>
    </Card>
  );
};