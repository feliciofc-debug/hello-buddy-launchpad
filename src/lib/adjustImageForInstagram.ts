/**
 * Pré-processamento de imagem para Instagram.
 * Ajusta proporção usando Canvas API para evitar cortes.
 */

export type InstagramFormat = 'landscape' | 'square' | 'portrait';

export interface AdjustedImage {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  format: InstagramFormat;
  original: { width: number; height: number };
}

function detectFormat(w: number, h: number): InstagramFormat {
  const ratio = w / h;
  if (ratio > 1.2) return 'landscape';   // wider than tall
  if (ratio < 0.75) return 'portrait';    // taller than wide
  return 'square';
}

const FORMAT_DIMS: Record<InstagramFormat, [number, number]> = {
  landscape: [1080, 566],
  square: [1080, 1080],
  portrait: [1080, 1350],
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = url;
  });
}

/**
 * Ajusta uma imagem para o formato ideal do Instagram.
 * Usa "contain" — a imagem fica inteira, com barras pretas se necessário.
 */
export async function adjustImageForInstagram(
  imageUrl: string,
  bgColor = '#000000',
): Promise<AdjustedImage> {
  const img = await loadImage(imageUrl);
  const origW = img.naturalWidth;
  const origH = img.naturalHeight;

  const format = detectFormat(origW, origH);
  const [canvasW, canvasH] = FORMAT_DIMS[format];

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;

  // Fundo
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Contain: escalar para caber inteiramente
  const scale = Math.min(canvasW / origW, canvasH / origH);
  const drawW = origW * scale;
  const drawH = origH * scale;
  const x = (canvasW - drawW) / 2;
  const y = (canvasH - drawH) / 2;
  ctx.drawImage(img, x, y, drawW, drawH);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Erro ao gerar blob'))),
      'image/jpeg',
      0.95,
    );
  });

  return {
    blob,
    dataUrl,
    width: canvasW,
    height: canvasH,
    format,
    original: { width: origW, height: origH },
  };
}

/**
 * Ajusta múltiplas imagens (para carrossel).
 * Todas ficam no mesmo formato (baseado na primeira imagem).
 */
export async function adjustImagesForInstagram(
  imageUrls: string[],
  bgColor = '#000000',
): Promise<AdjustedImage[]> {
  if (imageUrls.length === 0) return [];

  // Detectar formato baseado na primeira imagem
  const firstImg = await loadImage(imageUrls[0]);
  const format = detectFormat(firstImg.naturalWidth, firstImg.naturalHeight);
  const [canvasW, canvasH] = FORMAT_DIMS[format];

  const results: AdjustedImage[] = [];

  for (const url of imageUrls) {
    const img = await loadImage(url);
    const origW = img.naturalWidth;
    const origH = img.naturalHeight;

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvasW, canvasH);

    const scale = Math.min(canvasW / origW, canvasH / origH);
    const drawW = origW * scale;
    const drawH = origH * scale;
    const x = (canvasW - drawW) / 2;
    const y = (canvasH - drawH) / 2;
    ctx.drawImage(img, x, y, drawW, drawH);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Erro ao gerar blob'))),
        'image/jpeg',
        0.95,
      );
    });

    results.push({
      blob,
      dataUrl,
      width: canvasW,
      height: canvasH,
      format,
      original: { width: origW, height: origH },
    });
  }

  return results;
}

export const FORMAT_LABELS: Record<InstagramFormat, string> = {
  landscape: 'Paisagem (1080×566)',
  square: 'Quadrado (1080×1080)',
  portrait: 'Retrato (1080×1350)',
};
