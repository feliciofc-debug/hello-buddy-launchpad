import { useMemo } from 'react';
import { PublicarTodasRedesModal } from '@/components/PublicarTodasRedesModal';

interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number | null;
  imagem_url: string | null;
  link?: string | null;
  link_marketplace?: string | null;
  imagens?: any; // string[] from DB
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto: Produto;
}

type ProdutoImageFields = Pick<Produto, 'imagem_url' | 'imagens'>;

function isValidImageUrl(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeStoredImages(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeStoredImages(item));
  }

  if (isValidImageUrl(value)) {
    const trimmed = value.trim();

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return normalizeStoredImages(JSON.parse(trimmed));
      } catch {
        return [trimmed];
      }
    }

    return [trimmed];
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    for (const key of ['imagens', 'image_urls', 'photos', 'urls']) {
      if (key in record) {
        return normalizeStoredImages(record[key]);
      }
    }

    const values = Object.values(record);
    if (values.every((item) => typeof item === 'string')) {
      return values.filter(isValidImageUrl).map((item) => item.trim());
    }
  }

  return [];
}

function getAllImageUrls(produto: ProdutoImageFields): string[] {
  const urls = new Set<string>();

  if (isValidImageUrl(produto.imagem_url)) {
    urls.add(produto.imagem_url.trim());
  }

  normalizeStoredImages(produto.imagens).forEach((url) => {
    if (isValidImageUrl(url)) {
      urls.add(url.trim());
    }
  });

  return Array.from(urls).slice(0, 5);
}

export function PublicarSimultaneoModal({ open, onOpenChange, produto }: Props) {
  const link = produto.link || produto.link_marketplace || '';
  const precoFormatado = produto.preco ? `R$ ${produto.preco.toFixed(2).replace('.', ',')}` : '';
  const textoInicial = [
    `🔥 ${produto.nome}`,
    produto.descricao ? `\n${produto.descricao}` : '',
    precoFormatado ? `\n💰 ${precoFormatado}` : '',
    link ? `\n\n🔗 Compre aqui: ${link}` : '',
  ].filter(Boolean).join('');

  const images = useMemo(
    () => getAllImageUrls(produto),
    [produto.id, produto.imagem_url, produto.imagens]
  );
  if (images.length === 0) return null;

  return <PublicarTodasRedesModal
    open={open}
    onOpenChange={onOpenChange}
    mediaType="image"
    mediaUrl={images[0]}
    imageUrls={images}
    title={produto.nome}
    initialCaption={textoInicial}
    linkUrl={link || null}
  />;
}
