import React from 'react';

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

type TemplateKey = 'modern-dark' | 'clean-white' | 'gradient-pop' | 'elegant-serif' | 'neon-bold';

export const TEMPLATE_OPTIONS: Record<TemplateKey, { name: string; emoji: string; primaryColor: string; secondaryColor: string }> = {
  'modern-dark': { name: 'Modern Dark', emoji: '🌙', primaryColor: '#6366F1', secondaryColor: '#8B5CF6' },
  'clean-white': { name: 'Clean White', emoji: '⬜', primaryColor: '#2563EB', secondaryColor: '#3B82F6' },
  'gradient-pop': { name: 'Gradient Pop', emoji: '🌈', primaryColor: '#EC4899', secondaryColor: '#8B5CF6' },
  'elegant-serif': { name: 'Elegant Serif', emoji: '✨', primaryColor: '#D4AF37', secondaryColor: '#B8860B' },
  'neon-bold': { name: 'Neon Bold', emoji: '💜', primaryColor: '#A855F7', secondaryColor: '#06B6D4' },
};

const ProgressDots = ({ current, total, color }: { current: number; total: number; color: string }) => (
  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
    {Array.from({ length: total }).map((_, i) => (
      <div key={i} style={{
        width: i === current ? '24px' : '8px',
        height: '8px',
        borderRadius: '4px',
        background: i === current ? color : 'rgba(255,255,255,0.3)',
        transition: 'all 0.3s',
      }} />
    ))}
  </div>
);

const LogoBadge = ({ logoUrl, position = 'bottom-right' }: { logoUrl?: string; position?: string }) => {
  if (!logoUrl) return null;
  return (
    <div style={{
      position: 'absolute',
      bottom: '30px',
      right: '30px',
      width: '50px',
      height: '50px',
      borderRadius: '12px',
      overflow: 'hidden',
      opacity: 0.7,
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
    }}>
      <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  );
};

const bodyLines = (body?: string) => (body || '').split('\n').filter(l => l.trim());

