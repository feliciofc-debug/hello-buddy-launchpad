import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Video, Upload, Copy, Download, Instagram, MessageCircle, Facebook, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TikTokShareModal } from "@/components/TikTokShareModal";

interface VideoResult {
  videoUrl: string;
  legendas: {
    instagram: string;
    facebook: string;
    tiktok: string;
    whatsapp: string;
  };
  promptUsed?: string;
}

export const VideoGenerator = () => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<VideoResult | null>(null);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [credits, setCredits] = useState(0);
  const [duration, setDuration] = useState(6);
  const [style, setStyle] = useState("automatico");
  const [movement, setMovement] = useState("moderado");
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [tiktokModalOpen, setTiktokModalOpen] = useState(false);
  
  const [editableLegendas, setEditableLegendas] = useState({
    instagram: '',
    facebook: '',
    tiktok: '',
    whatsapp: ''
  });

  // Carregar créditos ao montar
  useEffect(() => {
    loadCredits();
  }, []);

  const loadCredits = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data } = await supabase
      .from('user_video_credits')
      .select('credits_remaining')
      .eq('user_id', userData.user.id)
      .single();

    setCredits(data?.credits_remaining || 0);
  };

  // Polling de status
  useEffect(() => {
    if (!predictionId || !loading) return;

    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('gerar-video', {
          body: { predictionId }
        });

        if (error) throw error;

        if (data.status === 'succeeded') {
          clearInterval(interval);
          
          // Gerar legendas
          const legendas = {
            instagram: `🎥✨ ${url}\n\n💫 Aproveite!\n🔥 #reels #instagram #ofertas`,
            facebook: `🎬 ${url}\n\n👉 Saiba mais!\n\n#video #facebook #promocao`,
            tiktok: `🔥 ${url}\n\n💥 Não perca! #tiktok #viral #fyp`,
            whatsapp: `🎥 *${url}*\n\n✅ Confira agora!`
          };

          setResultado({
            videoUrl: data.videoUrl,
            legendas,
            promptUsed: data.promptUsed
          });
          setEditableLegendas(legendas);
          setLoading(false);
          setPredictionId(null);
          
          // Salvar no banco
          const { data: userData } = await supabase.auth.getUser();
          if (userData.user) {
            await supabase
              .from('videos')
              .insert({
                user_id: userData.user.id,
                titulo: url.substring(0, 100),
                video_url: data.videoUrl,
                legenda_instagram: legendas.instagram,
                legenda_facebook: legendas.facebook,
                legenda_tiktok: legendas.tiktok,
                legenda_whatsapp: legendas.whatsapp,
                status: 'concluido'
              });
          }

          await loadCredits();
          toast.success("🎬 Vídeo gerado com sucesso!");
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setLoading(false);
          setPredictionId(null);
          toast.error(data.error || 'Falha ao gerar vídeo');
        }
      } catch (err: any) {
        clearInterval(interval);
        setLoading(false);
        setPredictionId(null);
        toast.error(err.message);
      }
    }, 3000); // Checar a cada 3 segundos

    return () => clearInterval(interval);
  }, [predictionId, loading, url]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, envie apenas imagens');
      return;
    }

    setUploadedImage(file);
    toast.success('Imagem carregada!');
  };

  const handleGenerate = async (isRetry: boolean = false) => {
    if (!url.trim() && !uploadedImage) {
      toast.error("Digite uma descrição ou envie uma imagem");
      return;
    }

    const creditsNeeded = duration === 6 ? 1 : duration === 12 ? 2 : 5;

    if (credits < creditsNeeded && !isRetry) {
      toast.error(`Você precisa de ${creditsNeeded} créditos. Você tem apenas ${credits}.`);
      return;
    }

    setLoading(true);
    setResultado(null);
    setPredictionId(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error("Você precisa estar logado");
        setLoading(false);
        return;
      }

      let imageBase64 = null;
      if (uploadedImage) {
        imageBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(uploadedImage);
        });
      }

      const { data, error } = await supabase.functions.invoke('gerar-video', {
        body: {
          prompt: url.trim(),
          image: imageBase64,
          duration,
          style,
          movement
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao gerar vídeo');
      }

      setPredictionId(data.predictionId);
      setCredits(data.creditsRemaining);
      toast.success(`⏳ Gerando vídeo... Isso pode levar até 2 minutos.`);

    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar vídeo');
      setLoading(false);
    }
  };

  const handleCopy = (text: string, platform: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Legenda ${platform} copiada!`);
  };

  const handleDownload = async () => {
    if (!resultado?.videoUrl) return;

    try {
      const response = await fetch(resultado.videoUrl);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'video-ia.mp4';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      toast.success('Vídeo baixado!');
    } catch (error) {
      toast.error('Erro ao baixar vídeo');
    }
  };

  const creditsNeeded = duration === 6 ? 1 : duration === 12 ? 2 : 5;

  return (
    <div className="space-y-6">
      {/* Header com créditos */}
      <Card className="shadow-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0">
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <Video className="h-8 w-8" />
              <span className="text-xl font-bold">🎬 IA Vídeos - Gere Vídeos Profissionais em Segundos!</span>
            </div>
            <div className="bg-white/20 backdrop-blur rounded-lg px-4 py-2">
              <p className="text-sm opacity-90">Créditos Disponíveis</p>
              <p className="text-2xl font-bold">🎟️ {credits}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formulário */}
      <Card className="shadow-xl">
        <CardContent className="pt-6 space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">
              💬 Descreva o vídeo que deseja criar
            </label>
            <Textarea
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Ex: 'óculos de sol Ray-Ban na praia' OU 'hambúrguer gourmet com queijo derretendo' OU 'tênis Nike Air Max girando em 360 graus'"
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground mt-1">
              💡 Seja específico! Quanto mais detalhes, melhor o resultado.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              📷 Imagem de Referência (opcional)
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <Button
                onClick={() => document.getElementById('file-upload')?.click()}
                variant="outline"
                className="w-full"
                type="button"
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploadedImage ? uploadedImage.name : 'Escolher Imagem'}
              </Button>
            </div>
          </div>

          {/* Estilo */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              🎨 Estilo do Vídeo
            </label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o estilo" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="automatico">✨ Automático (Recomendado)</SelectItem>
                <SelectItem value="comercial">📺 Comercial/Publicitário</SelectItem>
                <SelectItem value="documental">🎥 Documental/Realista</SelectItem>
                <SelectItem value="cinematografico">🎬 Cinematográfico/Artístico</SelectItem>
                <SelectItem value="minimalista">⚪ Minimalista/Clean</SelectItem>
                <SelectItem value="lifestyle">👥 Lifestyle/Natural</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Movimento */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              ⚡ Intensidade de Movimento
            </label>
            <RadioGroup value={movement} onValueChange={setMovement} className="space-y-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="suave" id="mov-suave" />
                <Label htmlFor="mov-suave" className="cursor-pointer">
                  Suave - Movimento lento e elegante
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="moderado" id="mov-moderado" />
                <Label htmlFor="mov-moderado" className="cursor-pointer">
                  Moderado - Movimento natural (padrão)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dinamico" id="mov-dinamico" />
                <Label htmlFor="mov-dinamico" className="cursor-pointer">
                  Dinâmico - Movimento ativo e energético
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Duração */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              ⏱️ Duração do Vídeo
            </label>
            <RadioGroup value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v))} className="space-y-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="6" id="dur-6" />
                <Label htmlFor="dur-6" className="cursor-pointer">
                  6 segundos (1 crédito)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="12" id="dur-12" />
                <Label htmlFor="dur-12" className="cursor-pointer">
                  12 segundos (2 créditos)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="30" id="dur-30" />
                <Label htmlFor="dur-30" className="cursor-pointer">
                  30 segundos (5 créditos)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Button
            onClick={() => handleGenerate(false)}
            disabled={loading || credits < creditsNeeded}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-lg py-6"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Gerando vídeo... Aguarde até 2 minutos
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                ✨ GERAR VÍDEO COM IA ({creditsNeeded} crédito{creditsNeeded > 1 ? 's' : ''})
              </>
            )}
          </Button>

          {credits < creditsNeeded && (
            <p className="text-sm text-red-500 text-center">
              ⚠️ Créditos insuficientes! Você tem {credits}, precisa de {creditsNeeded}.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Resultados */}
      {resultado && (
        <div className="space-y-6">
          {/* Preview Principal */}
          <Card className="shadow-2xl border-4 border-purple-500">
            <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
              <CardTitle className="flex items-center gap-2 justify-between flex-wrap">
                <span>🎥 Vídeo Gerado com IA - Ultra Realista</span>
                <Button
                  onClick={() => handleGenerate(true)}
                  variant="secondary"
                  size="sm"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Gerar Novamente
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <video
                src={resultado.videoUrl}
                controls
                className="w-full rounded-lg mb-4"
                autoPlay
                loop
              />
              <Button
                onClick={handleDownload}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <Download className="mr-2 h-5 w-5" />
                💾 Salvar Vídeo no Computador
              </Button>
              
              <Button
                onClick={() => setTiktokModalOpen(true)}
                className="w-full bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600"
                size="lg"
              >
                <svg viewBox="0 0 24 24" className="mr-2 h-5 w-5" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                </svg>
                📤 Enviar para TikTok
              </Button>
              
              <TikTokShareModal
                open={tiktokModalOpen}
                onOpenChange={setTiktokModalOpen}
                content={{ type: "video", url: resultado.videoUrl, title: url }}
              />
              
              {resultado.promptUsed && (
                <details className="mt-4">
                  <summary className="text-xs text-muted-foreground cursor-pointer">
                    🔍 Ver prompt usado pela IA
                  </summary>
                  <p className="text-xs mt-2 p-2 bg-muted rounded">
                    {resultado.promptUsed}
                  </p>
                </details>
              )}
            </CardContent>
          </Card>

          {/* Cards de Redes Sociais */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Instagram */}
            <Card className="shadow-xl border-2 hover:border-pink-500 transition-colors">
              <CardHeader className="bg-gradient-to-r from-pink-500 to-purple-600 text-white">
                <CardTitle className="flex items-center gap-2">
                  <Instagram className="h-5 w-5" />
                  📱 Instagram Reels
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <Textarea
                  value={editableLegendas.instagram}
                  onChange={(e) => setEditableLegendas({...editableLegendas, instagram: e.target.value})}
                  className="min-h-[100px]"
                />
                <Button
                  onClick={() => handleCopy(editableLegendas.instagram, 'Instagram')}
                  variant="outline"
                  className="w-full"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar Legenda
                </Button>
              </CardContent>
            </Card>

            {/* Facebook */}
            <Card className="shadow-xl border-2 hover:border-blue-500 transition-colors">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-700 text-white">
                <CardTitle className="flex items-center gap-2">
                  <Facebook className="h-5 w-5" />
                  📘 Facebook Vídeo
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <Textarea
                  value={editableLegendas.facebook}
                  onChange={(e) => setEditableLegendas({...editableLegendas, facebook: e.target.value})}
                  className="min-h-[100px]"
                />
                <Button
                  onClick={() => handleCopy(editableLegendas.facebook, 'Facebook')}
                  variant="outline"
                  className="w-full"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar Legenda
                </Button>
              </CardContent>
            </Card>

            {/* TikTok */}
            <Card className="shadow-xl border-2 hover:border-black transition-colors">
              <CardHeader className="bg-gradient-to-r from-black to-gray-800 text-white">
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  🎵 TikTok
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <Textarea
                  value={editableLegendas.tiktok}
                  onChange={(e) => setEditableLegendas({...editableLegendas, tiktok: e.target.value})}
                  className="min-h-[100px]"
                />
                <Button
                  onClick={() => handleCopy(editableLegendas.tiktok, 'TikTok')}
                  variant="outline"
                  className="w-full"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar Legenda
                </Button>
              </CardContent>
            </Card>

            {/* WhatsApp */}
            <Card className="shadow-xl border-2 hover:border-green-500 transition-colors">
              <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  💬 WhatsApp Status
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <Textarea
                  value={editableLegendas.whatsapp}
                  onChange={(e) => setEditableLegendas({...editableLegendas, whatsapp: e.target.value})}
                  className="min-h-[100px]"
                />
                <Button
                  onClick={() => handleCopy(editableLegendas.whatsapp, 'WhatsApp')}
                  variant="outline"
                  className="w-full"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar Legenda
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
