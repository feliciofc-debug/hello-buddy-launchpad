import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Instagram, MessageCircle, Copy, Calendar as CalendarIcon, Upload, Video, Facebook, Sparkles, Download } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SchedulePostsModal } from "@/components/SchedulePostsModal";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { VideoGenerator } from "@/components/VideoGenerator";
import { EnviarWhatsAppModal } from "@/components/EnviarWhatsAppModal";
import { AfiliadoLayout } from "@/components/afiliado/AfiliadoLayout";

interface PostVariations {
  opcaoA: string;
  opcaoB: string;
  opcaoC: string;
}

interface ProductAnalysis {
  produto: { titulo: string; preco: string; url: string; originalUrl: string; imagem?: string | null; };
  instagram: PostVariations;
  facebook: PostVariations;
  story: PostVariations;
  whatsapp: PostVariations;
  generatedImage?: string | null;
}

const AfiliadoIAMarketing = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ProductAnalysis | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [selectedVariations, setSelectedVariations] = useState({
    instagram: 'opcaoA' as keyof PostVariations,
    facebook: 'opcaoA' as keyof PostVariations,
    story: 'opcaoA' as keyof PostVariations,
    whatsapp: 'opcaoA' as keyof PostVariations
  });
  const [editableTexts, setEditableTexts] = useState({
    instagram: { opcaoA: '', opcaoB: '', opcaoC: '' },
    facebook: { opcaoA: '', opcaoB: '', opcaoC: '' },
    story: { opcaoA: '', opcaoB: '', opcaoC: '' },
    whatsapp: { opcaoA: '', opcaoB: '', opcaoC: '' }
  });

  const handleAnalyze = async () => {
    if (!url.trim()) { toast.error("Digite uma descrição ou cole um link"); return; }
    setLoading(true);
    setResultado(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { toast.error("Você precisa estar logado"); return; }

      const imagesBase64: string[] = [];
      for (const file of uploadedFiles) {
        if (file.type.startsWith('image/')) {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          imagesBase64.push(base64);
        }
      }

      const isShopeeUrl = url.trim().toLowerCase().includes('shopee.com');
      const { data, error } = await supabase.functions.invoke('analisar-produto', {
        body: { url: url.trim(), images: imagesBase64, source: isShopeeUrl ? 'shopee' : 'generic' }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao analisar produto');

      const analysisResult: ProductAnalysis = {
        produto: data.produto || { titulo: "Produto", preco: "0", url, originalUrl: url },
        instagram: data.instagram || { opcaoA: '', opcaoB: '', opcaoC: '' },
        facebook: data.facebook || { opcaoA: '', opcaoB: '', opcaoC: '' },
        story: data.story || { opcaoA: '', opcaoB: '', opcaoC: '' },
        whatsapp: data.whatsapp || { opcaoA: '', opcaoB: '', opcaoC: '' },
        generatedImage: data.generatedImage || null
      };

      setResultado(analysisResult);
      if (data.generatedImage) toast.success("🎨 Imagem gerada com IA!");

      setEditableTexts({
        instagram: analysisResult.instagram,
        facebook: analysisResult.facebook,
        story: analysisResult.story,
        whatsapp: analysisResult.whatsapp
      });

      await supabase.from('posts').insert({
        user_id: userData.user.id,
        titulo: analysisResult.produto.titulo,
        link_produto: analysisResult.produto.originalUrl,
        link_afiliado: analysisResult.produto.url,
        texto_instagram: JSON.stringify(analysisResult.instagram),
        texto_story: JSON.stringify(analysisResult.story),
        texto_facebook: JSON.stringify(analysisResult.facebook),
        texto_whatsapp: JSON.stringify(analysisResult.whatsapp),
        status: 'rascunho'
      });

      toast.success("✅ Posts gerados e salvos!");
    } catch (err: any) {
      toast.error(err.message || 'Erro ao analisar produto');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles = Array.from(files).filter(file => {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        toast.error(`${file.name} não é válido`);
        return false;
      }
      return true;
    });
    setUploadedFiles(prev => [...prev, ...newFiles]);
    toast.success(`${newFiles.length} arquivo(s) adicionado(s)`);
  };

  const removeFile = (index: number) => setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(`${text}\n\n🔗 ${resultado?.produto?.originalUrl || url}`);
    toast.success(`${type} copiado com link!`);
  };
  const handleDownloadImage = () => {
    if (!resultado?.generatedImage) return;
    const link = document.createElement('a');
    link.href = resultado.generatedImage;
    link.download = `imagem-ia-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Imagem baixada!");
  };
  const updateText = (platform: 'instagram' | 'facebook' | 'story' | 'whatsapp', variation: keyof PostVariations, text: string) => {
    setEditableTexts(prev => ({ ...prev, [platform]: { ...prev[platform], [variation]: text } }));
  };
  const handleCreateCampaign = () => {
    const textoSelecionado = editableTexts.whatsapp[selectedVariations.whatsapp];
    if (!textoSelecionado.trim()) { toast.error("Selecione uma variação primeiro"); return; }
    localStorage.setItem('campaignMessageTemplate', textoSelecionado);
    toast.success("Texto salvo! Redirecionando...");
    setTimeout(() => navigate('/afiliado/campanhas'), 500);
  };

  const renderPlatformCard = (
    platform: 'instagram' | 'facebook' | 'story' | 'whatsapp',
    title: string,
    icon: React.ReactNode,
    headerClass: string,
    options: { id: string; label: string }[]
  ) => (
    <Card className="shadow-lg border hover:shadow-xl transition-shadow">
      <CardHeader className={`${headerClass} text-white`}>
        <CardTitle className="flex items-center gap-2 text-base">{icon} {title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <RadioGroup
          value={selectedVariations[platform]}
          onValueChange={(value) => setSelectedVariations({ ...selectedVariations, [platform]: value as keyof PostVariations })}
        >
          {options.map(opt => (
            <div key={opt.id} className="flex items-center space-x-2">
              <RadioGroupItem value={opt.id} id={`${platform}-${opt.id}`} />
              <Label htmlFor={`${platform}-${opt.id}`} className="cursor-pointer text-sm">{opt.label}</Label>
            </div>
          ))}
        </RadioGroup>
        {platform === 'whatsapp' && resultado?.produto?.imagem && (
          <div className="border rounded-lg p-2 bg-muted/30">
            <p className="text-xs text-muted-foreground mb-2">📷 Imagem do produto:</p>
            <img src={resultado.produto.imagem} alt="" className="w-full h-32 object-cover rounded-md" />
          </div>
        )}
        <Textarea
          value={editableTexts[platform][selectedVariations[platform]]}
          onChange={(e) => updateText(platform, selectedVariations[platform], e.target.value)}
          className={platform === 'story' ? "min-h-[150px] text-sm" : "min-h-[200px] text-sm"}
          maxLength={platform === 'story' ? 80 : undefined}
        />
        {platform === 'story' && (
          <p className="text-xs text-muted-foreground text-right">{editableTexts.story[selectedVariations.story].length}/80</p>
        )}
        <div className="flex flex-col gap-2">
          <Button onClick={() => handleCopy(editableTexts[platform][selectedVariations[platform]], title)} variant="outline" className="w-full">
            <Copy className="mr-2 h-4 w-4" /> Copiar
          </Button>
          {platform === 'whatsapp' && (
            <>
              <Button onClick={() => setShowWhatsAppModal(true)} disabled={!editableTexts.whatsapp[selectedVariations.whatsapp]?.trim()} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                <MessageCircle className="mr-2 h-4 w-4" /> 📲 Enviar via WhatsApp
              </Button>
              <Button onClick={handleCreateCampaign} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                <Sparkles className="mr-2 h-4 w-4" /> 🚀 Criar Campanha
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AfiliadoLayout>
      <div className="p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <Tabs defaultValue="gerar" className="w-full">
            <TabsList className="grid w-full max-w-lg mx-auto grid-cols-3 mb-8">
              <TabsTrigger value="gerar">Gerar Posts</TabsTrigger>
              <TabsTrigger value="video">🎬 Gerar Vídeo</TabsTrigger>
              <TabsTrigger value="historico">Meus Posts</TabsTrigger>
            </TabsList>

            <TabsContent value="gerar">
              <div className="text-center space-y-2 mb-8">
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent">
                  ✨ IA Marketing
                </h1>
                <p className="text-muted-foreground">
                  Cole um link OU envie fotos + descrição para receber 3 variações de posts
                </p>
              </div>

              <Card className="max-w-4xl mx-auto mb-8 shadow-xl border-2">
                <CardContent className="pt-8 space-y-6">
                  <Textarea
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Cole um link OU escreva uma descrição..."
                    className="text-lg p-6 min-h-[100px]"
                    disabled={loading}
                  />
                  <div className="border-2 border-dashed rounded-lg p-6 space-y-4">
                    <div className="flex items-center justify-center">
                      <label className="cursor-pointer">
                        <input type="file" multiple accept="image/*,video/*" onChange={handleFileUpload} className="hidden" />
                        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors">
                          <Upload className="h-5 w-5" />
                          <span className="font-medium">Upload Fotos/Vídeos</span>
                        </div>
                      </label>
                    </div>
                    {uploadedFiles.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {uploadedFiles.map((file, index) => (
                          <div key={index} className="relative group">
                            <div className="aspect-square rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                              {file.type.startsWith('image/') ? (
                                <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                              ) : (
                                <Video className="h-8 w-8 text-muted-foreground" />
                              )}
                            </div>
                            <button onClick={() => removeFile(index)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button onClick={handleAnalyze} disabled={loading || !url.trim()} size="lg" className="w-full text-lg py-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
                    {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analisando com IA...</> : <>✨ ANALISAR COM IA</>}
                  </Button>
                </CardContent>
              </Card>

              {resultado && (
                <div className="max-w-7xl mx-auto space-y-6">
                  {resultado.generatedImage && (
                    <Card className="shadow-xl border-2 border-purple-500">
                      <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                        <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> 🎨 Imagem Gerada com IA</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-4">
                        <img src={resultado.generatedImage} alt="Gerada" className="w-full rounded-lg shadow-lg" />
                        <Button onClick={handleDownloadImage} className="w-full bg-gradient-to-r from-green-600 to-emerald-600">
                          <Download className="mr-2 h-5 w-5" /> 💾 Salvar Imagem
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {renderPlatformCard('instagram', '📱 Post Instagram', <Instagram className="h-5 w-5" />, 'bg-gradient-to-r from-pink-500 to-purple-500', [
                      { id: 'opcaoA', label: 'Opção A: Direto/Urgente' },
                      { id: 'opcaoB', label: 'Opção B: Storytelling' },
                      { id: 'opcaoC', label: 'Opção C: Educativo' },
                    ])}
                    {renderPlatformCard('facebook', '📘 Post Facebook', <Facebook className="h-5 w-5" />, 'bg-gradient-to-r from-blue-500 to-cyan-500', [
                      { id: 'opcaoA', label: 'Opção A: Casual/Amigável' },
                      { id: 'opcaoB', label: 'Opção B: Profissional' },
                      { id: 'opcaoC', label: 'Opção C: Promocional' },
                    ])}
                    {renderPlatformCard('story', '📖 Story Instagram', <Sparkles className="h-5 w-5" />, 'bg-gradient-to-r from-orange-500 to-red-500', [
                      { id: 'opcaoA', label: 'Opção A: Curto/Impactante' },
                      { id: 'opcaoB', label: 'Opção B: Pergunta Interativa' },
                      { id: 'opcaoC', label: 'Opção C: Contagem Regressiva' },
                    ])}
                    {renderPlatformCard('whatsapp', '💬 Mensagem WhatsApp', <MessageCircle className="h-5 w-5" />, 'bg-gradient-to-r from-green-500 to-emerald-600', [
                      { id: 'opcaoA', label: 'Opção A: Curto e Direto' },
                      { id: 'opcaoB', label: 'Opção B: Amigável' },
                      { id: 'opcaoC', label: 'Opção C: Com Call-to-Action' },
                    ])}
                  </div>

                  <div className="flex justify-center pt-4">
                    <Button onClick={() => setShowScheduleModal(true)} size="lg" className="bg-green-600 hover:bg-green-700 text-lg px-12 py-6">
                      <CalendarIcon className="mr-2 h-6 w-6" /> 📅 AGENDAR TODOS
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="video">
              <div className="max-w-4xl mx-auto"><VideoGenerator /></div>
            </TabsContent>

            <TabsContent value="historico">
              <div className="max-w-4xl mx-auto">
                <Card>
                  <CardHeader><CardTitle className="text-center">📚 Histórico de Posts</CardTitle></CardHeader>
                  <CardContent className="text-center py-20 text-muted-foreground">Em breve: veja todos os seus posts salvos e agendados</CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <EnviarWhatsAppModal
        open={showWhatsAppModal}
        onOpenChange={setShowWhatsAppModal}
        mensagem={editableTexts.whatsapp[selectedVariations.whatsapp] || ""}
        imagemUrl={resultado?.generatedImage || resultado?.produto?.imagem}
      />

      {resultado && (
        <SchedulePostsModal
          open={showScheduleModal}
          onOpenChange={setShowScheduleModal}
          postContent={{
            instagram: editableTexts.instagram[selectedVariations.instagram],
            facebook: editableTexts.facebook[selectedVariations.facebook],
            story: editableTexts.story[selectedVariations.story],
            whatsapp: editableTexts.whatsapp[selectedVariations.whatsapp]
          }}
          userType="afiliado"
        />
      )}
    </AfiliadoLayout>
  );
};

export default AfiliadoIAMarketing;
