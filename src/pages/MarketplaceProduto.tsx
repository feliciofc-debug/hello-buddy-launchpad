import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Gift, ShoppingBag, MessageCircle, ExternalLink, Star } from "lucide-react";

export default function MarketplaceProduto() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [produto, setProduto] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [imagemSelecionada, setImagemSelecionada] = useState(0);

  useEffect(() => {
    loadProduto();
  }, [slug]);

  const loadProduto = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('produtos_marketplace')
        .select('*')
        .eq('slug', slug)
        .eq('ativo', true)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setProduto(data);
        
        // Incrementar visualizações
        await supabase
          .from('produtos_marketplace')
          .update({ visualizacoes: (data.visualizacoes || 0) + 1 })
          .eq('id', data.id);
      }

    } catch (error: any) {
      toast.error("Produto não encontrado");
      navigate('/marketplace');
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppClick = async () => {
    if (!produto) return;

    try {
      // Incrementar cliques WhatsApp
      await supabase
        .from('produtos_marketplace')
        .update({ cliques_whatsapp: (produto.cliques_whatsapp || 0) + 1 })
        .eq('id', produto.id);

      // Número WhatsApp da AMZ (SUBSTITUA PELO SEU NÚMERO)
      const numeroWhatsApp = "5511999999999"; // ← SEU NÚMERO AQUI
      
      // Mensagem automática
      const mensagem = `Olá! 👋 Vi o produto *${produto.titulo}* no Marketplace AMZ e quero ganhar o *E-book Grátis*! 🎁`;
      
      const linkWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensagem)}`;
      
      // Abrir WhatsApp
      window.open(linkWhatsApp, '_blank');
      
      toast.success("Abrindo WhatsApp...");

    } catch (error) {
      toast.error("Erro ao abrir WhatsApp");
    }
  };

  const handleComprarClick = async () => {
    if (!produto) return;

    try {
      // Incrementar cliques afiliado
      await supabase
        .from('produtos_marketplace')
        .update({ cliques_afiliado: (produto.cliques_afiliado || 0) + 1 })
        .eq('id', produto.id);

      // Abrir link afiliado
      window.open(produto.link_afiliado, '_blank');
      
      toast.success("Redirecionando para loja...");

    } catch (error) {
      toast.error("Erro ao abrir loja");
    }
  };

  const getPlatformInfo = (plataforma: string) => {
    const configs = {
      shopee: { 
        color: 'bg-orange-500', 
        label: 'Shopee',
        icon: '🛍️',
        garantia: 'Compra 100% protegida pela Shopee'
      },
      amazon: { 
        color: 'bg-yellow-600', 
        label: 'Amazon',
        icon: '📦',
        garantia: 'Garantia Amazon'
      },
      mercadolivre: { 
        color: 'bg-yellow-500', 
        label: 'Mercado Livre',
        icon: '🛒',
        garantia: 'Compra Garantida Mercado Livre'
      },
      lomadee: { 
        color: 'bg-blue-500', 
        label: 'Lomadee',
        icon: '🔗',
        garantia: 'Parceiro Oficial'
      },
    };
    return configs[plataforma as keyof typeof configs] || configs.shopee;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!produto) return null;

  const platformInfo = getPlatformInfo(produto.plataforma);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Button variant="ghost" onClick={() => navigate('/marketplace')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Marketplace
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* COLUNA ESQUERDA - Imagens */}
          <div>
            {/* Imagem Principal */}
            <Card className="mb-4 overflow-hidden">
              <CardContent className="p-0">
                <div className="aspect-square bg-muted flex items-center justify-center">
                  {produto.imagens?.[imagemSelecionada] ? (
                    <img 
                      src={produto.imagens[imagemSelecionada]} 
                      alt={produto.titulo}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ShoppingBag className="h-32 w-32 text-muted-foreground" />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Miniaturas */}
            {produto.imagens && produto.imagens.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {produto.imagens.map((img: string, idx: number) => (
                  <div 
                    key={idx}
                    onClick={() => setImagemSelecionada(idx)}
                    className={`aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition ${
                      imagemSelecionada === idx ? 'border-purple-600' : 'border-transparent'
                    }`}
                  >
                    <img src={img} alt={`${produto.titulo} ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* COLUNA DIREITA - Informações */}
          <div>
            {/* Badge Plataforma */}
            <div className="mb-4">
              <Badge className={`${platformInfo.color} text-white text-base px-4 py-1`}>
                {platformInfo.icon} {platformInfo.label}
              </Badge>
            </div>

            {/* Título */}
            <h1 className="text-3xl font-bold mb-4">{produto.titulo}</h1>

            {/* Categoria */}
            {produto.categoria && (
              <p className="text-muted-foreground mb-4">
                📂 {produto.categoria}
              </p>
            )}

            {/* Avaliação Fake (visual) */}
            <div className="flex items-center gap-2 mb-6">
              <div className="flex">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">(1.2k avaliações na {platformInfo.label})</span>
            </div>

            {/* Preço */}
            <Card className="mb-6 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <CardContent className="pt-6">
                {produto.preco_original && produto.preco_original > produto.preco && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-muted-foreground line-through">
                      De: R$ {produto.preco_original.toFixed(2)}
                    </span>
                    <Badge variant="destructive">
                      -{Math.round(((produto.preco_original - produto.preco) / produto.preco_original) * 100)}%
                    </Badge>
                  </div>
                )}
                <div className="text-4xl font-bold text-green-600 mb-2">
                  R$ {produto.preco.toFixed(2)}
                </div>
                <p className="text-sm text-muted-foreground">
                  ✅ {platformInfo.garantia}
                </p>
              </CardContent>
            </Card>

            {/* E-BOOK GRÁTIS - DESTAQUE */}
            <Card className="mb-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Gift className="h-8 w-8 text-purple-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-2">🎁 GANHE E-BOOK GRÁTIS!</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Ao comprar este produto, você ganha um e-book exclusivo via WhatsApp!
                    </p>
                    {produto.ebook_bonus && (
                      <Badge className="bg-purple-600 text-white">
                        📖 {produto.ebook_bonus}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* BOTÕES AÇÃO */}
            <div className="space-y-3 mb-6">
              {/* Botão WhatsApp - PRINCIPAL */}
              <Button 
                onClick={handleWhatsAppClick}
                size="lg"
                className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-6"
              >
                <MessageCircle className="mr-2 h-6 w-6" />
                💬 FALAR NO WHATSAPP E GANHAR E-BOOK
              </Button>

              {/* Botão Comprar - SECUNDÁRIO */}
              <Button 
                onClick={handleComprarClick}
                size="lg"
                variant="outline"
                className="w-full text-lg py-6"
              >
                <ExternalLink className="mr-2 h-5 w-5" />
                🛒 Comprar direto na {platformInfo.label}
              </Button>
            </div>

            {/* Informações Extras */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-3">✅ Benefícios</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    E-book exclusivo grátis via WhatsApp
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    Compra 100% segura na {platformInfo.label}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    Frete grátis (conforme política da loja)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    Garantia oficial do fabricante
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    Atendimento personalizado AMZ
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Descrição */}
            {produto.descricao && (
              <Card className="mt-6">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-3">📝 Descrição</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {produto.descricao}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}