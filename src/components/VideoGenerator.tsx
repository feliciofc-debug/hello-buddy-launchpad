import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Video, Upload, Copy, Download, Instagram, MessageCircle, Facebook, Clock, Ticket, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface VideoResult {
  videoUrl: string;
  legendas: {
    instagram: string;
    facebook: string;
    tiktok: string;
    whatsapp: string;
  };
}

type Duration = 6 | 12 | 30;

const DURATION_COSTS: Record<Duration, number> = { 6: 1, 12: 2, 30: 5 };

const DURATION_OPTIONS = [
  { value: 6, label: "6 segundos", credits: 1, videos: "30 vídeos" },
  { value: 12, label: "12 segundos", credits: 2, videos: "15 vídeos" },
  { value: 30, label: "30 segundos", credits: 5, videos: "6 vídeos" },
];

export const VideoGenerator = () => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<VideoResult | null>(null);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [duration, setDuration] = useState<Duration>(6);
  const [credits, setCredits] = useState<number | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(true);
  const [editableLegendas, setEditableLegendas] = useState({ instagram: '', facebook: '', tiktok: '', whatsapp: '' });

  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) { setLoadingCredits(false); return; }

        const { data, error } = await supabase.from('user_video_credits').select('credits_remaining').eq('user_id', userData.user.id).single();

        if (error && error.code === 'PGRST116') {
          const { data: newCredits } = await supabase.from('user_video_credits').insert({ user_id: userData.user.id, credits_remaining: 10 }).select('credits_remaining').single();
          setCredits(newCredits?.credits_remaining ?? 10);
        } else if (data) {
          setCredits(data.credits_remaining);
        }
      } catch (err) { console.error('Erro ao buscar créditos:', err); } finally { setLoadingCredits(false); }
    };
    fetchCredits();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Por favor, envie apenas imagens'); return; }
    setUploadedImage(file);
    toast.success('Imagem carregada!');
  };

  const creditsNeeded = DURATION_COSTS[duration];
  const hasEnoughCredits = credits !== null && credits >= creditsNeeded;

  const handleGenerate = async () => {
    if (!prompt.trim() && !uploadedImage) {
      toast.error("Digite uma descrição ou envie uma imagem");
      return;
    }
    if (!hasEnoughCredits) {
      toast.error(`Você precisa de ${creditsNeeded} créditos. Você tem ${credits ?? 0}.`);
      return;
    }

    setLoading(true);
    setResultado(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error("Você precisa estar logado");
        setLoading(false);
        return;
      }

      let imageBase64: string | null = null;
      if (uploadedImage) {
        imageBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(uploadedImage);
        });
      }

      // 1) Inicia a geração (retorna predictionId)
      const { data: startData, error: startError } = await supabase.functions.invoke('gerar-video', {
        body: {
          prompt: prompt.trim(),
          productUrl: prompt.includes('http') ? prompt : null,
          image: imageBase64,
          duration,
        },
      });

      if (startError) throw startError;
      if (!startData?.success) throw new Error(startData?.error || 'Erro ao iniciar geração');

      const predictionId = startData.predictionId as string | undefined;
      if (!predictionId) throw new Error('Não foi possível iniciar a geração (predictionId ausente).');

      toast.message('🎬 Gerando...', { description: 'Aguarde (pode levar 1-3 minutos).', duration: 4000 });

      if (typeof startData.creditsRemaining === 'number') {
        setCredits(startData.creditsRemaining);
      }

      // 2) Faz polling no frontend (evita timeout de conexão)
      const startedAt = Date.now();
      const timeoutMs = 4 * 60 * 1000; // 4 min
      let videoUrl: string | null = null;

      while (!videoUrl && Date.now() - startedAt < timeoutMs) {
        await new Promise((r) => setTimeout(r, 2500));

        const { data: statusData, error: statusError } = await supabase.functions.invoke('gerar-video', {
          body: { predictionId },
        });

        if (statusError) throw statusError;
        if (!statusData?.success) throw new Error(statusData?.error || 'Falha ao gerar vídeo');

        if (statusData.status === 'succeeded' && statusData.videoUrl) {
          videoUrl = statusData.videoUrl;
          break;
        }
      }

      if (!videoUrl) throw new Error('Timeout ao gerar vídeo. Tente novamente.');

      // Legendas locais (mantém igual ao comportamento anterior)
      const legendas = {
        instagram: `🎥✨ ${prompt.trim()}\n\n💫 Aproveite!\n🔥 Link na bio!\n\n#reels #instagram #viral`,
        facebook: `🎬 ${prompt.trim()}\n\n👉 Clique no link!\n\n#video #facebook`,
        tiktok: `🔥 ${prompt.trim()}\n\n💥 Não perca!\n\n#tiktok #viral #fyp`,
        whatsapp: `🎥 *${prompt.trim()}*\n\n✅ Confira!\n\n👉 ${prompt.includes('http') ? prompt : 'Link aqui'}`,
      };

      setResultado({ videoUrl, legendas });
      setEditableLegendas(legendas);

      await supabase.from('videos').insert({
        user_id: userData.user.id,
        titulo: prompt.trim().substring(0, 100),
        link_produto: prompt.includes('http') ? prompt : null,
        video_url: videoUrl,
        legenda_instagram: legendas.instagram,
        legenda_facebook: legendas.facebook,
        legenda_tiktok: legendas.tiktok,
        legenda_whatsapp: legendas.whatsapp,
        status: 'concluido',
      });

      toast.success(`🎬 Vídeo gerado! Restam ${typeof startData.creditsRemaining === 'number' ? startData.creditsRemaining : ''} créditos`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar vídeo');
      console.error(err);
    } finally {
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
      a.download = `video-ia-${duration}s.mp4`; 
      document.body.appendChild(a); 
      a.click(); 
      window.URL.revokeObjectURL(downloadUrl); 
      document.body.removeChild(a); 
      toast.success('Vídeo baixado!'); 
    } catch { 
      toast.error('Erro ao baixar vídeo'); 
    }
  };

  return (
    <div className="space-y-8">
      {/* Header com créditos */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent">
          🎬 IA Vídeos
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground">
          Gere vídeos ULTRA REALISTAS com IA em segundos!
        </p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <Ticket className="h-6 w-6 text-yellow-400" />
          {loadingCredits ? (
            <span className="text-muted-foreground">Carregando...</span>
          ) : credits !== null ? (
            <span className={`font-bold text-2xl ${credits > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {credits} créditos disponíveis 🎟️
            </span>
          ) : (
            <span className="text-muted-foreground">Faça login para ver créditos</span>
          )}
        </div>
      </div>

      {/* Campo Principal - igual ao de imagens */}
      <Card className="max-w-4xl mx-auto shadow-2xl border-2">
        <CardContent className="pt-8 space-y-6">
          {/* Prompt */}
          <div className="space-y-4">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Descreva o vídeo que você quer criar... Ex: 'um passarinho colorido amarelo azul e vermelho voando de galho em galho numa floresta verde ultra realista'"
              className="text-lg p-6 min-h-[120px]"
              disabled={loading}
            />
            
            {/* Upload de Imagem */}
            <div className="border-2 border-dashed rounded-lg p-6">
              <div className="flex items-center justify-center gap-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload-video"
                />
                <label htmlFor="file-upload-video" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors">
                    <Upload className="h-5 w-5" />
                    <span className="font-medium">
                      {uploadedImage ? uploadedImage.name : '📷 Upload Imagem (opcional)'}
                    </span>
                  </div>
                </label>
                {uploadedImage && (
                  <Button variant="ghost" size="sm" onClick={() => setUploadedImage(null)}>
                    ✕ Remover
                  </Button>
                )}
              </div>
              {uploadedImage && (
                <div className="mt-4 flex justify-center">
                  <img 
                    src={URL.createObjectURL(uploadedImage)} 
                    alt="Preview" 
                    className="max-h-32 rounded-lg"
                  />
                </div>
              )}
            </div>

            {/* Seleção de Duração */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                ⏱️ Duração do vídeo:
              </label>
              <RadioGroup 
                value={String(duration)} 
                onValueChange={(v) => setDuration(Number(v) as Duration)} 
                className="grid grid-cols-3 gap-4"
              >
                {DURATION_OPTIONS.map((o) => (
                  <div key={o.value}>
                    <RadioGroupItem value={String(o.value)} id={`d-${o.value}`} className="peer sr-only" />
                    <Label 
                      htmlFor={`d-${o.value}`} 
                      className={`flex flex-col items-center rounded-lg border-2 p-4 cursor-pointer transition-all ${
                        duration === o.value 
                          ? 'border-purple-500 bg-purple-500/10 shadow-lg' 
                          : 'border-border hover:border-purple-500/50'
                      }`}
                    >
                      <Clock className={`h-6 w-6 mb-2 ${duration === o.value ? 'text-purple-400' : 'text-muted-foreground'}`} />
                      <span className="font-bold">{o.label}</span>
                      <span className="text-sm text-muted-foreground">{o.credits} crédito{o.credits > 1 ? 's' : ''}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Botão Gerar */}
            <Button 
              onClick={handleGenerate} 
              disabled={loading || !hasEnoughCredits || (!prompt.trim() && !uploadedImage)} 
              size="lg"
              className="w-full text-lg py-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Gerando vídeo ultra realista... (30-90s)
                </>
              ) : !hasEnoughCredits ? (
                <>
                  <Ticket className="mr-2 h-5 w-5" />
                  Créditos insuficientes ({credits ?? 0}/{creditsNeeded})
                </>
              ) : (
                <>
                  ✨ GERAR VÍDEO COM IA ({creditsNeeded} crédito{creditsNeeded > 1 ? 's' : ''})
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {resultado && (
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Vídeo Gerado - Grande */}
          <Card className="shadow-xl border-2 border-purple-500">
            <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                🎬 Vídeo Gerado com IA - Ultra Realista
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <video 
                src={resultado.videoUrl} 
                controls 
                autoPlay 
                loop
                className="w-full rounded-lg shadow-lg max-h-[500px] object-contain bg-black"
              />
              <Button
                onClick={handleDownload}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                <Download className="mr-2 h-5 w-5" />
                💾 Salvar Vídeo no Computador
              </Button>
            </CardContent>
          </Card>

          {/* Grid de Cards - 4 colunas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: '📱 Instagram Reels', icon: Instagram, color: 'from-pink-500 to-purple-600', key: 'instagram' as const },
              { title: '📘 Facebook', icon: Facebook, color: 'from-blue-500 to-blue-700', key: 'facebook' as const },
              { title: '🎵 TikTok', icon: Video, color: 'from-gray-800 to-black', key: 'tiktok' as const },
              { title: '💬 WhatsApp', icon: MessageCircle, color: 'from-green-500 to-emerald-600', key: 'whatsapp' as const }
            ].map(({ title, icon: Icon, color, key }) => (
              <Card key={key} className="shadow-xl border-2 hover:border-purple-500 transition-colors">
                <CardHeader className={`bg-gradient-to-r ${color} text-white`}>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Icon className="h-4 w-4" />
                    {title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <Textarea 
                    value={editableLegendas[key]} 
                    onChange={(e) => setEditableLegendas({...editableLegendas, [key]: e.target.value})} 
                    className="min-h-[120px] text-sm" 
                  />
                  <Button 
                    onClick={() => handleCopy(editableLegendas[key], title)} 
                    variant="outline" 
                    className="w-full"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
