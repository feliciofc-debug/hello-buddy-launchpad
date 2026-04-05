import React from 'react';
import type { SlideTemplateProps } from './types';
import { ProgressDots } from './shared';

export const DarkPremiumCover: React.FC<SlideTemplateProps> = ({ title, body, primaryColor, secondaryColor, logoUrl, totalSlides, profileHandle }) => (
  <div style={{
    width: 1080, height: 1350, position: 'relative', overflow: 'hidden',
    background: `linear-gradient(145deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)`,
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
    padding: '80px',
  }}>
    {/* Decorative circles */}
    <div style={{ position: 'absolute', top: -120, right: -120, width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, ${primaryColor}25 0%, transparent 70%)` }} />
    <div style={{ position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: `radial-gradient(circle, ${secondaryColor}20 0%, transparent 70%)` }} />
    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, height: 600, borderRadius: '50%', background: `radial-gradient(circle, ${primaryColor}08 0%, transparent 70%)` }} />

    {/* Top accent line */}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor}, ${primaryColor})` }} />

    {/* Logo GRANDE centralizada */}
    {logoUrl && (
      <img src={logoUrl} alt="Logo" style={{ maxWidth: 280, maxHeight: 120, objectFit: 'contain', marginBottom: 30 }} />
    )}

    {/* Badge */}
    <div style={{
      background: `${primaryColor}20`, border: `1px solid ${primaryColor}40`, borderRadius: 50,
      padding: '12px 32px', marginBottom: 40, display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: primaryColor, boxShadow: `0 0 10px ${primaryColor}` }} />
      <span style={{ color: primaryColor, fontSize: 18, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase' }}>CARROSSEL PREMIUM</span>
    </div>

    {/* Title */}
    <h1 style={{
      color: '#FFFFFF', fontSize: 72, fontWeight: 900, textAlign: 'center',
      lineHeight: 1.1, margin: 0, marginBottom: 30,
      textShadow: `0 0 40px ${primaryColor}30`,
    }}>
      {title}
    </h1>

    {/* Subtitle */}
    {body && (
      <p style={{
        color: 'rgba(255,255,255,0.65)', fontSize: 30, fontWeight: 400,
        textAlign: 'center', lineHeight: 1.5, margin: 0, maxWidth: 800,
      }}>
        {body}
      </p>
    )}

    {/* Swipe indicator */}
    <div style={{ position: 'absolute', bottom: 60, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16, fontWeight: 500, letterSpacing: 2 }}>DESLIZE PARA VER →</span>
      <ProgressDots current={0} total={totalSlides} activeColor={primaryColor} inactiveColor="rgba(255,255,255,0.2)" />
    </div>
  </div>
);

export const DarkPremiumContent: React.FC<SlideTemplateProps> = ({ title, body, number, primaryColor, secondaryColor, logoUrl, totalSlides, imageUrl }) => (
  <div style={{
    width: 1080, height: 1350, position: 'relative', overflow: 'hidden',
    background: `linear-gradient(165deg, #0F172A 0%, #1E293B 100%)`,
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    display: 'flex', flexDirection: 'column', padding: '80px',
  }}>
    {/* Decorative accent */}
    <div style={{ position: 'absolute', top: 0, left: 0, width: 6, height: '100%', background: `linear-gradient(180deg, ${primaryColor}, ${secondaryColor}50, transparent)` }} />
    <div style={{ position: 'absolute', top: -100, right: -100, width: 300, height: 300, borderRadius: '50%', background: `radial-gradient(circle, ${primaryColor}15 0%, transparent 70%)` }} />

    {/* Number badge */}
    <div style={{
      width: 90, height: 90, borderRadius: 20,
      background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginBottom: 40, boxShadow: `0 8px 30px ${primaryColor}40`,
    }}>
      <span style={{ color: '#FFF', fontSize: 44, fontWeight: 900 }}>{number || 1}</span>
    </div>

    {/* Title */}
    <h2 style={{
      color: '#FFFFFF', fontSize: 56, fontWeight: 800, lineHeight: 1.15,
      margin: 0, marginBottom: 30,
    }}>
      {title}
    </h2>

    {/* Divider */}
    <div style={{ width: 80, height: 4, borderRadius: 2, background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`, marginBottom: 30 }} />

    {/* Body */}
    {body && (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, marginTop: 20 }}>
        {body.includes('\n') ? (
          body.split('\n').filter(Boolean).map((line, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 20,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 20, padding: '24px 32px',
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                background: primaryColor, flexShrink: 0,
                boxShadow: `0 0 12px ${primaryColor}60`,
              }} />
              <p style={{
                color: 'rgba(255,255,255,0.9)', fontSize: 36,
                fontWeight: 500, lineHeight: 1.4, margin: 0,
              }}>{line}</p>
            </div>
          ))
        ) : (
          <p style={{
            color: 'rgba(255,255,255,0.8)', fontSize: 34,
            fontWeight: 400, lineHeight: 1.7, margin: 0,
          }}>{body}</p>
        )}
      </div>
    )}

    {/* Product image */}
    {imageUrl && (
      <div style={{
        marginTop: 30, borderRadius: 20, overflow: 'hidden',
        border: `1px solid rgba(255,255,255,0.1)`, maxHeight: 350,
      }}>
        <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )}

    {/* Progress */}
    <div style={{ position: 'absolute', bottom: 50, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
      <ProgressDots current={number || 0} total={totalSlides} activeColor={primaryColor} inactiveColor="rgba(255,255,255,0.15)" />
    </div>

    {logoUrl && <img src={logoUrl} alt="Logo" style={{ position: 'absolute', bottom: 50, right: 60, maxWidth: 100, maxHeight: 45, objectFit: 'contain', opacity: 0.7 }} />}
  </div>
);

export const DarkPremiumCTA: React.FC<SlideTemplateProps> = ({ title, body, primaryColor, secondaryColor, logoUrl, totalSlides, profileHandle, ctaLabel }) => (
  <div style={{
    width: 1080, height: 1350, position: 'relative', overflow: 'hidden',
    background: `linear-gradient(145deg, #0F172A 0%, #1E293B 100%)`,
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
    padding: '80px',
  }}>
    {/* Decorative */}
    <div style={{ position: 'absolute', top: -150, left: '50%', transform: 'translateX(-50%)', width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${primaryColor}20 0%, transparent 60%)` }} />
    <div style={{ position: 'absolute', bottom: -100, right: -100, width: 350, height: 350, borderRadius: '50%', background: `radial-gradient(circle, ${secondaryColor}15 0%, transparent 60%)` }} />
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor}, ${primaryColor})` }} />

    {/* Title */}
    <h2 style={{
      color: '#FFFFFF', fontSize: 60, fontWeight: 900, textAlign: 'center',
      lineHeight: 1.1, margin: 0, marginBottom: 30,
      textShadow: `0 0 40px ${primaryColor}25`,
    }}>
      {title}
    </h2>

    {/* Body */}
    {body && (
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 28, textAlign: 'center', lineHeight: 1.6, margin: 0, marginBottom: 50, maxWidth: 800 }}>
        {body.replace(/\\n/g, '\n')}
      </p>
    )}

    {/* CTA Button */}
    <div style={{
      background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
      borderRadius: 60, padding: '24px 64px',
      boxShadow: `0 10px 40px ${primaryColor}50`,
    }}>
      <span style={{ color: '#FFF', fontSize: 28, fontWeight: 700 }}>{ctaLabel || 'SAIBA MAIS'}</span>
    </div>

    {/* Profile */}
    {profileHandle && (
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 22, marginTop: 40 }}>{profileHandle}</p>
    )}

    {/* Progress */}
    <div style={{ position: 'absolute', bottom: 50, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
      <ProgressDots current={totalSlides - 1} total={totalSlides} activeColor={primaryColor} inactiveColor="rgba(255,255,255,0.15)" />
    </div>

    <LogoBadge logoUrl={logoUrl} />
  </div>
);
