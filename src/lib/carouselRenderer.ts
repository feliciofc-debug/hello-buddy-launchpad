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
    bgColor: '#F0F4FF',
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

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
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

  const primary = userPrimaryColor || style.primaryColor;
  const secondary = userSecondaryColor || style.secondaryColor;
  const pRgb = hexToRgb(primary);
  const sRgb = hexToRgb(secondary);

  // ============ BACKGROUND ============
  if (style.layout === 'bold') {
    // Dark gradient bg
    const grad = ctx.createLinearGradient(0, 0, CAROUSEL_WIDTH, CAROUSEL_HEIGHT);
    grad.addColorStop(0, primary);
    grad.addColorStop(1, `rgb(${Math.max(0, pRgb.r - 40)}, ${Math.max(0, pRgb.g - 40)}, ${Math.max(0, pRgb.b - 40)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CAROUSEL_WIDTH, CAROUSEL_HEIGHT);
  } else if (style.layout === 'colorful') {
    // Vibrant gradient bg
    const grad = ctx.createLinearGradient(0, 0, CAROUSEL_WIDTH, CAROUSEL_HEIGHT);
    grad.addColorStop(0, `rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.12)`);
    grad.addColorStop(0.5, '#FFFFFF');
    grad.addColorStop(1, `rgba(${sRgb.r}, ${sRgb.g}, ${sRgb.b}, 0.12)`);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, CAROUSEL_WIDTH, CAROUSEL_HEIGHT);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CAROUSEL_WIDTH, CAROUSEL_HEIGHT);
  } else if (style.layout === 'modern') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, CAROUSEL_WIDTH, CAROUSEL_HEIGHT);
    // Subtle gradient overlay
    const grad = ctx.createLinearGradient(0, 0, 0, CAROUSEL_HEIGHT);
    grad.addColorStop(0, `rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.06)`);
    grad.addColorStop(1, `rgba(${sRgb.r}, ${sRgb.g}, ${sRgb.b}, 0.04)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CAROUSEL_WIDTH, CAROUSEL_HEIGHT);
  } else if (style.layout === 'elegant') {
    ctx.fillStyle = '#FAFAF8';
    ctx.fillRect(0, 0, CAROUSEL_WIDTH, CAROUSEL_HEIGHT);
  } else {
    ctx.fillStyle = style.bgColor;
    ctx.fillRect(0, 0, CAROUSEL_WIDTH, CAROUSEL_HEIGHT);
  }

  const textColor = style.layout === 'bold' ? '#FFFFFF' : style.textColor;
  const margin = 80;

  // ============ DECORATIONS ============
  if (style.layout === 'modern') {
    // Top gradient bar
    const barGrad = ctx.createLinearGradient(0, 0, CAROUSEL_WIDTH, 0);
    barGrad.addColorStop(0, primary);
    barGrad.addColorStop(1, secondary);
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, CAROUSEL_WIDTH, 14);
    // Bottom gradient bar
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, CAROUSEL_HEIGHT - 14, CAROUSEL_WIDTH, 14);
    // Decorative circles
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = secondary;
    ctx.beginPath();
    ctx.arc(CAROUSEL_WIDTH - 150, 250, 200, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(150, CAROUSEL_HEIGHT - 200, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (style.layout === 'bold') {
    // Large decorative circles
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = secondary;
    ctx.beginPath();
    ctx.arc(CAROUSEL_WIDTH + 50, -50, 400, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-100, CAROUSEL_HEIGHT + 100, 350, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(CAROUSEL_WIDTH / 2, CAROUSEL_HEIGHT / 2, 500, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (style.layout === 'elegant') {
    // Double border frame
    ctx.strokeStyle = `rgba(${sRgb.r}, ${sRgb.g}, ${sRgb.b}, 0.4)`;
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, CAROUSEL_WIDTH - 60, CAROUSEL_HEIGHT - 60);
    ctx.strokeStyle = `rgba(${sRgb.r}, ${sRgb.g}, ${sRgb.b}, 0.2)`;
    ctx.lineWidth = 1;
    ctx.strokeRect(45, 45, CAROUSEL_WIDTH - 90, CAROUSEL_HEIGHT - 90);
    // Corner ornaments
    const ornSize = 40;
    ctx.fillStyle = secondary;
    ctx.fillRect(30, 30, ornSize, 3);
    ctx.fillRect(30, 30, 3, ornSize);
    ctx.fillRect(CAROUSEL_WIDTH - 30 - ornSize, 30, ornSize, 3);
    ctx.fillRect(CAROUSEL_WIDTH - 33, 30, 3, ornSize);
    ctx.fillRect(30, CAROUSEL_HEIGHT - 33, ornSize, 3);
    ctx.fillRect(30, CAROUSEL_HEIGHT - 30 - ornSize, 3, ornSize);
    ctx.fillRect(CAROUSEL_WIDTH - 30 - ornSize, CAROUSEL_HEIGHT - 33, ornSize, 3);
    ctx.fillRect(CAROUSEL_WIDTH - 33, CAROUSEL_HEIGHT - 30 - ornSize, 3, ornSize);
  } else if (style.layout === 'colorful') {
    // Top thick gradient bar
    const barGrad = ctx.createLinearGradient(0, 0, CAROUSEL_WIDTH, 0);
    barGrad.addColorStop(0, primary);
    barGrad.addColorStop(0.5, secondary);
    barGrad.addColorStop(1, primary);
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, CAROUSEL_WIDTH, 18);
    // Bottom bar
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, CAROUSEL_HEIGHT - 18, CAROUSEL_WIDTH, 18);
    // Decorative shapes
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = primary;
    drawRoundedRect(ctx, CAROUSEL_WIDTH - 200, 100, 250, 250, 60);
    ctx.fill();
    ctx.fillStyle = secondary;
    drawRoundedRect(ctx, -50, CAROUSEL_HEIGHT - 300, 200, 200, 50);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ============ IMAGE ============
  if (slide.imageUrl && (slide.type === 'cover' || slide.type === 'content')) {
    try {
      const img = await loadImage(slide.imageUrl);
      if (slide.type === 'cover') {
        const imgH = CAROUSEL_HEIGHT * 0.45;
        ctx.drawImage(img, 0, 60, CAROUSEL_WIDTH, imgH);
        const grad = ctx.createLinearGradient(0, imgH - 150, 0, imgH + 60);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, style.layout === 'bold' ? primary : '#FFFFFF');
        ctx.fillStyle = grad;
        ctx.fillRect(0, imgH - 150, CAROUSEL_WIDTH, 210);
      } else {
        const imgSize = 280;
        const imgX = CAROUSEL_WIDTH - imgSize - 80;
        const imgY = 200;
        // Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 8;
        ctx.save();
        drawRoundedRect(ctx, imgX, imgY, imgSize, imgSize, 20);
        ctx.clip();
        ctx.drawImage(img, imgX, imgY, imgSize, imgSize);
        ctx.restore();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = secondary;
        ctx.lineWidth = 3;
        drawRoundedRect(ctx, imgX, imgY, imgSize, imgSize, 20);
        ctx.stroke();
      }
    } catch {
      // skip image
    }
  }

  // ============ LOGO ============
  if (slide.logoUrl) {
    try {
      const logo = await loadImage(slide.logoUrl);
      const logoSize = 90;
      const lx = CAROUSEL_WIDTH - logoSize - 60;
      const ly = CAROUSEL_HEIGHT - logoSize - 60;
      // Logo bg circle
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(lx + logoSize / 2, ly + logoSize / 2, logoSize / 2 + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(lx + logoSize / 2, ly + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(logo, lx, ly, logoSize, logoSize);
      ctx.restore();
    } catch {
      // skip logo
    }
  }

  const maxTextWidth = slide.imageUrl && slide.type === 'content' ? CAROUSEL_WIDTH - 440 : CAROUSEL_WIDTH - margin * 2;

  // ============ CONTENT ============
  if (slide.type === 'cover') {
    const titleY = slide.imageUrl ? CAROUSEL_HEIGHT * 0.55 : CAROUSEL_HEIGHT * 0.38;

    // Title
    ctx.fillStyle = textColor;
    ctx.font = style.fontTitle;
    const lastY = wrapText(ctx, slide.title, margin, titleY, CAROUSEL_WIDTH - margin * 2, 78);

    // Accent bar under title
    const barGrad = ctx.createLinearGradient(margin, 0, margin + 200, 0);
    barGrad.addColorStop(0, secondary);
    barGrad.addColorStop(1, primary);
    ctx.fillStyle = barGrad;
    drawRoundedRect(ctx, margin, lastY + 25, 200, 8, 4);
    ctx.fill();

    // Swipe hint
    ctx.fillStyle = textColor;
    ctx.globalAlpha = 0.5;
    ctx.font = '28px Arial, sans-serif';
    ctx.fillText('Deslize para ver →', margin, CAROUSEL_HEIGHT - 100);
    ctx.globalAlpha = 1;

  } else if (slide.type === 'content') {
    // Number badge
    if (slide.number) {
      const badgeSize = 90;
      const badgeGrad = ctx.createLinearGradient(margin, 90, margin + badgeSize, 90 + badgeSize);
      badgeGrad.addColorStop(0, secondary);
      badgeGrad.addColorStop(1, primary);
      ctx.fillStyle = badgeGrad;
      drawRoundedRect(ctx, margin, 90, badgeSize, badgeSize, 20);
      ctx.fill();
      // Shadow for badge
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 50px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(slide.number), margin + badgeSize / 2, 148);
      ctx.textAlign = 'left';
    }

    // Title
    ctx.fillStyle = textColor;
    ctx.font = 'bold 50px Arial, sans-serif';
    const titleStartY = slide.number ? 260 : 150;
    const titleEndY = wrapText(ctx, slide.title, margin, titleStartY, maxTextWidth, 62);

    // Separator line
    ctx.fillStyle = secondary;
    drawRoundedRect(ctx, margin, titleEndY + 25, 80, 5, 3);
    ctx.fill();

    // Body text
    if (slide.body) {
      ctx.fillStyle = textColor;
      ctx.globalAlpha = 0.75;
      ctx.font = style.fontBody;
      wrapText(ctx, slide.body, margin, titleEndY + 65, maxTextWidth, 46);
      ctx.globalAlpha = 1;
    }

    // Progress dots
    if (slide.number && slide.totalSlides) {
      const progY = CAROUSEL_HEIGHT - 70;
      const dotGap = 28;
      const totalW = (slide.totalSlides - 1) * dotGap;
      const startX = (CAROUSEL_WIDTH - totalW) / 2;
      for (let i = 0; i < slide.totalSlides; i++) {
        const isCurrent = i + 1 === slide.number;
        ctx.beginPath();
        if (isCurrent) {
          drawRoundedRect(ctx, startX + i * dotGap - 12, progY - 5, 24, 10, 5);
          ctx.fillStyle = secondary;
          ctx.fill();
        } else {
          ctx.arc(startX + i * dotGap, progY, 5, 0, Math.PI * 2);
          ctx.fillStyle = textColor;
          ctx.globalAlpha = 0.2;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }

  } else if (slide.type === 'cta') {
    const centerX = CAROUSEL_WIDTH / 2;

    // Large decorative circle behind CTA
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = secondary;
    ctx.beginPath();
    ctx.arc(centerX, CAROUSEL_HEIGHT * 0.4, 350, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Title
    const titleY = CAROUSEL_HEIGHT * 0.32;
    ctx.fillStyle = textColor;
    ctx.font = 'bold 54px Arial, sans-serif';
    const lastY = wrapText(ctx, slide.title, centerX, titleY, CAROUSEL_WIDTH - margin * 2, 68, 'center');

    // CTA Button with gradient
    const btnY = lastY + 80;
    const btnW = 520;
    const btnH = 90;
    const btnX = (CAROUSEL_WIDTH - btnW) / 2;
    const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY);
    btnGrad.addColorStop(0, primary);
    btnGrad.addColorStop(1, secondary);
    // Shadow
    ctx.shadowColor = `rgba(${sRgb.r}, ${sRgb.g}, ${sRgb.b}, 0.35)`;
    ctx.shadowBlur = 25;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = btnGrad;
    drawRoundedRect(ctx, btnX, btnY, btnW, btnH, 45);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    // Button text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 34px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Saiba Mais →', centerX, btnY + 58);
    ctx.textAlign = 'left';

    // Profile handle
    if (slide.profileHandle) {
      ctx.fillStyle = textColor;
      ctx.globalAlpha = 0.5;
      ctx.font = '32px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(slide.profileHandle, centerX, CAROUSEL_HEIGHT - 120);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }

    // Checkmark icon decorative
    ctx.fillStyle = secondary;
    ctx.globalAlpha = 0.1;
    ctx.font = '200px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✓', centerX, CAROUSEL_HEIGHT * 0.72);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  return canvas.toDataURL('image/png');
}

export { CAROUSEL_WIDTH, CAROUSEL_HEIGHT };
