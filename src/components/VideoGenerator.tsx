import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Video, Upload, Copy, Download, Instagram, MessageCircle, Facebook } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

interface VideoResult {
  videoUrl: string;
  legendas: {
    instagram: string;
    facebook: string;
    tiktok: string;
    whatsapp: string;
  };
}

export const VideoGenerator = () => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<VideoResult | null>(null);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [editableLegendas, setEditableLegendas] = useState({
    instagram: '',
    facebook: '',
    tiktok: '',
    whatsapp: ''
  });

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

  const handleGenerate = async () => {
    if (!url.trim() && !uploadedImage) {
      toast.error("Digite uma descrição ou envie uma imagem");
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

      // Converter imagem para base64 se houver
      let imageBase64: string | null = null;
      if (uploadedImage) {
        imageBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(uploadedImage);
        });
      }

      // Chamar edge function
      const { data, error } = await supabase.functions.invoke('gerar-video', {
        body: {
          prompt: url.trim(),
          productUrl: url.includes('http') ? url : null,
          image: imageBase64
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao gerar vídeo');
      }

      const videoResult: VideoResult = {
        videoUrl: data.videoUrl,
        legendas: data.legendas
      };

      setResultado(videoResult);
      setEditableLegendas(data.legendas);

      // Salvar no banco
      await supabase
        .from('videos')
        .insert({
          user_id: userData.user.id,
          titulo: url.trim().substring(0, 100),
          link_produto: url.includes('http') ? url : null,
          video_url: data.videoUrl,
          legenda_instagram: data.legendas.instagram,
          legenda_facebook: data.legendas.facebook,
          legenda_tiktok: data.legendas.tiktok,
          legenda_whatsapp: data.legendas.whatsapp,
          status: 'concluido'
        });

      toast.success("🎬 Vídeo gerado com sucesso!");

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          <Video className="inline-block mr-2 h-8 w-8" />
          🎬 IA Vídeos - Gere Vídeos Incríveis em Segundos!
        </h2>
      </div>

      {/* Formulário */}
      <Card className="max-w-4xl mx-auto shadow-2xl border-2">
        <CardContent className="pt-8 space-y-6">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Cole um link OU escreva uma descrição do vídeo
            </label>
            <Textarea
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Ex: 'crie posts para minha marca de lubrificantes automotivos' OU cole link da Shopee/Amazon"
              className="min-h-[100px]"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              📷 Upload Fotos/Vídeos (opcional)
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload-video"
              />
              <Button
                onClick={() => document.getElementById('file-upload-video')?.click()}
                variant="outline"
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploadedImage ? uploadedImage.name : 'Escolher Arquivo'}
              </Button>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-lg py-6"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Gerando vídeo com IA...
              </>
            ) : (
              <>
                <Video className="mr-2 h-5 w-5" />
                ✨ GERAR VÍDEO COM IA
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Resultados */}
      {resultado && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Instagram Reels */}
          <Card className="shadow-xl border-2 hover:border-pink-500 transition-colors">
            <CardHeader className="bg-gradient-to-r from-pink-500 to-purple-600 text-white">
              <CardTitle className="flex items-center gap-2">
                <Instagram className="h-5 w-5" />
                📱 Instagram Reels
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <video
                src={resultado.videoUrl}
                controls
                className="w-full rounded-lg"
              />
              <Textarea
                value={editableLegendas.instagram}
                onChange={(e) => setEditableLegendas({...editableLegendas, instagram: e.target.value})}
                className="min-h-[100px]"
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => handleCopy(editableLegendas.instagram, 'Instagram')}
                  variant="outline"
                  className="flex-1"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar
                </Button>
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Baixar
                </Button>
              </div>
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
              <video
                src={resultado.videoUrl}
                controls
                className="w-full rounded-lg"
              />
              <Textarea
                value={editableLegendas.facebook}
                onChange={(e) => setEditableLegendas({...editableLegendas, facebook: e.target.value})}
                className="min-h-[100px]"
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => handleCopy(editableLegendas.facebook, 'Facebook')}
                  variant="outline"
                  className="flex-1"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar
                </Button>
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Baixar
                </Button>
              </div>
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
              <video
                src={resultado.videoUrl}
                controls
                className="w-full rounded-lg"
              />
              <Textarea
                value={editableLegendas.tiktok}
                onChange={(e) => setEditableLegendas({...editableLegendas, tiktok: e.target.value})}
                className="min-h-[100px]"
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => handleCopy(editableLegendas.tiktok, 'TikTok')}
                  variant="outline"
                  className="flex-1"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar
                </Button>
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Baixar
                </Button>
              </div>
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
              <video
                src={resultado.videoUrl}
                controls
                className="w-full rounded-lg"
              />
              <Textarea
                value={editableLegendas.whatsapp}
                onChange={(e) => setEditableLegendas({...editableLegendas, whatsapp: e.target.value})}
                className="min-h-[100px]"
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => handleCopy(editableLegendas.whatsapp, 'WhatsApp')}
                  variant="outline"
                  className="flex-1"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar
                </Button>
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Baixar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
