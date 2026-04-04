const CAROUSEL_WIDTH = 1080;
const CAROUSEL_HEIGHT = 1350;

export interface SlideData {
  type: 'cover' | 'content' | 'cta';
  title: string;
  body?: string;
  highlight?: string;
  ctaLabel?: string;
  number?: number;
  totalSlides?: number;
  contentTotal?: number;
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
    bgColor: '#0F172A',
    textColor: '#FFFFFF',
    accentColor: '#3B82F6',
    fontTitle: 'bold 64px Arial, sans-serif',
    fontBody: '32px Arial, sans-serif',
    layout: 'modern',
  },
  minimal: {
    name: 'Minimalista',
    primaryColor: '#18181B',
    secondaryColor: '#6366F1',
    bgColor: '#F8FAFC',
    textColor: '#0F172A',
    accentColor: '#6366F1',
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
    bgColor: '#111827',
    textColor: '#FFFFFF',
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
    textColor: '#1E1B4B',
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

function withAlpha(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lighten(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.min(255, r + amount)}, ${Math.min(255, g + amount)}, ${Math.min(255, b + amount)})`;
}

function darken(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.max(0, r - amount)}, ${Math.max(0, g - amount)}, ${Math.max(0, b - amount)})`;
}

// Decide if we should use light text on this bg
function isColorDark(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}