// ==================== MODERN DARK ====================
const ModernDarkSlide: React.FC<SlideTemplateProps> = (props) => {
  const { type, title, body, number, totalSlides, imageUrl, logoUrl, primaryColor, secondaryColor, highlight, ctaLabel, profileHandle } = props;
  const currentIndex = type === 'cover' ? 0 : type === 'cta' ? totalSlides - 1 : (number || 1);

  const base: React.CSSProperties = {
    width: '1080px', height: '1350px', position: 'relative', overflow: 'hidden',
    background: 'linear-gradient(145deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
    fontFamily: "'Inter', sans-serif", color: '#F8FAFC', display: 'flex', flexDirection: 'column',
    padding: '70px',
  };

  return (
    <div style={base}>
      {/* Decorative gradient line top */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})` }} />
      {/* Decorative circles */}
      <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '350px', height: '350px', borderRadius: '50%', background: `radial-gradient(circle, ${primaryColor}20, transparent 70%)`, filter: 'blur(40px)' }} />
      <div style={{ position: 'absolute', bottom: '-80px', left: '-80px', width: '300px', height: '300px', borderRadius: '50%', background: `radial-gradient(circle, ${secondaryColor}15, transparent 70%)`, filter: 'blur(50px)' }} />

      {type === 'cover' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '40px', zIndex: 1 }}>
          {imageUrl && (
            <div style={{ width: '100%', height: '400px', borderRadius: '24px', overflow: 'hidden', boxShadow: `0 20px 60px ${primaryColor}30` }}>
              <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <h1 style={{ fontSize: imageUrl ? '52px' : '64px', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-1px' }}>{title}</h1>
          {body && <p style={{ fontSize: '28px', fontWeight: 300, color: '#94A3B8', lineHeight: 1.5 }}>{body}</p>}
        </div>
      )}

      {type === 'content' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '30px', zIndex: 1 }}>
          {/* Number badge */}
          <div style={{ width: '70px', height: '70px', borderRadius: '20px', background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 900, boxShadow: `0 10px 30px ${primaryColor}40` }}>
            {number}
          </div>
          <h2 style={{ fontSize: '48px', fontWeight: 800, lineHeight: 1.15, marginTop: '10px' }}>{title}</h2>
          {imageUrl && (
            <div style={{ width: '100%', height: '300px', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
              <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          {/* Glass card with body */}
          <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', padding: '40px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '20px' }}>
            {bodyLines(body).map((line, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: primaryColor, marginTop: '10px', flexShrink: 0 }} />
                <p style={{ fontSize: '26px', fontWeight: 400, color: '#CBD5E1', lineHeight: 1.5 }}>{line}</p>
              </div>
            ))}
          </div>
          {highlight && (
            <div style={{ background: `linear-gradient(135deg, ${primaryColor}20, ${secondaryColor}20)`, border: `1px solid ${primaryColor}40`, borderRadius: '16px', padding: '20px 30px' }}>
              <p style={{ fontSize: '22px', fontWeight: 600, color: primaryColor }}>💡 {highlight}</p>
            </div>
          )}
        </div>
      )}

      {type === 'cta' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: '40px', zIndex: 1 }}>
          <h2 style={{ fontSize: '56px', fontWeight: 900, lineHeight: 1.1 }}>{title}</h2>
          {body && <p style={{ fontSize: '26px', color: '#94A3B8', lineHeight: 1.6, maxWidth: '800px' }}>{body.replace(/\\n/g, '\n')}</p>}
          {ctaLabel && (
            <div style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`, borderRadius: '20px', padding: '24px 60px', fontSize: '28px', fontWeight: 700, boxShadow: `0 15px 40px ${primaryColor}50`, letterSpacing: '1px' }}>
              {ctaLabel}
            </div>
          )}
          {profileHandle && <p style={{ fontSize: '24px', color: '#64748B', fontWeight: 500 }}>{profileHandle}</p>}
        </div>
      )}

      <div style={{ position: 'absolute', bottom: '30px', left: '70px', right: '70px', display: 'flex', justifyContent: 'center' }}>
        <ProgressDots current={currentIndex} total={totalSlides} color={primaryColor} />
      </div>
      <LogoBadge logoUrl={logoUrl} />
    </div>
  );
};

