// src/components/ProductCard.tsx
// INSTRUÇÕES LOVABLE: Criar arquivo em src/components/ProductCard.tsx

"use client";

import { Star, TrendingUp, ExternalLink, Copy, Sparkles, MessageCircle, Calculator, Activity } from 'lucide-react';
import type { Product } from '@/data/mockData';
import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ProductCardProps {
  product: Product;
  onGenerateContent?: (product: Product) => void;
}

const ProductCard = ({ product, onGenerateContent }: ProductCardProps) => {
  const [copied, setCopied] = useState(false);
  const [calculatingROI, setCalculatingROI] = useState(false);

  const copyAffiliateLink = () => {
    navigator.clipboard.writeText(product.affiliateLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCalculateROI = async () => {
    setCalculatingROI(true);
    try {
      const { data, error } = await supabase.functions.invoke('calcular-roi-avancado', {
        body: {
          productId: product.id,
          productPrice: product.price,
          commission: product.commission,
          adSpend: 50 // Valor padrão de investimento em anúncios
        }
      });

      if (error) throw error;

      toast.success('ROI Calculado!', {
        description: `Lucro: R$ ${data.lucro.toFixed(2)} | ROI: ${data.roi}% | Margem: ${data.margem}%`
      });
    } catch (error) {
      console.error('Erro ao calcular ROI:', error);
      toast.error('Erro ao calcular ROI');
    } finally {
      setCalculatingROI(false);
    }
  };

  const handleTrackPixel = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('rastrear-pixel', {
        body: {
          productId: product.id,
          eventType: 'view',
          pixelId: product.pixelId || `pixel_${product.id}`
        }
      });

      if (error) throw error;

      toast.success('Visualização rastreada!', {
        description: 'Pixel de rastreamento ativado com sucesso'
      });
    } catch (error) {
      console.error('Erro ao rastrear pixel:', error);
      toast.error('Erro ao rastrear visualização');
    }
  };

  const getMarketplaceBadgeColor = (marketplace: string) => {
    const colors: Record<string, string> = {
      amazon: 'bg-orange-500',
      shopee: 'bg-orange-600',
      aliexpress: 'bg-red-500',
      lomadee: 'bg-blue-500',
      hotmart: 'bg-green-500',
      eduzz: 'bg-purple-500',
      monetizze: 'bg-pink-500'
    };
    return colors[marketplace] || 'bg-gray-500';
  };

  const discount = product.originalPrice 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group">
      {/* Image Container */}
      <div className="relative h-48 overflow-hidden bg-gray-100 dark:bg-gray-700">
        <img
          src={product.imageUrl}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
        />
        
        {/* Badges Container */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {/* Marketplace Badge */}
          <span className={`${getMarketplaceBadgeColor(product.marketplace)} text-white text-xs font-bold px-2 py-1 rounded uppercase`}>
            {product.marketplace}
          </span>
          
          {/* Status Badge */}
          {product.badge && (
            <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded shadow-lg animate-pulse">
              {product.badge}
            </span>
          )}
        </div>

        {/* Discount Badge */}
        {discount > 0 && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            -{discount}%
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Category */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">{product.category}</span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 h-10">
          {product.title}
        </h3>

        {/* Rating & Sales */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {product.rating}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({product.reviews.toLocaleString()})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {product.sales.toLocaleString()} vendas
            </span>
          </div>
        </div>

        {/* Price Section */}
        <div className="mb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              R$ {product.price.toFixed(2)}
            </span>
            {product.originalPrice && (
              <span className="text-sm text-gray-500 dark:text-gray-400 line-through">
                R$ {product.originalPrice.toFixed(2)}
              </span>
            )}
          </div>
          
          {/* Commission */}
          <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600 dark:text-gray-400">Sua comissão:</span>
              <span className="text-sm font-bold text-green-600 dark:text-green-400">
                R$ {product.commission.toFixed(2)}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {product.commissionPercent}% por venda
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {/* ROI and Pixel Buttons Row */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCalculateROI}
              disabled={calculatingROI}
              className="flex items-center justify-center gap-1 py-2 px-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
            >
              <Calculator className="w-4 h-4" />
              <span className="text-xs">ROI</span>
            </button>
            <button
              onClick={handleTrackPixel}
              className="flex items-center justify-center gap-1 py-2 px-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors font-medium"
            >
              <Activity className="w-4 h-4" />
              <span className="text-xs">Pixel</span>
            </button>
          </div>

          {/* Copy Link Button */}
          <button
            onClick={copyAffiliateLink}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
          >
            {copied ? (
              <>
                <span className="text-sm">✓ Link Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span className="text-sm">Copiar Link</span>
              </>
            )}
          </button>

          {/* WhatsApp Button */}
          <button
            onClick={() => {
              const message = `🔥 *${product.title}*%0A%0A💰 R$ ${product.price.toFixed(2)}%0A⭐ ${product.rating}/5 estrelas%0A%0A🔗 ${product.affiliateLink}`;
              window.open(`https://wa.me/?text=${message}`, '_blank');
            }}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-medium"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="text-sm">Enviar WhatsApp</span>
          </button>

          {/* Generate Content Button */}
          {onGenerateContent && (
            <button
              onClick={() => onGenerateContent(product)}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-colors font-medium"
            >
              <Sparkles className="w-4 h-4" />
              <span className="text-sm">Gerar Conteúdo IA</span>
            </button>
          )}

          {/* View Product Button */}
          <a
            href={product.affiliateLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="text-sm">Ver Produto</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;