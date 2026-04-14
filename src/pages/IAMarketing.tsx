import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTrialConfig } from "@/hooks/useTrialConfig";
import { useIALimit } from "@/hooks/useIALimit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Instagram, MessageCircle, ArrowLeft, Copy, Calendar as CalendarIcon, Upload, Video, Facebook, Sparkles, Download, X } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SchedulePostsModal } from "@/components/SchedulePostsModal";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

import { VideoSlideshowGenerator } from "@/components/VideoSlideshowGenerator";
import { EnviarWhatsAppModal } from "@/components/EnviarWhatsAppModal";
import { CarouselGenerator } from "@/components/CarouselGenerator";
import { PublicarReelsModal } from "@/components/PublicarReelsModal";
import { Separator } from "@/components/ui/separator";
import { getSafeProductLink, getSanitizedProductLinks } from "@/lib/product-links";
import { sanitizeGeneratedPostText, sanitizeGeneratedPostVariations } from "@/lib/social-post-sanitizer";

interface PostVariations {
  opcaoA: string;
  opcaoB: string;
  opcaoC: string;
}

interface ProductAnalysis {
  produto: {
    titulo: string;
    preco: string;
    url: string;
    originalUrl: string;
    imagem?: string | null;
  };
  instagram: PostVariations;
  facebook: PostVariations;
  story: PostVariations;
  whatsapp: PostVariations;
  generatedImage?: string | null;
  applyLogoOverlay?: boolean;
}

