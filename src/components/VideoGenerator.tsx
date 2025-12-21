import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Wand2, Download, RefreshCw, Copy, Check, Image } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const VideoGenerator = () => {
  const [productName, setProductName] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedPosts, setGeneratedPosts] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
        setGeneratedImage(null);
        setGeneratedPosts(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!uploadedImage) {
      toast.error("Por favor, faça upload de uma imagem primeiro");
      return;
    }

    if (!prompt.trim()) {
      toast.error("Descreva como quer a imagem");
      return;
    }

    setIsGenerating(true);
    toast.info("Gerando imagem...");

    try {
      const { data, error } = await supabase.functions.invoke('generate-product-video', {
        body: {
          productName: productName || "Produto",
          productImage: uploadedImage,
          editPrompt: prompt,
          mode: "edit"
        }
      });

      if (error) throw error;

      if (data?.editedImage) {
        setGeneratedImage(data.editedImage);
        toast.success("Imagem gerada com sucesso!");
        
        // Gerar posts automaticamente
        generatePosts();
      } else {
        throw new Error(data?.error || "Nenhuma imagem foi gerada");
      }
    } catch (error: any) {
      console.error("Erro ao gerar:", error);
      toast.error(error.message || "Erro ao gerar imagem");
    } finally {
      setIsGenerating(false);
    }
  };

  const generatePosts = () => {
    const name = productName || "Produto";
    setGeneratedPosts({
      instagram: `🔥 ${name.toUpperCase()} 🔥\n\n✨ O produto que você estava esperando!\n\n💰 PREÇO ESPECIAL\n\n👆 Link na bio!\n\n#oferta #promocao #compras #desconto`,
      facebook: `🎉 OFERTA IMPERDÍVEL!\n\n${name}\n\n🛒 Aproveite antes que acabe!\n\nComente "EU QUERO" para receber o link!`,
      whatsapp: `Olá! 👋\n\nVocê viu o *${name}*?\n\n🔥 Oferta por tempo limitado!\n\nQuer saber mais? Me responda aqui!`
    });
  };

  const handleDownloadImage = () => {
    if (!generatedImage) return;
    
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `${productName || 'produto'}-editado.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Imagem baixada!");
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copiado!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Gerador de Imagem para Produto
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Faça upload da foto, descreva como quer que fique e a IA irá editar/melhorar a imagem.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload de imagem */}
          <div className="space-y-2">
            <Label>📸 Foto do Produto</Label>
            <div 
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadedImage ? (
                <div className="space-y-2">
                  <img 
                    src={uploadedImage} 
                    alt="Produto" 
                    className="max-h-48 mx-auto rounded-lg"
                  />
                  <p className="text-sm text-muted-foreground">Clique para trocar a imagem</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="h-8 w-8" />
                  <span>Clique para fazer upload da foto</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Nome do produto */}
          <div className="space-y-2">
            <Label>Nome do Produto (opcional)</Label>
            <Input
              placeholder="Ex: Arroz Integral Premium"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />
          </div>

          {/* Prompt de edição */}
          <div className="space-y-2">
            <Label>✏️ Como quer a imagem?</Label>
            <Textarea
              placeholder="Descreva como quer que a imagem fique. Ex: 'Coloque um fundo de cozinha gourmet, com iluminação profissional e adicione elementos que remetam a saúde e bem-estar'"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              💡 Dica: Seja específico! Descreva o fundo, iluminação, elementos decorativos, etc.
            </p>
          </div>

          {/* Botão gerar */}
          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || !uploadedImage}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Gerar Imagem
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Resultado */}
      {generatedImage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>✅ Imagem Gerada</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isGenerating}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
                  Refazer
                </Button>
                <Button variant="default" size="sm" onClick={handleDownloadImage}>
                  <Download className="h-4 w-4 mr-1" />
                  Baixar
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <img 
              src={generatedImage} 
              alt="Imagem gerada" 
              className="w-full max-w-lg mx-auto rounded-lg shadow-lg"
            />
          </CardContent>
        </Card>
      )}

      {/* Posts gerados */}
      {generatedPosts && (
        <Card>
          <CardHeader>
            <CardTitle>📱 Posts para Redes Sociais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {generatedPosts.instagram && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-pink-500 font-medium">📸 Instagram</Label>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleCopy(generatedPosts.instagram, 'instagram')}
                  >
                    {copiedField === 'instagram' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">
                  {generatedPosts.instagram}
                </p>
              </div>
            )}

            {generatedPosts.facebook && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-blue-500 font-medium">📘 Facebook</Label>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleCopy(generatedPosts.facebook, 'facebook')}
                  >
                    {copiedField === 'facebook' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">
                  {generatedPosts.facebook}
                </p>
              </div>
            )}

            {generatedPosts.whatsapp && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-green-500 font-medium">💬 WhatsApp</Label>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleCopy(generatedPosts.whatsapp, 'whatsapp')}
                  >
                    {copiedField === 'whatsapp' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">
                  {generatedPosts.whatsapp}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
