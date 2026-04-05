import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, Download, Instagram, Image as ImageIcon, Palette, Sparkles, X, ChevronLeft, ChevronRight, PackagePlus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SlideRenderer } from "@/components/carousel/SlideRenderer";
import { TEMPLATE_OPTIONS, type TemplateKey } from "@/components/carousel/templates/types";
import { exportAllSlides } from "@/lib/carouselExporter";

export interface SlideData {
  type: 'cover' | 'content' | 'cta';
  title: string;
  body?: string;
  number?: number;
  totalSlides: number;
  contentTotal?: number;
  imageUrl?: string;
  logoUrl?: string;
  profileHandle?: string;
  highlight?: string;
  ctaLabel?: string;
}

export const CarouselGenerator = () => {
  const [tema, setTema] = useState("");
  const [numSlides, setNumSlides] = useState("5");
  const [estilo, setEstilo] = useState<string>("dark-premium");
  const [primaryColor, setPrimaryColor] = useState(TEMPLATE_OPTIONS['dark-premium'].primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(TEMPLATE_OPTIONS['dark-premium'].secondaryColor);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [profileHandle, setProfileHandle] = useState("@amzofertas");
  const [loading, setLoading] = useState(false);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [renderedImages, setRenderedImages] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [activeSlide, setActiveSlide] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [rendering, setRendering] = useState(false);
  const slideContainerRef = useRef<HTMLDivElement>(null);
  const productInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleMultiImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const remaining = 5 - productImages.length;
    if (remaining <= 0) { toast.error("Máximo de 5 fotos atingido"); return; }
    Array.from(files).slice(0, remaining).filter(f => f.type.startsWith("image/")).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => setProductImages(prev => [...prev, reader.result as string].slice(0, 5));
      reader.readAsDataURL(file);
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onloadend = () => setLogoImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeProductImage = (index: number) => setProductImages(prev => prev.filter((_, i) => i !== index));

  const renderSlidesToImages = useCallback(async (): Promise<string[]> => {
    if (!slideContainerRef.current) return [];
    setRendering(true);
    await new Promise(r => setTimeout(r, 600));
    const images = await exportAllSlides(slideContainerRef.current);
    setRendering(false);
    return images;
  }, []);

  const generateContent = async () => {
    if (!tema.trim()) { toast.error("Digite um tema para o carrossel"); return; }
    setLoading(true);
    setRenderedImages([]);
    setSlides([]);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { toast.error("Você precisa estar logado"); setLoading(false); return; }

      const n = parseInt(numSlides);
      const prompt = `Você é um diretor criativo e copywriter sênior especialista em carrosséis premium para Instagram.
Crie um carrossel de alto nível, com páginas completas, linguagem forte e benefícios reais — nada genérico, nada vazio.

TEMA BASE DO USUÁRIO:
"""${tema}"""

NÚMERO EXATO DE SLIDES: ${n}

OBJETIVO DO CARROSSEL:
- parecer conteúdo premium, estratégico e profissional
- transformar funcionalidades em benefícios claros
- mostrar valor percebido, resultado prático, ganho de tempo, automação, facilidade, escala ou economia
- preencher bem cada página com informação útil e persuasiva
- usar títulos grandes, impactantes e memoráveis

FORMATO JSON OBRIGATÓRIO:
{
  "slides": [
    { "type": "cover", "title": "headline principal", "body": "subtítulo curto" },
    { "type": "content", "number": 1, "title": "benefício principal", "body": "linha 1\\nlinha 2\\nlinha 3\\nlinha 4", "highlight": "ganho principal" },
    { "type": "cta", "title": "chamada final forte", "body": "frase curta 1\\nfrase curta 2", "ctaLabel": "texto do botão" }
  ],
  "caption": "legenda persuasiva para o post"
}

REGRAS:
- Exatamente 1 cover, ${Math.max(n - 2, 1)} content e 1 cta.
- Português do Brasil.
- Cada slide content deve ter 3-4 linhas curtas no body, separadas por \\n.
- A capa deve parecer manchete de campanha premium.
- Legenda com 2 parágrafos + 8-12 hashtags.
- Responda APENAS JSON válido.`;

      const { data, error } = await supabase.functions.invoke("gerar-carousel-content", { body: { prompt, tema } });
      if (error) throw error;

      let parsed = data;
      if (typeof data === "string") parsed = JSON.parse(data.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());

      const parsedSlides = Array.isArray(parsed.slides) ? parsed.slides : [];
      if (parsedSlides.length === 0) throw new Error("A IA não retornou slides válidos");

      const totalContentSlides = parsedSlides.filter((s: any) => s.type === "content").length;
      const slideData: SlideData[] = parsedSlides.map((s: any, i: number) => ({
        ...s,
        number: s.type === "content" ? (s.number ?? parsedSlides.slice(0, i + 1).filter((x: any) => x.type === "content").length) : undefined,
        totalSlides: parsedSlides.length,
        contentTotal: totalContentSlides,
        imageUrl: s.type === "cover" ? productImages[0] : (productImages[Math.min(i, productImages.length - 1)] || undefined),
        logoUrl: logoImage || undefined,
        profileHandle: s.type === "cta" ? (profileHandle || "@seuperfil") : undefined,
      }));

      setSlides(slideData);
      setCaption(parsed.caption || "");

      setTimeout(async () => {
        const images = await renderSlidesToImages();
        setRenderedImages(images);
        setActiveSlide(0);
        setLoading(false);
      }, 900);

      await supabase.from("carrosseis_gerados").insert({
        user_id: userData.user.id, tema: tema.trim(), estilo,
        num_slides: slideData.length, slides_data: slideData as any, caption: parsed.caption,
      });

      toast.success(`🎨 Carrossel V3 com ${slideData.length} slides gerado!`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao gerar carrossel");
      setLoading(false);
    }
  };

  const reRenderSlides = useCallback(async () => {
    if (slides.length === 0) return;
    const images = await renderSlidesToImages();
    setRenderedImages(images);
    toast.success("✅ Slides re-renderizados!");
  }, [slides, renderSlidesToImages]);

  const updateSlideText = (index: number, field: 'title' | 'body', value: string) => {
    setSlides(prev => { const u = [...prev]; u[index] = { ...u[index], [field]: value }; return u; });
  };

  const downloadAll = () => {
    renderedImages.forEach((img, i) => {
      const link = document.createElement("a");
      link.href = img; link.download = `carrossel-slide-${i + 1}.png`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    });
    toast.success(`📥 ${renderedImages.length} imagens baixadas!`);
  };

  const publishInstagram = async () => {
    setPublishing(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");
      const uploadedUrls: string[] = [];
      for (let i = 0; i < renderedImages.length; i++) {
        const blob = await (await fetch(renderedImages[i])).blob();
        const filename = `carrosseis/${userData.user.id}/${Date.now()}-slide-${i + 1}.png`;
        const { error: upErr } = await supabase.storage.from("produtos").upload(filename, blob, { contentType: "image/png" });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("produtos").getPublicUrl(filename);
        uploadedUrls.push(urlData.publicUrl);
      }
      const { error } = await supabase.functions.invoke("meta-publish-carousel", {
        body: { user_id: userData.user.id, image_urls: uploadedUrls, caption },
      });
      if (error) throw error;
      toast.success("🎉 Carrossel publicado no Instagram!");
    } catch (err: any) { toast.error(err.message || "Erro ao publicar"); }
    finally { setPublishing(false); }
  };

  const saveAsProduct = async () => {
    setSavingProduct(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");
      const allUrls: string[] = [];
      for (let i = 0; i < renderedImages.length; i++) {
        const blob = await (await fetch(renderedImages[i])).blob();
        const fname = `carrosseis/${userData.user.id}/${Date.now()}-slide-${i + 1}.png`;
        const { error: upErr } = await supabase.storage.from("produtos").upload(fname, blob, { contentType: "image/png" });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("produtos").getPublicUrl(fname);
        allUrls.push(urlData.publicUrl);
      }
      const titulo = slides[0]?.title || tema.slice(0, 80) || "Carrossel IA";
      await supabase.from("afiliado_produtos").insert({
        user_id: userData.user.id, titulo, marketplace: "Instagram",
        link_afiliado: allUrls[0], imagem_url: allUrls[0],
        descricao: caption || `Carrossel: ${titulo}`, categoria: "Marketing", status: "ativo",
      });
      toast.success("✅ Salvo como produto! Disponível no Autopilot.");
    } catch (err: any) { toast.error(err.message || "Erro ao salvar produto"); }
    finally { setSavingProduct(false); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
          🎨 Gerador de Carrosséis V3
        </h2>
        <p className="text-muted-foreground text-sm">Design profissional nível agência — 5 templates premium, custo zero!</p>
      </div>

      {/* Form */}
      <Card className="shadow-xl border-2">
        <CardContent className="pt-6 space-y-5">
          <div className="space-y-2">
            <Label className="font-semibold">📝 Tema ou conteúdo</Label>
            <Textarea value={tema} onChange={e => setTema(e.target.value)}
              placeholder='Ex: "5 dicas para cuidar do pelo do seu pet" ou cole uma lista de funcionalidades do seu produto'
              className="min-h-[90px]" disabled={loading} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="font-semibold">Nº de slides</Label>
              <Select value={numSlides} onValueChange={setNumSlides}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[3,4,5,6,7,8,9,10].map(n => <SelectItem key={n} value={String(n)}>{n} slides</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">🎨 Template</Label>
              <Select value={estilo} onValueChange={(v) => {
                setEstilo(v);
                const t = TEMPLATE_OPTIONS[v as TemplateKey];
                if (t) { setPrimaryColor(t.primaryColor); setSecondaryColor(t.secondaryColor); }
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TEMPLATE_OPTIONS).map(([key, t]) => (
                    <SelectItem key={key} value={key}>{t.emoji} {t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">@ perfil</Label>
              <Input value={profileHandle} onChange={e => setProfileHandle(e.target.value)} placeholder="@seuperfil" />
            </div>
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-semibold flex items-center gap-1"><Palette className="h-4 w-4" /> Cor principal</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
                <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="flex-1" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold flex items-center gap-1"><Palette className="h-4 w-4" /> Cor secundária</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
                <Input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="flex-1" />
              </div>
            </div>
          </div>

          {/* Uploads */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-semibold flex items-center gap-1"><ImageIcon className="h-4 w-4" /> Fotos do produto (até 5)</Label>
              <input ref={productInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleMultiImageUpload} />
              {productImages.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {productImages.map((img, i) => (
                    <div key={i} className="relative inline-block">
                      <img src={img} alt="" className="h-20 w-20 object-cover rounded-lg border" />
                      <button onClick={() => removeProductImage(i)} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              {productImages.length < 5 && (
                <Button variant="outline" onClick={() => productInputRef.current?.click()} className="w-full">
                  <Upload className="mr-2 h-4 w-4" /> {productImages.length === 0 ? 'Anexar fotos' : `Mais (${5 - productImages.length} restantes)`}
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <Label className="font-semibold flex items-center gap-1"><Sparkles className="h-4 w-4" /> Logo da marca</Label>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              {logoImage ? (
                <div className="relative inline-block">
                  <img src={logoImage} alt="" className="h-20 w-20 object-contain rounded-lg border" />
                  <button onClick={() => setLogoImage(null)} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"><X className="h-3 w-3" /></button>
                </div>
              ) : (
                <Button variant="outline" onClick={() => logoInputRef.current?.click()} className="w-full">
                  <Upload className="mr-2 h-4 w-4" /> Anexar logo
                </Button>
              )}
            </div>
          </div>

          <Button onClick={generateContent} disabled={loading || !tema.trim()} size="lg"
            className="w-full text-lg py-6 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700">
            {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando carrossel profissional...</> : <>🚀 Gerar Carrossel V3 Profissional</>}
          </Button>
        </CardContent>
      </Card>

      {/* Hidden render container */}
      <div ref={slideContainerRef} style={{ position: 'absolute', left: '-9999px', top: 0 }} aria-hidden="true">
        {slides.map((slide, i) => (
          <SlideRenderer
            key={`${estilo}-${i}-${slide.title}-${primaryColor}`}
            templateName={estilo}
            type={slide.type}
            title={slide.title}
            body={slide.body}
            number={slide.number}
            totalSlides={slide.totalSlides}
            contentTotal={slide.contentTotal}
            imageUrl={slide.imageUrl}
            logoUrl={slide.logoUrl}
            profileHandle={slide.profileHandle}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            highlight={slide.highlight}
            ctaLabel={slide.ctaLabel}
          />
        ))}
      </div>

      {/* Preview */}
      {renderedImages.length > 0 && (
        <Card className="shadow-xl border-2 border-purple-300">
          <CardHeader className="bg-gradient-to-r from-pink-500 to-purple-500 text-white">
            <CardTitle className="flex items-center gap-2">🖼️ Preview do Carrossel ({renderedImages.length} slides)</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {/* Main preview */}
            <div className="relative flex items-center justify-center">
              <Button variant="ghost" size="icon" onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))} disabled={activeSlide === 0} className="absolute left-0 z-10">
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <img src={renderedImages[activeSlide]} alt={`Slide ${activeSlide + 1}`}
                className="max-h-[500px] rounded-lg shadow-lg border" />
              <Button variant="ghost" size="icon" onClick={() => setActiveSlide(Math.min(renderedImages.length - 1, activeSlide + 1))} disabled={activeSlide === renderedImages.length - 1} className="absolute right-0 z-10">
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>

            {/* Slide indicator */}
            <p className="text-center text-sm font-medium text-muted-foreground">
              Slide {activeSlide + 1} de {renderedImages.length}
            </p>

            {/* Thumbnails */}
            <div className="flex gap-2 overflow-x-auto pb-2 justify-center">
              {renderedImages.map((img, i) => (
                <button key={i} onClick={() => setActiveSlide(i)}
                  className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${i === activeSlide ? 'border-purple-500 scale-105 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                  <img src={img} alt={`Slide ${i + 1}`} className="h-20 w-16 object-cover" />
                </button>
              ))}
            </div>

            {/* Edit */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-muted-foreground">✏️ Editar Slide {activeSlide + 1}</p>
              <div className="space-y-2">
                <Label className="text-xs">Título</Label>
                <Input value={slides[activeSlide]?.title || ""} onChange={e => updateSlideText(activeSlide, 'title', e.target.value)} />
              </div>
              {slides[activeSlide]?.body !== undefined && (
                <div className="space-y-2">
                  <Label className="text-xs">Corpo</Label>
                  <Textarea value={slides[activeSlide]?.body || ""} onChange={e => updateSlideText(activeSlide, 'body', e.target.value)} className="min-h-[60px]" />
                </div>
              )}
              <Button variant="outline" size="sm" onClick={reRenderSlides} disabled={rendering}>
                {rendering ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                Re-renderizar
              </Button>
            </div>

            {/* Caption */}
            <div className="space-y-2">
              <Label className="font-semibold">📝 Legenda do post</Label>
              <Textarea value={caption} onChange={e => setCaption(e.target.value)} className="min-h-[100px] text-sm" />
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={downloadAll} size="lg" className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                <Download className="mr-2 h-5 w-5" /> 📥 Baixar ({renderedImages.length} PNGs)
              </Button>
              <Button onClick={publishInstagram} disabled={publishing} size="lg" className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600">
                {publishing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Instagram className="mr-2 h-5 w-5" />}
                📱 Instagram
              </Button>
            </div>
            <Button onClick={saveAsProduct} disabled={savingProduct} size="lg" className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white">
              {savingProduct ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PackagePlus className="mr-2 h-5 w-5" />}
              📦 Salvar como Produto (Autopilot)
            </Button>
          </CardContent>
        </Card>
      )}

      {rendering && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Renderizando slides...</span>
        </div>
      )}
    </div>
  );
};
