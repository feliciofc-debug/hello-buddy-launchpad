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
    ctx.fillStyle = '#FFFFFF';
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
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, W, H);

    // Subtle left accent bar
    const barGrad = ctx.createLinearGradient(0, 0, 0, H);
    barGrad.addColorStop(0, primary);
    barGrad.addColorStop(1, secondary);
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, 6, H);
  }

  const maxTextWidth = slide.imageUrl && slide.type === 'content' ? W - 480 : W - margin * 2;

  // ====== IMAGE ======
  if (slide.imageUrl && (slide.type === 'cover' || slide.type === 'content')) {
    try {
      const img = await loadImage(slide.imageUrl);
      if (slide.type === 'cover') {
        const imgH = H * 0.42;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(margin, 80, W - margin * 2, imgH, 24);
        ctx.clip();
        ctx.drawImage(img, margin, 80, W - margin * 2, imgH);
        ctx.restore();
        // Gradient overlay at bottom of image
        const imgGrad = ctx.createLinearGradient(0, 80 + imgH - 120, 0, 80 + imgH);
        imgGrad.addColorStop(0, 'transparent');
        imgGrad.addColorStop(1, useDarkBg ? darken(primary, 30) : 'rgba(255,255,255,0.9)');
        ctx.fillStyle = imgGrad;
        ctx.fillRect(margin, 80 + imgH - 120, W - margin * 2, 120);
      } else {
        const imgSize = 300;
        const imgX = W - imgSize - margin;
        const imgY = 180;
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 10;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(imgX, imgY, imgSize, imgSize, 24);
        ctx.clip();
        ctx.drawImage(img, imgX, imgY, imgSize, imgSize);
        ctx.restore();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
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
    const titleY = slide.imageUrl ? H * 0.56 : H * 0.35;

    // Title
    ctx.fillStyle = textColor;
    ctx.font = style.fontTitle;
    const lastY = wrapText(ctx, slide.title, margin, titleY, W - margin * 2, 80);

    // Accent bar
    const barGrad = ctx.createLinearGradient(margin, 0, margin + 250, 0);
    barGrad.addColorStop(0, secondary);
    barGrad.addColorStop(1, lighten(secondary, 40));
    ctx.fillStyle = barGrad;
    ctx.beginPath();
    ctx.roundRect(margin, lastY + 30, 250, 8, 4);
    ctx.fill();

    // Subtitle hint
    ctx.fillStyle = subtextColor;
    ctx.font = '30px Arial, sans-serif';
    ctx.fillText('Deslize para ver →', margin, H - 100);

    // Decorative slide count
    ctx.fillStyle = subtextColor;
    ctx.font = '24px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`1/${slide.totalSlides || '?'}`, W - margin, H - 100);
    ctx.textAlign = 'left';

  } else if (slide.type === 'content') {
    // ===== NUMBER BADGE =====
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

    // ===== TITLE =====
    const titleStartY = slide.number ? 280 : 160;
    ctx.fillStyle = textColor;
    ctx.font = 'bold 52px Arial, sans-serif';
    const titleEndY = wrapText(ctx, slide.title, margin, titleStartY, maxTextWidth, 65);

    // Separator
    ctx.fillStyle = secondary;
    ctx.beginPath();
    ctx.roundRect(margin, titleEndY + 25, 80, 5, 3);
    ctx.fill();

    // ===== BODY =====
    if (slide.body) {
      ctx.fillStyle = subtextColor;
      ctx.font = style.fontBody;
      wrapText(ctx, slide.body, margin, titleEndY + 70, maxTextWidth, 48);
    }

    // ===== CHECKMARK ICON (visual flair) =====
    if (!slide.imageUrl) {
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = secondary;
      ctx.font = '350px Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('✓', W - 30, H - 200);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }

    // ===== PROGRESS DOTS =====
    if (slide.number && slide.totalSlides) {
      const progY = H - 80;
      const dotGap = 32;
      const totalW = (slide.totalSlides - 1) * dotGap;
      const startX = (W - totalW) / 2;
      for (let i = 0; i < slide.totalSlides; i++) {
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
      ctx.fillText(`${slide.number}/${slide.totalSlides}`, W - margin, H - 70);
      ctx.textAlign = 'left';
    }

  } else if (slide.type === 'cta') {
    const centerX = W / 2;

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
    ctx.font = 'bold 58px Arial, sans-serif';
    const lastY = wrapText(ctx, slide.title, centerX, titleY, W - margin * 2, 72, 'center');

    // CTA Button with gradient + shadow
    const btnY = lastY + 80;
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
    ctx.font = 'bold 36px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Saiba Mais →', centerX, btnY + 64);
    ctx.textAlign = 'left';

    // Profile handle
    if (slide.profileHandle) {
      ctx.fillStyle = subtextColor;
      ctx.font = '34px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(slide.profileHandle, centerX, H - 130);
      ctx.textAlign = 'left';
    }

    // Decorative large checkmark
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = secondary;
    ctx.font = '500px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', centerX, H * 0.78);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  return canvas.toDataURL('image/png');
}

export { CAROUSEL_WIDTH, CAROUSEL_HEIGHT };
