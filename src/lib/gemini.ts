// TODO: Integrar com Gemini API
// Este arquivo será usado para gerar conteúdo automaticamente usando IA

import type { Product } from '@/types/product';

interface GeneratedContent {
  instagram: string;
  facebook: string;
  tiktok: string;
  whatsapp: string;
  email: string;
}

/**
 * Gera conteúdo otimizado para diferentes plataformas usando Gemini AI
 * @param product - Produto para o qual gerar o conteúdo
 * @param platform - Plataforma específica ou 'all' para todas
 * @returns Conteúdo gerado para cada plataforma
 * 
 * TODO: Implementar integração com Gemini API
 * - Configurar chave de API
 * - Criar prompts específicos para cada plataforma
 * - Incluir informações do produto no prompt
 * - Otimizar para cada rede social (limite de caracteres, hashtags, etc.)
 */
export async function generateContent(
  product: Product, 
  platform: 'all' | 'instagram' | 'facebook' | 'tiktok' | 'whatsapp' | 'email' = 'all'
): Promise<GeneratedContent | string> {
  // Mock response - substituir por chamada real à API
  const mockContent: GeneratedContent = {
    instagram: `🔥 ${product.title}\n\n💰 De ${product.originalPrice ? `R$ ${product.originalPrice.toFixed(2)}` : ''} por apenas R$ ${product.price.toFixed(2)}!\n\n⭐ ${product.rating}/5 estrelas\n📦 ${product.sales.toLocaleString()} vendas\n\n🔗 Link na bio!\n\n#afiliados #ofertas #${product.category.split(' ')[1].toLowerCase()}`,
    
    facebook: `${product.title}\n\nPreço especial: R$ ${product.price.toFixed(2)}\nAvaliação: ${product.rating}/5 (${product.reviews} reviews)\n\nGaranta já o seu: ${product.affiliateLink}`,
    
    tiktok: `Olha essa oferta imperdível! 🔥\n${product.title}\nR$ ${product.price.toFixed(2)}\nLink nos comentários! 👇`,
    
    whatsapp: `Olá! 👋\n\nVi que você se interessa por ${product.category}.\n\nTenho uma oferta especial para você:\n\n🔥 ${product.title}\n💰 R$ ${product.price.toFixed(2)}\n⭐ ${product.rating}/5 estrelas\n\nConfira: ${product.affiliateLink}`,
    
    email: `Assunto: Oferta Especial: ${product.title}\n\nOlá!\n\nDescubra ${product.title} com ${product.commissionPercent}% de desconto!\n\nPor apenas R$ ${product.price.toFixed(2)}, você garante um produto avaliado em ${product.rating}/5 estrelas por ${product.reviews} clientes.\n\nClique aqui para aproveitar: ${product.affiliateLink}\n\nNão perca essa oportunidade!`
  };

  if (platform === 'all') {
    return mockContent;
  }

  return mockContent[platform];
}

/**
 * Gera copy para anúncios pagos (Google Ads, Facebook Ads, etc.)
 * TODO: Implementar com Gemini API
 */
export async function generateAdCopy(product: Product, adType: 'google' | 'facebook' | 'tiktok'): Promise<string> {
  // Mock - substituir por implementação real
  return `${product.title} - R$ ${product.price.toFixed(2)} - Compre agora!`;
}
