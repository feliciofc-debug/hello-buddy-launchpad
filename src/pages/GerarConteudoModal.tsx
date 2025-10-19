import { useState } from 'react';
import { X, Copy, Loader2, Instagram, MessageCircle, Facebook, Send, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Product } from '@/types/product';

interface Props {
  product: Product;
  onClose: () => void;
}

const GerarConteudoModal = ({ product, onClose }: Props) => {
  const [selectedPlatform, setSelectedPlatform] = useState<'instagram' | 'whatsapp' | 'facebook' | 'tiktok' | 'email'>('whatsapp');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const platforms = [
    { id: 'whatsapp', name: 'WhatsApp', icon: MessageCircle, color: 'bg-green-500' },
    { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'bg-pink-500' },
    { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'bg-blue-600' },
    { id: 'tiktok', name: 'TikTok', icon: Send, color: 'bg-black' },
    { id: 'email', name: 'Email', icon: Mail, color: 'bg-purple-500' },
  ];

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedContent('');

    try {
      const { data, error } = await supabase.functions.invoke('gerar-conteudo-ia', {
        body: {
          productTitle: product.title,
          productPrice: product.price,
          productRating: product.rating,
          productLink: product.affiliateLink,
          platform: selectedPlatform
        }
      });

      if (error) throw error;

      setGeneratedContent(data.content);
      toast.success('Conteúdo gerado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao gerar conteúdo:', error);
      toast.error('Erro ao gerar conteúdo. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    toast.success('Conteúdo copiado!');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Gerar Conteúdo com IA
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {product.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Platform Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Escolha a plataforma:
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {platforms.map((platform) => {
                const Icon = platform.icon;
                const isSelected = selectedPlatform === platform.id;
                return (
                  <button
                    key={platform.id}
                    onClick={() => setSelectedPlatform(platform.id as any)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? `${platform.color} border-transparent text-white`
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="text-xs font-medium">{platform.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-3 px-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Gerando conteúdo...
              </>
            ) : (
              <>
                ✨ Gerar Conteúdo
              </>
            )}
          </button>

          {/* Generated Content */}
          {generatedContent && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Conteúdo Gerado:
                </label>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Copiar
                </button>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <pre className="whitespace-pre-wrap text-sm text-gray-900 dark:text-white font-sans">
                  {generatedContent}
                </pre>
              </div>

              {/* Quick Actions */}
              <div className="mt-4 flex gap-3">
                {selectedPlatform === 'whatsapp' && (
                  <button
                    onClick={() => {
                      const encodedMessage = encodeURIComponent(generatedContent);
                      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
                    }}
                    className="flex-1 py-2 px-4 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Enviar via WhatsApp
                  </button>
                )}
                <button
                  onClick={handleCopy}
                  className="flex-1 py-2 px-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copiar Texto
                </button>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              💡 <strong>Dica:</strong> O conteúdo é gerado usando Lovable AI (Gemini 2.5 Flash). 
              Você pode editá-lo antes de usar!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GerarConteudoModal;
