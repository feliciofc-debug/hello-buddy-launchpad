import { useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';

function normalizeImages(imagem_url: string | null, imagens: any): string[] {
  const urls = new Set<string>();

  if (imagem_url && typeof imagem_url === 'string' && imagem_url.trim()) {
    urls.add(imagem_url.trim());
  }

  const flatten = (val: unknown): void => {
    if (!val) return;
    if (Array.isArray(val)) {
      val.forEach(flatten);
      return;
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return;
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try { flatten(JSON.parse(trimmed)); return; } catch { /* noop */ }
      }
      urls.add(trimmed);
    }
  };

  flatten(imagens);
  return Array.from(urls);
}

interface Props {
  imagem_url: string | null;
  imagens: any;
  alt: string;
  size?: 'sm' | 'md';
}

export function getAllProductImages(imagem_url: string | null, imagens: any): string[] {
  return normalizeImages(imagem_url, imagens);
}

export function ProductImageCarousel({ imagem_url, imagens, alt, size = 'sm' }: Props) {
  const allImages = normalizeImages(imagem_url, imagens);
  const [current, setCurrent] = useState(0);

  const sizeClass = size === 'md' ? 'w-24 h-24' : 'w-16 h-16';

  if (allImages.length === 0) {
    return <ImageIcon className={`${sizeClass} text-muted-foreground`} />;
  }

  return (
    <div className={`relative ${sizeClass} group`}>
      <img
        src={allImages[current]}
        alt={`${alt} ${current + 1}`}
        className="w-full h-full object-cover rounded"
      />

      {allImages.length > 1 && (
        <>
          {/* Counter */}
          <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white px-1 py-0.5 rounded text-[9px] font-bold leading-none">
            {current + 1}/{allImages.length}
          </span>

          {/* Arrows (visible on hover) */}
          {current > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setCurrent(c => c - 1); }}
              className="absolute left-0 top-1/2 -translate-y-1/2 bg-black/60 text-white rounded-r p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
          )}
          {current < allImages.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setCurrent(c => c + 1); }}
              className="absolute right-0 top-1/2 -translate-y-1/2 bg-black/60 text-white rounded-l p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
