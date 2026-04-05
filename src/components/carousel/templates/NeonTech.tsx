import React from 'react';
import type { SlideTemplateProps } from './types';
import { ProgressDots, LogoBadge } from './shared';

export const NeonTechCover: React.FC<SlideTemplateProps> = ({ title, body, primaryColor, secondaryColor, logoUrl, totalSlides }) => (
  <div style={{
    width: 1080, height: 1350, position: 'relative', overflow: 'hidden',
    background: '#09090B',
    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
    padding: '80px',
  }}>
    {/* Scan lines */}
    <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 4px)', pointerEvents: 'none' }} />

    {/* Grid pattern */}
    <div style={{ position: 'absolute', inset: 0, opacity: 0.03, background: 'repeating-linear-gradient(90deg, #FFF 0px, transparent 1px, transparent 60px), repeating-linear-gradient(0deg, #FFF 0px, transparent 1px, transparent 60px)' }} />

    {/* Glow orbs */}
    <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, ${primaryColor}20 0%, transparent 60%)` }} />
    <div style={{ position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: `radial-gradient(circle, ${secondaryColor}15 0%, transparent 60%)` }} />

    {/* Top neon line */}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: primaryColor, boxShadow: `0 0 20px ${primaryColor}60, 0 0 40px ${primaryColor}30` }} />

    {/* Logo GRANDE centralizada */}
    {logoUrl && (
      <div style={{ width: 140, height: 140, borderRadius: '50%', overflow: 'hidden', marginBottom: 36, background: `${primaryColor}10`, border: `2px solid ${primaryColor}40`, boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 20px ${primaryColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={logoUrl} alt="Logo" style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
      </div>
    )}

    {/* Badge */}
    <div style={{
      border: `1px solid ${primaryColor}60`, borderRadius: 4, padding: '10px 28px', marginBottom: 40,
      boxShadow: `0 0 15px ${primaryColor}20`,
    }}>
      <span style={{ color: primaryColor, fontSize: 16, fontWeight: 600, letterSpacing: 4, textTransform: 'uppercase' }}>⚡ TECH CONTENT</span>
    </div>

    <h1 style={{
      color: '#FFFFFF', fontSize: 72, fontWeight: 900, textAlign: 'center',
      lineHeight: 1.1, margin: 0, marginBottom: 30,
      textShadow: `0 0 30px ${primaryColor}35`,
    }}>
      {title}
    </h1>

    {body && (
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 24, textAlign: 'center', lineHeight: 1.5, margin: 0, maxWidth: 800 }}>
        {body}
      </p>
    )}

    <div style={{ position: 'absolute', bottom: 60, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <span style={{ color: `${primaryColor}80`, fontSize: 14, letterSpacing: 3, fontFamily: "'Space Grotesk', monospace" }}>[ SWIPE → ]</span>
      <ProgressDots current={0} total={totalSlides} activeColor={primaryColor} inactiveColor="rgba(255,255,255,0.1)" />
    </div>
  </div>
);

export const NeonTechContent: React.FC<SlideTemplateProps> = ({ title, body, number, primaryColor, secondaryColor, logoUrl, totalSlides, imageUrl }) => (
  <div style={{
    width: 1080, height: 1350, position: 'relative', overflow: 'hidden',
    background: '#09090B',
    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
    display: 'flex', flexDirection: 'column', padding: '80px',
  }}>
    {/* Scan lines */}
    <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 4px)', pointerEvents: 'none' }} />

    {/* Left neon bar */}
    <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: `linear-gradient(180deg, ${primaryColor}, transparent)`, boxShadow: `0 0 15px ${primaryColor}40` }} />

    {/* Glow */}
    <div style={{ position: 'absolute', top: -80, right: -80, width: 250, height: 250, borderRadius: '50%', background: `radial-gradient(circle, ${primaryColor}12 0%, transparent 60%)` }} />

    {/* Number badge */}
    <div style={{
      width: 80, height: 80, borderRadius: 8,
      border: `1.5px solid ${primaryColor}`, background: `${primaryColor}10`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginBottom: 36, boxShadow: `0 0 25px ${primaryColor}25`,
    }}>
      <span style={{ color: primaryColor, fontSize: 40, fontWeight: 700, textShadow: `0 0 10px ${primaryColor}60` }}>{number || 1}</span>
    </div>

    {/* Title */}
    <h2 style={{
      color: '#FFFFFF', fontSize: 52, fontWeight: 700, lineHeight: 1.15,
      margin: 0, marginBottom: 28,
      textShadow: `0 0 20px ${primaryColor}20`,
    }}>
      {title}
    </h2>

    {/* Neon divider */}
    <div style={{ width: 80, height: 2, background: primaryColor, marginBottom: 28, boxShadow: `0 0 10px ${primaryColor}60` }} />

    {/* Body */}
    {body && (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, marginTop: 16 }}>
        {body.includes('\n') ? (
          body.split('\n').filter(Boolean).map((line, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 20,
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${primaryColor}30`,
              borderRadius: 16, padding: '22px 30px',
              boxShadow: `0 0 20px ${primaryColor}10`,
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                background: primaryColor, flexShrink: 0,
                boxShadow: `0 0 12px ${primaryColor}60`,
              }} />
              <p style={{
                color: 'rgba(255,255,255,0.85)', fontSize: 32,
                fontWeight: 500, lineHeight: 1.4, margin: 0,
              }}>{line}</p>
            </div>
          ))
        ) : (
          <p style={{
            color: 'rgba(255,255,255,0.75)', fontSize: 34,
            fontWeight: 400, lineHeight: 1.7, margin: 0,
          }}>{body}</p>
        )}
      </div>
    )}

    {imageUrl && (
      <div style={{ marginTop: 20, borderRadius: 12, overflow: 'hidden', border: `1px solid ${primaryColor}30`, maxHeight: 300, boxShadow: `0 0 20px ${primaryColor}15` }}>
        <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )}

    <div style={{ position: 'absolute', bottom: 50, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
      <ProgressDots current={number || 0} total={totalSlides} activeColor={primaryColor} inactiveColor="rgba(255,255,255,0.1)" />
    </div>
    <LogoBadge logoUrl={logoUrl} />
  </div>
);

export const NeonTechCTA: React.FC<SlideTemplateProps> = ({ title, body, primaryColor, secondaryColor, logoUrl, totalSlides, profileHandle, ctaLabel }) => (
  <div style={{
    width: 1080, height: 1350, position: 'relative', overflow: 'hidden',
    background: '#09090B',
    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
    padding: '80px',
  }}>
    <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 4px)', pointerEvents: 'none' }} />
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: primaryColor, boxShadow: `0 0 20px ${primaryColor}60` }} />
    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${primaryColor}10 0%, transparent 50%)` }} />

    <h2 style={{
      color: '#FFF', fontSize: 58, fontWeight: 700, textAlign: 'center', lineHeight: 1.1, margin: 0, marginBottom: 30,
      textShadow: `0 0 30px ${primaryColor}30`,
    }}>
      {title}
    </h2>

    {body && <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 22, textAlign: 'center', lineHeight: 1.6, margin: 0, marginBottom: 50 }}>{body.replace(/\\n/g, '\n')}</p>}

    <div style={{
      border: `2px solid ${primaryColor}`, borderRadius: 8, padding: '22px 56px',
      boxShadow: `0 0 30px ${primaryColor}30, inset 0 0 20px ${primaryColor}10`,
    }}>
      <span style={{ color: primaryColor, fontSize: 24, fontWeight: 700, letterSpacing: 2, textShadow: `0 0 10px ${primaryColor}60` }}>{ctaLabel || 'ACESSAR AGORA'}</span>
    </div>

    {profileHandle && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 20, marginTop: 36, fontFamily: "'Space Grotesk', monospace" }}>{profileHandle}</p>}

    <div style={{ position: 'absolute', bottom: 50, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
      <ProgressDots current={totalSlides - 1} total={totalSlides} activeColor={primaryColor} inactiveColor="rgba(255,255,255,0.1)" />
    </div>
    <LogoBadge logoUrl={logoUrl} />
  </div>
);