const IAMarketing = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isTrial, trial, canUseIAMarketing, canPostToday, isTrialExpired, incrementImageUsage, incrementPostUsage, trialDaysRemaining } = useTrialConfig();
  const { iaUsado, iaLimite, canGenerate, remaining, incrementUsage: incrementIAUsage } = useIALimit();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ProductAnalysis | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [userType, setUserType] = useState<string>('empresa');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [publicandoFacebook, setPublicandoFacebook] = useState(false);
  const [publicandoInstagram, setPublicandoInstagram] = useState(false);
  const [publicandoTodas, setPublicandoTodas] = useState(false);
  const [showReelsModal, setShowReelsModal] = useState(false);
  const [selectedVariations, setSelectedVariations] = useState({
    instagram: 'opcaoA' as keyof PostVariations,
    facebook: 'opcaoA' as keyof PostVariations,
    story: 'opcaoA' as keyof PostVariations,
    whatsapp: 'opcaoA' as keyof PostVariations
  });

  // Estados editáveis para cada variação
  const [editableTexts, setEditableTexts] = useState({
    instagram: { opcaoA: '', opcaoB: '', opcaoC: '' },
    facebook: { opcaoA: '', opcaoB: '', opcaoC: '' },
    story: { opcaoA: '', opcaoB: '', opcaoC: '' },
    whatsapp: { opcaoA: '', opcaoB: '', opcaoC: '' }
  });
  const safeProductLink = getSafeProductLink(resultado?.produto);

  // Carregar tipo do usuário
  useState(() => {
    const loadUserType = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tipo')
          .eq('id', user.id)
          .single();
        
        if (profile?.tipo) {
          setUserType(profile.tipo);
        }
      }
    };
    loadUserType();
  });

  const handleAnalyze = async () => {
    if (!url.trim()) {
      toast.error(t('ai_marketing.enter_desc'));
      return;
    }

    // PJ limit guard - check monthly IA image limit (all clients)
    if (!canGenerate()) {
      toast.error(t('ai_marketing.ia_limit', { limit: iaLimite }));
      return;
    }

    // Trial guard - check IA Marketing limit
    if (isTrial && !canUseIAMarketing()) {
      toast.error(t('ai_marketing.ia_marketing_limit'));
      return;
    }

    setLoading(true);
    setResultado(null);
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error(t('common.need_login'));
        return;
      }

      // Helper to convert file to base64
      const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      };

      // Converter imagens de referência para base64 (NÃO a logo)
      const imagesBase64 = await Promise.all(
        referenceFiles.filter(f => f.type.startsWith('image/')).map(fileToBase64)
      );

      // Converter logo separadamente
      const logoBase64 = logoFile ? await fileToBase64(logoFile) : null;

      // 🚀 PILAR 1: Detectar se é URL da Shopee
      const isShopeeUrl = url.trim().toLowerCase().includes('shopee.com');
      
      const { data, error } = await supabase.functions.invoke('analisar-produto', {
        body: { 
          url: url.trim(),
          images: imagesBase64,
          logo: logoBase64,
          source: isShopeeUrl ? 'shopee' : 'generic'
        }
      });

      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao analisar produto');
      }

      console.log('✅ Dados recebidos:', data);

      const sanitizedGeneratedPosts = sanitizeGeneratedPostVariations({
        instagram: data.instagram || { opcaoA: '', opcaoB: '', opcaoC: '' },
        facebook: data.facebook || { opcaoA: '', opcaoB: '', opcaoC: '' },
        story: data.story || { opcaoA: '', opcaoB: '', opcaoC: '' },
        whatsapp: data.whatsapp || { opcaoA: '', opcaoB: '', opcaoC: '' },
      }, url.trim());

      // Criar estrutura de análise com os dados corretos
      const analysisResult: ProductAnalysis = {
        produto: data.produto || { titulo: "Produto", preco: "0", url: url, originalUrl: url },
        instagram: sanitizedGeneratedPosts.instagram,
        facebook: sanitizedGeneratedPosts.facebook,
        story: sanitizedGeneratedPosts.story,
        whatsapp: sanitizedGeneratedPosts.whatsapp,
        generatedImage: data.generatedImage || null,
        applyLogoOverlay: data.applyLogoOverlay !== false
      };

      // Se tem imagem gerada E logo, compor a logo sobre a imagem no frontend
      if (analysisResult.generatedImage && logoFile && analysisResult.applyLogoOverlay !== false) {
        try {
          const logob64 = logoBase64 || await fileToBase64(logoFile);
          const composited = await compositeImageWithLogo(analysisResult.generatedImage, logob64);
          analysisResult.generatedImage = composited;
        } catch (e) {
          console.error('Erro ao compor logo:', e);
        }
      }

      setResultado(analysisResult);
      
      if (data.generatedImage) {
        toast.success(t('ai_marketing.image_generated'));
      }
      
      // Inicializar textos editáveis
      setEditableTexts({
        instagram: analysisResult.instagram,
        facebook: analysisResult.facebook,
        story: analysisResult.story,
        whatsapp: analysisResult.whatsapp
      });

      // Salvar no banco
      const { originalLink, affiliateLink } = getSanitizedProductLinks(analysisResult.produto);
      const { error: insertError } = await supabase
        .from('posts')
        .insert({
          user_id: userData.user.id,
          titulo: analysisResult.produto.titulo,
          link_produto: originalLink,
          link_afiliado: affiliateLink,
          texto_instagram: JSON.stringify(analysisResult.instagram),
          texto_story: JSON.stringify(analysisResult.story),
          texto_facebook: JSON.stringify(analysisResult.facebook),
          texto_whatsapp: JSON.stringify(analysisResult.whatsapp),
          status: 'rascunho'
        });

      if (insertError) {
        console.error("Erro ao salvar:", insertError);
      }


      // Increment PJ usage (all clients)
      await incrementIAUsage();

      // Increment trial usage
      if (isTrial) await incrementImageUsage();

      toast.success(t('publish.posts_generated'));
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao analisar produto';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleReferenceFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files).filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} não é uma imagem válida`);
        return false;
      }
      return true;
    }).slice(0, 4 - referenceFiles.length);

    setReferenceFiles(prev => [...prev, ...newFiles]);
    toast.success(t('ai_marketing.files_added', { count: newFiles.length }));
  };

  const removeReferenceFile = (index: number) => {
    setReferenceFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Composite logo over generated image using Canvas
  const compositeImageWithLogo = async (baseImageUrl: string, logoBase64: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject('No canvas context'); return; }

      const baseImg = new Image();
      baseImg.crossOrigin = 'anonymous';
      baseImg.onload = () => {
        canvas.width = baseImg.width;
        canvas.height = baseImg.height;
        ctx.drawImage(baseImg, 0, 0);

        const logoImg = new Image();
        logoImg.onload = () => {
          const logoMaxWidth = canvas.width * 0.2;
          const logoScale = Math.min(logoMaxWidth / logoImg.width, 1);
          const logoW = logoImg.width * logoScale;
          const logoH = logoImg.height * logoScale;
          const logoX = canvas.width - logoW - 20;
          const logoY = canvas.height - logoH - 20;
          ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
          resolve(canvas.toDataURL('image/png'));
        };
        logoImg.onerror = () => resolve(baseImageUrl);
        logoImg.src = logoBase64;
      };
      baseImg.onerror = () => reject('Failed to load base image');
      baseImg.src = baseImageUrl;
    });
  };

  const handleCopy = (text: string, type: string) => {
    const sanitizedText = sanitizeGeneratedPostText(text, url.trim());
    const fullText = safeProductLink ? `${sanitizedText}\n\n🔗 ${safeProductLink}` : sanitizedText;
    navigator.clipboard.writeText(fullText);
    toast.success(safeProductLink ? `${type} copiado com link!` : `${type} copiado!`);
  };

  const handleDownloadImage = () => {
    if (!resultado?.generatedImage) return;
    
    // Criar um link temporário para download
    const link = document.createElement('a');
    link.href = resultado.generatedImage;
    link.download = `imagem-ia-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(t('publish.image_downloaded'));
  };

  const handleScheduleAll = () => {
    if (!resultado) return;
    setShowScheduleModal(true);
  };

  const updateText = (platform: 'instagram' | 'facebook' | 'story' | 'whatsapp', variation: keyof PostVariations, text: string) => {
    setEditableTexts(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [variation]: text
      }
    }));
  };

  // 🚀 PILAR 2: Criar Campanha a partir do texto do WhatsApp
  const handleCreateCampaign = () => {
    const textoSelecionado = sanitizeGeneratedPostText(editableTexts.whatsapp[selectedVariations.whatsapp], url.trim());
    
    if (!textoSelecionado.trim()) {
      toast.error(t('publish.select_text_first'));
      return;
    }

    localStorage.setItem('campaignMessageTemplate', textoSelecionado);
    toast.success(t('ai_marketing.text_saved'));
    setTimeout(() => navigate('/campanhas-prospeccao'), 500);
  };

  const handlePublicarFacebook = async () => {
    if (isTrial && !canPostToday()) { toast.error(t('ai_marketing.post_limit')); return; }
    if (isTrial && isTrialExpired()) { toast.error(t('ai_marketing.trial_expired')); return; }
    const texto = editableTexts.facebook[selectedVariations.facebook];
    if (!texto.trim()) { toast.error(t('publish.select_text_first')); return; }

    setPublicandoFacebook(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error(t('common.need_login')); return; }

      const link = getSafeProductLink(resultado?.produto);
      const textoLimpo = sanitizeGeneratedPostText(texto, url.trim());
      const mensagemFinal = link ? `${textoLimpo}\n\n🔗 Compre aqui: ${link}` : textoLimpo;
      const imagemUrl = resultado?.generatedImage || resultado?.produto?.imagem || null;

      await supabase.from("social_posts_queue" as any).insert({
        user_id: user.id,
        platform: "facebook",
        page_id: "",
        post_text: mensagemFinal,
        image_url: imagemUrl,
        status: "pendente",
      } as any);

      const { data: pubData, error: pubError } = await supabase.functions.invoke("meta-publish-post", {
        body: { message: mensagemFinal, user_id: user.id, image_url: imagemUrl || undefined },
      });
      if (pubError) throw pubError;

      const postId = pubData?.post_id || pubData?.id || "OK";
      if (isTrial) await incrementPostUsage();
      toast.success(`✅ Publicado no Facebook! Post ID: ${postId}`);
    } catch (err: any) {
      console.error("Erro ao publicar no Facebook:", err);
      toast.error(err.message || "Erro ao publicar no Facebook");
    } finally {
      setPublicandoFacebook(false);
    }
  };

  const handlePublicarInstagram = async () => {
    if (isTrial && !canPostToday()) { toast.error(t('ai_marketing.post_limit')); return; }
    if (isTrial && isTrialExpired()) { toast.error(t('ai_marketing.trial_expired')); return; }
    const texto = editableTexts.instagram[selectedVariations.instagram];
    if (!texto.trim()) { toast.error(t('publish.select_text_first')); return; }

    const imagemUrl = resultado?.generatedImage || resultado?.produto?.imagem || null;
    if (!imagemUrl) { toast.error(t('publish.ig_requires_image_ai')); return; }

    setPublicandoInstagram(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error(t('common.need_login')); return; }

      const link = getSafeProductLink(resultado?.produto);
      const textoLimpo = sanitizeGeneratedPostText(texto, url.trim());
      const captionFinal = link ? `${textoLimpo}\n\n🔗 Link na bio ou acesse: ${link}` : textoLimpo;

      await supabase.from("social_posts_queue" as any).insert({
        user_id: user.id,
        platform: "instagram",
        page_id: "",
        post_text: captionFinal,
        image_url: imagemUrl,
        status: "pendente",
      } as any);

      const { data: pubData, error: pubError } = await supabase.functions.invoke("meta-publish-instagram", {
        body: { caption: captionFinal, image_url: imagemUrl, user_id: user.id },
      });
      if (pubError) throw pubError;
      if (!pubData?.success) throw new Error(pubData?.error || "Erro ao publicar no Instagram");

      if (isTrial) await incrementPostUsage();
      toast.success(`✅ Publicado no Instagram! Post ID: ${pubData?.post_id || "OK"}`);
    } catch (err: any) {
      console.error("Erro ao publicar no Instagram:", err);
      toast.error(err.message || "Erro ao publicar no Instagram");
    } finally {
      setPublicandoInstagram(false);
    }
  };

  const handlePublicarTodas = async () => {
    if (!resultado) return;
    if (isTrial && !canPostToday()) { toast.error(t('ai_marketing.post_limit')); return; }
    if (isTrial && isTrialExpired()) { toast.error(t('ai_marketing.trial_expired')); return; }

    const textoFb = editableTexts.facebook[selectedVariations.facebook];
    const textoIg = editableTexts.instagram[selectedVariations.instagram];
    const imagemUrl = resultado?.generatedImage || resultado?.produto?.imagem || null;
    const link = getSafeProductLink(resultado?.produto);

    if (!textoFb.trim() && !textoIg.trim()) { toast.error(t('publish.no_text_available')); return; }

    setPublicandoTodas(true);
    const resultados: string[] = [];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error(t('common.need_login')); return; }

      const promises: Promise<void>[] = [];

      if (textoFb.trim()) {
        promises.push((async () => {
          try {
            const textoFbLimpo = sanitizeGeneratedPostText(textoFb, url.trim());
            const mensagemFb = link ? `${textoFbLimpo}\n\n🔗 Compre aqui: ${link}` : textoFbLimpo;
            await supabase.from("social_posts_queue" as any).insert({
              user_id: user.id,
              platform: "facebook",
              page_id: "",
              post_text: mensagemFb,
              image_url: imagemUrl,
              status: "pendente",
            } as any);
            const { error } = await supabase.functions.invoke("meta-publish-post", {
              body: { message: mensagemFb, user_id: user.id, image_url: imagemUrl || undefined },
            });
            if (error) throw error;
            resultados.push("✅ Facebook");
          } catch (err: any) {
            resultados.push("❌ Facebook: " + (err.message || "erro"));
          }
        })());
      }

      if (textoIg.trim() && imagemUrl) {
        promises.push((async () => {
          try {
            const textoIgLimpo = sanitizeGeneratedPostText(textoIg, url.trim());
            const captionIg = link ? `${textoIgLimpo}\n\n🔗 Link na bio ou acesse: ${link}` : textoIgLimpo;
            await supabase.from("social_posts_queue" as any).insert({
              user_id: user.id,
              platform: "instagram",
              page_id: "",
              post_text: captionIg,
              image_url: imagemUrl,
              status: "pendente",
            } as any);
            const { data: pubData, error } = await supabase.functions.invoke("meta-publish-instagram", {
              body: { caption: captionIg, image_url: imagemUrl, user_id: user.id },
            });
            if (error) throw error;
            if (!pubData?.success) throw new Error(pubData?.error);
            resultados.push("✅ Instagram");
          } catch (err: any) {
            resultados.push("❌ Instagram: " + (err.message || "erro"));
          }
        })());
      } else if (textoIg.trim() && !imagemUrl) {
        resultados.push("⚠️ Instagram pulado (sem imagem)");
      }

      await Promise.all(promises);
      toast.success(resultados.join(" | "));
    } catch (err: any) {
      toast.error(err.message || "Erro ao publicar");
    } finally {
      setPublicandoTodas(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* PJ IA Limit Banner */}
        {!isTrial && iaLimite < 9999 && (
          <div className={`mb-4 p-3 rounded-lg border ${remaining() === 0 ? 'bg-destructive/10 border-destructive' : 'bg-muted/50 border-border'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm">
                {t('ai_marketing.ia_generations')} <strong>{iaUsado}/{iaLimite}</strong> {t('ai_marketing.this_month')} ({remaining()} {t('ai_marketing.remaining')})
              </span>
              {remaining() === 0 && (
                <span className="text-sm font-medium text-destructive">{t('ai_marketing.limit_reached')}</span>
              )}
            </div>
          </div>
        )}
        {isTrial && trial && (
          <div className={`mb-4 p-4 rounded-lg border ${isTrialExpired() ? 'bg-destructive/10 border-destructive' : 'bg-amber-500/10 border-amber-500'}`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="font-bold">{isTrialExpired() ? t('ai_marketing.trial_ended') : t('ai_marketing.trial_days', { days: trialDaysRemaining() })}</span>
                <span className="ml-4 text-sm">
                  IA: {trial.imagens_ia_usadas}/{trial.limite_imagens_ia} {t('ai_marketing.images')} | {t('ai_marketing.posts_today')} {trial.posts_hoje}/{trial.limite_posts_dia}
                </span>
              </div>
              {isTrialExpired() && (
                <span className="text-sm font-medium text-destructive">{t('ai_marketing.buy_plan')}</span>
              )}
            </div>
          </div>
        )}
        <Tabs defaultValue="gerar" className="w-full">
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-4 mb-8">
            <TabsTrigger value="gerar">{t('ai_marketing.generate_posts')}</TabsTrigger>
            <TabsTrigger value="carrossel">{t('ai_marketing.carousel')}</TabsTrigger>
            <TabsTrigger value="video">{t('ai_marketing.generate_video')}</TabsTrigger>
            <TabsTrigger value="historico">{t('ai_marketing.my_posts')}</TabsTrigger>
          </TabsList>

          <TabsContent value="gerar">
            {/* Header */}
            <div className="mb-8">
              <Button
                onClick={() => navigate('/dashboard')}
                variant="ghost"
                className="mb-4"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('common.back')}
              </Button>
              
              <div className="text-center space-y-2">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent">
                  {t('ai_marketing.title')}
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground">
                  {t('ai_marketing.subtitle')}
                </p>
              </div>
            </div>

            {/* Campo Principal */}
            <Card className="max-w-4xl mx-auto mb-8 shadow-2xl border-2">
              <CardContent className="pt-8 space-y-6">
                <div className="space-y-4">
                  <Textarea
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={t('ai_marketing.input_placeholder')}
                    className="text-lg p-6 min-h-[100px]"
                    disabled={loading}
                  />
                  
                  {/* Upload de Logo e Imagens de Referência */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Upload de Logo */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Logo da empresa</Label>
                      <p className="text-xs text-muted-foreground">A logo será aplicada sobre a imagem gerada sem nenhuma alteração</p>
                      <div className="border-2 border-dashed rounded-lg p-3 min-h-[80px] flex items-center justify-center">
                        {logoFile ? (
                          <div className="relative inline-block">
                            <img src={URL.createObjectURL(logoFile)} className="h-16 w-16 object-contain rounded" alt="Logo" />
                            <button
                              type="button"
                              onClick={() => setLogoFile(null)}
                              className="absolute -right-2 -top-2 h-5 w-5 p-0 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                            <Upload className="h-4 w-4" />
                            <span>Anexar logo</span>
                            <input type="file" accept="image/png,image/webp,image/svg+xml" className="hidden"
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) setLogoFile(f); }} />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Upload de Imagens de Referência */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Foto base / referências</Label>
                      <p className="text-xs text-muted-foreground">A 1ª foto pode ser usada como base principal da edição; as demais servem de apoio visual (até 4)</p>
                      <div className="border-2 border-dashed rounded-lg p-3 min-h-[80px]">
                        {referenceFiles.length < 4 && (
                          <div className="flex items-center justify-center mb-2">
                            <label className="cursor-pointer">
                              <input type="file" multiple accept="image/*" onChange={handleReferenceFileUpload} className="hidden" />
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors text-sm">
                                <Upload className="h-4 w-4" />
                                <span>{t('publish.upload_photos')}</span>
                              </div>
                            </label>
                          </div>
                        )}
                        {referenceFiles.length > 0 && (
                          <div className="grid grid-cols-4 gap-2">
                            {referenceFiles.map((file, index) => (
                              <div key={index} className="relative group">
                                <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                                  <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                                </div>
                                <button onClick={() => removeReferenceFile(index)}
                                  className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    onClick={handleAnalyze}
                    disabled={loading || !url.trim()}
                    size="lg"
                    className="w-full text-lg py-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        {t('publish.analyzing')}
                      </>
                    ) : (
                      <>
                        {t('publish.analyze_ai')}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Resultados */}
            {resultado && (
              <div className="max-w-7xl mx-auto space-y-6">
                {/* Imagem Gerada */}
                {resultado.generatedImage && (
                  <Card className="shadow-xl border-2 border-purple-500">
                    <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        {t('ai_marketing.ai_image')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <img 
                        src={resultado.generatedImage} 
                        alt="Imagem gerada"
                        className="w-full rounded-lg shadow-lg"
                      />
                      <Button
                        onClick={handleDownloadImage}
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                      >
                        <Download className="mr-2 h-5 w-5" />
                        {t('publish.save_image')}
                      </Button>
                      <div className="flex gap-2 w-full">
                        <Button
                          variant="outline"
                          className="gap-2 border-[#00C4CC] text-[#00C4CC] hover:bg-[#00C4CC]/10 flex-1"
                          onClick={() => window.open('https://www.canva.com/create/design?type=TABqMN-bVr0', '_blank')}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                          Editar no Canva
                        </Button>
                        <Button
                          variant="outline"
                          className="gap-2 flex-1"
                          onClick={async () => {
                            try {
                              const response = await fetch(resultado.generatedImage!);
                              const blob = await response.blob();
                              await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
                              toast.success('Imagem copiada! Cole no Canva com Ctrl+V');
                            } catch {
                              toast.error('Use o botão de download e arraste para o Canva');
                            }
                          }}
                        >
                          Copiar imagem
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        💡 Dica: Clique em "Editar no Canva" para abrir o editor, depois cole a imagem (Ctrl+V) ou arraste o arquivo baixado. Adicione sua logo e texto perfeitos!
                      </p>
                    </CardContent>
                  </Card>
                )}
                
                {/* Grid de Cards - 4 colunas (Instagram, Facebook, Story, WhatsApp) */}
                {/* Botão combinado FB + IG */}
                <div className="flex justify-center">
                  <Button
                    onClick={handlePublicarTodas}
                    disabled={publicandoTodas || !resultado}
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white text-lg px-10 py-5"
                  >
                    {publicandoTodas ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t('publish.publishing_both')}</>
                    ) : (
                      <>{t('publish.publish_fb_ig')}</>
                    )}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Card Instagram */}
                  <Card className="shadow-xl border-2 hover:border-pink-500 transition-colors">
                    <CardHeader className="bg-gradient-to-r from-pink-500 to-purple-500 text-white">
                      <CardTitle className="flex items-center gap-2">
                        <Instagram className="h-5 w-5" />
                        {t('ai_marketing.post_instagram')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <RadioGroup
                        value={selectedVariations.instagram}
                        onValueChange={(value) => setSelectedVariations({ ...selectedVariations, instagram: value as keyof PostVariations })}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="opcaoA" id="inst-a" />
                          <Label htmlFor="inst-a" className="cursor-pointer">{t('ai_marketing.option_direct')}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="opcaoB" id="inst-b" />
                          <Label htmlFor="inst-b" className="cursor-pointer">{t('ai_marketing.option_storytelling')}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="opcaoC" id="inst-c" />
                          <Label htmlFor="inst-c" className="cursor-pointer">{t('ai_marketing.option_educational')}</Label>
                        </div>
                      </RadioGroup>

                      <Textarea
                        value={editableTexts.instagram[selectedVariations.instagram]}
                        onChange={(e) => updateText('instagram', selectedVariations.instagram, e.target.value)}
                        className="min-h-[200px] text-sm"
                      />

                      <div className="flex flex-col gap-2">
                        <Button
                          onClick={() => handleCopy(editableTexts.instagram[selectedVariations.instagram], 'Instagram')}
                          variant="outline"
                          className="w-full"
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          {t('publish.copy')}
                        </Button>
                        <Button
                          onClick={handlePublicarInstagram}
                          disabled={publicandoInstagram || !editableTexts.instagram[selectedVariations.instagram]?.trim()}
                          className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:from-purple-700 hover:via-pink-700 hover:to-orange-600 text-white"
                        >
                          {publicandoInstagram ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publicando...</>
                          ) : (
                            <><Instagram className="mr-2 h-4 w-4" /> ${t('publish.publish_instagram')}</>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card Facebook */}
                  <Card className="shadow-xl border-2 hover:border-blue-500 transition-colors">
                    <CardHeader className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
                      <CardTitle className="flex items-center gap-2">
                        <Facebook className="h-5 w-5" />
                        {t('ai_marketing.post_facebook')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <RadioGroup
                        value={selectedVariations.facebook}
                        onValueChange={(value) => setSelectedVariations({ ...selectedVariations, facebook: value as keyof PostVariations })}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="opcaoA" id="fb-a" />
                          <Label htmlFor="fb-a" className="cursor-pointer">{t('ai_marketing.option_casual')}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="opcaoB" id="fb-b" />
                          <Label htmlFor="fb-b" className="cursor-pointer">{t('ai_marketing.option_professional')}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="opcaoC" id="fb-c" />
                          <Label htmlFor="fb-c" className="cursor-pointer">{t('ai_marketing.option_promotional')}</Label>
                        </div>
                      </RadioGroup>

                      <Textarea
                        value={editableTexts.facebook[selectedVariations.facebook]}
                        onChange={(e) => updateText('facebook', selectedVariations.facebook, e.target.value)}
                        className="min-h-[200px] text-sm"
                      />

                      <div className="flex flex-col gap-2">
                        <Button
                          onClick={() => handleCopy(editableTexts.facebook[selectedVariations.facebook], 'Facebook')}
                          variant="outline"
                          className="w-full"
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          {t('publish.copy')}
                        </Button>
                        <Button
                          onClick={handlePublicarFacebook}
                          disabled={publicandoFacebook || !editableTexts.facebook[selectedVariations.facebook]?.trim()}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          {publicandoFacebook ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publicando...</>
                          ) : (
                            <><Facebook className="mr-2 h-4 w-4" /> {t('publish.publish_facebook')}</>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card Story */}
                  <Card className="shadow-xl border-2 hover:border-orange-500 transition-colors">
                    <CardHeader className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        {t('ai_marketing.story_instagram')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <RadioGroup
                        value={selectedVariations.story}
                        onValueChange={(value) => setSelectedVariations({ ...selectedVariations, story: value as keyof PostVariations })}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="opcaoA" id="story-a" />
                          <Label htmlFor="story-a" className="cursor-pointer">{t('ai_marketing.option_short')}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="opcaoB" id="story-b" />
                          <Label htmlFor="story-b" className="cursor-pointer">{t('ai_marketing.option_interactive')}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="opcaoC" id="story-c" />
                          <Label htmlFor="story-c" className="cursor-pointer">{t('ai_marketing.option_countdown')}</Label>
                        </div>
                      </RadioGroup>

                      <Textarea
                        value={editableTexts.story[selectedVariations.story]}
                        onChange={(e) => updateText('story', selectedVariations.story, e.target.value)}
                        className="min-h-[150px] text-sm"
                        maxLength={80}
                      />
                      <p className="text-xs text-muted-foreground text-right">
                        {editableTexts.story[selectedVariations.story].length}/80 {t('publish.character_count')}
                      </p>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleCopy(editableTexts.story[selectedVariations.story], 'Story')}
                          variant="outline"
                          className="flex-1"
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          {t('publish.copy')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card WhatsApp */}
                  <Card className="shadow-xl border-2 hover:border-green-500 transition-colors">
                    <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                      <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5" />
                        {t('ai_marketing.message_whatsapp')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <RadioGroup
                        value={selectedVariations.whatsapp}
                        onValueChange={(value) => setSelectedVariations({ ...selectedVariations, whatsapp: value as keyof PostVariations })}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="opcaoA" id="wpp-a" />
                          <Label htmlFor="wpp-a" className="cursor-pointer">{t('ai_marketing.option_whatsapp_short')}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="opcaoB" id="wpp-b" />
                          <Label htmlFor="wpp-b" className="cursor-pointer">{t('ai_marketing.option_whatsapp_friendly')}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="opcaoC" id="wpp-c" />
                          <Label htmlFor="wpp-c" className="cursor-pointer">{t('ai_marketing.option_whatsapp_cta')}</Label>
                        </div>
                      </RadioGroup>

                      {/* Exibir imagem do produto se disponível */}
                      {resultado?.produto?.imagem && (
                        <div className="border rounded-lg p-2 bg-muted/30">
                          <p className="text-xs text-muted-foreground mb-2">{t('ai_marketing.product_image')}</p>
                          <img 
                            src={resultado.produto.imagem} 
                            alt={resultado.produto.titulo}
                            className="w-full h-32 object-cover rounded-md"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            {t('ai_marketing.copy_image_hint')}
                          </p>
                        </div>
                      )}

                      <Textarea
                        value={editableTexts.whatsapp[selectedVariations.whatsapp]}
                        onChange={(e) => updateText('whatsapp', selectedVariations.whatsapp, e.target.value)}
                        className="min-h-[200px] text-sm"
                      />

                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleCopy(editableTexts.whatsapp[selectedVariations.whatsapp], 'WhatsApp')}
                            variant="outline"
                            className="flex-1"
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            {t('publish.copy')}
                          </Button>
                        </div>
                        
                        {/* Botão Envio WhatsApp via Modal */}
                        <Button
                          onClick={() => setShowWhatsAppModal(true)}
                          disabled={!editableTexts.whatsapp[selectedVariations.whatsapp]?.trim()}
                          title={!editableTexts.whatsapp[selectedVariations.whatsapp]?.trim() ? t('ai_marketing.generate_first') : ""}
                          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                        >
                          <MessageCircle className="mr-2 h-4 w-4" />
                          {t('publish.send_whatsapp')}
                        </Button>
                        
                        {/* 🚀 PILAR 2: Botão Criar Campanha de Prospecção */}
                        <Button
                          onClick={handleCreateCampaign}
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          {t('publish.create_prospection')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Botão Principal - Rodapé */}
                <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
                  <Button
                    onClick={handlePublicarTodas}
                    disabled={publicandoTodas}
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-lg px-12 py-6 text-white"
                  >
                    {publicandoTodas ? (
                      <><Loader2 className="mr-2 h-6 w-6 animate-spin" /> {t('publish.publishing')}</>
                    ) : (
                      <>{t('publish.publish_all_networks')}</>
                    )}
                  </Button>
                  <Button
                    onClick={handleScheduleAll}
                    size="lg"
                    className="bg-green-600 hover:bg-green-700 text-lg px-12 py-6"
                  >
                    <CalendarIcon className="mr-2 h-6 w-6" />
                    {t('ai_marketing.schedule')}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="video">
            <div className="max-w-4xl mx-auto space-y-6">
              <Button
                onClick={() => navigate('/dashboard')}
                variant="ghost"
                className="mb-4"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('common.back')}
              </Button>
              
              {/* Slideshow gratuito */}
              <VideoSlideshowGenerator />

              {/* Botão Upload de Reels */}
              <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
                <CardContent className="p-6 text-center">
                  <Video className="h-10 w-10 mx-auto mb-3 text-purple-600" />
                  <h3 className="text-lg font-bold mb-1">{t('publish.publish_reels_phone')}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('publish.publish_reels_desc')}
                  </p>
                  <Button
                    onClick={() => setShowReelsModal(true)}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                    size="lg"
                  >
                    <Upload className="mr-2 h-5 w-5" />
                    {t('publish.upload_video_mp4')}
                  </Button>
                </CardContent>
              </Card>

              {/* Dica informativa */}
              <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">
                    ℹ️ <strong>Reels</strong> = alcance e marca (não tem link clicável no vídeo, mas pode colocar link na legenda)<br />
                    ℹ️ <strong>Feed com imagem</strong> = conversão (link direto no post)<br /><br />
                    💡 <strong>Dica:</strong> Use Reels para atrair novos seguidores e posts de imagem com link para vender.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="carrossel">
            <CarouselGenerator />
          </TabsContent>

          <TabsContent value="historico">
            <div className="max-w-4xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="text-center">{t('ai_marketing.post_history')}</CardTitle>
                </CardHeader>
                <CardContent className="text-center py-20 text-muted-foreground">
                  {t('ai_marketing.coming_soon')}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de Envio WhatsApp */}
      <EnviarWhatsAppModal
        open={showWhatsAppModal}
        onOpenChange={setShowWhatsAppModal}
        mensagem={editableTexts.whatsapp[selectedVariations.whatsapp] || ""}
        imagemUrl={resultado?.generatedImage || resultado?.produto?.imagem}
      />

      {/* Modal de Agendamento */}
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
          userType={userType}
        />
      )}
      <PublicarReelsModal
        open={showReelsModal}
        onOpenChange={setShowReelsModal}
        produto={resultado ? {
          nome: resultado.produto.titulo,
          preco: resultado.produto.preco ? parseFloat(resultado.produto.preco.replace(/[^\d.,]/g, '').replace(',', '.')) : null,
          link: safeProductLink,
          imagem_url: resultado.produto.imagem,
        } : null}
      />
    </div>
  );
};

export default IAMarketing;
