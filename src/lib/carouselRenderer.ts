const CAROUSEL_WIDTH = 1080;
const CAROUSEL_HEIGHT = 1350;

export interface SlideData {
  type: 'cover' | 'content' | 'cta';
  title: string;
  body?: string;
  number?: number;
  totalSlides?: number;
  imageUrl?: string;
  logoUrl?: string;
  profileHandle?: string;
}

export interface CarouselStyle {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  bgColor: string;
  textColor: string;
  accentColor: string;
  fontTitle: string;
  fontBody: string;
  layout: 'modern' | 'minimal' | 'bold' | 'elegant' | 'colorful';
}

export const STYLES: Record<string, CarouselStyle> = {
  modern: {
    name: 'Moderno',
    primaryColor: '#1E293B',
    secondaryColor: '#3B82F6',
    bgColor: '#FFFFFF',
    textColor: '#1E293B',
    accentColor: '#3B82F6',
    fontTitle: 'bold 64px Arial, sans-serif',
    fontBody: '32px Arial, sans-serif',
    layout: 'modern',
  },
  minimal: {
    name: 'Minimalista',
    primaryColor: '#18181B',
    secondaryColor: '#A1A1AA',
    bgColor: '#FAFAFA',
    textColor: '#18181B',
    accentColor: '#18181B',
    fontTitle: 'bold 58px Georgia, serif',
    fontBody: '30px Georgia, serif',
    layout: 'minimal',
  },
  bold: {
    name: 'Ousado',
    primaryColor: '#7C3AED',
    secondaryColor: '#F59E0B',
    bgColor: '#1E1B4B',
    textColor: '#FFFFFF',
    accentColor: '#F59E0B',
    fontTitle: 'bold 68px Arial, sans-serif',
    fontBody: '32px Arial, sans-serif',
    layout: 'bold',
  },
  elegant: {
    name: 'Elegante',
    primaryColor: '#1F2937',
    secondaryColor: '#D4AF37',
    bgColor: '#F9FAFB',
    textColor: '#1F2937',
    accentColor: '#D4AF37',
    fontTitle: 'bold 56px Georgia, serif',
    fontBody: '28px Georgia, serif',
    layout: 'elegant',
  },
  colorful: {
    name: 'Colorido',
    primaryColor: '#EC4899',
    secondaryColor: '#8B5CF6',
    bgColor: '#FDF2F8',
    textColor: '#831843',
    accentColor: '#EC4899',
    fontTitle: 'bold 64px Arial, sans-serif',
    fontBody: '32px Arial, sans-serif',
    layout: 'colorful',
  },
};

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  align: CanvasTextAlign = 'left'
): number {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  const prev = ctx.textAlign;
  ctx.textAlign = align;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    if (ctx.measureText(testLine).width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
  ctx.textAlign = prev;
  return currentY;
}

function getTextHeight(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(' ');
  let line = '';
  let height = lineHeight;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    if (ctx.measureText(testLine).width > maxWidth && n > 0) {
      line = words[n] + ' ';
      height += lineHeight;
    } else {
      line = testLine;
    }
  }
  return height;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

export async function renderSlide(
  canvas: HTMLCanvasElement,
  slide: SlideData,
  style: CarouselStyle,
  userPrimaryColor?: string,
  userSecondaryColor?: string
): Promise<string> {
  const ctx = canvas.getContext('2d')!;
  canvas.width = CAROUSEL_WIDTH;
  canvas.height = CAROUSEL_HEIGHT;

  const secondary = userSecondaryColor || style.secondaryColor;
  const primary = userPrimaryColor || style.primaryColor;
  const bg = style.layout === 'bold' ? (userPrimaryColor ? darkenHex(userPrimaryColor, 0.7) : style.bgColor) : style.bgColor;
  const textColor = style.layout === 'bold' ? '#FFFFFF' : style.textColor;

  // Background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CAROUSEL_WIDTH, CAROUSEL_HEIGHT);

  // Decorative elements
  if (style.layout === 'modern') {
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, CAROUSEL_WIDTH, 8);
    ctx.fillStyle = secondary;
    ctx.fillRect(0, 0, 8, CAROUSEL_HEIGHT);
  } else if (style.layout === 'bold') {
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, CAROUSEL_WIDTH, CAROUSEL_HEIGHT);
    ctx.beginPath();
    ctx.arc(CAROUSEL_WIDTH - 100, 200, 300, 0, Math.PI * 2);
    ctx.fillStyle = secondary + '20';
    ctx.fill();
  } else if (style.layout === 'elegant') {
    ctx.strokeStyle = secondary;
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 40, CAROUSEL_WIDTH - 80, CAROUSEL_HEIGHT - 80);
  } else if (style.layout === 'colorful') {
    const gradient = ctx.createLinearGradient(0, 0, CAROUSEL_WIDTH, CAROUSEL_HEIGHT);
    gradient.addColorStop(0, primary + '15');
    gradient.addColorStop(1, secondary + '15');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CAROUSEL_WIDTH, CAROUSEL_HEIGHT);
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, CAROUSEL_WIDTH, 12);
  }

  // Image
  if (slide.imageUrl && (slide.type === 'cover' || slide.type === 'content')) {
    try {
      const img = await loadImage(slide.imageUrl);
      if (slide.type === 'cover') {
        const imgH = CAROUSEL_HEIGHT * 0.45;
        ctx.drawImage(img, 0, 80, CAROUSEL_WIDTH, imgH);
        const grad = ctx.createLinearGradient(0, imgH - 100, 0, imgH + 80);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, bg);
        ctx.fillStyle = grad;
        ctx.fillRect(0, imgH - 100, CAROUSEL_WIDTH, 180);
      } else {
        const imgSize = 280;
        const imgX = CAROUSEL_WIDTH - imgSize - 80;
        const imgY = 200;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(imgX, imgY, imgSize, imgSize, 20);
        ctx.clip();
        ctx.drawImage(img, imgX, imgY, imgSize, imgSize);
        ctx.restore();
        ctx.strokeStyle = secondary;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(imgX, imgY, imgSize, imgSize, 20);
        ctx.stroke();
      }
    } catch {
      // skip image
    }
  }

  // Logo
  if (slide.logoUrl) {
    try {
      const logo = await loadImage(slide.logoUrl);
      const logoSize = 80;
      ctx.drawImage(logo, CAROUSEL_WIDTH - logoSize - 60, CAROUSEL_HEIGHT - logoSize - 60, logoSize, logoSize);
    } catch {
      // skip logo
    }
  }

  const margin = 80;
  const maxTextWidth = slide.imageUrl && slide.type === 'content' ? CAROUSEL_WIDTH - 440 : CAROUSEL_WIDTH - margin * 2;

  if (slide.type === 'cover') {
    const titleY = slide.imageUrl ? CAROUSEL_HEIGHT * 0.55 : CAROUSEL_HEIGHT * 0.35;
    ctx.fillStyle = textColor;
    ctx.font = style.fontTitle;
    wrapText(ctx, slide.title, margin, titleY, CAROUSEL_WIDTH - margin * 2, 76);
    ctx.fillStyle = secondary;
    ctx.fillRect(margin, titleY + 20, 120, 6);
    ctx.fillStyle = textColor + '80';
    ctx.font = '28px Arial, sans-serif';
    ctx.fillText('Deslize para ver →', margin, CAROUSEL_HEIGHT - 120);
  } else if (slide.type === 'content') {
    if (slide.number) {
      ctx.fillStyle = secondary;
      ctx.beginPath();
      ctx.roundRect(margin, 100, 80, 80, 16);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 44px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(slide.number), margin + 40, 152);
      ctx.textAlign = 'left';
    }

    ctx.fillStyle = textColor;
    ctx.font = 'bold 48px Arial, sans-serif';
    const titleStartY = slide.number ? 250 : 150;
    wrapText(ctx, slide.title, margin, titleStartY, maxTextWidth, 58);

    if (slide.body) {
      ctx.fillStyle = textColor + 'CC';
      ctx.font = style.fontBody;
      const bodyStartY = titleStartY + getTextHeight(ctx, slide.title, maxTextWidth, 58) + 40;
      wrapText(ctx, slide.body, margin, bodyStartY, maxTextWidth, 44);
    }

    if (slide.number && slide.totalSlides) {
      const progY = CAROUSEL_HEIGHT - 80;
      const dotGap = 24;
      const totalWidth = slide.totalSlides * dotGap;
      const startX = (CAROUSEL_WIDTH - totalWidth) / 2;
      for (let i = 1; i <= slide.totalSlides; i++) {
        ctx.beginPath();
        ctx.arc(startX + i * dotGap, progY, 6, 0, Math.PI * 2);
        ctx.fillStyle = i === slide.number ? secondary : textColor + '30';
        ctx.fill();
      }
    }
  } else if (slide.type === 'cta') {
    const centerY = CAROUSEL_HEIGHT * 0.35;
    ctx.fillStyle = textColor;
    ctx.font = 'bold 52px Arial, sans-serif';
    wrapText(ctx, slide.title, CAROUSEL_WIDTH / 2, centerY, CAROUSEL_WIDTH - margin * 2, 64, 'center');

    const btnY = centerY + 150;
    const btnW = 500;
    const btnH = 80;
    const btnX = (CAROUSEL_WIDTH - btnW) / 2;
    ctx.fillStyle = secondary;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 40);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Saiba Mais', CAROUSEL_WIDTH / 2, btnY + 52);

    if (slide.profileHandle) {
      ctx.fillStyle = textColor + '80';
      ctx.font = '30px Arial, sans-serif';
      ctx.fillText(slide.profileHandle, CAROUSEL_WIDTH / 2, CAROUSEL_HEIGHT - 150);
    }
    ctx.textAlign = 'left';
  }

  return canvas.toDataURL('image/png');
}

function darkenHex(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
}

export { CAROUSEL_WIDTH, CAROUSEL_HEIGHT };
