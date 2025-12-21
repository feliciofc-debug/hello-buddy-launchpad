import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Download, Sparkles, Upload, Copy, Instagram, Facebook, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface VideoGeneratorProps {
  productImage?: string;
  productName?: string;
  productPrice?: number;
}

interface GeneratedPosts {
  instagram: string;
  facebook: string;
  story: string;
  whatsapp: string;
}

export const VideoGenerator = ({ 
  productImage: initialImage, 
  productName: initialName = "Meu Produto",
  productPrice: initialPrice 
}: VideoGeneratorProps) => {
  const [selectedStyle, setSelectedStyle] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  
  // Estados para upload e edição
  const [productImage, setProductImage] = useState<string>(initialImage || "");
  const [productName, setProductName] = useState<string>(initialName);
  const [productPrice, setProductPrice] = useState<number | undefined>(initialPrice);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPosts | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setProductImage(event.target?.result as string);
      toast.success("Imagem carregada!");
    };
    reader.readAsDataURL(file);
  };

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
      const transitionFrames = 15;

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

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const progressVal = frameInCurrentImage / framesPerImage;
        
        let scale = 1;
        if (selectedStyle === 'zoom') {
          scale = 1 + (progressVal * 0.1);
        }

        const drawImageWithEffects = (image: HTMLImageElement, alpha: number, zoomScale: number) => {
          ctx.save();
          ctx.globalAlpha = alpha;
          
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

        if (frameInCurrentImage >= framesPerImage - transitionFrames) {
          const transitionProgress = (frameInCurrentImage - (framesPerImage - transitionFrames)) / transitionFrames;
          drawImageWithEffects(img, 1 - transitionProgress, scale);
          drawImageWithEffects(nextImg, transitionProgress, 1);
        } else {
          drawImageWithEffects(img, 1, scale);
        }

        if (selectedStyle === 'glitch' && Math.random() > 0.9) {
          const glitchHeight = 20 + Math.random() * 50;
          const glitchY = Math.random() * canvas.height;
          const imageData = ctx.getImageData(0, glitchY, canvas.width, glitchHeight);
          ctx.putImageData(imageData, Math.random() * 20 - 10, glitchY);
        }

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

        const textIndex = currentImageIndex % textOverlays.length;
        const text = textOverlays[textIndex];
        
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 64px Arial';
        ctx.textAlign = 'center';
        
        let textY = canvas.height - 200;
        if (selectedStyle === 'animated-text') {
          textY = canvas.height - 200 + Math.sin(currentFrame * 0.1) * 10;
        }
        
        ctx.fillText(text, canvas.width / 2, textY);
        ctx.shadowColor = 'transparent';

        const barWidth = (currentFrame / totalFrames) * (canvas.width - 100);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(50, canvas.height - 80, canvas.width - 100, 6);
        ctx.fillStyle = '#fff';
        ctx.fillRect(50, canvas.height - 80, barWidth, 6);

        currentFrame++;
        if (currentFrame % framesPerImage === 0 && currentFrame < totalFrames) {
          currentImageIndex = (currentImageIndex + 1) % loadedImages.length;
        }

        const renderProgress = Math.floor((currentFrame / totalFrames) * 100);
        setProgress(50 + renderProgress * 0.5);
        setProgressText(`Renderizando vídeo: ${renderProgress}%`);

        requestAnimationFrame(drawFrame);
      };

      drawFrame();
    });
  };

  const generatePosts = (name: string, price?: number): GeneratedPosts => {
    const priceText = price ? `R$ ${price.toFixed(2)}` : "PREÇO ESPECIAL";
    
    return {
      instagram: `🔥 ${name.toUpperCase()} 🔥\n\n✨ O produto que você estava esperando!\n\n💰 Apenas ${priceText}\n\n👆 Link na bio!\n\n#oferta #promocao #compras #desconto`,
      facebook: `🎉 OFERTA IMPERDÍVEL!\n\n${name}\n\n💰 Por apenas ${priceText}\n\n🛒 Aproveite antes que acabe!\n\nComente "EU QUERO" para receber o link!`,
      story: `🔥 ${name}\n\n⚡ ${priceText}\n\n👆 ARRASTA PRA CIMA`,
      whatsapp: `Olá! 👋\n\nVocê viu o *${name}*?\n\n💰 Está por apenas *${priceText}*\n\n🔥 Oferta por tempo limitado!\n\nQuer saber mais? Me responda aqui!`
    };
  };

  const handleGenerate = async () => {
    if (!selectedStyle || !selectedTemplate) {
      toast.error("Selecione um estilo e um template");
      return;
    }

    if (!productImage) {
      toast.error("Faça upload de uma imagem do produto");
      return;
    }

    if (!productName.trim()) {
      toast.error("Digite o nome do produto");
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setProgressText("Iniciando geração...");
    setGeneratedVideo(null);
    setGeneratedImages([]);
    setGeneratedPosts(null);

    try {
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

      setGeneratedImages(data.images);
      setProgress(50);
      setProgressText("Imagens geradas! Criando vídeo...");

      const videoUrl = await createVideoFromImages(
        data.images,
        data.textOverlays || [productName, '🔥 OFERTA'],
        data.videoDuration || 15
      );

      setGeneratedVideo(videoUrl);
      
      // Gerar posts
      const posts = generatePosts(productName, productPrice);
      setGeneratedPosts(posts);
      
      setProgress(100);
      setProgressText("Vídeo pronto!");
      toast.success("Vídeo e posts gerados com sucesso!");

    } catch (error: any) {
      console.error("Erro:", error);
      toast.error(error.message || "Erro ao gerar vídeo");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadVideo = () => {
    if (!generatedVideo) return;
    
    const link = document.createElement('a');
    link.href = generatedVideo;
    link.download = `${productName.toLowerCase().replace(/\s+/g, '-')}-video.webm`;
    link.click();
    toast.success("Download do vídeo iniciado!");
  };

  const handleDownloadImage = (imageUrl: string, index: number) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${productName.toLowerCase().replace(/\s+/g, '-')}-imagem-${index + 1}.png`;
    link.click();
    toast.success("Download da imagem iniciado!");
  };

  const handleCopy = (text: string, platform: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Texto do ${platform} copiado!`);
  };

  return (
    <div className="space-y-6">
      {/* Card Principal - Configuração */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Gerar Vídeo com IA (Gemini + Slideshow)
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Faça upload de uma foto, escolha o estilo e gere vídeos + posts automaticamente!
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload de Imagem */}
          <div className="space-y-2">
            <Label>📸 Imagem do Produto</Label>
            <div 
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              {productImage ? (
                <div className="space-y-2">
                  <img 
                    src={productImage} 
                    alt="Produto" 
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <p className="text-sm text-muted-foreground">Clique para trocar a imagem</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                  <p className="font-medium">Clique para fazer upload</p>
                  <p className="text-sm text-muted-foreground">JPG, PNG ou WebP</p>
                </div>
              )}
            </div>
          </div>

          {/* Nome e Preço */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Produto</Label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Ex: Fone Bluetooth Premium"
              />
            </div>
            <div className="space-y-2">
              <Label>Preço (opcional)</Label>
              <Input
                type="number"
                value={productPrice || ""}
                onChange={(e) => setProductPrice(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="Ex: 99.90"
              />
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
            disabled={isGenerating || !selectedStyle || !selectedTemplate || !productImage}
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
                GERAR VÍDEO + POSTS
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Vídeo Gerado */}
      {generatedVideo && (
        <Card className="border-2 border-green-500">
          <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
            <CardTitle>🎬 Vídeo Gerado</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="border rounded-lg overflow-hidden bg-black">
              <video 
                src={generatedVideo} 
                controls 
                autoPlay
                loop
                className="w-full max-h-[400px]" 
              />
            </div>
            <Button onClick={handleDownloadVideo} className="w-full" variant="default">
              <Download className="mr-2 h-4 w-4" />
              💾 Salvar Vídeo no Computador
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Imagens Geradas */}
      {generatedImages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>🖼️ Imagens Geradas ({generatedImages.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {generatedImages.map((img, index) => (
                <div key={index} className="space-y-2">
                  <img 
                    src={img} 
                    alt={`Imagem ${index + 1}`}
                    className="w-full aspect-[9/16] object-cover rounded-lg border"
                  />
                  <Button 
                    onClick={() => handleDownloadImage(img, index)}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Download className="mr-1 h-3 w-3" />
                    Baixar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Posts Gerados */}
      {generatedPosts && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Instagram */}
          <Card className="border-2 hover:border-pink-500 transition-colors">
            <CardHeader className="bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Instagram className="h-4 w-4" />
                Instagram
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <Textarea
                value={generatedPosts.instagram}
                readOnly
                className="min-h-[150px] text-sm"
              />
              <Button
                onClick={() => handleCopy(generatedPosts.instagram, 'Instagram')}
                variant="outline"
                className="w-full"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar
              </Button>
            </CardContent>
          </Card>

          {/* Facebook */}
          <Card className="border-2 hover:border-blue-500 transition-colors">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-500 text-white py-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Facebook className="h-4 w-4" />
                Facebook
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <Textarea
                value={generatedPosts.facebook}
                readOnly
                className="min-h-[150px] text-sm"
              />
              <Button
                onClick={() => handleCopy(generatedPosts.facebook, 'Facebook')}
                variant="outline"
                className="w-full"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar
              </Button>
            </CardContent>
          </Card>

          {/* Story */}
          <Card className="border-2 hover:border-orange-500 transition-colors">
            <CardHeader className="bg-gradient-to-r from-orange-500 to-pink-500 text-white py-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Instagram className="h-4 w-4" />
                Story
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <Textarea
                value={generatedPosts.story}
                readOnly
                className="min-h-[150px] text-sm"
              />
              <Button
                onClick={() => handleCopy(generatedPosts.story, 'Story')}
                variant="outline"
                className="w-full"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar
              </Button>
            </CardContent>
          </Card>

          {/* WhatsApp */}
          <Card className="border-2 hover:border-green-500 transition-colors">
            <CardHeader className="bg-gradient-to-r from-green-600 to-green-500 text-white py-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <Textarea
                value={generatedPosts.whatsapp}
                readOnly
                className="min-h-[150px] text-sm"
              />
              <Button
                onClick={() => handleCopy(generatedPosts.whatsapp, 'WhatsApp')}
                variant="outline"
                className="w-full"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Info */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <p className="font-semibold mb-2 text-sm">🚀 Como funciona:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li>Faça upload da foto do produto</li>
            <li>Gemini gera 4 variações de imagem</li>
            <li>Canvas API monta slideshow com transições</li>
            <li>Exporte vídeo + imagens + posts prontos</li>
          </ol>
          <p className="mt-3 text-xs opacity-80">
            💡 Custo: Apenas créditos Lovable AI (sem API de vídeo externa)
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