// ==================== CLEAN WHITE ====================
const CleanWhiteSlide: React.FC<SlideTemplateProps> = (props) => {
  const { type, title, body, number, totalSlides, imageUrl, logoUrl, primaryColor, secondaryColor, highlight, ctaLabel, profileHandle } = props;
  const currentIndex = type === 'cover' ? 0 : type === 'cta' ? totalSlides - 1 : (number || 1);

  const base: React.CSSProperties = {
    width: '1080px', height: '1350px', position: 'relative', overflow: 'hidden',
    background: '#FFFFFF', fontFamily: "'Inter', sans-serif", color: '#1E293B',
    display: 'flex', flexDirection: 'column', padding: '70px',
  };

  return (
    <div style={base}>
      {/* Top accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '6px', background: primaryColor }} />
      {/* Subtle background circle */}
      <div style={{ position: 'absolute', bottom: '-200px', right: '-200px', width: '500px', height: '500px', borderRadius: '50%', background: `${primaryColor}08` }} />

      {type === 'cover' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '40px' }}>
          {imageUrl && (
            <div style={{ width: '100%', height: '420px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
              <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <h1 style={{ fontSize: '60px', fontWeight: 900, lineHeight: 1.1, color: '#0F172A' }}>{title}</h1>
          {body && <p style={{ fontSize: '28px', fontWeight: 400, color: '#64748B', lineHeight: 1.5 }}>{body}</p>}
          <div style={{ width: '80px', height: '4px', background: primaryColor, borderRadius: '2px' }} />
        </div>
      )}

      {type === 'content' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 900, color: '#FFF' }}>
              {number}
            </div>
            <h2 style={{ fontSize: '44px', fontWeight: 800, lineHeight: 1.15, color: '#0F172A' }}>{title}</h2>
          </div>
          {imageUrl && (
            <div style={{ width: '100%', height: '300px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9' }}>
              <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <div style={{ background: '#F8FAFC', borderRadius: '24px', padding: '40px', border: '1px solid #E2E8F0', boxShadow: '0 4px 24px rgba(0,0,0,0.04)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '24px' }}>
            {bodyLines(body).map((line, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: primaryColor, marginTop: '10px', flexShrink: 0 }} />
                <p style={{ fontSize: '26px', color: '#334155', lineHeight: 1.5 }}>{line}</p>
              </div>
            ))}
          </div>
          {highlight && (
            <div style={{ background: `${primaryColor}10`, borderLeft: `4px solid ${primaryColor}`, borderRadius: '0 16px 16px 0', padding: '20px 30px' }}>
              <p style={{ fontSize: '22px', fontWeight: 600, color: primaryColor }}>✨ {highlight}</p>
            </div>
          )}
        </div>
      )}

      {type === 'cta' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: '40px' }}>
          <h2 style={{ fontSize: '56px', fontWeight: 900, lineHeight: 1.1, color: '#0F172A' }}>{title}</h2>
          {body && <p style={{ fontSize: '26px', color: '#64748B', lineHeight: 1.6, maxWidth: '800px' }}>{body.replace(/\\n/g, '\n')}</p>}
          {ctaLabel && (
            <div style={{ background: primaryColor, borderRadius: '20px', padding: '24px 60px', fontSize: '28px', fontWeight: 700, color: '#FFF', boxShadow: `0 10px 30px ${primaryColor}30` }}>
              {ctaLabel}
            </div>
          )}
          {profileHandle && <p style={{ fontSize: '24px', color: '#94A3B8', fontWeight: 500 }}>{profileHandle}</p>}
        </div>
      )}

      <div style={{ position: 'absolute', bottom: '30px', left: '70px', right: '70px', display: 'flex', justifyContent: 'center' }}>
        <ProgressDots current={currentIndex} total={totalSlides} color={primaryColor} />
      </div>
      <LogoBadge logoUrl={logoUrl} />
    </div>
  );
};