function getBodyLines(body?: string): string[] {
  if (!body) return [];

  const normalized = body
    .replace(/\r\n/g, '\n')
    .replace(/[•▪‣·]/g, '\n')
    .replace(/\s*\|\s*/g, '\n')
    .replace(/\.\s+/g, '.\n');

  let lines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 1) {
    lines = body
      .split(/(?<=[.!?])\s+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  if (lines.length === 1) {
    const words = lines[0].split(/\s+/).filter(Boolean);
    if (words.length > 8) {
      const chunkSize = Math.ceil(words.length / 3);
      lines = [];
      for (let i = 0; i < words.length; i += chunkSize) {
        lines.push(words.slice(i, i + chunkSize).join(' '));
      }
    }
  }

  return lines
    .map((line) => line.replace(/^[-–—]\s*/, '').replace(/[.!?]+$/, '').trim())
    .filter(Boolean)
    .slice(0, 4);
}

function getTitleFontSize(text: string, type: SlideData['type']) {
  const length = text.trim().length;
  const base = type === 'cover' ? 76 : type === 'cta' ? 70 : 62;

  if (length <= 26) return base;
  if (length <= 42) return base - 6;
  if (length <= 60) return base - 12;
  if (length <= 82) return base - 18;
  return Math.max(type === 'content' ? 44 : 50, base - 24);
}

function drawRoundedPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fillStyle: string,
  strokeStyle?: string,
  radius = 28
) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const imageRatio = image.width / image.height;
  const frameRatio = width / height;

  let drawWidth = width;
  let drawHeight = height;
  let drawX = x;
  let drawY = y;

  if (imageRatio > frameRatio) {
    drawHeight = height;
    drawWidth = height * imageRatio;
    drawX = x - (drawWidth - width) / 2;
  } else {
    drawWidth = width;
    drawHeight = width / imageRatio;
    drawY = y - (drawHeight - height) / 2;
  }

  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
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

  // For most styles, use primary/secondary as BG with white text
  // For minimal/colorful, use light bg with dark text
  const useDarkBg = style.layout !== 'minimal' && style.layout !== 'colorful';
  const textColor = useDarkBg ? '#FFFFFF' : '#1A1A2E';
  const subtextColor = useDarkBg ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';

  const margin = 90;
  const W = CAROUSEL_WIDTH;
  const H = CAROUSEL_HEIGHT;

  // ====== BACKGROUND ======
  if (style.layout === 'modern') {
    // Deep gradient from primary to darker
    const grad = ctx.createLinearGradient(0, 0, W * 0.3, H);
    grad.addColorStop(0, primary);
    grad.addColorStop(0.6, darken(primary, 30));
    grad.addColorStop(1, darken(primary, 60));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Decorative blob top-right
    ctx.globalAlpha = 0.15;
    const blobGrad = ctx.createRadialGradient(W - 100, 150, 50, W - 100, 150, 450);
    blobGrad.addColorStop(0, secondary);
    blobGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = blobGrad;
    ctx.fillRect(0, 0, W, H);

    // Decorative blob bottom-left
    const blob2 = ctx.createRadialGradient(100, H - 200, 30, 100, H - 200, 350);
    blob2.addColorStop(0, secondary);
    blob2.addColorStop(1, 'transparent');
    ctx.fillStyle = blob2;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    // Top accent line
    const lineGrad = ctx.createLinearGradient(0, 0, W, 0);
    lineGrad.addColorStop(0, secondary);
    lineGrad.addColorStop(0.5, lighten(secondary, 60));
    lineGrad.addColorStop(1, secondary);
    ctx.fillStyle = lineGrad;
    ctx.fillRect(0, 0, W, 8);

  } else if (style.layout === 'bold') {
    // Vibrant gradient diagonal
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, primary);
    grad.addColorStop(0.5, darken(primary, 20));
    grad.addColorStop(1, darken(primary, 50));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Large accent circles
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = secondary;
    ctx.beginPath();
    ctx.arc(W + 80, -80, 400, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-120, H + 80, 380, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 500, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Thick top bar
    ctx.fillStyle = secondary;
    ctx.fillRect(0, 0, W, 12);

  } else if (style.layout === 'elegant') {
    // Dark rich background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0C0C1D');
    grad.addColorStop(0.5, primary);
    grad.addColorStop(1, '#0C0C1D');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Gold frame
    ctx.strokeStyle = secondary;
    ctx.lineWidth = 2;
    ctx.strokeRect(35, 35, W - 70, H - 70);
    ctx.strokeStyle = `rgba(${sRgb.r}, ${sRgb.g}, ${sRgb.b}, 0.3)`;
    ctx.lineWidth = 1;
    ctx.strokeRect(50, 50, W - 100, H - 100);

    // Corner accents
    const cs = 50;
    ctx.fillStyle = secondary;
    [[35, 35], [W - 35 - cs, 35], [35, H - 35 - cs], [W - 35 - cs, H - 35 - cs]].forEach(([cx, cy]) => {
      ctx.fillRect(cx, cy, cs, 2);
      ctx.fillRect(cx, cy, 2, cs);
    });

    // Subtle pattern
    ctx.globalAlpha = 0.03;
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = secondary;
      ctx.beginPath();
      ctx.arc(Math.random() * W, Math.random() * H, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

  } else if (style.layout === 'colorful') {
    // Light vibrant gradient
    ctx.fillStyle = '#FFF8FC';
    ctx.fillRect(0, 0, W, H);
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, `rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.08)`);
    grad.addColorStop(0.5, `rgba(${sRgb.r}, ${sRgb.g}, ${sRgb.b}, 0.06)`);
    grad.addColorStop(1, `rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.1)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Top/bottom thick gradient bars
    const barGrad = ctx.createLinearGradient(0, 0, W, 0);
    barGrad.addColorStop(0, primary);
    barGrad.addColorStop(1, secondary);
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, W, 16);
    ctx.fillRect(0, H - 16, W, 16);

    // Decorative shapes
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.roundRect(W - 250, 80, 300, 300, 80);
    ctx.fill();
    ctx.fillStyle = secondary;
    ctx.beginPath();
    ctx.roundRect(-50, H - 350, 250, 250, 60);
    ctx.fill();
    ctx.globalAlpha = 1;

  } else if (style.layout === 'minimal') {
    // Clean white/light gray
    ctx.fillStyle = '#F5F1EA';
    ctx.fillRect(0, 0, W, H);

    // Subtle left accent bar
    const barGrad = ctx.createLinearGradient(0, 0, 0, H);
    barGrad.addColorStop(0, primary);
    barGrad.addColorStop(1, secondary);
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, 6, H);

    ctx.globalAlpha = 0.05;
    ctx.fillStyle = primary;
    ctx.beginPath();
    ctx.roundRect(W - 300, 80, 260, 220, 60);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  const maxTextWidth = slide.imageUrl && slide.type === 'content' ? W - 480 : W - margin * 2;

  // ====== IMAGE ======
  if (slide.imageUrl && (slide.type === 'cover' || slide.type === 'content')) {
    try {
      const img = await loadImage(slide.imageUrl);
      if (slide.type === 'cover') {
        const imgH = H * 0.38;
        const imgY = 140;
        ctx.shadowColor = 'rgba(0,0,0,0.22)';
        ctx.shadowBlur = 34;
        ctx.shadowOffsetY = 18;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(margin, imgY, W - margin * 2, imgH, 32);
        ctx.clip();
        drawImageCover(ctx, img, margin, imgY, W - margin * 2, imgH);
        ctx.restore();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        ctx.strokeStyle = useDarkBg ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.48)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(margin, imgY, W - margin * 2, imgH, 32);
        ctx.stroke();

        // Gradient overlay at bottom of image
        const imgGrad = ctx.createLinearGradient(0, imgY + imgH - 150, 0, imgY + imgH);
        imgGrad.addColorStop(0, 'transparent');
        imgGrad.addColorStop(1, useDarkBg ? darken(primary, 34) : 'rgba(255,255,255,0.92)');
        ctx.fillStyle = imgGrad;
        ctx.fillRect(margin, imgY + imgH - 150, W - margin * 2, 150);
      } else {
        const imgWidth = 320;
        const imgHeight = 400;
        const imgX = W - imgWidth - margin;
        const imgY = 170;

        ctx.globalAlpha = 0.18;
        ctx.fillStyle = secondary;
        ctx.beginPath();
        ctx.roundRect(imgX - 16, imgY + 22, imgWidth, imgHeight, 30);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 32;
        ctx.shadowOffsetY = 14;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(imgX, imgY, imgWidth, imgHeight, 28);
        ctx.clip();
        drawImageCover(ctx, img, imgX, imgY, imgWidth, imgHeight);
        ctx.restore();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        ctx.strokeStyle = useDarkBg ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(imgX, imgY, imgWidth, imgHeight, 28);
        ctx.stroke();
      }
    } catch {
      // skip
    }
  }

  // ====== LOGO ======
  if (slide.logoUrl) {
    try {
      const logo = await loadImage(slide.logoUrl);
      const logoSize = 80;
      const lx = W - logoSize - margin;
      const ly = H - logoSize - 80;
      // Circle bg
      ctx.fillStyle = useDarkBg ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)';
      ctx.beginPath();
      ctx.arc(lx + logoSize / 2, ly + logoSize / 2, logoSize / 2 + 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(lx + logoSize / 2, ly + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(logo, lx, ly, logoSize, logoSize);
      ctx.restore();
    } catch {
      // skip
    }
  }

  // ====== SLIDE CONTENT ======
  if (slide.type === 'cover') {
    const coverLines = getBodyLines(slide.body);
    const titleY = slide.imageUrl ? H * 0.57 : 300;
    const titleSize = getTitleFontSize(slide.title, 'cover');
    const topChipY = slide.imageUrl ? 88 : 72;

    drawRoundedPanel(
      ctx,
      margin,
      topChipY,
      320,
      62,
      useDarkBg ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.82)',
      useDarkBg ? 'rgba(255,255,255,0.14)' : withAlpha(primary, 0.10),
      32
    );
    ctx.fillStyle = useDarkBg ? '#FFFFFF' : primary;
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText('CARROSSEL PREMIUM', margin + 26, topChipY + 40);

    drawRoundedPanel(
      ctx,
      W - margin - 170,
      topChipY,
      170,
      62,
      withAlpha(secondary, useDarkBg ? 0.24 : 0.14),
      withAlpha(secondary, useDarkBg ? 0.32 : 0.18),
      32
    );
    ctx.fillStyle = useDarkBg ? '#FFFFFF' : primary;
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${slide.totalSlides || '?'} SLIDES`, W - margin - 85, topChipY + 40);
    ctx.textAlign = 'left';

    ctx.fillStyle = textColor;
    ctx.font = `bold ${titleSize}px Arial, sans-serif`;
    const lastY = wrapText(ctx, slide.title, margin, titleY, W - margin * 2, titleSize + 12);

    // Accent bar
    const barGrad = ctx.createLinearGradient(margin, 0, margin + 250, 0);
    barGrad.addColorStop(0, secondary);
    barGrad.addColorStop(1, lighten(secondary, 40));
    ctx.fillStyle = barGrad;
    ctx.beginPath();
    ctx.roundRect(margin, lastY + 30, 250, 8, 4);
    ctx.fill();

    if (coverLines.length > 0) {
      const subtitleY = lastY + 70;
      const panelHeight = 52 + coverLines.slice(0, 2).length * 40;
      drawRoundedPanel(
        ctx,
        margin,
        subtitleY - 34,
        Math.min(W - margin * 2, 760),
        panelHeight,
        useDarkBg ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.90)',
        useDarkBg ? 'rgba(255,255,255,0.10)' : withAlpha(primary, 0.10),
        30
      );

      ctx.fillStyle = subtextColor;
      ctx.font = '30px Arial, sans-serif';
      coverLines.slice(0, 2).forEach((line, index) => {
        ctx.fillText(line, margin + 30, subtitleY + index * 40);
      });
    }

    drawRoundedPanel(
      ctx,
      margin,
      H - 172,
      420,
      72,
      useDarkBg ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.92)',
      useDarkBg ? 'rgba(255,255,255,0.10)' : withAlpha(primary, 0.10),
      30
    );

    // Subtitle hint
    ctx.fillStyle = subtextColor;
    ctx.font = '30px Arial, sans-serif';
    ctx.fillText('Deslize para ver os benefícios →', margin + 28, H - 124);

    // Decorative slide count
    ctx.fillStyle = subtextColor;
    ctx.font = '24px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`1/${slide.totalSlides || '?'}`, W - margin, H - 100);
    ctx.textAlign = 'left';

  } else if (slide.type === 'content') {
    const detailLinesRaw = getBodyLines(slide.body);
    const highlightText = slide.highlight || detailLinesRaw[0] || '';
    const detailLines = (highlightText && detailLinesRaw.length > 1 ? detailLinesRaw.slice(1) : detailLinesRaw).slice(0, 4);
    const titleWidth = slide.imageUrl ? W - 520 : W - margin * 2;
    const titleSize = getTitleFontSize(slide.title, 'content');

    if (slide.number) {
      const badgeX = margin;
      const badgeY = 100;
      const badgeSize = 100;

      // Circle badge with gradient
      const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeSize, badgeY + badgeSize);
      badgeGrad.addColorStop(0, secondary);
      badgeGrad.addColorStop(1, lighten(secondary, 30));
      ctx.fillStyle = badgeGrad;
      ctx.shadowColor = `rgba(${sRgb.r}, ${sRgb.g}, ${sRgb.b}, 0.4)`;
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 6;
      ctx.beginPath();
      ctx.arc(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Number text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 56px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(slide.number), badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 20);
      ctx.textAlign = 'left';
    }

    drawRoundedPanel(
      ctx,
      margin + 126,
      112,
      220,
      52,
      useDarkBg ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.88)',
      useDarkBg ? 'rgba(255,255,255,0.10)' : withAlpha(primary, 0.10),
      26
    );
    ctx.fillStyle = secondary;
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText(`BENEFÍCIO ${slide.number || 1}`, margin + 154, 146);

    const titleStartY = slide.number ? 280 : 160;
    ctx.fillStyle = textColor;
    ctx.font = `bold ${titleSize}px Arial, sans-serif`;
    const titleEndY = wrapText(ctx, slide.title, margin, titleStartY, titleWidth, titleSize + 10);

    // Separator
    ctx.fillStyle = secondary;
    ctx.beginPath();
    ctx.roundRect(margin, titleEndY + 28, 110, 6, 3);
    ctx.fill();

    let currentY = titleEndY + 54;

    if (highlightText) {
      drawRoundedPanel(
        ctx,
        margin,
        currentY,
        titleWidth,
        104,
        useDarkBg ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.90)',
        useDarkBg ? withAlpha(secondary, 0.24) : withAlpha(primary, 0.10),
        28
      );
      ctx.fillStyle = secondary;
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.fillText('IMPACTO DIRETO', margin + 30, currentY + 36);
      ctx.fillStyle = textColor;
      ctx.font = 'bold 34px Arial, sans-serif';
      wrapText(ctx, highlightText, margin + 30, currentY + 76, titleWidth - 60, 38);
      currentY += 128;
    }

    const availableSlots = Math.max(1, Math.min(detailLines.length || 1, Math.floor((H - 230 - currentY) / 108)));
    const visibleLines = (detailLines.length > 0 ? detailLines : detailLinesRaw).slice(0, availableSlots);

    visibleLines.forEach((line, index) => {
      const blockY = currentY + index * 108;
      drawRoundedPanel(
        ctx,
        margin,
        blockY,
        titleWidth,
        88,
        useDarkBg ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.92)',
        useDarkBg ? 'rgba(255,255,255,0.08)' : withAlpha(primary, 0.10),
        26
      );

      const bulletGrad = ctx.createLinearGradient(margin + 22, blockY + 18, margin + 66, blockY + 66);
      bulletGrad.addColorStop(0, secondary);
      bulletGrad.addColorStop(1, lighten(secondary, 36));
      ctx.fillStyle = bulletGrad;
      ctx.beginPath();
      ctx.arc(margin + 44, blockY + 44, 20, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(index + 1), margin + 44, blockY + 52);
      ctx.textAlign = 'left';

      ctx.fillStyle = textColor;
      ctx.font = 'bold 32px Arial, sans-serif';
      wrapText(ctx, line, margin + 84, blockY + 52, titleWidth - 116, 36);
    });

    if (!slide.imageUrl) {
      const valueBarY = H - 186;
      drawRoundedPanel(
        ctx,
        margin,
        valueBarY,
        W - margin * 2,
        92,
        useDarkBg ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.92)',
        useDarkBg ? withAlpha(secondary, 0.20) : withAlpha(primary, 0.10),
        26
      );
      ctx.fillStyle = secondary;
      ctx.font = 'bold 22px Arial, sans-serif';
      ctx.fillText('POR QUE ISSO IMPORTA', margin + 28, valueBarY + 34);
      ctx.fillStyle = textColor;
      ctx.font = 'bold 28px Arial, sans-serif';
      wrapText(ctx, highlightText || 'Benefício percebido de forma clara e direta', margin + 28, valueBarY + 72, W - margin * 2 - 56, 32);
    }

    // ===== PROGRESS DOTS =====
    if (slide.number && (slide.contentTotal || slide.totalSlides)) {
      const progY = H - 80;
      const dotGap = 32;
      const totalItems = slide.contentTotal || slide.totalSlides || 0;
      const totalW = (Math.max(totalItems, 1) - 1) * dotGap;
      const startX = (W - totalW) / 2;
      for (let i = 0; i < totalItems; i++) {
        const isCurrent = i + 1 === slide.number;
        if (isCurrent) {
          ctx.fillStyle = secondary;
          ctx.beginPath();
          ctx.roundRect(startX + i * dotGap - 16, progY - 5, 32, 10, 5);
          ctx.fill();
        } else {
          ctx.fillStyle = useDarkBg ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
          ctx.beginPath();
          ctx.arc(startX + i * dotGap, progY, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Slide counter
      ctx.fillStyle = subtextColor;
      ctx.font = '22px Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${slide.number}/${totalItems}`, W - margin, H - 70);
      ctx.textAlign = 'left';
    }

  } else if (slide.type === 'cta') {
    const centerX = W / 2;
    const ctaLines = getBodyLines(slide.body);
    const titleSize = getTitleFontSize(slide.title, 'cta');

    // Large decorative circle
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = secondary;
    ctx.beginPath();
    ctx.arc(centerX, H * 0.38, 380, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Title
    const titleY = H * 0.30;
    ctx.fillStyle = textColor;
    ctx.font = `bold ${titleSize}px Arial, sans-serif`;
    const lastY = wrapText(ctx, slide.title, centerX, titleY, W - margin * 2, titleSize + 10, 'center');

    let chipsBottomY = lastY + 34;
    ctaLines.slice(0, 3).forEach((line, index) => {
      const chipWidth = Math.min(W - margin * 2, Math.max(320, ctx.measureText(line).width + 70));
      drawRoundedPanel(
        ctx,
        centerX - chipWidth / 2,
        chipsBottomY + index * 84,
        chipWidth,
        58,
        useDarkBg ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.92)',
        useDarkBg ? 'rgba(255,255,255,0.10)' : withAlpha(primary, 0.10),
        29
      );
      ctx.fillStyle = textColor;
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(line, centerX, chipsBottomY + index * 84 + 38);
    });

    // CTA Button with gradient + shadow
    const btnY = chipsBottomY + ctaLines.slice(0, 3).length * 84 + 34;
    const btnW = 560;
    const btnH = 100;
    const btnX = (W - btnW) / 2;
    const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY + btnH);
    btnGrad.addColorStop(0, secondary);
    btnGrad.addColorStop(1, lighten(secondary, 30));

    ctx.shadowColor = `rgba(${sRgb.r}, ${sRgb.g}, ${sRgb.b}, 0.5)`;
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = btnGrad;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 50);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Button text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 34px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(slide.ctaLabel || 'Quero conhecer agora →', centerX, btnY + 64);
    ctx.textAlign = 'left';

    // Profile handle
    if (slide.profileHandle) {
      ctx.fillStyle = subtextColor;
      ctx.font = '34px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(slide.profileHandle, centerX, H - 130);
      ctx.textAlign = 'left';
    }

    // Decorative rings
    ctx.strokeStyle = withAlpha(secondary, 0.16);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(centerX, H * 0.78, 150, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(centerX, H * 0.78, 220, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  return canvas.toDataURL('image/png');
}

export { CAROUSEL_WIDTH, CAROUSEL_HEIGHT };
