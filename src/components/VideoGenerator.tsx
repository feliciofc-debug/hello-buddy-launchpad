import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Download, Play, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

interface VideoGeneratorProps {
  productImage: string;
  productName: string;
  productPrice?: number;
}

export const VideoGenerator = ({ productImage, productName, productPrice }: VideoGeneratorProps) => {
  const [selectedStyle, setSelectedStyle] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  const createVideoFromImages = async (
    images: string[], 
    textOverlays: string[],
    duration: number = 15
  ): Promise<string> => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d')!;

    // Carregar todas as imagens
    const loadedImages: HTMLImageElement[] = [];
    for (let i = 0; i < images.length; i++) {
      try {
        const img = await loadImage(images[i]);
        loadedImages.push(img);
      } catch (e) {
        console.error(`Erro ao carregar imagem ${i}:`, e);
      }
    }

    if (loadedImages.length === 0) {
      throw new Error("Nenhuma imagem carregada");
    }

    // Configurar gravação
    const stream = canvas.captureStream(30);
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 5000000
    });

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

    return new Promise((resolve, reject) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        resolve(url);
      };

      mediaRecorder.onerror = reject;
      mediaRecorder.start();

      const fps = 30;
      const totalFrames = duration * fps;
      const framesPerImage = Math.floor(totalFrames / loadedImages.length);
      const transitionFrames = 15; // 0.5s de transição

      let currentFrame = 0;
      let currentImageIndex = 0;

      const drawFrame = () => {
        if (currentFrame >= totalFrames) {
          mediaRecorder.stop();
          return;
        }

        const frameInCurrentImage = currentFrame % framesPerImage;
        const img = loadedImages[currentImageIndex];
        const nextImg = loadedImages[(currentImageIndex + 1) % loadedImages.length];

        // Limpar canvas
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Calcular efeitos baseados no estilo
        const progress = frameInCurrentImage / framesPerImage;
        
        // Efeito de zoom
        let scale = 1;
        if (selectedStyle === 'zoom') {
          scale = 1 + (progress * 0.1);
        }

        // Desenhar imagem atual com escala
        const drawImage = (image: HTMLImageElement, alpha: number, zoomScale: number) => {
          ctx.save();
          ctx.globalAlpha = alpha;
          
          // Centralizar e escalar
          const aspectRatio = image.width / image.height;
          let drawWidth = canvas.width * zoomScale;
          let drawHeight = drawWidth / aspectRatio;
          
          if (drawHeight < canvas.height * zoomScale) {
            drawHeight = canvas.height * zoomScale;
            drawWidth = drawHeight * aspectRatio;
          }
          
          const x = (canvas.width - drawWidth) / 2;
          const y = (canvas.height - drawHeight) / 2;
          
          ctx.drawImage(image, x, y, drawWidth, drawHeight);
          ctx.restore();
        };

        // Transição crossfade
        if (frameInCurrentImage >= framesPerImage - transitionFrames) {
          const transitionProgress = (frameInCurrentImage - (framesPerImage - transitionFrames)) / transitionFrames;
          drawImage(img, 1 - transitionProgress, scale);
          drawImage(nextImg, transitionProgress, 1);
        } else {
          drawImage(img, 1, scale);
        }

        // Efeito glitch
        if (selectedStyle === 'glitch' && Math.random() > 0.9) {
          const glitchHeight = 20 + Math.random() * 50;
          const glitchY = Math.random() * canvas.height;
          const imageData = ctx.getImageData(0, glitchY, canvas.width, glitchHeight);
          ctx.putImageData(imageData, Math.random() * 20 - 10, glitchY);
        }

        // Efeito partículas
        if (selectedStyle === 'particles') {
          for (let i = 0; i < 20; i++) {
            const x = Math.random() * canvas.width;
            const y = (currentFrame * 2 + Math.random() * 100) % canvas.height;
            const size = 2 + Math.random() * 4;
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.5})`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Adicionar texto overlay
        const textIndex = currentImageIndex % textOverlays.length;
        const text = textOverlays[textIndex];
        
        // Sombra do texto
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        // Texto principal
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 64px Arial';
        ctx.textAlign = 'center';
        
        // Animação de texto
        let textY = canvas.height - 200;
        if (selectedStyle === 'animated-text') {
          textY = canvas.height - 200 + Math.sin(currentFrame * 0.1) * 10;
        }
        
        ctx.fillText(text, canvas.width / 2, textY);
        ctx.shadowColor = 'transparent';

        // Barra de progresso visual no vídeo
        const barWidth = (currentFrame / totalFrames) * (canvas.width - 100);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(50, canvas.height - 80, canvas.width - 100, 6);
        ctx.fillStyle = '#fff';
        ctx.fillRect(50, canvas.height - 80, barWidth, 6);

        currentFrame++;
        if (currentFrame % framesPerImage === 0 && currentFrame < totalFrames) {
          currentImageIndex = (currentImageIndex + 1) % loadedImages.length;
        }

        // Atualizar progresso UI
        const renderProgress = Math.floor((currentFrame / totalFrames) * 100);
        setProgress(50 + renderProgress * 0.5);
        setProgressText(`Renderizando vídeo: ${renderProgress}%`);

        requestAnimationFrame(drawFrame);
      };

      drawFrame();
    });
  };

  const handleGenerate = async () => {
    if (!selectedStyle || !selectedTemplate) {
      toast.error("Selecione um estilo e um template");
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setProgressText("Iniciando geração...");
    setGeneratedVideo(null);

    try {
      // Etapa 1: Gerar imagens com Gemini
      setProgress(10);
      setProgressText("Gerando imagens com IA...");

      const { data, error } = await supabase.functions.invoke('generate-product-video', {
        body: {
          productName,
          productImage,
          productPrice,
          style: selectedStyle,
          template: selectedTemplate
        }
      });

      if (error) throw error;

      if (!data.success || !data.images?.length) {
        throw new Error(data.error || "Falha ao gerar imagens");
      }

      setProgress(50);
      setProgressText("Imagens geradas! Criando vídeo...");

      // Etapa 2: Criar vídeo a partir das imagens
      const videoUrl = await createVideoFromImages(
        data.images,
        data.textOverlays || [productName, '🔥 OFERTA'],
        data.videoDuration || 15
      );

      setGeneratedVideo(videoUrl);
      setProgress(100);
      setProgressText("Vídeo pronto!");
      toast.success("Vídeo gerado com sucesso!");

    } catch (error: any) {
      console.error("Erro:", error);
      toast.error(error.message || "Erro ao gerar vídeo");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedVideo) return;
    
    const link = document.createElement('a');
    link.href = generatedVideo;
    link.download = `${productName.toLowerCase().replace(/\s+/g, '-')}-video.webm`;
    link.click();
    toast.success("Download iniciado!");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Gerar Vídeo com IA (Gemini + Slideshow)
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Cria vídeos usando imagens geradas por IA com transições animadas - custo zero de API de vídeo!
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

        {/* Progresso */}
        {isGenerating && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">{progressText}</p>
          </div>
        )}

        {/* Botão Gerar */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !selectedStyle || !selectedTemplate}
          className="w-full h-12 text-lg font-bold bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {progressText}
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-5 w-5" />
              GERAR VÍDEO COM IA
            </>
          )}
        </Button>

        {/* Preview do Vídeo Gerado */}
        {generatedVideo && (
          <div className="space-y-4">
            <Label>Vídeo Gerado (1080x1920 - WebM)</Label>
            <div className="border rounded-lg overflow-hidden bg-black">
              <video 
                src={generatedVideo} 
                controls 
                autoPlay
                loop
                className="w-full max-h-[500px]" 
              />
            </div>
            <Button onClick={handleDownload} className="w-full" variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Baixar Vídeo WebM
            </Button>
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-muted-foreground bg-muted p-4 rounded-lg">
          <p className="font-semibold mb-2">🚀 Como funciona:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Gemini gera 4 variações de imagem do produto</li>
            <li>Canvas API monta slideshow com transições</li>
            <li>MediaRecorder exporta como vídeo WebM</li>
          </ol>
          <p className="mt-3 text-xs opacity-80">
            💡 Custo: Apenas créditos Lovable AI (sem API de vídeo externa)
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
