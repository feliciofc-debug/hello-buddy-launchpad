export interface SlideTemplateProps {
  type: 'cover' | 'content' | 'cta';
  title: string;
  body?: string;
  number?: number;
  totalSlides: number;
  contentTotal?: number;
  imageUrl?: string;
  logoUrl?: string;
  profileHandle?: string;
  primaryColor: string;
  secondaryColor: string;
  highlight?: string;
  ctaLabel?: string;
}

export type TemplateKey = 'dark-premium' | 'clean-bright' | 'gradient-vibrant' | 'elegant-serif' | 'neon-tech';

export const TEMPLATE_OPTIONS: Record<TemplateKey, { name: string; emoji: string; primaryColor: string; secondaryColor: string }> = {
  'dark-premium': { name: 'Dark Premium', emoji: '🌙', primaryColor: '#6366F1', secondaryColor: '#8B5CF6' },
  'clean-bright': { name: 'Clean Bright', emoji: '⬜', primaryColor: '#2563EB', secondaryColor: '#3B82F6' },
  'gradient-vibrant': { name: 'Gradient Vibrant', emoji: '🌈', primaryColor: '#EC4899', secondaryColor: '#8B5CF6' },
  'elegant-serif': { name: 'Elegant Serif', emoji: '✨', primaryColor: '#D4AF37', secondaryColor: '#B8860B' },
  'neon-tech': { name: 'Neon Tech', emoji: '💜', primaryColor: '#A855F7', secondaryColor: '#06B6D4' },
};
