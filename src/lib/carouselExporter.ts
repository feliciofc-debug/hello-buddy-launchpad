import { toPng } from 'html-to-image';

export async function exportSlideAsPng(element: HTMLElement): Promise<string> {
  return await toPng(element, {
    width: 1080,
    height: 1350,
    quality: 1.0,
    pixelRatio: 1,
    cacheBust: true,
    skipAutoScale: true,
    style: {
      transform: 'scale(1)',
      transformOrigin: 'top left',
    },
  });
}

export async function exportAllSlides(container: HTMLElement): Promise<string[]> {
  const images: string[] = [];
  const children = container.children;
  
  for (let i = 0; i < children.length; i++) {
    const el = children[i] as HTMLElement;
    try {
      const png = await exportSlideAsPng(el);
      images.push(png);
    } catch (err) {
      console.error(`Error rendering slide ${i + 1}:`, err);
      // Fallback
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1350;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(0, 0, 1080, 1350);
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 40px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Slide ${i + 1}`, 540, 675);
      }
      images.push(canvas.toDataURL('image/png'));
    }
  }
  
  return images;
}