// ==================== GRADIENT POP ====================
const GradientPopSlide: React.FC<SlideTemplateProps> = (props) => {
  const { type, title, body, number, totalSlides, imageUrl, logoUrl, primaryColor, secondaryColor, highlight, ctaLabel, profileHandle } = props;
  const currentIndex = type === 'cover' ? 0 : type === 'cta' ? totalSlides - 1 : (number || 1);

  const base: React.CSSProperties = {
    width: '1080px', height: '1350px', position: 'relative', overflow: 'hidden',
    background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
    fontFamily: "'Inter', sans-serif", color: '#FFFFFF',
    display: 'flex', flexDirection: 'column', padding: '70px',
  };

  return (
    <div style={base}>
      {/* Big translucent shapes */}
      <div style={{ position: 'absolute', top: '-120px', right: '-120px', width: '400px', height: '400px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
      <div style={{ position: 'absolute', bottom: '-80px', left: '-80px', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
      <div style={{ position: 'absolute', top: '50%', left: '60%', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

      {type === 'cover' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '40px', zIndex: 1 }}>
          {imageUrl && (
            <div style={{ width: '100%', height: '400px', borderRadius: '30px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '3px solid rgba(255,255,255,0.3)' }}>
              <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <h1 style={{ fontSize: '64px', fontWeight: 900, lineHeight: 1.05, textShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>{title}</h1>
          {body && <p style={{ fontSize: '28px', fontWeight: 400, opacity: 0.9, lineHeight: 1.5 }}>{body}</p>}
        </div>
      )}

      {type === 'content' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '30px', zIndex: 1 }}>
          <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 900, border: '2px solid rgba(255,255,255,0.4)' }}>
            {number}
          </div>
          <h2 style={{ fontSize: '48px', fontWeight: 800, lineHeight: 1.15, textShadow: '0 2px 10px rgba(0,0,0,0.15)' }}>{title}</h2>
          {imageUrl && (
            <div style={{ width: '100%', height: '280px', borderRadius: '24px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.3)', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
              <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <div style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(20px)', borderRadius: '24px', padding: '40px', border: '1px solid rgba(255,255,255,0.25)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '22px' }}>
            {bodyLines(body).map((line, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <span style={{ fontSize: '24px', marginTop: '2px' }}>✦</span>
                <p style={{ fontSize: '26px', fontWeight: 500, lineHeight: 1.5 }}>{line}</p>
              </div>
            ))}
          </div>
          {highlight && (
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '16px', padding: '18px 28px', textAlign: 'center' }}>
              <p style={{ fontSize: '22px', fontWeight: 700 }}>⚡ {highlight}</p>
            </div>
          )}
        </div>
      )}

      {type === 'cta' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: '40px', zIndex: 1 }}>
          <h2 style={{ fontSize: '56px', fontWeight: 900, lineHeight: 1.1, textShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>{title}</h2>
          {body && <p style={{ fontSize: '26px', opacity: 0.9, lineHeight: 1.6, maxWidth: '800px' }}>{body.replace(/\\n/g, '\n')}</p>}
          {ctaLabel && (
            <div style={{ background: '#FFF', color: primaryColor, borderRadius: '20px', padding: '24px 60px', fontSize: '28px', fontWeight: 800, boxShadow: '0 15px 40px rgba(0,0,0,0.2)' }}>
              {ctaLabel}
            </div>
          )}
          {profileHandle && <p style={{ fontSize: '24px', opacity: 0.8, fontWeight: 500 }}>{profileHandle}</p>}
        </div>
      )}

      <div style={{ position: 'absolute', bottom: '30px', left: '70px', right: '70px', display: 'flex', justifyContent: 'center', zIndex: 2 }}>
        <ProgressDots current={currentIndex} total={totalSlides} color="rgba(255,255,255,0.9)" />
      </div>
      <LogoBadge logoUrl={logoUrl} />
    </div>
  );
};

// ==================== ELEGANT SERIF ====================
const ElegantSerifSlide: React.FC<SlideTemplateProps> = (props) => {
  const { type, title, body, number, totalSlides, imageUrl, logoUrl, primaryColor, secondaryColor, highlight, ctaLabel, profileHandle } = props;
  const currentIndex = type === 'cover' ? 0 : type === 'cta' ? totalSlides - 1 : (number || 1);

  const gold = primaryColor || '#D4AF37';
  const base: React.CSSProperties = {
    width: '1080px', height: '1350px', position: 'relative', overflow: 'hidden',
    background: '#FAF9F6', fontFamily: "'Playfair Display', Georgia, serif", color: '#2C2C2C',
    display: 'flex', flexDirection: 'column', padding: '80px',
  };

  return (
    <div style={base}>
      {/* Elegant border frame */}
      <div style={{ position: 'absolute', top: '20px', left: '20px', right: '20px', bottom: '20px', border: `2px solid ${gold}`, borderRadius: '8px', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '30px', left: '30px', right: '30px', bottom: '30px', border: `1px solid ${gold}40`, borderRadius: '4px', pointerEvents: 'none' }} />

      {type === 'cover' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: '35px', zIndex: 1 }}>
          <div style={{ width: '60px', height: '2px', background: gold }} />
          {imageUrl && (
            <div style={{ width: '400px', height: '400px', borderRadius: '50%', overflow: 'hidden', border: `3px solid ${gold}`, boxShadow: `0 10px 40px ${gold}20` }}>
              <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <h1 style={{ fontSize: '56px', fontWeight: 900, lineHeight: 1.15, letterSpacing: '1px' }}>{title}</h1>
          {body && <p style={{ fontSize: '26px', fontWeight: 400, color: '#6B6B6B', lineHeight: 1.6, fontFamily: "'Inter', sans-serif" }}>{body}</p>}
          <div style={{ width: '60px', height: '2px', background: gold }} />
        </div>
      )}

      {type === 'content' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '30px', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '50%', border: `2px solid ${gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 700, color: gold }}>
              {number}
            </div>
            <div style={{ flex: 1, height: '1px', background: `${gold}30` }} />
          </div>
          <h2 style={{ fontSize: '44px', fontWeight: 700, lineHeight: 1.2 }}>{title}</h2>
          {imageUrl && (
            <div style={{ width: '100%', height: '280px', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${gold}30` }}>
              <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <div style={{ background: '#F5F3EE', borderRadius: '16px', padding: '40px', border: `1px solid ${gold}20`, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '24px' }}>
            {bodyLines(body).map((line, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <span style={{ color: gold, fontSize: '20px', marginTop: '4px' }}>◆</span>
                <p style={{ fontSize: '24px', lineHeight: 1.6, fontFamily: "'Inter', sans-serif", color: '#444' }}>{line}</p>
              </div>
            ))}
          </div>
          {highlight && (
            <div style={{ textAlign: 'center', borderTop: `1px solid ${gold}30`, borderBottom: `1px solid ${gold}30`, padding: '16px' }}>
              <p style={{ fontSize: '20px', fontStyle: 'italic', color: gold }}>"{highlight}"</p>
            </div>
          )}
        </div>
      )}

      {type === 'cta' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: '40px', zIndex: 1 }}>
          <div style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: gold, fontSize: '36px' }}>✦</span>
          </div>
          <h2 style={{ fontSize: '52px', fontWeight: 900, lineHeight: 1.15 }}>{title}</h2>
          {body && <p style={{ fontSize: '24px', color: '#6B6B6B', lineHeight: 1.6, maxWidth: '750px', fontFamily: "'Inter', sans-serif" }}>{body.replace(/\\n/g, '\n')}</p>}
          {ctaLabel && (
            <div style={{ background: gold, borderRadius: '12px', padding: '22px 55px', fontSize: '26px', fontWeight: 700, color: '#FFF', letterSpacing: '2px', textTransform: 'uppercase' as const }}>
              {ctaLabel}
            </div>
          )}
          {profileHandle && <p style={{ fontSize: '22px', color: '#999', fontFamily: "'Inter', sans-serif" }}>{profileHandle}</p>}
        </div>
      )}

      <div style={{ position: 'absolute', bottom: '40px', left: '80px', right: '80px', display: 'flex', justifyContent: 'center', zIndex: 2 }}>
        <ProgressDots current={currentIndex} total={totalSlides} color={gold} />
      </div>
      <LogoBadge logoUrl={logoUrl} />
    </div>
  );
};

