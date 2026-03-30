import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Video, Download, Facebook, Instagram, Plus, X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SlideshowConfig {
  productName: string;
  price: string;
  ctaText: string;
  duration: number;
  textColor: string;
  showPrice: boolean;
  showCta: boolean;
}

export const VideoSlideshowGenerator = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [config, setConfig] = useState<SlideshowConfig>({
    productName: "",
    price: "",
    ctaText: "🔥 OFERTA IMPERDÍVEL!",
    duration: 4,
    textColor: "#FFFFFF",
    showPrice: true,
    showCta: true,
  });
  const [generating, setGenerating] = useState(false);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploadingReels, setUploadingReels] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([""]);

  const addImageUrl = () => {
    if (imageUrls.length >= 10) { toast.error("Máximo de 10 imagens"); return; }
    setImageUrls([...imageUrls, ""]);
  };

  const removeImageUrl = (index: number) => setImageUrls(imageUrls.filter((_, i) => i !== index));

  const updateImageUrl = (index: number, value: string) => {
    const newUrls = [...imageUrls];
    newUrls[index] = value;
    setImageUrls(newUrls);
  };

  const loadImages = async (): Promise<HTMLImageElement[]> => {
    const validUrls = imageUrls.filter(u => u.trim());
    if (validUrls.length === 0) { toast.error("Adicione pelo menos uma imagem"); return []; }

    const loadedImages: HTMLImageElement[] = [];
    for (const url of validUrls) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Falha ao carregar: ${url}`));
          img.src = url;
        });
        loadedImages.push(img);
      } catch (err) {
        console.warn("Imagem não carregou:", url);
      }
    }
    return loadedImages;
  };

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = words[0] || "";
    for (let i = 1; i < words.length; i++) {
      const testLine = currentLine + " " + words[i];
      if (ctx.measureText(testLine).width < maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    lines.push(currentLine);
    return lines.slice(0, 3);
  };

  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  const drawSlide = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    width: number,
    height: number,
    alpha: number = 1,
    progress: number = 0,
    slideIndex: number = 0
  ) => {
    ctx.save();
    ctx.globalAlpha = alpha;

    // Ken Burns: zoom lento + pan suave
    const startScale = 1.0;
    const endScale = 1.2;
    const scale = startScale + (endScale - startScale) * progress;

    const direction = slideIndex % 4;
    let panX = 0;
    let panY = 0;
    const panAmount = 40;

    switch (direction) {
      case 0:
        panX = -panAmount + (panAmount * 2 * progress);
        panY = -panAmount / 2 + (panAmount * progress);
        break;
      case 1:
        panX = panAmount - (panAmount * 2 * progress);
        panY = panAmount / 2 - (panAmount * progress);
        break;
      case 2:
        panX = 0;
        panY = -panAmount / 2 + (panAmount * progress);
        break;
      case 3:
        panX = panAmount / 2 - (panAmount * progress);
        panY = 0;
        break;
    }

    const imgRatio = img.width / img.height;
    const canvasRatio = width / height;
    let drawWidth: number, drawHeight: number, drawX: number, drawY: number;

    if (imgRatio > canvasRatio) {
      drawHeight = height * scale;
      drawWidth = drawHeight * imgRatio;
    } else {
      drawWidth = width * scale;
      drawHeight = drawWidth / imgRatio;
    }

    drawX = (width - drawWidth) / 2 + panX;
    drawY = (height - drawHeight) / 2 + panY;

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

    // Overlay gradient (bottom)
    const gradient = ctx.createLinearGradient(0, height * 0.5, 0, height);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,0.8)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Overlay gradient (top) for CTA
    const gradientTop = ctx.createLinearGradient(0, 0, 0, height * 0.15);
    gradientTop.addColorStop(0, "rgba(0,0,0,0.4)");
    gradientTop.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradientTop;
    ctx.fillRect(0, 0, width, height);

    if (config.showCta && config.ctaText) {
      ctx.font = "bold 24px Arial";
      const ctaWidth = Math.min(width * 0.8, ctx.measureText(config.ctaText).width + 60);
      const ctaX = (width - ctaWidth) / 2;
      ctx.fillStyle = "rgba(255,50,50,0.9)";
      roundRect(ctx, ctaX, height * 0.06, ctaWidth, 50, 25);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.fillText(config.ctaText, width / 2, height * 0.06 + 34);
    }

    if (config.productName) {
      ctx.fillStyle = config.textColor;
      ctx.font = "bold 28px Arial";
      ctx.textAlign = "center";
      const maxWidth = width * 0.85;
      const lines = wrapText(ctx, config.productName, maxWidth);
      const lineHeight = 34;
      const startY = height * 0.78 - (lines.length * lineHeight) / 2;
      lines.forEach((line, i) => {
        ctx.fillText(line, width / 2, startY + i * lineHeight);
      });
    }

    if (config.showPrice && config.price) {
      ctx.fillStyle = "#FFD700";
      ctx.font = "bold 48px Arial";
      ctx.textAlign = "center";
      ctx.fillText(`R$ ${config.price}`, width / 2, height * 0.9);
    }

    ctx.restore();
  };

  const generateVideo = async () => {
    const images = await loadImages();
    if (images.length === 0) return;

    setGenerating(true);
    setVideoBlob(null);
    setVideoUrl(null);

    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas não encontrado");

      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Contexto 2D não disponível");

      const stream = canvas.captureStream(30);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 5000000,
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const videoReady = new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => {
          resolve(new Blob(chunks, { type: "video/webm" }));
        };
      });

      mediaRecorder.start();

      // Build slideshow images — single image gets 4 virtual slides
      let slideshowImages = [...images];
      if (images.length === 1) {
        slideshowImages = [images[0], images[0], images[0], images[0]];
      }

      // Ensure minimum 15 seconds
      const minDurationSec = 15;
      while (slideshowImages.length * config.duration < minDurationSec) {
        slideshowImages = [...slideshowImages, ...images];
      }

      const fps = 30;
      const slideDurationMs = config.duration * 1000;
      const transitionMs = 800;
      const totalFrames = (slideshowImages.length * slideDurationMs * fps) / 1000;

      for (let frame = 0; frame < totalFrames; frame++) {
        const timeMs = (frame / fps) * 1000;
        const slideIndex = Math.floor(timeMs / slideDurationMs);
        const slideTimeMs = timeMs % slideDurationMs;
        const slideProgress = slideTimeMs / slideDurationMs;

        if (slideIndex >= slideshowImages.length) break;

        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const currentImg = slideshowImages[slideIndex];

        if (slideTimeMs < transitionMs && slideIndex > 0) {
          const prevImg = slideshowImages[slideIndex - 1];
          const transitionProgress = slideTimeMs / transitionMs;
          drawSlide(ctx, prevImg, canvas.width, canvas.height, 1 - transitionProgress, 1.0, slideIndex - 1);
          drawSlide(ctx, currentImg, canvas.width, canvas.height, transitionProgress, slideProgress, slideIndex);
        } else {
          drawSlide(ctx, currentImg, canvas.width, canvas.height, 1, slideProgress, slideIndex);
        }

        await new Promise((r) => setTimeout(r, 1000 / fps));
      }

      await new Promise((r) => setTimeout(r, 1000));
      mediaRecorder.stop();
      const blob = await videoReady;

      setVideoBlob(blob);
      setVideoUrl(URL.createObjectURL(blob));

      setCaption(
        `${config.ctaText}\n\n${config.productName}\n💰 R$ ${config.price}\n\n#ofertas #promocao #desconto #compras`
      );

      toast.success("🎬 Vídeo gerado com sucesso!");
    } catch (err: any) {
      console.error("Erro ao gerar vídeo:", err);
      toast.error(err.message || "Erro ao gerar vídeo");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!videoBlob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(videoBlob);
    a.download = `reels-${config.productName.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.webm`;
    a.click();
    toast.success("Vídeo baixado!");
  };

  const handleUploadAndPublishReels = async (platform: "facebook" | "instagram") => {
    if (!videoBlob) { toast.error("Gere o vídeo primeiro"); return; }
    if (!caption.trim()) { toast.error("Escreva uma legenda"); return; }

    setUploadingReels(platform);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Você precisa estar logado"); return; }

      const fileName = `reels/${user.id}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(fileName, videoBlob, { contentType: "video/webm", cacheControl: "3600" });

      if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);

      const { data: publicUrl } = supabase.storage.from("videos").getPublicUrl(fileName);
      if (!publicUrl?.publicUrl) throw new Error("Não foi possível gerar URL pública");

      const { data: pubData, error: pubError } = await supabase.functions.invoke("meta-publish-reels", {
        body: { platform, video_url: publicUrl.publicUrl, caption, user_id: user.id },
      });

      if (pubError) throw pubError;
      if (!pubData?.success) throw new Error(pubData?.error || "Erro ao publicar Reels");

      toast.success(`✅ Reels publicado no ${platform === "facebook" ? "Facebook" : "Instagram"}!`);
    } catch (err: any) {
      console.error("Erro ao publicar Reels:", err);
      toast.error(err.message || "Erro ao publicar Reels");
    } finally {
      setUploadingReels(null);
    }
  };

  const validCount = imageUrls.filter(u => u.trim()).length;
  const estimatedDuration = Math.max(15, (validCount || 4) * config.duration);

  return (
    <div className="space-y-6">
      <Card className="shadow-xl border-2">
        <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            🎬 Gerador de Vídeo Slideshow (Gratuito)
          </CardTitle>
          <p className="text-purple-100 text-sm mt-1">
            Crie vídeos no formato Reels (9:16) com efeito Ken Burns. Sem custo, sem IA externa.
          </p>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-semibold">Imagens do produto (URLs)</Label>
            {imageUrls.map((url, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={url}
                  onChange={(e) => updateImageUrl(i, e.target.value)}
                  placeholder={`URL da imagem ${i + 1}`}
                />
                {imageUrls.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeImageUrl(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addImageUrl}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar imagem
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome do produto</Label>
              <Input
                value={config.productName}
                onChange={(e) => setConfig({ ...config, productName: e.target.value })}
                placeholder="Ex: Tênis Nike Air Max"
              />
            </div>
            <div>
              <Label>Preço</Label>
              <Input
                value={config.price}
                onChange={(e) => setConfig({ ...config, price: e.target.value })}
                placeholder="Ex: 199.90"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Texto de chamada (CTA)</Label>
              <Input
                value={config.ctaText}
                onChange={(e) => setConfig({ ...config, ctaText: e.target.value })}
                placeholder="🔥 OFERTA IMPERDÍVEL!"
              />
            </div>
            <div>
              <Label>Segundos por slide</Label>
              <Select
                value={String(config.duration)}
                onValueChange={(v) => setConfig({ ...config, duration: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3s por slide (vídeo curto)</SelectItem>
                  <SelectItem value="4">4s por slide (recomendado)</SelectItem>
                  <SelectItem value="5">5s por slide (mais detalhado)</SelectItem>
                  <SelectItem value="6">6s por slide (contemplativo)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Duração estimada: {estimatedDuration} segundos
                {validCount <= 1 && " (1 imagem = 4 slides com movimentos diferentes)"}
              </p>
            </div>
          </div>

          <canvas ref={canvasRef} className="hidden" />

          <Button
            onClick={generateVideo}
            disabled={generating || validCount === 0}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
            size="lg"
          >
            {generating ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando vídeo...</>
            ) : (
              <><Video className="mr-2 h-5 w-5" /> 🎬 GERAR VÍDEO SLIDESHOW (GRÁTIS)</>
            )}
          </Button>

          {videoUrl && (
            <div className="space-y-4">
              <p className="font-semibold text-center">Preview do vídeo:</p>
              <div className="flex justify-center">
                <video src={videoUrl} controls className="max-h-[400px] rounded-lg shadow-lg" />
              </div>

              <div>
                <Label>Legenda do Reels</Label>
                <Textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={4}
                  placeholder="Legenda do Reels..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button onClick={handleDownload} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" /> Baixar Vídeo
                </Button>
                <Button
                  onClick={() => handleUploadAndPublishReels("facebook")}
                  disabled={!!uploadingReels}
                  className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {uploadingReels === "facebook" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Facebook className="h-4 w-4" />
                  )}
                  Reels Facebook
                </Button>
                <Button
                  onClick={() => handleUploadAndPublishReels("instagram")}
                  disabled={!!uploadingReels}
                  className="gap-2 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white"
                >
                  {uploadingReels === "instagram" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Instagram className="h-4 w-4" />
                  )}
                  Reels Instagram
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
