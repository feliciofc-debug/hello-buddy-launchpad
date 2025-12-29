import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Sparkles, Copy, Send, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Produto {
  id: string;
  titulo: string;
  descricao: string | null;
  preco: number | null;
  link_afiliado: string;
  marketplace: string;
}

export default function AfiliadoIAMarketing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [selectedProduto, setSelectedProduto] = useState<string>('');
  const [tipoPost, setTipoPost] = useState('whatsapp');
  const [generatedContent, setGeneratedContent] = useState('');

  useEffect(() => {
    loadProdutos();
  }, []);

  const loadProdutos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data, error } = await supabase
        .from('afiliado_produtos')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'ativo');

      if (error) throw error;
      setProdutos(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedProduto) {
      toast.error('Selecione um produto');
      return;
    }

    const produto = produtos.find(p => p.id === selectedProduto);
    if (!produto) return;

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('gerar-conteudo-ia', {
        body: {
          tipo: tipoPost,
          produto: {
            titulo: produto.titulo,
            descricao: produto.descricao,
            preco: produto.preco,
            link: produto.link_afiliado,
            marketplace: produto.marketplace
          }
        }
      });

      if (error) throw error;

      if (data?.content) {
        setGeneratedContent(data.content);
        toast.success('Conteúdo gerado com sucesso!');
      } else {
        // Fallback se a edge function não existir
        const content = generateFallbackContent(produto, tipoPost);
        setGeneratedContent(content);
        toast.success('Conteúdo gerado!');
      }
    } catch (error: any) {
      console.error('Erro ao gerar:', error);
      // Fallback
      const produto = produtos.find(p => p.id === selectedProduto);
      if (produto) {
        const content = generateFallbackContent(produto, tipoPost);
        setGeneratedContent(content);
        toast.success('Conteúdo gerado!');
      }
    } finally {
      setGenerating(false);
    }
  };

  const generateFallbackContent = (produto: Produto, tipo: string) => {
    const emojis = ['🔥', '⭐', '✨', '🎯', '💰', '🛒'];
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    
    if (tipo === 'whatsapp') {
      return `${emoji} *${produto.titulo}*

${produto.descricao || 'Produto incrível com ótima qualidade!'}

${produto.preco ? `💰 Por apenas *R$ ${produto.preco.toFixed(2)}*` : ''}

🛒 Compre agora: ${produto.link_afiliado}

✅ Aproveite antes que acabe!`;
    } else if (tipo === 'instagram') {
      return `${emoji} ${produto.titulo}

${produto.descricao || 'Um produto que você precisa conhecer!'}

${produto.preco ? `💰 Apenas R$ ${produto.preco.toFixed(2)}` : ''}

👆 Link na bio!

#ofertas #promocao #${produto.marketplace} #compras #desconto`;
    } else {
      return `🔥 OFERTA IMPERDÍVEL!

${produto.titulo}

${produto.descricao || ''}

${produto.preco ? `💰 R$ ${produto.preco.toFixed(2)}` : ''}

Compre agora: ${produto.link_afiliado}`;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    toast.success('Copiado para a área de transferência!');
  };

  const tiposPost = [
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'generico', label: 'Genérico' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/afiliado/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">IA Marketing</h1>
            <p className="text-muted-foreground">Gere posts com inteligência artificial</p>
          </div>
        </div>

        {/* Formulário */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Gerar Conteúdo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Selecione o Produto</Label>
              <Select value={selectedProduto} onValueChange={setSelectedProduto}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um produto" />
                </SelectTrigger>
                <SelectContent>
                  {produtos.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {produtos.length === 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Nenhum produto cadastrado. <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/afiliado/produtos')}>Cadastre um produto</Button>
                </p>
              )}
            </div>

            <div>
              <Label>Tipo de Post</Label>
              <Select value={tipoPost} onValueChange={setTipoPost}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiposPost.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleGenerate} 
              disabled={generating || !selectedProduto}
              className="w-full"
            >
              {generating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar Conteúdo
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Resultado */}
        {generatedContent && (
          <Card>
            <CardHeader>
              <CardTitle>Conteúdo Gerado</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea 
                value={generatedContent}
                onChange={(e) => setGeneratedContent(e.target.value)}
                rows={10}
                className="mb-4"
              />
              <div className="flex gap-2">
                <Button onClick={handleCopy} variant="outline" className="flex-1">
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar
                </Button>
                <Button onClick={handleGenerate} variant="outline">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