// ==================== NEON BOLD ====================
const NeonBoldSlide: React.FC<SlideTemplateProps> = (props) => {
  const { type, title, body, number, totalSlides, imageUrl, logoUrl, primaryColor, secondaryColor, highlight, ctaLabel, profileHandle } = props;
  const currentIndex = type === 'cover' ? 0 : type === 'cta' ? totalSlides - 1 : (number || 1);

  const base: React.CSSProperties = {
    width: '1080px', height: '1350px', position: 'relative', overflow: 'hidden',
    background: '#09090B', fontFamily: "'Inter', sans-serif", color: '#FAFAFA',
    display: 'flex', flexDirection: 'column', padding: '70px',
  };

  return (
    <div style={base}>
      {/* Neon glow elements */}
      <div style={{ position: 'absolute', top: '-50px', right: '100px', width: '300px', height: '300px', borderRadius: '50%', background: `${primaryColor}15`, filter: 'blur(80px)' }} />
      <div style={{ position: 'absolute', bottom: '100px', left: '-50px', width: '250px', height: '250px', borderRadius: '50%', background: `${secondaryColor}12`, filter: 'blur(60px)' }} />
      {/* Scan lines effect */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.02) 2px, rgba(255,255,255,0.02) 4px)', pointerEvents: 'none' }} />

      {type === 'cover' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '40px', zIndex: 1 }}>
          {imageUrl && (
            <div style={{ width: '100%', height: '400px', borderRadius: '20px', overflow: 'hidden', border: `2px solid ${primaryColor}`, boxShadow: `0 0 40px ${primaryColor}30` }}>
              <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <h1 style={{ fontSize: '64px', fontWeight: 900, lineHeight: 1.05, textShadow: `0 0 30px ${primaryColor}60, 0 0 60px ${primaryColor}20` }}>{title}</h1>
          {body && <p style={{ fontSize: '28px', fontWeight: 300, color: '#A1A1AA', lineHeight: 1.5 }}>{body}</p>}
          <div style={{ width: '100px', height: '3px', background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`, boxShadow: `0 0 15px ${primaryColor}60` }} />
        </div>
      )}

      {type === 'content' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '30px', zIndex: 1 }}>
          <div style={{ width: '70px', height: '70px', borderRadius: '16px', border: `2px solid ${primaryColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 900, color: primaryColor, boxShadow: `0 0 25px ${primaryColor}30`, background: `${primaryColor}10` }}>
            {number}
          </div>
          <h2 style={{ fontSize: '48px', fontWeight: 800, lineHeight: 1.15, textShadow: `0 0 20px ${primaryColor}30` }}>{title}</h2>
          {imageUrl && (
            <div style={{ width: '100%', height: '280px', borderRadius: '16px', overflow: 'hidden', border: `1px solid ${primaryColor}40`, boxShadow: `0 0 30px ${primaryColor}15` }}>
              <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${primaryColor}25`, borderRadius: '20px', padding: '40px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '22px' }}>
            {bodyLines(body).map((line, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: primaryColor, marginTop: '10px', flexShrink: 0, boxShadow: `0 0 10px ${primaryColor}80` }} />
                <p style={{ fontSize: '26px', fontWeight: 400, color: '#D4D4D8', lineHeight: 1.5 }}>{line}</p>
              </div>
            ))}
          </div>
          {highlight && (
            <div style={{ background: `${primaryColor}10`, border: `1px solid ${primaryColor}30`, borderRadius: '12px', padding: '18px 28px' }}>
              <p style={{ fontSize: '22px', fontWeight: 600, color: primaryColor, textShadow: `0 0 10px ${primaryColor}40` }}>⚡ {highlight}</p>
            </div>
          )}
        </div>
      )}

      {type === 'cta' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: '40px', zIndex: 1 }}>
          <h2 style={{ fontSize: '56px', fontWeight: 900, lineHeight: 1.1, textShadow: `0 0 30px ${primaryColor}60` }}>{title}</h2>
          {body && <p style={{ fontSize: '26px', color: '#A1A1AA', lineHeight: 1.6, maxWidth: '800px' }}>{body.replace(/\\n/g, '\n')}</p>}
          {ctaLabel && (
            <div style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`, borderRadius: '16px', padding: '24px 60px', fontSize: '28px', fontWeight: 700, boxShadow: `0 0 40px ${primaryColor}50, 0 10px 30px rgba(0,0,0,0.3)` }}>
              {ctaLabel}
            </div>
          )}
          {profileHandle && <p style={{ fontSize: '24px', color: '#71717A', fontWeight: 500 }}>{profileHandle}</p>}
        </div>
      )}

      <div style={{ position: 'absolute', bottom: '30px', left: '70px', right: '70px', display: 'flex', justifyContent: 'center', zIndex: 2 }}>
        <ProgressDots current={currentIndex} total={totalSlides} color={primaryColor} />
      </div>
      <LogoBadge logoUrl={logoUrl} />
    </div>
  );
};

// ==================== TEMPLATE MAP ====================
const TEMPLATE_MAP: Record<string, React.FC<SlideTemplateProps>> = {
  'modern-dark': ModernDarkSlide,
  'clean-white': CleanWhiteSlide,
  'gradient-pop': GradientPopSlide,
  'elegant-serif': ElegantSerifSlide,
  'neon-bold': NeonBoldSlide,
};

export const SlideRenderer: React.FC<SlideTemplateProps & { templateName: string }> = ({ templateName, ...props }) => {
  const Component = TEMPLATE_MAP[templateName] || ModernDarkSlide;
  return <Component {...props} />;
};
