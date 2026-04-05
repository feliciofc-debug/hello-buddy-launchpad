import React from 'react';
import type { SlideTemplateProps } from './types';
import { ProgressDots, LogoBadge } from './shared';

export const GradientVibrantCover: React.FC<SlideTemplateProps> = ({ title, body, primaryColor, secondaryColor, logoUrl, totalSlides }) => (
  <div style={{
    width: 1080, height: 1350, position: 'relative', overflow: 'hidden',
    background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
    padding: '80px',
  }}>
    {/* Decorative shapes */}
    <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
    <div style={{ position: 'absolute', bottom: -80, left: -80, width: 350, height: 350, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
    <div style={{ position: 'absolute', top: '40%', left: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

    {/* Logo GRANDE centralizada */}
    {logoUrl && (
      <div style={{ width: 140, height: 140, borderRadius: '50%', overflow: 'hidden', marginBottom: 36, background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.25)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={logoUrl} alt="Logo" style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
      </div>
    )}

    {/* Glass badge */}
    <div style={{
      background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.25)', borderRadius: 50,
      padding: '12px 32px', marginBottom: 40,
    }}>
      <span style={{ color: '#FFF', fontSize: 17, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase' }}>✦ CONTEÚDO EXCLUSIVO</span>
    </div>

    <h1 style={{
      color: '#FFFFFF', fontSize: 72, fontWeight: 900, textAlign: 'center',
      lineHeight: 1.08, margin: 0, marginBottom: 30,
      textShadow: '0 2px 15px rgba(0,0,0,0.15)',
    }}>
      {title}
    </h1>

    {body && (
      <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 30, textAlign: 'center', lineHeight: 1.5, margin: 0, maxWidth: 800, textShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
        {body}
      </p>
    )}

    <div style={{ position: 'absolute', bottom: 60, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, letterSpacing: 2 }}>DESLIZE →</span>
      <ProgressDots current={0} total={totalSlides} activeColor="#FFFFFF" inactiveColor="rgba(255,255,255,0.3)" />
    </div>
  </div>
);

export const GradientVibrantContent: React.FC<SlideTemplateProps> = ({ title, body, number, primaryColor, secondaryColor, logoUrl, totalSlides, imageUrl }) => (
  <div style={{
    width: 1080, height: 1350, position: 'relative', overflow: 'hidden',
    background: `linear-gradient(150deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    display: 'flex', flexDirection: 'column', padding: '70px',
  }}>
    <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
    <div style={{ position: 'absolute', bottom: -60, left: -60, width: 250, height: 250, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

    {/* Number badge */}
    <div style={{
      width: 80, height: 80, borderRadius: '50%',
      background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginBottom: 36,
    }}>
      <span style={{ color: '#FFF', fontSize: 38, fontWeight: 900 }}>{number || 1}</span>
    </div>

    {/* Title */}
    <h2 style={{
      color: '#FFFFFF', fontSize: 54, fontWeight: 800, lineHeight: 1.15,
      margin: 0, marginBottom: 28, textShadow: '0 2px 10px rgba(0,0,0,0.12)',
    }}>
      {title}
    </h2>

    {/* Body */}
    {body && (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, marginTop: 16 }}>
        {body.includes('\n') ? (
          body.split('\n').filter(Boolean).map((line, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 20,
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 20, padding: '22px 30px',
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                background: '#FFFFFF', flexShrink: 0,
              }} />
              <p style={{
                color: 'rgba(255,255,255,0.95)', fontSize: 32,
                fontWeight: 500, lineHeight: 1.4, margin: 0,
              }}>{line}</p>
            </div>
          ))
        ) : (
          <div style={{
            background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: 24, padding: '36px 40px',
          }}>
            <p style={{
              color: 'rgba(255,255,255,0.9)', fontSize: 34,
              fontWeight: 400, lineHeight: 1.7, margin: 0,
            }}>{body}</p>
          </div>
        )}
      </div>
    )}

    {imageUrl && (
      <div style={{ marginTop: 20, borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)', maxHeight: 320 }}>
        <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )}

    <div style={{ position: 'absolute', bottom: 50, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
      <ProgressDots current={number || 0} total={totalSlides} activeColor="#FFFFFF" inactiveColor="rgba(255,255,255,0.3)" />
    </div>
    <LogoBadge logoUrl={logoUrl} />
  </div>
);

export const GradientVibrantCTA: React.FC<SlideTemplateProps> = ({ title, body, primaryColor, secondaryColor, logoUrl, totalSlides, profileHandle, ctaLabel }) => (
  <div style={{
    width: 1080, height: 1350, position: 'relative', overflow: 'hidden',
    background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
    padding: '80px',
  }}>
    <div style={{ position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)', width: 500, height: 500, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

    <h2 style={{ color: '#FFF', fontSize: 60, fontWeight: 900, textAlign: 'center', lineHeight: 1.1, margin: 0, marginBottom: 30, textShadow: '0 2px 15px rgba(0,0,0,0.15)' }}>
      {title}
    </h2>

    {body && <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 24, textAlign: 'center', lineHeight: 1.6, margin: 0, marginBottom: 50 }}>{body.replace(/\\n/g, '\n')}</p>}

    <div style={{
      background: '#FFFFFF', borderRadius: 60, padding: '22px 60px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
    }}>
      <span style={{ color: primaryColor, fontSize: 26, fontWeight: 800 }}>{ctaLabel || 'QUERO COMEÇAR'}</span>
    </div>

    {profileHandle && <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 22, marginTop: 36 }}>{profileHandle}</p>}

    <div style={{ position: 'absolute', bottom: 50, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
      <ProgressDots current={totalSlides - 1} total={totalSlides} activeColor="#FFFFFF" inactiveColor="rgba(255,255,255,0.3)" />
    </div>
    <LogoBadge logoUrl={logoUrl} />
  </div>
);
