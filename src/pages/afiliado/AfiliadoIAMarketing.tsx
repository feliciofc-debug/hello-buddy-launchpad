import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Instagram, MessageCircle, ArrowLeft, Copy, Calendar as CalendarIcon, Upload, Video, Facebook, Sparkles, Download } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SchedulePostsModal } from "@/components/SchedulePostsModal";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { VideoGenerator } from "@/components/VideoGenerator";

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
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [selectedVariations, setSelectedVariations] = useState({ instagram: 'opcaoA' as keyof PostVariations, facebook: 'opcaoA' as keyof PostVariations, story: 'opcaoA' as keyof PostVariations, whatsapp: 'opcaoA' as keyof PostVariations });
  const [editableTexts, setEditableTexts] = useState({ instagram: { opcaoA: '', opcaoB: '', opcaoC: '' }, facebook: { opcaoA: '', opcaoB: '', opcaoC: '' }, story: { opcaoA: '', opcaoB: '', opcaoC: '' }, whatsapp: { opcaoA: '', opcaoB: '', opcaoC: '' } });

  const handleAnalyze = async () => {
    if (!url.trim()) { toast.error("Digite uma descrição ou cole um link"); return; }
    setLoading(true); setResultado(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { toast.error("Você precisa estar logado"); return; }
      const imagesBase64: string[] = [];
      for (const file of uploadedFiles) {
        if (file.type.startsWith('image/')) {
          const base64 = await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result as string); reader.readAsDataURL(file); });
          imagesBase64.push(base64);
        }
      }
      const { data, error } = await supabase.functions.invoke('analisar-produto', { body: { url: url.trim(), images: imagesBase64, source: url.trim().toLowerCase().includes('shopee.com') ? 'shopee' : 'generic' } });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao analisar produto');
      
      // Story e WhatsApp vêm aninhados dentro do instagram
      const storyData = data.instagram?.story || data.story || { opcaoA: '', opcaoB: '', opcaoC: '' };
      const whatsappData = data.instagram?.whatsapp || data.whatsapp || { opcaoA: '', opcaoB: '', opcaoC: '' };
      
      const analysisResult: ProductAnalysis = { 
        produto: data.produto || { titulo: "Produto", preco: "0", url: url, originalUrl: url, imagem: null }, 
        instagram: { opcaoA: data.instagram?.opcaoA || '', opcaoB: data.instagram?.opcaoB || '', opcaoC: data.instagram?.opcaoC || '' }, 
        facebook: data.facebook || { opcaoA: '', opcaoB: '', opcaoC: '' }, 
        story: storyData, 
        whatsapp: whatsappData, 
        generatedImage: data.generatedImage || null 
      };
      setResultado(analysisResult);
      if (data.generatedImage) toast.success("🎨 Imagem gerada com IA!");
      setEditableTexts({ instagram: analysisResult.instagram, facebook: analysisResult.facebook, story: analysisResult.story, whatsapp: analysisResult.whatsapp });
      await supabase.from('posts').insert({ user_id: userData.user.id, titulo: analysisResult.produto.titulo, link_produto: analysisResult.produto.originalUrl, link_afiliado: analysisResult.produto.url, texto_instagram: JSON.stringify(analysisResult.instagram), texto_story: JSON.stringify(analysisResult.story), texto_facebook: JSON.stringify(analysisResult.facebook), texto_whatsapp: JSON.stringify(analysisResult.whatsapp), status: 'rascunho' });
      toast.success("✅ Posts gerados!");
    } catch (err: any) { toast.error(err.message || 'Erro ao analisar'); } finally { setLoading(false); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const files = e.target.files; if (!files) return; const newFiles = Array.from(files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/')); setUploadedFiles(prev => [...prev, ...newFiles]); };
  const removeFile = (index: number) => { setUploadedFiles(prev => prev.filter((_, i) => i !== index)); };
  const handleCopy = (text: string, type: string) => { navigator.clipboard.writeText(`${text}\n\n🔗 ${resultado?.produto?.originalUrl || url}`); toast.success(`${type} copiado!`); };
  const handleDownloadImage = () => { if (!resultado?.generatedImage) return; const link = document.createElement('a'); link.href = resultado.generatedImage; link.download = `imagem-ia-${Date.now()}.png`; document.body.appendChild(link); link.click(); document.body.removeChild(link); toast.success("Imagem baixada!"); };
  const updateText = (platform: 'instagram' | 'facebook' | 'story' | 'whatsapp', variation: keyof PostVariations, text: string) => { setEditableTexts(prev => ({ ...prev, [platform]: { ...prev[platform], [variation]: text } })); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <Tabs defaultValue="gerar" className="w-full">
          <TabsList className="grid w-full max-w-lg mx-auto grid-cols-3 mb-8">
            <TabsTrigger value="gerar">Gerar Posts</TabsTrigger>
            <TabsTrigger value="video">🎬 Gerar Vídeo</TabsTrigger>
            <TabsTrigger value="historico">Meus Posts</TabsTrigger>
          </TabsList>
          <TabsContent value="gerar">
            <div className="mb-8">
              <Button onClick={() => navigate('/afiliado/dashboard')} variant="ghost" className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
              <div className="text-center space-y-2">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent">✨ IA Marketing</h1>
                <p className="text-lg md:text-xl text-muted-foreground">Cole um link OU envie fotos + descrição para receber 3 variações de posts</p>
              </div>
            </div>
            <Card className="max-w-4xl mx-auto mb-8 shadow-2xl border-2">
              <CardContent className="pt-8 space-y-6">
                <Textarea value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Cole um link OU escreva uma descrição..." className="text-lg p-6 min-h-[100px]" disabled={loading} />
                <div className="border-2 border-dashed rounded-lg p-6 space-y-4">
                  <label className="cursor-pointer flex items-center justify-center"><input type="file" multiple accept="image/*,video/*" onChange={handleFileUpload} className="hidden" /><div className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"><Upload className="h-5 w-5" /><span className="font-medium">Upload Fotos/Vídeos</span></div></label>
                  {uploadedFiles.length > 0 && <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{uploadedFiles.map((file, i) => <div key={i} className="relative group"><div className="aspect-square rounded-lg overflow-hidden bg-muted flex items-center justify-center">{file.type.startsWith('image/') ? <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" /> : <Video className="h-8 w-8 text-muted-foreground" />}</div><button onClick={() => removeFile(i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100">✕</button></div>)}</div>}
                </div>
                <Button onClick={handleAnalyze} disabled={loading || !url.trim()} size="lg" className="w-full text-lg py-6 bg-gradient-to-r from-purple-600 to-indigo-600">{loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Analisando...</> : <>✨ ANALISAR COM IA</>}</Button>
              </CardContent>
            </Card>
            {resultado && <div className="max-w-7xl mx-auto space-y-6">
              {resultado.generatedImage && <Card className="shadow-xl border-2 border-purple-500"><CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white"><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />🎨 Imagem Gerada</CardTitle></CardHeader><CardContent className="pt-6 space-y-4"><img src={resultado.generatedImage} alt="Imagem gerada" className="w-full rounded-lg shadow-lg" /><Button onClick={handleDownloadImage} className="w-full bg-gradient-to-r from-green-600 to-emerald-600"><Download className="mr-2 h-5 w-5" />💾 Salvar Imagem</Button></CardContent></Card>}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Instagram */}
                <Card className="shadow-xl border-2 hover:border-pink-500"><CardHeader className="bg-gradient-to-r from-pink-500 to-purple-500 text-white"><CardTitle className="flex items-center gap-2"><Instagram className="h-5 w-5" />📱 Instagram</CardTitle></CardHeader><CardContent className="pt-6 space-y-4"><RadioGroup value={selectedVariations.instagram} onValueChange={(v) => setSelectedVariations({...selectedVariations, instagram: v as keyof PostVariations})}><div className="flex items-center space-x-2"><RadioGroupItem value="opcaoA" id="ia" /><Label htmlFor="ia">Opção A</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="opcaoB" id="ib" /><Label htmlFor="ib">Opção B</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="opcaoC" id="ic" /><Label htmlFor="ic">Opção C</Label></div></RadioGroup><Textarea value={editableTexts.instagram[selectedVariations.instagram]} onChange={(e) => updateText('instagram', selectedVariations.instagram, e.target.value)} className="min-h-[200px] text-sm" /><Button onClick={() => handleCopy(editableTexts.instagram[selectedVariations.instagram], 'Instagram')} variant="outline" className="w-full"><Copy className="mr-2 h-4 w-4" />Copiar</Button></CardContent></Card>
                {/* Facebook */}
                <Card className="shadow-xl border-2 hover:border-blue-500"><CardHeader className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white"><CardTitle className="flex items-center gap-2"><Facebook className="h-5 w-5" />📘 Facebook</CardTitle></CardHeader><CardContent className="pt-6 space-y-4"><RadioGroup value={selectedVariations.facebook} onValueChange={(v) => setSelectedVariations({...selectedVariations, facebook: v as keyof PostVariations})}><div className="flex items-center space-x-2"><RadioGroupItem value="opcaoA" id="fa" /><Label htmlFor="fa">Opção A</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="opcaoB" id="fb" /><Label htmlFor="fb">Opção B</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="opcaoC" id="fc" /><Label htmlFor="fc">Opção C</Label></div></RadioGroup><Textarea value={editableTexts.facebook[selectedVariations.facebook]} onChange={(e) => updateText('facebook', selectedVariations.facebook, e.target.value)} className="min-h-[200px] text-sm" /><Button onClick={() => handleCopy(editableTexts.facebook[selectedVariations.facebook], 'Facebook')} variant="outline" className="w-full"><Copy className="mr-2 h-4 w-4" />Copiar</Button></CardContent></Card>
                {/* Story */}
                <Card className="shadow-xl border-2 hover:border-orange-500"><CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white"><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />📖 Story</CardTitle></CardHeader><CardContent className="pt-6 space-y-4"><RadioGroup value={selectedVariations.story} onValueChange={(v) => setSelectedVariations({...selectedVariations, story: v as keyof PostVariations})}><div className="flex items-center space-x-2"><RadioGroupItem value="opcaoA" id="sa" /><Label htmlFor="sa">Opção A</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="opcaoB" id="sb" /><Label htmlFor="sb">Opção B</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="opcaoC" id="sc" /><Label htmlFor="sc">Opção C</Label></div></RadioGroup><Textarea value={editableTexts.story[selectedVariations.story]} onChange={(e) => updateText('story', selectedVariations.story, e.target.value)} className="min-h-[150px] text-sm" maxLength={80} /><Button onClick={() => handleCopy(editableTexts.story[selectedVariations.story], 'Story')} variant="outline" className="w-full"><Copy className="mr-2 h-4 w-4" />Copiar</Button></CardContent></Card>
                {/* WhatsApp com imagem do produto */}
                <Card className="shadow-xl border-2 hover:border-green-500">
                  <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                    <CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5" />💬 Mensagem WhatsApp</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <RadioGroup value={selectedVariations.whatsapp} onValueChange={(v) => setSelectedVariations({...selectedVariations, whatsapp: v as keyof PostVariations})}>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="opcaoA" id="wa" /><Label htmlFor="wa">Opção A: Curto e Direto</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="opcaoB" id="wb" /><Label htmlFor="wb">Opção B: Amigável</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="opcaoC" id="wc" /><Label htmlFor="wc">Opção C: Com Call-to-Action</Label></div>
                    </RadioGroup>
                    
                    {/* Imagem do Produto */}
                    {(resultado?.produto?.imagem || resultado?.generatedImage) && (
                      <div className="border rounded-lg p-3 bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-2">📷 Imagem do produto:</p>
                        <img 
                          src={resultado.generatedImage || resultado.produto?.imagem || ''} 
                          alt="Produto" 
                          className="w-full max-h-32 object-contain rounded"
                        />
                        <p className="text-xs text-green-600 mt-2">💡 Copie esta imagem e cole no WhatsApp junto com o texto</p>
                      </div>
                    )}
                    
                    <Textarea value={editableTexts.whatsapp[selectedVariations.whatsapp]} onChange={(e) => updateText('whatsapp', selectedVariations.whatsapp, e.target.value)} className="min-h-[120px] text-sm" />
                    <Button onClick={() => handleCopy(editableTexts.whatsapp[selectedVariations.whatsapp], 'WhatsApp')} variant="outline" className="w-full"><Copy className="mr-2 h-4 w-4" />Copiar</Button>
                    <Button onClick={() => { navigate('/afiliado/whatsapp', { state: { messageTemplate: editableTexts.whatsapp[selectedVariations.whatsapp], productImage: resultado?.generatedImage || resultado?.produto?.imagem, productTitle: resultado?.produto?.titulo, fromIAMarketing: true } }); toast.success('Redirecionando...'); }} className="w-full bg-gradient-to-r from-green-600 to-emerald-600"><MessageCircle className="mr-2 h-4 w-4" />📤 Enviar WhatsApp</Button>
                  </CardContent>
                </Card>
              </div>
              <div className="flex justify-center pt-4"><Button onClick={() => setShowScheduleModal(true)} size="lg" className="bg-green-600 hover:bg-green-700 text-lg px-12 py-6"><CalendarIcon className="mr-2 h-6 w-6" />📅 AGENDAR</Button></div>
            </div>}
          </TabsContent>
          <TabsContent value="video"><div className="max-w-4xl mx-auto"><Button onClick={() => navigate('/afiliado/dashboard')} variant="ghost" className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button><VideoGenerator /></div></TabsContent>
          <TabsContent value="historico"><div className="max-w-4xl mx-auto"><Card><CardHeader><CardTitle className="text-center">📚 Histórico de Posts</CardTitle></CardHeader><CardContent className="text-center py-20 text-muted-foreground">Em breve</CardContent></Card></div></TabsContent>
        </Tabs>
      </div>
      {resultado && <SchedulePostsModal open={showScheduleModal} onOpenChange={setShowScheduleModal} postContent={{ instagram: editableTexts.instagram[selectedVariations.instagram], facebook: editableTexts.facebook[selectedVariations.facebook], story: editableTexts.story[selectedVariations.story], whatsapp: editableTexts.whatsapp[selectedVariations.whatsapp] }} userType="afiliado" />}
    </div>
  );
};

export default AfiliadoIAMarketing;