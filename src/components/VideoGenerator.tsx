import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Video, Upload, Copy, Download, Instagram, MessageCircle, Facebook, Clock, Ticket } from "lucide-react";
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
  const [url, setUrl] = useState("");
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
    if (!url.trim() && !uploadedImage) { toast.error("Digite uma descrição ou envie uma imagem"); return; }
    if (!hasEnoughCredits) { toast.error(`Você precisa de ${creditsNeeded} créditos. Você tem ${credits ?? 0}.`); return; }

    setLoading(true);
    setResultado(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { toast.error("Você precisa estar logado"); setLoading(false); return; }

      let imageBase64: string | null = null;
      if (uploadedImage) {
        imageBase64 = await new Promise((resolve) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result as string); reader.readAsDataURL(uploadedImage); });
      }

      const { data, error } = await supabase.functions.invoke('gerar-video', { body: { prompt: url.trim(), productUrl: url.includes('http') ? url : null, image: imageBase64, duration } });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao gerar vídeo');

      setResultado({ videoUrl: data.videoUrl, legendas: data.legendas });
      setEditableLegendas(data.legendas);
      if (data.creditsRemaining !== undefined) setCredits(data.creditsRemaining);

      await supabase.from('videos').insert({ user_id: userData.user.id, titulo: url.trim().substring(0, 100), link_produto: url.includes('http') ? url : null, video_url: data.videoUrl, legenda_instagram: data.legendas.instagram, legenda_facebook: data.legendas.facebook, legenda_tiktok: data.legendas.tiktok, legenda_whatsapp: data.legendas.whatsapp, status: 'concluido' });

      toast.success(`🎬 Vídeo gerado! Restam ${data.creditsRemaining} créditos`);
    } catch (err: any) { toast.error(err.message || 'Erro ao gerar vídeo'); console.error(err); } finally { setLoading(false); }
  };

  const handleCopy = (text: string, platform: string) => { navigator.clipboard.writeText(text); toast.success(`Legenda ${platform} copiada!`); };

  const handleDownload = async () => {
    if (!resultado?.videoUrl) return;
    try { const response = await fetch(resultado.videoUrl); const blob = await response.blob(); const downloadUrl = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = downloadUrl; a.download = 'video-ia.mp4'; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(downloadUrl); document.body.removeChild(a); toast.success('Vídeo baixado!'); } catch { toast.error('Erro ao baixar vídeo'); }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-xl border-2 border-purple-500/30 bg-gradient-to-r from-purple-900/20 to-pink-900/20">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-2xl"><Video className="h-8 w-8 text-purple-400" />🎬 IA Vídeos - Gere Vídeos Incríveis!</CardTitle>
          <div className="flex items-center gap-2 mt-2">
            <Ticket className="h-5 w-5 text-yellow-400" />
            {loadingCredits ? <span className="text-muted-foreground">Carregando...</span> : credits !== null ? <span className={`font-bold text-lg ${credits > 0 ? 'text-green-400' : 'text-red-400'}`}>Créditos: {credits} vídeos 🎟️</span> : <span className="text-muted-foreground">Faça login</span>}
          </div>
        </CardHeader>
      </Card>

      <Card className="shadow-xl border-2">
        <CardContent className="pt-6 space-y-6">
          <div><label className="text-sm font-medium mb-2 block">Cole um link OU escreva descrição</label><Textarea value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Ex: 'crie um vídeo de passarinho colorido'" className="min-h-[100px]" /></div>
          <div><label className="text-sm font-medium mb-2 block">📷 Upload (opcional)</label><Input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" id="file-upload-video" /><Button onClick={() => document.getElementById('file-upload-video')?.click()} variant="outline" className="w-full"><Upload className="mr-2 h-4 w-4" />{uploadedImage ? uploadedImage.name : 'Escolher Arquivo'}</Button></div>
          
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4" />⏱️ Duração:</label>
            <RadioGroup value={String(duration)} onValueChange={(v) => setDuration(Number(v) as Duration)} className="grid grid-cols-3 gap-4">
              {DURATION_OPTIONS.map((o) => (<div key={o.value}><RadioGroupItem value={String(o.value)} id={`d-${o.value}`} className="peer sr-only" /><Label htmlFor={`d-${o.value}`} className={`flex flex-col items-center rounded-lg border-2 p-4 cursor-pointer ${duration === o.value ? 'border-purple-500 bg-purple-500/10' : 'border-border hover:border-purple-500/50'}`}><Clock className={`h-6 w-6 mb-2 ${duration === o.value ? 'text-purple-400' : 'text-muted-foreground'}`} /><span className="font-bold">{o.label}</span><span className="text-sm text-muted-foreground">{o.credits} crédito{o.credits > 1 ? 's' : ''}</span></Label></div>))}
            </RadioGroup>
          </div>

          <Button onClick={handleGenerate} disabled={loading || !hasEnoughCredits} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-lg py-6">
            {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Gerando... (até 60s)</> : !hasEnoughCredits ? <><Ticket className="mr-2 h-5 w-5" />Créditos insuficientes</> : <><Video className="mr-2 h-5 w-5" />✨ GERAR VÍDEO ({creditsNeeded} crédito{creditsNeeded > 1 ? 's' : ''})</>}
          </Button>
        </CardContent>
      </Card>

      {resultado && (
        <div className="grid md:grid-cols-2 gap-6">
          {[{ title: '📱 Instagram Reels', icon: Instagram, color: 'from-pink-500 to-purple-600', key: 'instagram' as const }, { title: '📘 Facebook', icon: Facebook, color: 'from-blue-500 to-blue-700', key: 'facebook' as const }, { title: '🎵 TikTok', icon: Video, color: 'from-black to-gray-800', key: 'tiktok' as const }, { title: '💬 WhatsApp', icon: MessageCircle, color: 'from-green-500 to-emerald-600', key: 'whatsapp' as const }].map(({ title, icon: Icon, color, key }) => (
            <Card key={key} className="shadow-xl border-2">
              <CardHeader className={`bg-gradient-to-r ${color} text-white`}><CardTitle className="flex items-center gap-2"><Icon className="h-5 w-5" />{title}</CardTitle></CardHeader>
              <CardContent className="pt-6 space-y-4">
                <video src={resultado.videoUrl} controls className="w-full rounded-lg" />
                <Textarea value={editableLegendas[key]} onChange={(e) => setEditableLegendas({...editableLegendas, [key]: e.target.value})} className="min-h-[100px]" />
                <div className="flex gap-2"><Button onClick={() => handleCopy(editableLegendas[key], title)} variant="outline" className="flex-1"><Copy className="mr-2 h-4 w-4" />Copiar</Button><Button onClick={handleDownload} variant="outline" className="flex-1"><Download className="mr-2 h-4 w-4" />Baixar</Button></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};